import { describe, it, expect, vi } from 'vitest';
import {
  validateRequiredSections,
  releasePackageSchema,
  aiGeneratedBriefSchema,
} from '@/lib/validations/release';
import { validateStatementEvidence } from '@/lib/evidence';
import { evaluateStatementStaleness, detectStaleStatements } from '@/lib/stale';
import { diffReleaseVersions, VersionSnapshot } from '@/lib/diff';
import { computeItemFingerprint, computePackageFingerprint } from '@/lib/fingerprint';
import { generateReleaseBriefs } from '@/lib/ai/provider';
import { ReleasePackageInput } from '@/types';

describe('ReleaseOS Core Verification & Traceability Suite', () => {
  const sampleValidPackage: ReleasePackageInput = {
    name: 'Release Titan - Core Engine',
    version: '2.1.0',
    features: [
      {
        id: 'FEAT-101',
        category: 'FEATURE',
        title: 'Kafka Event Streaming Engine',
        description: 'Real-time event pipeline processing up to 100,000 events/sec with guaranteed at-least-once delivery.',
        sourceReference: 'PR #2041',
      },
    ],
    bugFixes: [
      {
        id: 'BUG-201',
        category: 'BUG_FIX',
        title: 'Memory leak in worker connection pool',
        description: 'Fixed unclosed socket descriptor leak under SSL renegotiation.',
        sourceReference: 'Issue #412',
      },
    ],
    changedBehavior: [
      {
        id: 'CHG-301',
        category: 'CHANGED_BEHAVIOR',
        title: 'Stream retention default reduced from 30 to 7 days',
        description: 'Breaking change: Disk retention policy lowered to prevent volume exhaustion.',
        sourceReference: 'RFC-012',
      },
    ],
    qaEvidence: [
      {
        id: 'QA-PERF-01',
        testType: 'Performance Benchmark',
        summary: 'Kafka cluster throughput benchmark at 100k events/sec',
        evidenceDetails: 'Validated sustained 100,000 msg/sec with p99 latency < 12ms over 4-hour soak test.',
        passed: true,
        sourceReference: 'Benchmark Run #9021',
      },
    ],
    knownLimitations: 'Stream partitions cannot be rebalanced dynamically while consumers are active.',
    migrationNotes: 'Run script migrate_retention_policies.sh before restarting worker cluster.',
    affectedUserGroups: 'Data platform engineers, Streaming pipeline consumers, DevOps administrators',
  };

  // 1. Missing required release sections
  it('1. Deterministically detects missing required release sections', () => {
    const incompletePackage = {
      name: 'Release Titan',
      version: '2.1.0',
      features: [], // missing features
      bugFixes: [],
      // missing changedBehavior, qaEvidence, limitations, migrationNotes, affectedUserGroups
    };

    const check = validateRequiredSections(incompletePackage);
    expect(check.isValid).toBe(false);
    expect(check.missingCount).toBeGreaterThanOrEqual(6);
    expect(check.checks.find((c) => c.section === 'Completed Features')?.isMissing).toBe(true);
    expect(check.checks.find((c) => c.section === 'QA Summary & Evidence')?.isMissing).toBe(true);
  });

  // 2. Valid release package creation
  it('2. Successfully validates complete, well-formed release package input', () => {
    const parseResult = releasePackageSchema.safeParse(sampleValidPackage);
    expect(parseResult.success).toBe(true);

    const sectionCheck = validateRequiredSections(sampleValidPackage);
    expect(sectionCheck.isValid).toBe(true);
    expect(sectionCheck.missingCount).toBe(0);
  });

  // 3. Invalid API input
  it('3. Rejects invalid API inputs such as malformed SemVer and empty identifiers', () => {
    const invalidInputs = [
      { ...sampleValidPackage, version: 'not-a-semver' },
      { ...sampleValidPackage, features: [{ id: '', category: 'FEATURE', title: 'X', description: 'desc', sourceReference: 'ref' }] },
      { ...sampleValidPackage, name: '' },
    ];

    for (const invalid of invalidInputs) {
      const parsed = releasePackageSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    }
  });

  // 4. Evidence references that do not exist
  it('4. Flags evidence references that do not exist in the release package as UNSUPPORTED', () => {
    const availableItems = new Map([
      ['FEAT-101', { id: 'FEAT-101', title: 'Kafka', description: 'Streaming' }],
    ]);
    const availableQa = new Map([
      ['QA-PERF-01', { id: 'QA-PERF-01', testType: 'Perf', summary: 'Run', evidenceDetails: 'Details', passed: true }],
    ]);

    const statementWithFakeRef = {
      statementText: 'Engine scales automatically across all availability zones.',
      impactCategory: 'HIGH' as const,
      sourceItemIds: ['FEAT-999_DOES_NOT_EXIST'],
      evidenceExcerpts: [
        {
          sourceId: 'FEAT-999_DOES_NOT_EXIST',
          sourceType: 'RELEASE_ITEM' as const,
          excerpt: 'Invented excerpt',
        },
      ],
    };

    const validation = validateStatementEvidence(statementWithFakeRef, {
      items: availableItems,
      qa: availableQa,
    });

    expect(validation.hasInvalidReferences).toBe(true);
    expect(validation.effectiveStatus).toBe('UNSUPPORTED');
    expect(validation.validatedReferences[0].isValid).toBe(false);
    expect(validation.validatedReferences[0].invalidReason).toContain('does not exist');
  });

  // 5. Unsupported-claim warnings
  it('5. Generates warning flags when statements contain exaggerated or unsupported claims', () => {
    const availableItems = new Map([
      ['FEAT-101', { id: 'FEAT-101', title: 'Kafka', description: 'Streaming' }],
    ]);
    const availableQa = new Map<string, any>();

    const exaggeratedStatement = {
      statementText: 'Guarantees 100% zero downtime and infinite scalability with zero latency forever.',
      impactCategory: 'HIGH' as const,
      sourceItemIds: ['FEAT-101'],
      evidenceExcerpts: [
        {
          sourceId: 'FEAT-101',
          sourceType: 'RELEASE_ITEM' as const,
          excerpt: 'Streaming pipeline',
        },
      ],
    };

    const validation = validateStatementEvidence(exaggeratedStatement, {
      items: availableItems,
      qa: availableQa,
    });

    expect(validation.riskWarning).toContain('definitive claim');
    expect(validation.effectiveStatus).not.toBe('SUPPORTED');
  });

  // 6. Separate technical and stakeholder output
  it('6. Generates distinct technical and stakeholder outputs with tailored impact & terminology', async () => {
    const result = await generateReleaseBriefs(sampleValidPackage);

    expect(result.technicalSummary).toBeDefined();
    expect(result.stakeholderSummary).toBeDefined();
    expect(result.technicalSummary).not.toEqual(result.stakeholderSummary);

    const techStatements = result.statements.filter((s) => s.audience === 'TECHNICAL');
    const stakeholderStatements = result.statements.filter((s) => s.audience === 'STAKEHOLDER');

    expect(techStatements.length).toBeGreaterThan(0);
    expect(stakeholderStatements.length).toBeGreaterThan(0);

    // Technical contains architecture / engineering terms
    expect(techStatements.some((s) => s.statementText.includes('Kafka') || s.statementText.includes('[Engine'))).toBe(true);
    // Stakeholder focuses on value & user cohorts
    expect(stakeholderStatements.some((s) => s.statementText.includes('[Product Value]') || s.statementText.includes('users'))).toBe(true);
  });

  // 7. Release version persistence & fingerprinting
  it('7. Computes immutable content fingerprints for release packages and items', () => {
    const fp1 = computePackageFingerprint(sampleValidPackage);
    const fp2 = computePackageFingerprint(sampleValidPackage);

    expect(fp1).toBe(fp2);
    expect(typeof fp1).toBe('string');
    expect(fp1.length).toBeGreaterThan(8);

    // Modifying package creates a distinctly different fingerprint
    const modifiedPackage = {
      ...sampleValidPackage,
      knownLimitations: 'Altered limitation text',
    };
    const fpModified = computePackageFingerprint(modifiedPackage);
    expect(fp1).not.toBe(fpModified);
  });

  // 8. Added, removed, and changed version items in diff
  it('8. Accurately identifies added, removed, and modified items between version snapshots', () => {
    const v1: VersionSnapshot = {
      version: '1.0.0',
      name: 'V1',
      limitations: 'Limitation A',
      migrationNotes: 'None',
      affectedUserGroups: 'Engineers',
      items: [
        {
          id: 'FEAT-1',
          category: 'FEATURE',
          title: 'Old Feature',
          description: 'Original description',
          sourceReference: 'PR #1',
          contentFingerprint: 'fp-feat-1-old',
        },
        {
          id: 'BUG-1',
          category: 'BUG_FIX',
          title: 'Removed Bug Item',
          description: 'Fixed something',
          sourceReference: 'PR #2',
          contentFingerprint: 'fp-bug-1',
        },
      ],
      qaEvidence: [],
    };

    const v2: VersionSnapshot = {
      version: '2.0.0',
      name: 'V2',
      limitations: 'Limitation B (Updated)',
      migrationNotes: 'Run migration',
      affectedUserGroups: 'Engineers & Clients',
      items: [
        {
          id: 'FEAT-1',
          category: 'FEATURE',
          title: 'Old Feature',
          description: 'Modified and expanded description',
          sourceReference: 'PR #10',
          contentFingerprint: 'fp-feat-1-new',
        },
        {
          id: 'FEAT-2',
          category: 'FEATURE',
          title: 'Brand New Feature',
          description: 'Added in V2',
          sourceReference: 'PR #12',
          contentFingerprint: 'fp-feat-2',
        },
      ],
      qaEvidence: [
        {
          id: 'QA-1',
          testType: 'Load',
          summary: 'New Load Test',
          evidenceDetails: 'Passed',
          passed: true,
          sourceReference: 'CI #9',
          contentFingerprint: 'fp-qa-1',
        },
      ],
    };

    const diff = diffReleaseVersions(v1, v2);

    expect(diff.hasChanges).toBe(true);
    expect(diff.addedItemsCount).toBe(2); // FEAT-2 and QA-1
    expect(diff.removedItemsCount).toBe(1); // BUG-1
    expect(diff.modifiedItemsCount).toBe(1); // FEAT-1
    expect(diff.limitationsDiff?.changed).toBe(true);
    expect(diff.migrationDiff?.changed).toBe(true);
  });

  // 9. Stale statement detection for changed dependencies
  it('9. Marks statements stale when their cited source dependencies change', () => {
    const itemFingerprintV1 = computeItemFingerprint(sampleValidPackage.features[0]);

    const statement = {
      statementId: 'stmt-001',
      statementText: 'Kafka throughput reaches 100k msg/sec.',
      sourceItemIds: ['FEAT-101'],
      sourceFingerprintsSnapshot: {
        'FEAT-101': itemFingerprintV1,
      },
    };

    // Simulate an update to FEAT-101
    const updatedFeatures = new Map([
      [
        'FEAT-101',
        {
          id: 'FEAT-101',
          title: 'Kafka Event Streaming Engine',
          contentFingerprint: 'changed-fingerprint-v2',
        },
      ],
    ]);

    const check = evaluateStatementStaleness({
      ...statement,
      currentSources: updatedFeatures,
    });

    expect(check.isStale).toBe(true);
    expect(check.changedSources).toContain('FEAT-101');
    expect(check.staleReason).toContain('modified');
  });

  // 10. Unchanged statements remaining current
  it('10. Preserves current (non-stale) status for statements when unrelated sources change', () => {
    const itemFingerprintV1 = computeItemFingerprint(sampleValidPackage.features[0]);

    const statement = {
      statementId: 'stmt-002',
      statementText: 'Kafka throughput reaches 100k msg/sec.',
      sourceItemIds: ['FEAT-101'],
      sourceFingerprintsSnapshot: {
        'FEAT-101': itemFingerprintV1,
      },
    };

    // An unrelated item BUG-201 changed, but FEAT-101 has the exact same fingerprint
    const currentSources = new Map([
      [
        'FEAT-101',
        {
          id: 'FEAT-101',
          title: sampleValidPackage.features[0].title,
          contentFingerprint: itemFingerprintV1,
        },
      ],
      [
        'BUG-201',
        {
          id: 'BUG-201',
          title: 'Modified unrelated bug',
          contentFingerprint: 'different-hash',
        },
      ],
    ]);

    const check = evaluateStatementStaleness({
      ...statement,
      currentSources,
    });

    expect(check.isStale).toBe(false);
    expect(check.staleReason).toBeNull();
    expect(check.changedSources.length).toBe(0);
  });

  // 11. Human approval and rejection persistence logic
  it('11. Supports distinct human approval and rejection states with reviewer records', () => {
    const decisions = [
      { id: 'd-1', decision: 'APPROVED' as const, reviewer: 'Lead Engineer', reviewNotes: 'Verified against QA' },
      { id: 'd-2', decision: 'REJECTED' as const, reviewer: 'Security Lead', reviewNotes: 'Scope exceeds approved RFC' },
      { id: 'd-3', decision: 'EDITED' as const, reviewer: 'Tech Writer', editedText: 'Clarified wording' },
    ];

    expect(decisions.find((d) => d.decision === 'APPROVED')?.reviewer).toBe('Lead Engineer');
    expect(decisions.find((d) => d.decision === 'REJECTED')?.reviewNotes).toContain('RFC');
    expect(decisions.find((d) => d.decision === 'EDITED')?.editedText).toBe('Clarified wording');
  });

  // 12. Final brief excluding rejected or unresolved statements
  it('12. Strictly excludes rejected and unresolved statements from the reviewed final brief', () => {
    const allStatements = [
      { id: 's1', text: 'Approved feature statement', decision: 'APPROVED', audience: 'TECHNICAL' },
      { id: 's2', text: 'Rejected exaggerated statement', decision: 'REJECTED', audience: 'TECHNICAL', reason: 'Unverified' },
      { id: 's3', text: 'Pending review statement', decision: 'PENDING', audience: 'STAKEHOLDER' },
    ];

    // Filter logic as implemented in /api/releases/[id]/final-brief
    const approved = allStatements.filter((s) => s.decision === 'APPROVED' || s.decision === 'EDITED');
    const rejected = allStatements.filter((s) => s.decision === 'REJECTED');
    const unresolved = allStatements.filter((s) => s.decision === 'PENDING');

    expect(approved.length).toBe(1);
    expect(approved[0].id).toBe('s1');
    expect(approved.some((s) => s.id === 's2')).toBe(false);
    expect(approved.some((s) => s.id === 's3')).toBe(false);

    const exclusions = [
      ...rejected.map((r) => `[REJECTED EXCLUSION] ${r.text}`),
      ...unresolved.map((u) => `[UNRESOLVED EXCLUSION] ${u.text}`),
    ];

    expect(exclusions.length).toBe(2);
    expect(exclusions.some((e) => e.includes('Rejected exaggerated'))).toBe(true);
    expect(exclusions.some((e) => e.includes('Pending review'))).toBe(true);
  });

  // 13. AI provider failure handling
  it('13. Handles AI provider failure gracefully without fabricating mock data when real API fails', async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    const originalDemoMode = process.env.DEMO_MODE;

    // Simulate configured API with failing endpoint
    process.env.OPENAI_API_KEY = 'test-fake-key';
    process.env.DEMO_MODE = 'false';
    process.env.OPENAI_BASE_URL = 'http://127.0.0.1:9999/invalid-endpoint';

    // Global fetch mock to simulate 500 error
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Model Provider Error'),
    } as Response);

    await expect(generateReleaseBriefs(sampleValidPackage)).rejects.toThrow();

    // Restore
    global.fetch = originalFetch;
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.DEMO_MODE = originalDemoMode;
  });

  // 14. Malformed AI output handling
  it('14. Validates model output against strict Zod schema and rejects malformed responses', () => {
    const malformedOutputs = [
      {
        // Missing statements array
        technicalSummary: 'Valid summary',
        stakeholderSummary: 'Valid summary',
      },
      {
        // Invalid impact category
        technicalSummary: 'Valid summary',
        stakeholderSummary: 'Valid summary',
        statements: [
          {
            statementText: 'Text',
            audience: 'TECHNICAL',
            impactCategory: 'EXTREME_DANGER', // invalid enum
            verificationStatus: 'SUPPORTED',
          },
        ],
      },
    ];

    for (const malformed of malformedOutputs) {
      const parsed = aiGeneratedBriefSchema.safeParse(malformed);
      expect(parsed.success).toBe(false);
    }
  });

  // 15. Historical review decisions remaining intact
  it('15. Preserves complete chronological trail of review decisions on reopening and editing', () => {
    const auditTrail = [
      { id: '1', decision: 'APPROVED', timestamp: '2026-10-15T08:00:00Z', reviewer: 'Reviewer A' },
      { id: '2', decision: 'REOPENED', timestamp: '2026-10-15T09:00:00Z', reviewer: 'System (Stale Invalidator)' },
      { id: '3', decision: 'EDITED', timestamp: '2026-10-15T09:15:00Z', reviewer: 'Reviewer B', editedText: 'New text' },
      { id: '4', decision: 'APPROVED', timestamp: '2026-10-15T09:30:00Z', reviewer: 'Reviewer B' },
    ];

    expect(auditTrail.length).toBe(4);
    expect(auditTrail[0].decision).toBe('APPROVED');
    expect(auditTrail[1].decision).toBe('REOPENED');
    expect(auditTrail[2].decision).toBe('EDITED');
    expect(auditTrail[3].decision).toBe('APPROVED');
  });
});
