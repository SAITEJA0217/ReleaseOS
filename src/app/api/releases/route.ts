import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { releasePackageSchema, validateRequiredSections } from '@/lib/validations/release';
import { computeItemFingerprint, computeQAFingerprint, computePackageFingerprint } from '@/lib/fingerprint';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const timer = logger.startTimer('listReleases');
  try {
    const releases = await prisma.release.findMany({
      orderBy: { updatedAt: 'desc' },
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
                reviewDecisions: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Compute live dashboard metrics for each release
    const data = releases.map((rel: any) => {
      const latestVersion = rel.versions[0];
      const latestBrief = rel.generatedBriefs[0];

      let pendingReviewCount = 0;
      let unsupportedWarningsCount = 0;
      let staleCount = 0;

      if (latestBrief) {
        for (const stmt of latestBrief.statements) {
          const latestDecision = stmt.reviewDecisions[0]?.decision;
          if (!latestDecision || latestDecision === 'REOPENED') {
            pendingReviewCount++;
          }
          if (stmt.verificationStatus === 'UNSUPPORTED' || stmt.verificationStatus === 'PARTIALLY_SUPPORTED' || stmt.riskWarning) {
            unsupportedWarningsCount++;
          }
          if (stmt.isStale) {
            staleCount++;
          }
        }
      }

      // Check missing sections on latest version package
      const missingCheck = latestVersion
        ? validateRequiredSections({
            name: rel.name,
            version: latestVersion.version,
            features: latestVersion.items.filter((i: any) => i.category === 'FEATURE'),
            bugFixes: latestVersion.items.filter((i: any) => i.category === 'BUG_FIX'),
            changedBehavior: latestVersion.items.filter((i: any) => i.category === 'CHANGED_BEHAVIOR'),
            qaEvidence: latestVersion.qaEvidence,
            knownLimitations: latestVersion.limitations,
            migrationNotes: latestVersion.migrationNotes,
            affectedUserGroups: latestVersion.affectedUserGroups,
          })
        : { isValid: false, missingCount: 8, checks: [] };

      return {
        id: rel.id,
        name: rel.name,
        currentVersion: rel.currentVersion,
        status: rel.status,
        createdAt: rel.createdAt,
        updatedAt: rel.updatedAt,
        versionsCount: rel.versions.length,
        hasBrief: Boolean(latestBrief),
        latestBriefId: latestBrief?.id,
        pendingReviewCount,
        unsupportedWarningsCount,
        staleCount,
        missingSectionsCount: missingCheck.missingCount,
      };
    });

    timer.end('SUCCESS', { count: data.length });
    return NextResponse.json(
      { releases: data },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to retrieve releases', details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const timer = logger.startTimer('createRelease');
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
    const packageFingerprint = computePackageFingerprint(pkg);

    // Save Release, initial ReleaseVersion, items, QA evidence, and AuditEvent in a transaction
    const result: any = await prisma.$transaction(async (tx: any) => {
      const release = await tx.release.create({
        data: {
          name: pkg.name,
          currentVersion: pkg.version,
          status: 'DRAFT',
        },
      });

      const version = await tx.releaseVersion.create({
        data: {
          releaseId: release.id,
          version: pkg.version,
          name: `${pkg.name} (${pkg.version})`,
          limitations: pkg.knownLimitations,
          migrationNotes: pkg.migrationNotes,
          affectedUserGroups: pkg.affectedUserGroups,
          contentFingerprint: packageFingerprint,
        },
      });

      // Prepare items
      const allItems = [
        ...(pkg.features || []).map((f: any, i: number) => ({ ...f, orderIndex: i })),
        ...(pkg.bugFixes || []).map((b: any, i: number) => ({ ...b, orderIndex: i })),
        ...(pkg.changedBehavior || []).map((c: any, i: number) => ({ ...c, orderIndex: i })),
      ];

      for (const item of allItems) {
        await tx.releaseItem.create({
          data: {
            id: item.id,
            versionId: version.id,
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
            versionId: version.id,
            testType: qa.testType,
            summary: qa.summary,
            evidenceDetails: qa.evidenceDetails,
            passed: qa.passed,
            sourceReference: qa.sourceReference,
            contentFingerprint: computeQAFingerprint(qa),
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          releaseId: release.id,
          action: 'RELEASE_CREATED',
          actor: 'Engineer / API',
          details: JSON.stringify({
            version: pkg.version,
            itemsCount: allItems.length,
            qaEvidenceCount: pkg.qaEvidence.length,
          }),
        },
      });

      return { release, version };
    });

    timer.end('SUCCESS', { releaseId: result.release.id, version: pkg.version });
    return NextResponse.json({ release: result.release, version: result.version }, { status: 201 });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to create release package', details: String(err) },
      { status: 500 }
    );
  }
}
