import { VersionComparisonResult, VersionDiffItem, ItemCategory } from '@/types';
import { computeItemFingerprint, computeQAFingerprint } from './fingerprint';

export interface VersionSnapshot {
  version: string;
  name: string;
  limitations: string;
  migrationNotes: string;
  affectedUserGroups: string;
  items: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    sourceReference: string;
    contentFingerprint: string;
  }>;
  qaEvidence: Array<{
    id: string;
    testType: string;
    summary: string;
    evidenceDetails: string;
    passed: boolean;
    sourceReference: string;
    contentFingerprint: string;
  }>;
}

/**
 * Compares two immutable release version snapshots and generates a granular diff.
 */
export function diffReleaseVersions(
  base: VersionSnapshot,
  target: VersionSnapshot
): VersionComparisonResult {
  const diffItems: VersionDiffItem[] = [];

  const baseItemMap = new Map(base.items.map((i) => [i.id, i]));
  const targetItemMap = new Map(target.items.map((i) => [i.id, i]));

  // Check for Added and Modified items in target
  for (const [id, targetItem] of targetItemMap.entries()) {
    const baseItem = baseItemMap.get(id);
    if (!baseItem) {
      diffItems.push({
        type: 'ADDED',
        category: targetItem.category as ItemCategory,
        id: targetItem.id,
        title: targetItem.title,
        newContent: targetItem.description,
        changeExplanation: `New ${targetItem.category.toLowerCase().replace('_', ' ')} introduced in ${target.version}`,
      });
    } else {
      const baseFp = baseItem.contentFingerprint || computeItemFingerprint(baseItem as any);
      const targetFp = targetItem.contentFingerprint || computeItemFingerprint(targetItem as any);

      if (baseFp !== targetFp || baseItem.title !== targetItem.title || baseItem.description !== targetItem.description) {
        diffItems.push({
          type: 'MODIFIED',
          category: targetItem.category as ItemCategory,
          id: targetItem.id,
          title: targetItem.title,
          oldContent: `${baseItem.title}: ${baseItem.description}`,
          newContent: `${targetItem.title}: ${targetItem.description}`,
          changeExplanation: `Modified details or scope in ${target.version}`,
        });
      } else {
        diffItems.push({
          type: 'UNCHANGED',
          category: targetItem.category as ItemCategory,
          id: targetItem.id,
          title: targetItem.title,
        });
      }
    }
  }

  // Check for Removed items (in base but not target)
  for (const [id, baseItem] of baseItemMap.entries()) {
    if (!targetItemMap.has(id)) {
      diffItems.push({
        type: 'REMOVED',
        category: baseItem.category as ItemCategory,
        id: baseItem.id,
        title: baseItem.title,
        oldContent: baseItem.description,
        changeExplanation: `Removed from ${target.version} scope`,
      });
    }
  }

  // Diff QA Evidence
  const baseQaMap = new Map(base.qaEvidence.map((q) => [q.id, q]));
  const targetQaMap = new Map(target.qaEvidence.map((q) => [q.id, q]));

  for (const [id, targetQa] of targetQaMap.entries()) {
    const baseQa = baseQaMap.get(id);
    if (!baseQa) {
      diffItems.push({
        type: 'ADDED',
        category: 'QA_EVIDENCE',
        id: targetQa.id,
        title: `${targetQa.testType}: ${targetQa.summary}`,
        newContent: targetQa.evidenceDetails,
        changeExplanation: `Added QA test record (Passed: ${targetQa.passed})`,
      });
    } else {
      const baseFp = baseQa.contentFingerprint || computeQAFingerprint(baseQa);
      const targetFp = targetQa.contentFingerprint || computeQAFingerprint(targetQa);
      if (baseFp !== targetFp || baseQa.passed !== targetQa.passed) {
        diffItems.push({
          type: 'MODIFIED',
          category: 'QA_EVIDENCE',
          id: targetQa.id,
          title: `${targetQa.testType}: ${targetQa.summary}`,
          oldContent: `Passed: ${baseQa.passed} | ${baseQa.evidenceDetails}`,
          newContent: `Passed: ${targetQa.passed} | ${targetQa.evidenceDetails}`,
          changeExplanation: `QA evidence results updated`,
        });
      }
    }
  }

  for (const [id, baseQa] of baseQaMap.entries()) {
    if (!targetQaMap.has(id)) {
      diffItems.push({
        type: 'REMOVED',
        category: 'QA_EVIDENCE',
        id: baseQa.id,
        title: `${baseQa.testType}: ${baseQa.summary}`,
        oldContent: baseQa.evidenceDetails,
        changeExplanation: `QA record omitted in target version`,
      });
    }
  }

  const addedCount = diffItems.filter((i) => i.type === 'ADDED').length;
  const removedCount = diffItems.filter((i) => i.type === 'REMOVED').length;
  const modifiedCount = diffItems.filter((i) => i.type === 'MODIFIED').length;

  const limitationsChanged = (base.limitations || '').trim() !== (target.limitations || '').trim();
  const migrationChanged = (base.migrationNotes || '').trim() !== (target.migrationNotes || '').trim();
  const affectedUsersChanged = (base.affectedUserGroups || '').trim() !== (target.affectedUserGroups || '').trim();

  return {
    baseVersion: base.version,
    targetVersion: target.version,
    hasChanges: addedCount > 0 || removedCount > 0 || modifiedCount > 0 || limitationsChanged || migrationChanged || affectedUsersChanged,
    addedItemsCount: addedCount,
    removedItemsCount: removedCount,
    modifiedItemsCount: modifiedCount,
    items: diffItems,
    limitationsDiff: {
      old: base.limitations || '',
      new: target.limitations || '',
      changed: limitationsChanged,
    },
    migrationDiff: {
      old: base.migrationNotes || '',
      new: target.migrationNotes || '',
      changed: migrationChanged,
    },
    affectedUsersDiff: {
      old: base.affectedUserGroups || '',
      new: target.affectedUserGroups || '',
      changed: affectedUsersChanged,
    },
  };
}
