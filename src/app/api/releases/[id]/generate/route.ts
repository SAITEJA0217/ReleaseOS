import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateReleaseBriefs } from '@/lib/ai/provider';
import { ReleasePackageInput } from '@/types';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const timer = logger.startTimer('generateBriefsForRelease', id);

  try {
    const release = await prisma.release.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: { items: true, qaEvidence: true },
        },
      },
    });

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    const currentVersionRecord = release.versions.find((v) => v.version === release.currentVersion) || release.versions[0];
    if (!currentVersionRecord) {
      return NextResponse.json({ error: 'No release version snapshot available to generate from' }, { status: 400 });
    }

    // Assemble ReleasePackageInput
    const pkg: ReleasePackageInput = {
      name: release.name,
      version: currentVersionRecord.version,
      features: currentVersionRecord.items
        .filter((i) => i.category === 'FEATURE')
        .map((f) => ({
          id: f.id,
          category: 'FEATURE' as const,
          title: f.title,
          description: f.description,
          sourceReference: f.sourceReference,
        })),
      bugFixes: currentVersionRecord.items
        .filter((i) => i.category === 'BUG_FIX')
        .map((b) => ({
          id: b.id,
          category: 'BUG_FIX' as const,
          title: b.title,
          description: b.description,
          sourceReference: b.sourceReference,
        })),
      changedBehavior: currentVersionRecord.items
        .filter((i) => i.category === 'CHANGED_BEHAVIOR')
        .map((c) => ({
          id: c.id,
          category: 'CHANGED_BEHAVIOR' as const,
          title: c.title,
          description: c.description,
          sourceReference: c.sourceReference,
        })),
      qaEvidence: currentVersionRecord.qaEvidence.map((q) => ({
        id: q.id,
        testType: q.testType,
        summary: q.summary,
        evidenceDetails: q.evidenceDetails,
        passed: q.passed,
        sourceReference: q.sourceReference,
      })),
      knownLimitations: currentVersionRecord.limitations,
      migrationNotes: currentVersionRecord.migrationNotes,
      affectedUserGroups: currentVersionRecord.affectedUserGroups,
    };

    // Run AI Generation with citation grounding
    const generationResult = await generateReleaseBriefs(pkg);

    // Persist in transaction
    const savedBrief = await prisma.$transaction(async (tx) => {
      const brief = await tx.generatedBrief.create({
        data: {
          releaseId: id,
          versionId: currentVersionRecord.id,
          modelUsed: generationResult.modelUsed,
          generationStatus: generationResult.detectedRisks.length > 0 ? 'PARTIAL_WARNINGS' : 'SUCCESS',
          technicalSummary: generationResult.technicalSummary,
          stakeholderSummary: generationResult.stakeholderSummary,
          diagnosticLogs: JSON.stringify(generationResult.diagnosticLogs),
        },
      });

      for (const stmt of generationResult.statements) {
        const createdStmt = await tx.briefStatement.create({
          data: {
            briefId: brief.id,
            statementText: stmt.statementText,
            audience: stmt.audience,
            impactCategory: stmt.impactCategory,
            verificationStatus: stmt.verificationStatus,
            riskWarning: stmt.riskWarning,
            isStale: false,
            sourceItemIds: JSON.stringify(stmt.sourceItemIds),
            sourceFingerprintsSnapshot: JSON.stringify(stmt.sourceFingerprintsSnapshot),
          },
        });

        for (const ref of stmt.evidenceExcerpts) {
          await tx.evidenceReference.create({
            data: {
              statementId: createdStmt.id,
              sourceId: ref.sourceId,
              sourceType: ref.sourceType,
              excerpt: ref.excerpt,
              isValid: ref.isValid,
              invalidReason: ref.invalidReason,
            },
          });
        }
      }

      await tx.release.update({
        where: { id },
        data: { status: 'IN_REVIEW' },
      });

      await tx.auditEvent.create({
        data: {
          releaseId: id,
          action: 'BRIEF_GENERATED',
          actor: generationResult.isDemoMode ? 'Demo Synthesizer' : 'AI Model Pipeline',
          details: JSON.stringify({
            model: generationResult.modelUsed,
            isDemo: generationResult.isDemoMode,
            statementsCount: generationResult.statements.length,
          }),
        },
      });

      return brief;
    });

    timer.end('SUCCESS', { briefId: savedBrief.id });
    return NextResponse.json({
      success: true,
      briefId: savedBrief.id,
      isDemoMode: generationResult.isDemoMode,
      modelUsed: generationResult.modelUsed,
      statementCount: generationResult.statements.length,
    });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      {
        error: 'Failed to generate release briefs. Release data preserved.',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
