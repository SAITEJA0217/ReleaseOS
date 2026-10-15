import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { reviewDecisionSchema } from '@/lib/validations/release';
import { logger } from '@/lib/logger';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; statementId: string } }
) {
  const { id: releaseId, statementId } = params;
  const timer = logger.startTimer('recordReviewDecision', `${releaseId}-${statementId}`);

  try {
    const json = await req.json();
    const parsed = reviewDecisionSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid review payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { decision, reviewer, editedText, reviewNotes } = parsed.data;

    // Verify statement exists and belongs to this release
    const statement = await prisma.briefStatement.findUnique({
      where: { id: statementId },
      include: {
        brief: true,
      },
    });

    if (!statement || statement.brief.releaseId !== releaseId) {
      return NextResponse.json({ error: 'Statement not found for this release' }, { status: 404 });
    }

    const reviewRecord = await prisma.$transaction(async (tx) => {
      // Create new review decision record to preserve historical decisions
      const record = await tx.reviewDecision.create({
        data: {
          statementId,
          decision,
          reviewer,
          editedText: decision === 'EDITED' ? editedText : null,
          reviewNotes: reviewNotes || null,
        },
      });

      // If re-evaluating an edit, statement is no longer marked stale
      if (decision === 'EDITED' || decision === 'APPROVED') {
        await tx.briefStatement.update({
          where: { id: statementId },
          data: {
            isStale: false,
            staleReason: null,
          },
        });
      }

      // Record audit event
      await tx.auditEvent.create({
        data: {
          releaseId,
          action: `STATEMENT_${decision}`,
          actor: reviewer,
          details: JSON.stringify({
            statementId,
            decision,
            hasNotes: Boolean(reviewNotes),
            isEdited: decision === 'EDITED',
          }),
        },
      });

      return record;
    });

    timer.end('SUCCESS', { decision, reviewer });
    return NextResponse.json({ success: true, decision: reviewRecord });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to record review decision', details: String(err) },
      { status: 500 }
    );
  }
}
