import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { detectStaleStatements } from '@/lib/stale';
import { computeItemFingerprint, computeQAFingerprint } from '@/lib/fingerprint';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: releaseId } = params;
  const timer = logger.startTimer('reevaluateStaleness', releaseId);

  try {
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: { items: true, qaEvidence: true },
        },
        generatedBriefs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            statements: true,
          },
        },
      },
    });

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    const latestBrief = release.generatedBriefs[0];
    if (!latestBrief) {
      return NextResponse.json({ error: 'No active brief to evaluate' }, { status: 400 });
    }

    const currentVersion =
      release.versions.find((v: any) => v.id === latestBrief.versionId) ||
      release.versions.find((v: any) => v.version === release.currentVersion) ||
      release.versions[0];

    if (!currentVersion) {
      return NextResponse.json({ error: 'No active version to evaluate against' }, { status: 400 });
    }

    // Map current sources
    const currentSources = new Map<string, { id: string; contentFingerprint: string; title: string }>();
    for (const item of currentVersion.items) {
      currentSources.set(item.id, {
        id: item.id,
        contentFingerprint: item.contentFingerprint || computeItemFingerprint(item as any),
        title: item.title,
      });
    }
    for (const qa of currentVersion.qaEvidence) {
      currentSources.set(qa.id, {
        id: qa.id,
        contentFingerprint: qa.contentFingerprint || computeQAFingerprint(qa),
        title: qa.summary,
      });
    }

    const checks = detectStaleStatements(
      latestBrief.statements.map((s: any) => ({
        id: s.id,
        statementText: s.statementText,
        sourceItemIds: JSON.parse(s.sourceItemIds || '[]'),
        sourceFingerprintsSnapshot: JSON.parse(s.sourceFingerprintsSnapshot || '{}'),
      })),
      currentSources
    );

    let staleCount = 0;
    await prisma.$transaction(async (tx: any) => {
      for (const check of checks) {
        if (check.isStale) {
          staleCount++;
          await tx.briefStatement.update({
            where: { id: check.statementId },
            data: {
              isStale: true,
              staleReason: check.staleReason,
            },
          });
        } else {
          await tx.briefStatement.update({
            where: { id: check.statementId },
            data: {
              isStale: false,
              staleReason: null,
            },
          });
        }
      }

      await tx.auditEvent.create({
        data: {
          releaseId,
          action: 'STALE_EVALUATION_COMPLETED',
          actor: 'System',
          details: JSON.stringify({
            totalEvaluated: checks.length,
            staleDetected: staleCount,
          }),
        },
      });
    });

    timer.end('SUCCESS', { total: checks.length, stale: staleCount });
    return NextResponse.json({
      success: true,
      totalEvaluated: checks.length,
      staleDetected: staleCount,
      results: checks,
    });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to reevaluate staleness', details: String(err) },
      { status: 500 }
    );
  }
}
