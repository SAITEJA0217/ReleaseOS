import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { diffReleaseVersions, VersionSnapshot } from '@/lib/diff';
import { logger } from '@/lib/logger';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: releaseId } = params;
  const { searchParams } = new URL(req.url);
  const baseVersion = searchParams.get('base');
  const targetVersion = searchParams.get('target');

  if (!baseVersion || !targetVersion) {
    return NextResponse.json(
      { error: 'Both "base" and "target" query parameters are required (e.g. ?base=1.0.0&target=1.1.0)' },
      { status: 400 }
    );
  }

  const timer = logger.startTimer('compareVersions', `${releaseId}:${baseVersion}->${targetVersion}`);

  try {
    const versions = await prisma.releaseVersion.findMany({
      where: {
        releaseId,
        version: { in: [baseVersion, targetVersion] },
      },
      include: {
        items: true,
        qaEvidence: true,
      },
    });

    const baseRecord = versions.find((v: any) => v.version === baseVersion);
    const targetRecord = versions.find((v: any) => v.version === targetVersion);

    if (!baseRecord) {
      return NextResponse.json({ error: `Base version "${baseVersion}" not found.` }, { status: 404 });
    }
    if (!targetRecord) {
      return NextResponse.json({ error: `Target version "${targetVersion}" not found.` }, { status: 404 });
    }

    const baseSnapshot: VersionSnapshot = {
      version: baseRecord.version,
      name: baseRecord.name,
      limitations: baseRecord.limitations,
      migrationNotes: baseRecord.migrationNotes,
      affectedUserGroups: baseRecord.affectedUserGroups,
      items: baseRecord.items.map((i: any) => ({
        id: i.id,
        category: i.category,
        title: i.title,
        description: i.description,
        sourceReference: i.sourceReference,
        contentFingerprint: i.contentFingerprint,
      })),
      qaEvidence: baseRecord.qaEvidence.map((q: any) => ({
        id: q.id,
        testType: q.testType,
        summary: q.summary,
        evidenceDetails: q.evidenceDetails,
        passed: q.passed,
        sourceReference: q.sourceReference,
        contentFingerprint: q.contentFingerprint,
      })),
    };

    const targetSnapshot: VersionSnapshot = {
      version: targetRecord.version,
      name: targetRecord.name,
      limitations: targetRecord.limitations,
      migrationNotes: targetRecord.migrationNotes,
      affectedUserGroups: targetRecord.affectedUserGroups,
      items: targetRecord.items.map((i: any) => ({
        id: i.id,
        category: i.category,
        title: i.title,
        description: i.description,
        sourceReference: i.sourceReference,
        contentFingerprint: i.contentFingerprint,
      })),
      qaEvidence: targetRecord.qaEvidence.map((q: any) => ({
        id: q.id,
        testType: q.testType,
        summary: q.summary,
        evidenceDetails: q.evidenceDetails,
        passed: q.passed,
        sourceReference: q.sourceReference,
        contentFingerprint: q.contentFingerprint,
      })),
    };

    const comparison = diffReleaseVersions(baseSnapshot, targetSnapshot);

    timer.end('SUCCESS', {
      added: comparison.addedItemsCount,
      removed: comparison.removedItemsCount,
      modified: comparison.modifiedItemsCount,
    });

    return NextResponse.json({ comparison });
  } catch (err) {
    timer.end('FAILED', {}, err);
    return NextResponse.json(
      { error: 'Failed to compare release versions', details: String(err) },
      { status: 500 }
    );
  }
}
