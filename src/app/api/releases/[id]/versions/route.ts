import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { releasePackageSchema } from '@/lib/validations/release';
import { computeItemFingerprint, computeQAFingerprint, computePackageFingerprint } from '@/lib/fingerprint';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  try {
    const versions = await prisma.releaseVersion.findMany({
      where: { releaseId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        qaEvidence: true,
      },
    });

    return NextResponse.json({ versions });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to fetch release versions', details: String(err) },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const timer = logger.startTimer('saveNewReleaseVersion', id);

  try {
    const json = await req.json();
    const parsed = releasePackageSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid version package data', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const pkg = parsed.data;

    // Check if this version number already exists for this release
    const existing = await prisma.releaseVersion.findUnique({
      where: {
        releaseId_version: {
          releaseId: id,
          version: pkg.version,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Version "${pkg.version}" already exists. Versions are immutable snapshots. Please choose a new version identifier (e.g. 1.4.1).` },
        { status: 409 }
      );
    }

    const packageFingerprint = computePackageFingerprint(pkg);

    const newVersion = await prisma.$transaction(async (tx) => {
      const versionRecord = await tx.releaseVersion.create({
        data: {
          releaseId: id,
          version: pkg.version,
          name: `${pkg.name} (${pkg.version})`,
          limitations: pkg.knownLimitations,
          migrationNotes: pkg.migrationNotes,
          affectedUserGroups: pkg.affectedUserGroups,
          contentFingerprint: packageFingerprint,
        },
      });

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

      // Update release currentVersion pointer
      await tx.release.update({
        where: { id },
        data: {
          currentVersion: pkg.version,
          updatedAt: new Date(),
        },
      });

      await tx.auditEvent.create({
        data: {
          releaseId: id,
          action: 'VERSION_SNAPSHOT_SAVED',
          actor: 'Engineer',
          details: JSON.stringify({
            version: pkg.version,
            fingerprint: packageFingerprint,
            itemCount: allItems.length,
          }),
        },
      });

      return versionRecord;
    });

    timer.end('SUCCESS', { version: pkg.version });
    return NextResponse.json({ success: true, version: newVersion }, { status: 201 });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to create release version snapshot', details: String(err) },
      { status: 500 }
    );
  }
}
