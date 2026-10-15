export interface StaleDetectionInput {
  statementId: string;
  statementText: string;
  sourceItemIds: string[];
  sourceFingerprintsSnapshot: Record<string, string>;
  currentSources: Map<string, { id: string; contentFingerprint: string; title: string }>;
}

export interface StaleCheckResult {
  statementId: string;
  isStale: boolean;
  staleReason?: string | null;
  changedSources: string[];
}

/**
 * Evaluates whether a generated statement has become stale based on changes
 * to its specific cited sources.
 * Statements whose dependencies did not change remain current.
 */
export function evaluateStatementStaleness(input: StaleDetectionInput): StaleCheckResult {
  const { statementId, sourceItemIds, sourceFingerprintsSnapshot, currentSources } = input;
  const changedSources: string[] = [];
  const reasons: string[] = [];

  for (const sourceId of sourceItemIds) {
    const currentItem = currentSources.get(sourceId);

    // Case 1: The source item was deleted from the release package
    if (!currentItem) {
      changedSources.push(sourceId);
      reasons.push(`Source item "${sourceId}" was removed from the release package.`);
      continue;
    }

    // Case 2: The source item exists but its content fingerprint changed
    const originalFingerprint = sourceFingerprintsSnapshot[sourceId];
    if (originalFingerprint && originalFingerprint !== currentItem.contentFingerprint) {
      changedSources.push(sourceId);
      reasons.push(`Source item "${sourceId}" (${currentItem.title}) content or scope was modified.`);
    }
  }

  const isStale = changedSources.length > 0;

  return {
    statementId,
    isStale,
    staleReason: isStale ? reasons.join(' ') : null,
    changedSources,
  };
}

/**
 * Batch evaluates all statements for a given brief against the updated release sources
 */
export function detectStaleStatements(
  statements: Array<{
    id: string;
    statementText: string;
    sourceItemIds: string[];
    sourceFingerprintsSnapshot: Record<string, string>;
  }>,
  currentSources: Map<string, { id: string; contentFingerprint: string; title: string }>
): StaleCheckResult[] {
  return statements.map((stmt) =>
    evaluateStatementStaleness({
      statementId: stmt.id,
      statementText: stmt.statementText,
      sourceItemIds: stmt.sourceItemIds,
      sourceFingerprintsSnapshot: stmt.sourceFingerprintsSnapshot,
      currentSources,
    })
  );
}
