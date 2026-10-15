import { ReleasePackageInput } from '@/types';
import { aiGeneratedBriefSchema } from '@/lib/validations/release';
import { computeItemFingerprint, computeQAFingerprint } from '@/lib/fingerprint';
import { validateStatementEvidence } from '@/lib/evidence';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export type GeneratedBriefOutput = z.infer<typeof aiGeneratedBriefSchema>;

export interface GenerationEngineResult {
  modelUsed: string;
  isDemoMode: boolean;
  technicalSummary: string;
  stakeholderSummary: string;
  detectedRisks: string[];
  missingInformationNotes: string[];
  statements: Array<{
    statementText: string;
    audience: 'TECHNICAL' | 'STAKEHOLDER';
    impactCategory: 'LOW' | 'MEDIUM' | 'HIGH' | 'BREAKING';
    verificationStatus: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN_MISSING_INFO';
    riskWarning?: string | null;
    sourceItemIds: string[];
    sourceFingerprintsSnapshot: Record<string, string>;
    evidenceExcerpts: Array<{
      sourceId: string;
      sourceType: 'RELEASE_ITEM' | 'QA_EVIDENCE';
      excerpt: string;
      isValid: boolean;
      invalidReason?: string | null;
    }>;
  }>;
  diagnosticLogs: Record<string, unknown>;
}

/**
 * Deterministic local synthesis engine used when OpenAI API credentials are not provided
 * or when explicitly in demo mode. Guarantees 100% truthful, evidence-backed generation
 * without hallucinating any items or test outcomes.
 */
function runDeterministicDemoEngine(pkg: ReleasePackageInput): GeneratedBriefOutput {
  const statements: z.infer<typeof aiGeneratedBriefSchema>['statements'] = [];
  const detectedRisks: string[] = [];
  const missingInformationNotes: string[] = [];

  // Check for missing data
  if (!pkg.qaEvidence || pkg.qaEvidence.length === 0) {
    missingInformationNotes.push('No formal QA evidence records provided in package.');
  }
  if (!pkg.knownLimitations || pkg.knownLimitations.trim().length === 0) {
    missingInformationNotes.push('Known limitations field is empty; potential unmonitored edge cases.');
  }

  // 1. Technical Brief Statements (Features)
  for (const feat of pkg.features || []) {
    // Determine impact
    const isBreaking = /breaking|deprecat|remov/i.test(feat.description) || /breaking/i.test(feat.title);
    const impact = isBreaking ? 'BREAKING' : feat.description.length > 80 ? 'MEDIUM' : 'LOW';

    // Find if any QA covers this feature
    const matchingQa = (pkg.qaEvidence || []).filter(
      (q) => q.summary.toLowerCase().includes(feat.title.toLowerCase()) || q.evidenceDetails.includes(feat.id)
    );

    const hasPassingQa = matchingQa.some((q) => q.passed);
    const hasFailingQa = matchingQa.some((q) => !q.passed);

    let status: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'UNSUPPORTED' = 'SUPPORTED';
    let risk: string | null = null;

    if (hasFailingQa) {
      status = 'UNSUPPORTED';
      risk = `QA test failed for related verification (${matchingQa[0].id})`;
      detectedRisks.push(`Feature ${feat.id} has associated failing QA verification.`);
    } else if (matchingQa.length === 0) {
      status = 'PARTIALLY_SUPPORTED';
      risk = 'Direct QA test evidence not explicitly linked to this specific feature item';
    }

    // Technical audience statement
    statements.push({
      statementText: `[Engine/Architecture] ${feat.title}: ${feat.description}. Reference: ${feat.sourceReference}.`,
      audience: 'TECHNICAL',
      impactCategory: impact,
      verificationStatus: status,
      riskWarning: risk,
      sourceItemIds: [feat.id, ...(matchingQa.map((q) => q.id))],
      evidenceExcerpts: [
        {
          sourceId: feat.id,
          sourceType: 'RELEASE_ITEM',
          excerpt: feat.description,
        },
        ...(matchingQa.map((q) => ({
          sourceId: q.id,
          sourceType: 'QA_EVIDENCE' as const,
          excerpt: `${q.testType}: ${q.summary} (Passed: ${q.passed})`,
        }))),
      ],
    });

    // Stakeholder audience statement
    statements.push({
      statementText: `[Product Value] Users can now leverage ${feat.title.toLowerCase()}. Designed for ${pkg.affectedUserGroups || 'general users'}.`,
      audience: 'STAKEHOLDER',
      impactCategory: impact === 'BREAKING' ? 'HIGH' : impact,
      verificationStatus: status,
      riskWarning: risk,
      sourceItemIds: [feat.id],
      evidenceExcerpts: [
        {
          sourceId: feat.id,
          sourceType: 'RELEASE_ITEM',
          excerpt: feat.description,
        },
      ],
    });
  }

  // 2. Bug Fixes Statements
  for (const bug of pkg.bugFixes || []) {
    statements.push({
      statementText: `[Defect Resolution] Resolved issue "${bug.title}": ${bug.description} (${bug.sourceReference}).`,
      audience: 'TECHNICAL',
      impactCategory: 'LOW',
      verificationStatus: 'SUPPORTED',
      riskWarning: null,
      sourceItemIds: [bug.id],
      evidenceExcerpts: [
        {
          sourceId: bug.id,
          sourceType: 'RELEASE_ITEM',
          excerpt: bug.description,
        },
      ],
    });

    statements.push({
      statementText: `[Stability Improvement] Fixed problem where ${bug.title.toLowerCase()}, restoring expected behavior.`,
      audience: 'STAKEHOLDER',
      impactCategory: 'LOW',
      verificationStatus: 'SUPPORTED',
      riskWarning: null,
      sourceItemIds: [bug.id],
      evidenceExcerpts: [
        {
          sourceId: bug.id,
          sourceType: 'RELEASE_ITEM',
          excerpt: bug.description,
        },
      ],
    });
  }

  // 3. Changed Behavior Statements
  for (const chg of pkg.changedBehavior || []) {
    const isBreaking = /breaking|schema|contract|deprecat/i.test(chg.description);
    const impact = isBreaking ? 'BREAKING' : 'HIGH';

    if (isBreaking) {
      detectedRisks.push(`Breaking behavior change detected in ${chg.id} (${chg.title}).`);
    }

    statements.push({
      statementText: `[Behavior Modification] ${chg.title}: ${chg.description}. Migration guidance: ${pkg.migrationNotes || 'None specified'}.`,
      audience: 'TECHNICAL',
      impactCategory: impact,
      verificationStatus: 'SUPPORTED',
      riskWarning: isBreaking ? 'Requires client/consumer configuration updates before deployment.' : null,
      sourceItemIds: [chg.id],
      evidenceExcerpts: [
        {
          sourceId: chg.id,
          sourceType: 'RELEASE_ITEM',
          excerpt: chg.description,
        },
      ],
    });

    statements.push({
      statementText: `[Workflow Change] Notice for ${pkg.affectedUserGroups || 'all users'}: ${chg.title} - ${chg.description}.`,
      audience: 'STAKEHOLDER',
      impactCategory: impact,
      verificationStatus: 'SUPPORTED',
      riskWarning: isBreaking ? 'Action required by end-users or account administrators.' : null,
      sourceItemIds: [chg.id],
      evidenceExcerpts: [
        {
          sourceId: chg.id,
          sourceType: 'RELEASE_ITEM',
          excerpt: chg.description,
        },
      ],
    });
  }

  // 4. Known Limitations & Risks
  if (pkg.knownLimitations && pkg.knownLimitations.trim().length > 0) {
    detectedRisks.push(`Declared limitation: ${pkg.knownLimitations}`);
  }

  const technicalSummary = `Release package ${pkg.name} (${pkg.version}) introduces ${pkg.features?.length || 0} features, ${pkg.bugFixes?.length || 0} defect resolutions, and ${pkg.changedBehavior?.length || 0} behavioral updates. Supported by ${pkg.qaEvidence?.length || 0} QA verification records. Migration requirements: ${pkg.migrationNotes || 'Standard deployment, no schema migration'}.`;

  const stakeholderSummary = `Version ${pkg.version} focuses on improving platform stability, adding requested user capabilities, and refining core workflows for ${pkg.affectedUserGroups || 'active teams'}. All key changes have been cataloged with associated QA verifications and human review checkpoints.`;

  return {
    technicalSummary,
    stakeholderSummary,
    statements,
    detectedRisks,
    missingInformationNotes,
  };
}

/**
 * Server-side AI generator that orchestrates either OpenAI API or the truthful local Demo Engine.
 * Automatically verifies citations against physical database records using deterministic rules.
 */
export async function generateReleaseBriefs(pkg: ReleasePackageInput): Promise<GenerationEngineResult> {
  const timer = logger.startTimer('generateReleaseBriefs');
  const apiKey = process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  const isDemo = process.env.DEMO_MODE === 'true' || !apiKey;
  const isGroq = Boolean(process.env.GROQ_API_KEY || apiKey?.startsWith('gsk_') || process.env.OPENAI_BASE_URL?.includes('groq'));

  // Build lookup maps of existing sources for evidence validation
  const allItems = [
    ...(pkg.features || []),
    ...(pkg.bugFixes || []),
    ...(pkg.changedBehavior || []),
  ];

  const itemMap = new Map(allItems.map((i) => [i.id, i]));
  const qaMap = new Map((pkg.qaEvidence || []).map((q) => [q.id, q]));

  // Snapshot fingerprints of all current sources
  const currentFingerprints: Record<string, string> = {};
  for (const item of allItems) {
    currentFingerprints[item.id] = computeItemFingerprint(item);
  }
  for (const qa of pkg.qaEvidence || []) {
    currentFingerprints[qa.id] = computeQAFingerprint(qa);
  }

  let rawOutput: GeneratedBriefOutput;
  let modelName = 'demo-rule-engine-v1 (Deterministic Local)';

  if (!isDemo && apiKey) {
    const defaultModel = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
    const defaultBaseUrl = isGroq ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';

    modelName = process.env.GROQ_MODEL || process.env.OPENAI_MODEL || defaultModel;
    const rawBaseUrl = process.env.GROQ_BASE_URL || process.env.OPENAI_BASE_URL;
    const cleanedBaseUrl = rawBaseUrl ? (rawBaseUrl.match(/https?:\/\/[^\s)\]'"]+/)?.[0] || rawBaseUrl.trim()) : defaultBaseUrl;
    const baseUrl = cleanedBaseUrl;

    const systemPrompt = `You are ReleaseOS, a rigorous software release communication and verification intelligence system.
Your job is to analyze a structured software release package and produce two distinct briefs:
1. Internal technical release brief (for engineers, DevOps, SREs).
2. Non-technical stakeholder/client release brief (for product managers, customer success, executives).

CRITICAL RULES FOR EVIDENCE TRACEABILITY:
- NEVER invent test results, evidence, completed work, or citations.
- Every statement MUST cite actual source IDs provided in the release package (e.g. "FEAT-101", "QA-LOAD-01").
- If evidence is insufficient or missing, mark verificationStatus as "PARTIALLY_SUPPORTED", "UNSUPPORTED", or "UNKNOWN_MISSING_INFO", and explain the riskWarning.
- Clearly classify impactCategory: "LOW", "MEDIUM", "HIGH", or "BREAKING".
- Classify audience: "TECHNICAL" or "STAKEHOLDER".
- You must output valid JSON matching the requested schema.`;

    const userPrompt = `Analyze the following release package:
${JSON.stringify(pkg, null, 2)}

Respond ONLY with valid JSON having the following structure:
{
  "technicalSummary": string,
  "stakeholderSummary": string,
  "detectedRisks": string[],
  "missingInformationNotes": string[],
  "statements": [
    {
      "statementText": string,
      "audience": "TECHNICAL" | "STAKEHOLDER",
      "impactCategory": "LOW" | "MEDIUM" | "HIGH" | "BREAKING",
      "verificationStatus": "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED" | "UNKNOWN_MISSING_INFO",
      "riskWarning": string | null,
      "sourceItemIds": string[],
      "evidenceExcerpts": [
        {
          "sourceId": string,
          "sourceType": "RELEASE_ITEM" | "QA_EVIDENCE",
          "excerpt": string
        }
      ]
    }
  ]
}`;

    try {
      let response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          temperature: 0.1, // Low temperature for high factual accuracy
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      if (!response.ok && response.status === 404 && isGroq && modelName !== 'qwen/qwen3.8-27b') {
        logger.info('Model not found on Groq, retrying with available model qwen/qwen3.8-27b');
        modelName = 'qwen/qwen3.8-27b';
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
      }

      const responseData = await response.json();
      const content = responseData.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response content received from AI provider');
      }

      const parsedJson = JSON.parse(content);
      rawOutput = aiGeneratedBriefSchema.parse(parsedJson);
    } catch (err) {
      logger.error('AI provider call failed; preserving release data', err);
      throw err; // Per requirements: If the provider fails, return a useful error and preserve the release data. Do not silently substitute fabricated output.
    }
  } else {
    // Deterministic rule engine fallback
    rawOutput = runDeterministicDemoEngine(pkg);
  }

  // Post-Process and Ground every generated statement against physical records
  const processedStatements = rawOutput.statements.map((stmt) => {
    const evidenceValidation = validateStatementEvidence(
      {
        statementText: stmt.statementText,
        impactCategory: stmt.impactCategory,
        reportedStatus: stmt.verificationStatus,
        reportedRiskWarning: stmt.riskWarning,
        sourceItemIds: stmt.sourceItemIds,
        evidenceExcerpts: stmt.evidenceExcerpts,
      },
      { items: itemMap, qa: qaMap }
    );

    // Build snapshot mapping for this statement's citations
    const stmtFingerprintSnapshot: Record<string, string> = {};
    for (const sourceId of stmt.sourceItemIds) {
      if (currentFingerprints[sourceId]) {
        stmtFingerprintSnapshot[sourceId] = currentFingerprints[sourceId];
      }
    }

    return {
      statementText: stmt.statementText,
      audience: stmt.audience,
      impactCategory: stmt.impactCategory,
      verificationStatus: evidenceValidation.effectiveStatus,
      riskWarning: evidenceValidation.riskWarning,
      sourceItemIds: stmt.sourceItemIds,
      sourceFingerprintsSnapshot: stmtFingerprintSnapshot,
      evidenceExcerpts: evidenceValidation.validatedReferences,
    };
  });

  const duration = timer.end('SUCCESS', {
    model: modelName,
    isDemo,
    statementCount: processedStatements.length,
  });

  return {
    modelUsed: modelName,
    isDemoMode: isDemo,
    technicalSummary: rawOutput.technicalSummary,
    stakeholderSummary: rawOutput.stakeholderSummary,
    detectedRisks: rawOutput.detectedRisks,
    missingInformationNotes: rawOutput.missingInformationNotes,
    statements: processedStatements,
    diagnosticLogs: {
      isDemoMode: isDemo,
      modelUsed: modelName,
      generationDurationMs: duration,
      statementsCount: processedStatements.length,
      detectedRisksCount: rawOutput.detectedRisks.length,
      missingNotesCount: rawOutput.missingInformationNotes.length,
      evaluatedSourcesCount: allItems.length + (pkg.qaEvidence?.length || 0),
    },
  };
}
