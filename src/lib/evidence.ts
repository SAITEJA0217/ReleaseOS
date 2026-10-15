import { VerificationStatus, ImpactCategory, EvidenceSourceType } from '@/types';

export interface ValidatedEvidenceReference {
  sourceId: string;
  sourceType: EvidenceSourceType;
  excerpt: string;
  isValid: boolean;
  invalidReason?: string | null;
}

export interface StatementValidationResult {
  effectiveStatus: VerificationStatus;
  riskWarning?: string | null;
  validatedReferences: ValidatedEvidenceReference[];
  hasInvalidReferences: boolean;
}

const EXAGGERATED_CLAIM_REGEX = /(?:zero\s+(?:downtime|bugs|latency|risk)|100%\s+(?:safe|secure|coverage|reliable)|infinite\s+scalability|flawless|unbreakable|instantaneous|guaranteed)/i;

/**
 * Validates evidence citations against actual stored release items and QA records.
 * Deterministically enforces truthfulness: no invented citations or ungrounded claims.
 */
export function validateStatementEvidence(
  statement: {
    statementText: string;
    impactCategory: ImpactCategory;
    reportedStatus?: VerificationStatus;
    reportedRiskWarning?: string | null;
    sourceItemIds: string[];
    evidenceExcerpts?: Array<{ sourceId: string; sourceType: EvidenceSourceType; excerpt: string }>;
  },
  availableSources: {
    items: Map<string, { id: string; title: string; description: string }>;
    qa: Map<string, { id: string; testType: string; summary: string; evidenceDetails: string; passed: boolean }>;
  }
): StatementValidationResult {
  const validatedReferences: ValidatedEvidenceReference[] = [];
  let hasInvalidReferences = false;
  const warnings: string[] = [];

  // 1. Check reported risk warning from model if any
  if (statement.reportedRiskWarning) {
    warnings.push(statement.reportedRiskWarning);
  }

  // 2. Scan for exaggerated claims exceeding reasonable engineering claims
  if (EXAGGERATED_CLAIM_REGEX.test(statement.statementText)) {
    warnings.push('Statement contains strong definitive claim ("100% secure", "zero downtime") that requires rigorous mathematical or empirical verification.');
  }

  // 3. Process and validate all cited references
  const declaredSources = new Set(statement.sourceItemIds);
  const excerpts = statement.evidenceExcerpts || [];

  if (declaredSources.size === 0 && excerpts.length === 0) {
    return {
      effectiveStatus: 'UNSUPPORTED',
      riskWarning: 'No source evidence or QA references cited for this claim.',
      validatedReferences: [],
      hasInvalidReferences: true,
    };
  }

  // Check all excerpts
  for (const ref of excerpts) {
    const isItem = ref.sourceType === 'RELEASE_ITEM';
    const exists = isItem
      ? availableSources.items.has(ref.sourceId)
      : availableSources.qa.has(ref.sourceId);

    if (!exists) {
      hasInvalidReferences = true;
      validatedReferences.push({
        sourceId: ref.sourceId,
        sourceType: ref.sourceType,
        excerpt: ref.excerpt,
        isValid: false,
        invalidReason: `Cited source ID "${ref.sourceId}" does not exist in this release package.`,
      });
      warnings.push(`Statement references non-existent ${isItem ? 'release item' : 'QA evidence'} (${ref.sourceId}).`);
    } else {
      // If it points to QA, check if the QA test passed
      if (!isItem) {
        const qaRecord = availableSources.qa.get(ref.sourceId);
        if (qaRecord && !qaRecord.passed) {
          warnings.push(`Associated QA test ${ref.sourceId} (${qaRecord.testType}) did not pass.`);
        }
      }

      validatedReferences.push({
        sourceId: ref.sourceId,
        sourceType: ref.sourceType,
        excerpt: ref.excerpt,
        isValid: true,
      });
    }
  }

  // Check declared IDs that didn't have explicit excerpts
  for (const id of declaredSources) {
    if (!validatedReferences.some((r) => r.sourceId === id)) {
      const existsInItems = availableSources.items.has(id);
      const existsInQa = availableSources.qa.has(id);

      if (!existsInItems && !existsInQa) {
        hasInvalidReferences = true;
        validatedReferences.push({
          sourceId: id,
          sourceType: 'RELEASE_ITEM',
          excerpt: '(Unspecified reference)',
          isValid: false,
          invalidReason: `Referenced source "${id}" not found in release package.`,
        });
        warnings.push(`Cited source ID "${id}" does not exist.`);
      } else {
        const isItem = existsInItems;
        const excerpt = isItem
          ? availableSources.items.get(id)?.description || ''
          : availableSources.qa.get(id)?.summary || '';

        if (!isItem) {
          const qaRecord = availableSources.qa.get(id);
          if (qaRecord && !qaRecord.passed) {
            warnings.push(`Associated QA test ${id} failed.`);
          }
        }

        validatedReferences.push({
          sourceId: id,
          sourceType: isItem ? 'RELEASE_ITEM' : 'QA_EVIDENCE',
          excerpt: excerpt.substring(0, 150),
          isValid: true,
        });
      }
    }
  }

  // Determine effective verification status based on deterministic checks
  let effectiveStatus: VerificationStatus = statement.reportedStatus || 'SUPPORTED';

  if (hasInvalidReferences) {
    effectiveStatus = 'UNSUPPORTED';
  } else if (warnings.length > 0) {
    if (warnings.some((w) => w.includes('did not pass') || w.includes('failed'))) {
      effectiveStatus = 'UNSUPPORTED';
    } else if (effectiveStatus === 'SUPPORTED') {
      effectiveStatus = 'PARTIALLY_SUPPORTED';
    }
  } else if (validatedReferences.length === 0) {
    effectiveStatus = 'UNSUPPORTED';
  }

  return {
    effectiveStatus,
    riskWarning: warnings.length > 0 ? warnings.join(' | ') : null,
    validatedReferences,
    hasInvalidReferences,
  };
}
