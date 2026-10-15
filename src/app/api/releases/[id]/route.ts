import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { releasePackageSchema, validateRequiredSections } from '@/lib/validations/release';
import { computeItemFingerprint, computeQAFingerprint, computePackageFingerprint } from '@/lib/fingerprint';
import { detectStaleStatements } from '@/lib/stale';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const timer = logger.startTimer('getRelease', id);

  try {
    const release = await prisma.release.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: { orderBy: { orderIndex: 'asc' } },
            qaEvidence: true,
          },
        },
        generatedBriefs: {
          orderBy: { createdAt: 'desc' },
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
        auditEvents: {
          orderBy: { timestamp: 'desc' },
          take: 20,
        },
      },
    });

    if (!release) {
      timer.end('WARNING', { reason: 'Not found' });
      return NextResponse.json({ error: 'Release not found' }, { status: 404 });
    }

    const currentVersionRecord = release.versions.find((v) => v.version === release.currentVersion) || release.versions[0];
    const latestBrief = release.generatedBriefs[0];

    // Check missing sections
    const missingCheck = currentVersionRecord
      ? validateRequiredSections({
          name: release.name,
          version: currentVersionRecord.version,
          features: currentVersionRecord.items.filter((i) => i.category === 'FEATURE'),
          bugFixes: currentVersionRecord.items.filter((i) => i.category === 'BUG_FIX'),
          changedBehavior: currentVersionRecord.items.filter((i) => i.category === 'CHANGED_BEHAVIOR'),
          qaEvidence: currentVersionRecord.qaEvidence,
          knownLimitations: currentVersionRecord.limitations,
          migrationNotes: currentVersionRecord.migrationNotes,
          affectedUserGroups: currentVersionRecord.affectedUserGroups,
        })
      : { isValid: false, missingCount: 8, checks: [] };

    // Format statements for clean UI consumption
    const formattedBrief = latestBrief
      ? {
          id: latestBrief.id,
          modelUsed: latestBrief.modelUsed,
          generationStatus: latestBrief.generationStatus,
          technicalSummary: latestBrief.technicalSummary,
          stakeholderSummary: latestBrief.stakeholderSummary,
          diagnosticLogs: JSON.parse(latestBrief.diagnosticLogs || '{}'),
          createdAt: latestBrief.createdAt,
          statements: latestBrief.statements.map((stmt) => {
            const latestDecision = stmt.reviewDecisions[0];
            const currentStatus = latestDecision
              ? (latestDecision.decision as 'APPROVED' | 'REJECTED' | 'EDITED' | 'REOPENED')
              : 'PENDING';

            const effectiveText = (latestDecision?.decision === 'EDITED' && latestDecision.editedText)
              ? latestDecision.editedText
              : stmt.statementText;

            // Augment evidence references with actual current item data if available
            const itemMap = new Map(currentVersionRecord?.items.map((i) => [i.id, i]) || []);
            const qaMap = new Map(currentVersionRecord?.qaEvidence.map((q) => [q.id, q]) || []);

            const enrichedReferences = stmt.evidenceReferences.map((ref) => {
              const item = itemMap.get(ref.sourceId);
              const qa = qaMap.get(ref.sourceId);

              return {
                id: ref.id,
                sourceId: ref.sourceId,
                sourceType: ref.sourceType,
                excerpt: ref.excerpt,
                isValid: ref.isValid,
                invalidReason: ref.invalidReason,
                sourceItem: item
                  ? {
                      id: item.id,
                      title: item.title,
                      description: item.description,
                      category: item.category,
                      sourceReference: item.sourceReference,
                    }
                  : qa
                  ? {
                      id: qa.id,
                      title: `${qa.testType}: ${qa.summary}`,
                      description: qa.evidenceDetails,
                      sourceReference: qa.sourceReference,
                    }
                  : null,
              };
            });

            return {
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
              currentStatus,
              evidenceReferences: enrichedReferences,
              reviewDecisions: stmt.reviewDecisions.map((d) => ({
                id: d.id,
                decision: d.decision,
                reviewer: d.reviewer,
                editedText: d.editedText,
                reviewNotes: d.reviewNotes,
                createdAt: d.createdAt.toISOString(),
              })),
            };
          }),
        }
      : null;

    timer.end('SUCCESS');
    return NextResponse.json({
      release: {
        id: release.id,
        name: release.name,
        currentVersion: release.currentVersion,
        status: release.status,
        createdAt: release.createdAt,
        updatedAt: release.updatedAt,
        missingSections: missingCheck,
        currentVersionDetails: currentVersionRecord
          ? {
              id: currentVersionRecord.id,
              version: currentVersionRecord.version,
              name: currentVersionRecord.name,
              limitations: currentVersionRecord.limitations,
              migrationNotes: currentVersionRecord.migrationNotes,
              affectedUserGroups: currentVersionRecord.affectedUserGroups,
              contentFingerprint: currentVersionRecord.contentFingerprint,
              createdAt: currentVersionRecord.createdAt,
              features: currentVersionRecord.items.filter((i) => i.category === 'FEATURE'),
              bugFixes: currentVersionRecord.items.filter((i) => i.category === 'BUG_FIX'),
              changedBehavior: currentVersionRecord.items.filter((i) => i.category === 'CHANGED_BEHAVIOR'),
              qaEvidence: currentVersionRecord.qaEvidence,
            }
          : null,
        versionsList: release.versions.map((v) => ({
          id: v.id,
          version: v.version,
          name: v.name,
          createdAt: v.createdAt,
          itemsCount: v.items.length,
          qaCount: v.qaEvidence.length,
        })),
        brief: formattedBrief,
        auditEvents: release.auditEvents.map((a) => ({
          id: a.id,
          action: a.action,
          actor: a.actor,
          details: JSON.parse(a.details || '{}'),
          timestamp: a.timestamp,
        })),
      },
    });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to fetch release details', details: String(err) },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const timer = logger.startTimer('updateRelease', id);

  try {
    const json = await req.json();
    const parsed = releasePackageSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid release package format', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const pkg = parsed.data;
    const release = await prisma.release.findUnique({
      where: { id },
      include: {
        versions: {
          where: { version: pkg.version },
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

    const packageFingerprint = computePackageFingerprint(pkg);

    await prisma.$transaction(async (tx) => {
      await tx.release.update({
        where: { id },
        data: {
          name: pkg.name,
          currentVersion: pkg.version,
          updatedAt: new Date(),
        },
      });

      // Find or update the specific version record
      let versionRecord = release.versions[0];
      if (!versionRecord) {
        versionRecord = await tx.releaseVersion.create({
          data: {
            releaseId: id,
            version: pkg.version,
            name: `${pkg.name} (${pkg.version})`,
            limitations: pkg.knownLimitations,
            migrationNotes: pkg.migrationNotes,
            affectedUserGroups: pkg.affectedUserGroups,
            contentFingerprint: packageFingerprint,
          },
          include: { items: true, qaEvidence: true },
        });
      } else {
        await tx.releaseVersion.update({
          where: { id: versionRecord.id },
          data: {
            limitations: pkg.knownLimitations,
            migrationNotes: pkg.migrationNotes,
            affectedUserGroups: pkg.affectedUserGroups,
            contentFingerprint: packageFingerprint,
          },
        });
      }

      // Upsert/Replace items for this version
      await tx.releaseItem.deleteMany({ where: { versionId: versionRecord.id } });
      await tx.qAEvidence.deleteMany({ where: { versionId: versionRecord.id } });

      const allItems = [
        ...(pkg.features || []).map((f, i) => ({ ...f, orderIndex: i })),
        ...(pkg.bugFixes || []).map((b, i) => ({ ...b, orderIndex: i })),
        ...(pkg.changedBehavior || []).map((c, i) => ({ ...c, orderIndex: i })),
      ];

      for (const item of allItems) {
        await tx.releaseItem.create({
          data: {
            id: item.id,
            versionId: versionRecord.id,
            category: item.category,
            title: item.title,
            description: item.description,
            sourceReference: item.sourceReference,
            contentFingerprint: computeItemFingerprint(item),
            orderIndex: item.orderIndex,
          },
        });
      }

      for (const qa of pkg.qaEvidence || []) {
        await tx.qAEvidence.create({
          data: {
            id: qa.id,
            versionId: versionRecord.id,
            testType: qa.testType,
            summary: qa.summary,
            evidenceDetails: qa.evidenceDetails,
            passed: qa.passed,
            sourceReference: qa.sourceReference,
            contentFingerprint: computeQAFingerprint(qa),
          },
        });
      }

      // STALE STATEMENT DETECTION: Check if any existing statements now depend on modified or deleted sources
      const latestBrief = release.generatedBriefs[0];
      if (latestBrief && latestBrief.statements.length > 0) {
        const currentSources = new Map<string, { id: string; contentFingerprint: string; title: string }>();
        for (const item of allItems) {
          currentSources.set(item.id, {
            id: item.id,
            contentFingerprint: computeItemFingerprint(item),
            title: item.title,
          });
        }
        for (const qa of pkg.qaEvidence || []) {
          currentSources.set(qa.id, {
            id: qa.id,
            contentFingerprint: computeQAFingerprint(qa),
            title: qa.summary,
          });
        }

        const staleChecks = detectStaleStatements(
          latestBrief.statements.map((s) => ({
            id: s.id,
            statementText: s.statementText,
            sourceItemIds: JSON.parse(s.sourceItemIds || '[]'),
            sourceFingerprintsSnapshot: JSON.parse(s.sourceFingerprintsSnapshot || '{}'),
          })),
          currentSources
        );

        for (const check of staleChecks) {
          if (check.isStale) {
            await tx.briefStatement.update({
              where: { id: check.statementId },
              data: {
                isStale: true,
                staleReason: check.staleReason,
              },
            });

            // Reopen any approved decision on stale statement
            await tx.reviewDecision.create({
              data: {
                statementId: check.statementId,
                decision: 'REOPENED',
                reviewer: 'System (Stale Invalidator)',
                reviewNotes: `Automatically reopened for review because dependent sources were updated: ${check.staleReason}`,
              },
            });
          }
        }
      }

      await tx.auditEvent.create({
        data: {
          releaseId: id,
          action: 'RELEASE_UPDATED',
          actor: 'Engineer / Editor',
          details: JSON.stringify({
            version: pkg.version,
            updatedItemsCount: allItems.length,
          }),
        },
      });
    });

    timer.end('SUCCESS');
    return NextResponse.json({ success: true, message: 'Release package successfully updated' });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to update release package', details: String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    await prisma.release.delete({ where: { id } });
    return NextResponse.json({ success: true, message: 'Release deleted' });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to delete release', details: String(err) },
      { status: 500 }
    );
  }
}
