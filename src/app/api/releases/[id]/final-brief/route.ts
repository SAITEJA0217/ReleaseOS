import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { FinalReviewedBrief } from '@/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: releaseId } = params;
  const timer = logger.startTimer('generateReviewedFinalBrief', releaseId);

  try {
    const release = await prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            qaEvidence: true,
          },
        },
        generatedBriefs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            statements: {
              include: {
                evidenceReferences: true,
                reviewDecisions: {
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    if (!release) {
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    const currentVersionRecord = release.versions.find((v: any) => v.version === release.currentVersion) || release.versions[0];
    const latestBrief = release.generatedBriefs[0];

    if (!latestBrief || !currentVersionRecord) {
      return NextResponse.json({ error: 'No generated brief exists for this release' }, { status: 400 });
    }

    // Partition statements based on EXPLICIT human review decisions
    const approvedStatements: any[] = [];
    const rejectedStatements: any[] = [];
    const unresolvedStatements: any[] = [];
    const reviewersSet = new Set<string>();

    for (const stmt of (latestBrief.statements as any[])) {
      const latestDecision = stmt.reviewDecisions[0];

      if (latestDecision?.decision === 'APPROVED' || latestDecision?.decision === 'EDITED') {
        reviewersSet.add(latestDecision.reviewer);
        const effectiveText = (latestDecision.decision === 'EDITED' && latestDecision.editedText)
          ? latestDecision.editedText
          : stmt.statementText;

        approvedStatements.push({
          id: stmt.id,
          statementText: stmt.statementText,
          effectiveText,
          audience: stmt.audience,
          impactCategory: stmt.impactCategory,
          verificationStatus: stmt.verificationStatus,
          riskWarning: stmt.riskWarning,
          isStale: stmt.isStale,
          staleReason: stmt.staleReason,
          sourceItemIds: JSON.parse(stmt.sourceItemIds || '[]'),
          currentStatus: latestDecision.decision,
          evidenceReferences: stmt.evidenceReferences.map((r: any) => ({
            id: r.id,
            sourceId: r.sourceId,
            sourceType: r.sourceType,
            excerpt: r.excerpt,
            isValid: r.isValid,
            invalidReason: r.invalidReason,
          })),
        });
      } else if (latestDecision?.decision === 'REJECTED') {
        reviewersSet.add(latestDecision.reviewer);
        rejectedStatements.push({
          id: stmt.id,
          text: stmt.statementText,
          reason: latestDecision.reviewNotes || 'Explicitly rejected by human reviewer',
        });
      } else {
        unresolvedStatements.push({
          id: stmt.id,
          text: stmt.statementText,
          status: 'PENDING_HUMAN_REVIEW',
        });
      }
    }

    const exclusionsAndUnresolved = [
      ...rejectedStatements.map((r: any) => `[REJECTED EXCLUSION] "${r.text}" — Reason: ${r.reason}`),
      ...unresolvedStatements.map((u: any) => `[UNRESOLVED EXCLUSION] "${u.text}" — Excluded because human review has not been completed.`),
    ];

    const techApproved = approvedStatements.filter((s: any) => s.audience === 'TECHNICAL');
    const stakeholderApproved = approvedStatements.filter((s: any) => s.audience === 'STAKEHOLDER');

    const reviewStatus: 'FULLY_REVIEWED' | 'PARTIALLY_REVIEWED' | 'REJECTED' =
      unresolvedStatements.length === 0 && approvedStatements.length > 0
        ? 'FULLY_REVIEWED'
        : approvedStatements.length === 0
        ? 'REJECTED'
        : 'PARTIALLY_REVIEWED';

    const finalBrief: FinalReviewedBrief = {
      releaseName: release.name,
      version: currentVersionRecord.version,
      generatedAt: latestBrief.createdAt.toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewStatus,
      totalApprovedStatements: approvedStatements.length,
      totalRejectedStatements: rejectedStatements.length,
      totalUnresolvedStatements: unresolvedStatements.length,
      technicalBrief: {
        summary: latestBrief.technicalSummary,
        approvedStatements: techApproved,
      },
      stakeholderBrief: {
        summary: latestBrief.stakeholderSummary,
        approvedStatements: stakeholderApproved,
      },
      qaSummary: currentVersionRecord.qaEvidence.map((q: any) => ({
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
      exclusionsAndUnresolved,
      reviewers: Array.from(reviewersSet),
      disclaimer: 'DISCLAIMER: This document contains only statements explicitly reviewed and approved by human engineering reviewers. ReleaseOS assists in synthesis and evidence traceability; it does NOT deploy code or authorize production rollouts automatically.',
    };

    // Update release status to REVIEWED if fully reviewed
    if (reviewStatus === 'FULLY_REVIEWED' && release.status !== 'REVIEWED') {
      await prisma.release.update({
        where: { id: releaseId },
        data: { status: 'REVIEWED' },
      });
    }

    timer.end('SUCCESS', { approved: approvedStatements.length, excluded: exclusionsAndUnresolved.length });
    return NextResponse.json({ finalBrief });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to compile reviewed final brief', details: String(err) },
      { status: 500 }
    );
  }
}
