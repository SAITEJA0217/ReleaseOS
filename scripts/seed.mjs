import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function computeHash(content) {
  const normalized = typeof content === 'string' ? content.trim() : JSON.stringify(content);
  return createHash('sha256').update(normalized, 'utf8').digest('hex').substring(0, 16);
}

async function main() {
  console.log('Seeding ReleaseOS database...');

  // Clean existing seed data
  await prisma.reviewDecision.deleteMany();
  await prisma.evidenceReference.deleteMany();
  await prisma.briefStatement.deleteMany();
  await prisma.generatedBrief.deleteMany();
  await prisma.releaseItem.deleteMany();
  await prisma.qAEvidence.deleteMany();
  await prisma.releaseVersion.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.release.deleteMany();

  // Create Release Horizon
  const release = await prisma.release.create({
    data: {
      name: 'Release Horizon - Multi-Currency Payment Engine',
      currentVersion: '1.4.0',
      status: 'IN_REVIEW',
    },
  });

  // Version 1.4.0
  const v140 = await prisma.releaseVersion.create({
    data: {
      releaseId: release.id,
      version: '1.4.0',
      name: 'Release Horizon (1.4.0)',
      limitations: 'Offline settlement processing is limited to batches under 50,000 transactions per run. High-value transactions over $100,000 USD require manual treasury review.',
      migrationNotes: 'Run migration 20261015_add_idempotency_keys.sql. Configure PAYMENT_WEBHOOK_SECRET in production vault. Update clients from deprecated v1/charges to v2/payments.',
      affectedUserGroups: 'Global e-commerce merchants, Checkout consumers, Platform billing admins, Treasury operations',
      contentFingerprint: 'seed-v140-fp-84920',
    },
  });

  const items = [
    {
      id: 'FEAT-101',
      versionId: v140.id,
      category: 'FEATURE',
      title: 'Multi-Currency Real-Time Settlement',
      description: 'Native checkout processing across 14 global fiat currencies with sub-second dynamic FX conversion rate locking.',
      sourceReference: 'PR #1042 / Jira PAY-204',
      contentFingerprint: computeHash('FEAT-101: Native checkout processing across 14 global fiat currencies'),
      orderIndex: 0,
    },
    {
      id: 'FEAT-102',
      versionId: v140.id,
      category: 'FEATURE',
      title: 'Idempotency Key Enforcement',
      description: 'Enforces unique idempotency keys on all POST /v2/payments and refund endpoints to guarantee zero duplicate debit occurrences under network retry storms.',
      sourceReference: 'PR #1055 / RFC-089',
      contentFingerprint: computeHash('FEAT-102: Enforces unique idempotency keys on all POST /v2/payments'),
      orderIndex: 1,
    },
    {
      id: 'BUG-201',
      versionId: v140.id,
      category: 'BUG_FIX',
      title: 'Parallel Double-Refund Race Condition',
      description: 'Fixed race condition where two simultaneous refund API calls within a 5ms window could trigger duplicate bank refund transactions.',
      sourceReference: 'Issue #892 / Hotfix #894',
      contentFingerprint: computeHash('BUG-201: Fixed race condition where two simultaneous refund API calls'),
      orderIndex: 2,
    },
    {
      id: 'CHG-301',
      versionId: v140.id,
      category: 'CHANGED_BEHAVIOR',
      title: 'Deprecation of v1/charges Payload Structure',
      description: 'Breaking change: The legacy v1/charges endpoint has been deprecated. Requests containing old legacy field "charge_token" will return HTTP 400 Bad Request.',
      sourceReference: 'API Spec v2.0 / PR #1066',
      contentFingerprint: computeHash('CHG-301: Breaking change: The legacy v1/charges endpoint has been deprecated'),
      orderIndex: 3,
    },
  ];

  for (const item of items) {
    await prisma.releaseItem.create({ data: item });
  }

  const qaRecords = [
    {
      id: 'QA-LOAD-01',
      versionId: v140.id,
      testType: 'Load & Concurrency',
      summary: '5,000 req/sec stress test on idempotency ledger',
      evidenceDetails: 'Simulated 50,000 concurrent payment requests with 15% deliberate packet drop and immediate retry. Exactly 0 duplicate transactions occurred.',
      passed: true,
      sourceReference: 'Grafana Bench Run #4910',
      contentFingerprint: computeHash('QA-LOAD-01: 5,000 req/sec stress test on idempotency ledger'),
    },
    {
      id: 'QA-E2E-02',
      versionId: v140.id,
      testType: 'End-to-End Multi-Currency',
      summary: 'Automated Playwright checkout flows across EUR, GBP, JPY, CAD, and USD',
      evidenceDetails: 'Verified accurate rounding, FX margin calculations, and ledger balances across all 14 supported currency test fixtures.',
      passed: true,
      sourceReference: 'CI Pipeline #94821',
      contentFingerprint: computeHash('QA-E2E-02: Automated Playwright checkout flows'),
    },
    {
      id: 'QA-SEC-03',
      versionId: v140.id,
      testType: 'Security & Integrity',
      summary: 'Double-refund concurrency attack simulation',
      evidenceDetails: 'Sent 1,000 parallel pairs of refund requests against 500 test charges. Distributed mutex held successfully; zero duplicate refunds.',
      passed: true,
      sourceReference: 'SecOps Audit Suite 2026.4',
      contentFingerprint: computeHash('QA-SEC-03: Double-refund concurrency attack simulation'),
    },
  ];

  for (const qa of qaRecords) {
    await prisma.qAEvidence.create({ data: qa });
  }

  // Create Generated Brief for 1.4.0
  const brief = await prisma.generatedBrief.create({
    data: {
      releaseId: release.id,
      versionId: v140.id,
      modelUsed: 'demo-rule-engine-v1 (Evidence Grounded)',
      generationStatus: 'SUCCESS',
      technicalSummary: 'Release Horizon 1.4.0 completes the core multi-currency architecture with idempotent payment endpoints and resolves critical double-refund concurrency defects. QA validated up to 5,000 req/s.',
      stakeholderSummary: 'Version 1.4.0 unlocks global transactions in 14 currencies for international customers, eliminates refund duplicate risks, and establishes enterprise-grade checkout reliability.',
      diagnosticLogs: JSON.stringify({
        isDemoMode: true,
        timingMs: 142,
        evaluatedSourcesCount: 7,
        verifiedStatementsCount: 4,
      }),
    },
  });

  // Statement 1: Technical - Idempotency
  const s1 = await prisma.briefStatement.create({
    data: {
      briefId: brief.id,
      statementText: '[Architecture] Enforces strict idempotency keys across all payment creation and refund endpoints to guarantee zero duplicate financial transactions under network retries.',
      audience: 'TECHNICAL',
      impactCategory: 'MEDIUM',
      verificationStatus: 'SUPPORTED',
      riskWarning: null,
      sourceItemIds: JSON.stringify(['FEAT-102', 'QA-LOAD-01']),
      sourceFingerprintsSnapshot: JSON.stringify({
        'FEAT-102': items[1].contentFingerprint,
        'QA-LOAD-01': qaRecords[0].contentFingerprint,
      }),
    },
  });

  await prisma.evidenceReference.create({
    data: {
      statementId: s1.id,
      sourceId: 'FEAT-102',
      sourceType: 'RELEASE_ITEM',
      excerpt: 'Enforces unique idempotency keys on all POST /v2/payments and refund endpoints...',
      isValid: true,
    },
  });

  await prisma.evidenceReference.create({
    data: {
      statementId: s1.id,
      sourceId: 'QA-LOAD-01',
      sourceType: 'QA_EVIDENCE',
      excerpt: 'Simulated 50,000 concurrent payment requests with 15% deliberate packet drop. Exactly 0 duplicate transactions occurred.',
      isValid: true,
    },
  });

  // Human reviewer approved statement 1
  await prisma.reviewDecision.create({
    data: {
      statementId: s1.id,
      decision: 'APPROVED',
      reviewer: 'Sarah Chen (Principal Architect)',
      reviewNotes: 'Verified against Grafana load test benchmarks. Idempotency guarantees meet financial compliance.',
    },
  });

  // Statement 2: Technical - Breaking change
  const s2 = await prisma.briefStatement.create({
    data: {
      briefId: brief.id,
      statementText: '[Behavior Change] The legacy v1/charges endpoint is deprecated. Requests containing old legacy field "charge_token" will be rejected with HTTP 400 Bad Request.',
      audience: 'TECHNICAL',
      impactCategory: 'BREAKING',
      verificationStatus: 'SUPPORTED',
      riskWarning: 'Requires client integration updates before deploying customer-facing changes.',
      sourceItemIds: JSON.stringify(['CHG-301']),
      sourceFingerprintsSnapshot: JSON.stringify({
        'CHG-301': items[3].contentFingerprint,
      }),
    },
  });

  await prisma.evidenceReference.create({
    data: {
      statementId: s2.id,
      sourceId: 'CHG-301',
      sourceType: 'RELEASE_ITEM',
      excerpt: 'Breaking change: The legacy v1/charges endpoint has been deprecated.',
      isValid: true,
    },
  });

  // Statement 3: Stakeholder - Multi Currency
  const s3 = await prisma.briefStatement.create({
    data: {
      briefId: brief.id,
      statementText: '[Customer Value] International shoppers can now pay natively in 14 currencies with real-time exchange rates, eliminating foreign transaction surprises at checkout.',
      audience: 'STAKEHOLDER',
      impactCategory: 'HIGH',
      verificationStatus: 'SUPPORTED',
      riskWarning: null,
      sourceItemIds: JSON.stringify(['FEAT-101', 'QA-E2E-02']),
      sourceFingerprintsSnapshot: JSON.stringify({
        'FEAT-101': items[0].contentFingerprint,
        'QA-E2E-02': qaRecords[1].contentFingerprint,
      }),
    },
  });

  await prisma.evidenceReference.create({
    data: {
      statementId: s3.id,
      sourceId: 'FEAT-101',
      sourceType: 'RELEASE_ITEM',
      excerpt: 'Native checkout processing across 14 global fiat currencies with sub-second dynamic FX conversion rate locking.',
      isValid: true,
    },
  });

  await prisma.reviewDecision.create({
    data: {
      statementId: s3.id,
      decision: 'APPROVED',
      reviewer: 'Marcus Vance (VP Product)',
      reviewNotes: 'Aligned with Q4 international merchant expansion launch.',
    },
  });

  // Statement 4: Unverified Exaggerated Claim (Shows warning & inspector capabilities!)
  const s4 = await prisma.briefStatement.create({
    data: {
      briefId: brief.id,
      statementText: '[Platform Claim] System delivers 100% zero downtime and infinite scalability across all cloud regions without configuration limits.',
      audience: 'STAKEHOLDER',
      impactCategory: 'MEDIUM',
      verificationStatus: 'UNSUPPORTED',
      riskWarning: 'Statement contains strong definitive claim ("100% zero downtime") not supported by provided load test thresholds. Known limitation limits batch runs to 50,000.',
      sourceItemIds: JSON.stringify([]),
      sourceFingerprintsSnapshot: JSON.stringify({}),
    },
  });

  // Audit Events
  await prisma.auditEvent.create({
    data: {
      releaseId: release.id,
      action: 'RELEASE_INITIALIZED',
      actor: 'System Seed',
      details: JSON.stringify({ version: '1.4.0', status: 'IN_REVIEW' }),
    },
  });

  // Also create a Version 1.3.0 for instant comparison testing
  const v130 = await prisma.releaseVersion.create({
    data: {
      releaseId: release.id,
      version: '1.3.0',
      name: 'Release Horizon (1.3.0 Baseline)',
      limitations: 'Single-currency USD only. Double-refund race condition present.',
      migrationNotes: 'Initial v1 setup.',
      affectedUserGroups: 'Domestic US customers only',
      contentFingerprint: 'seed-v130-fp-10291',
    },
  });

  await prisma.releaseItem.create({
    data: {
      id: 'FEAT-100',
      versionId: v130.id,
      category: 'FEATURE',
      title: 'Initial Single-Currency Payments',
      description: 'Basic USD Stripe-compatible checkout processing.',
      sourceReference: 'PR #801',
      contentFingerprint: computeHash('FEAT-100: Basic USD Stripe-compatible checkout processing'),
      orderIndex: 0,
    },
  });

  console.log('Seed completed successfully. Sample Release Horizon (1.4.0 and 1.3.0) created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
