import { createHash } from 'crypto';
import { ReleaseItemPayload, QAEvidencePayload, ReleasePackageInput } from '@/types';

/**
 * Deterministically computes a SHA-256 hash string for an arbitrary object or string
 */
export function computeHash(content: unknown): string {
  const normalized = typeof content === 'string' 
    ? content.trim() 
    : JSON.stringify(content, Object.keys(content as object || {}).sort());
  return createHash('sha256').update(normalized, 'utf8').digest('hex').substring(0, 16);
}

/**
 * Computes content fingerprint for an individual release item
 */
export function computeItemFingerprint(item: Pick<ReleaseItemPayload, 'title' | 'description' | 'category' | 'sourceReference'>): string {
  return computeHash({
    category: item.category,
    title: item.title.trim(),
    description: item.description.trim(),
    sourceReference: item.sourceReference.trim(),
  });
}

/**
 * Computes fingerprint for QA evidence item
 */
export function computeQAFingerprint(qa: Pick<QAEvidencePayload, 'testType' | 'summary' | 'evidenceDetails' | 'passed' | 'sourceReference'>): string {
  return computeHash({
    testType: qa.testType.trim(),
    summary: qa.summary.trim(),
    evidenceDetails: qa.evidenceDetails.trim(),
    passed: qa.passed,
    sourceReference: qa.sourceReference.trim(),
  });
}

/**
 * Computes overall package fingerprint for immutable release version comparison
 */
export function computePackageFingerprint(pkg: ReleasePackageInput): string {
  const itemFingerprints = [
    ...(pkg.features || []).map(computeItemFingerprint),
    ...(pkg.bugFixes || []).map(computeItemFingerprint),
    ...(pkg.changedBehavior || []).map(computeItemFingerprint),
  ].sort();

  const qaFingerprints = (pkg.qaEvidence || []).map(computeQAFingerprint).sort();

  return computeHash({
    name: pkg.name.trim(),
    version: pkg.version.trim(),
    items: itemFingerprints,
    qa: qaFingerprints,
    limitations: (pkg.knownLimitations || '').trim(),
    migration: (pkg.migrationNotes || '').trim(),
    affectedUsers: (pkg.affectedUserGroups || '').trim(),
  });
}
