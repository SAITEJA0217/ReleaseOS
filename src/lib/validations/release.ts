import { z } from 'zod';
import { MissingSectionCheck } from '@/types';

// Release Item Schema
export const releaseItemSchema = z.object({
  id: z.string().min(1, 'Item ID is required (e.g., FEAT-101)'),
  category: z.enum(['FEATURE', 'BUG_FIX', 'CHANGED_BEHAVIOR']),
  title: z.string().min(2, 'Item title must be at least 2 characters'),
  description: z.string().min(5, 'Item description must provide adequate context (min 5 characters)'),
  sourceReference: z.string().min(1, 'Source reference is required (e.g., PR #123, Jira ID)'),
});

// QA Evidence Schema
export const qaEvidenceSchema = z.object({
  id: z.string().min(1, 'QA Evidence ID is required (e.g., QA-TEST-01)'),
  testType: z.string().min(2, 'Test type is required (e.g., E2E, Load, Security, Unit)'),
  summary: z.string().min(3, 'QA summary is required'),
  evidenceDetails: z.string().min(5, 'Evidence details must be documented'),
  passed: z.boolean().default(true),
  sourceReference: z.string().min(1, 'QA source reference is required (e.g., CI Link, Report URL)'),
});

// Full Release Package Input Schema
export const releasePackageSchema = z.object({
  name: z.string().min(2, 'Release name is required'),
  version: z.string().regex(/^[vV]?\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/, 'Version must follow SemVer format (e.g., 1.4.0 or v1.4.0)'),
  features: z.array(releaseItemSchema).default([]),
  bugFixes: z.array(releaseItemSchema).default([]),
  changedBehavior: z.array(releaseItemSchema).default([]),
  qaEvidence: z.array(qaEvidenceSchema).default([]),
  knownLimitations: z.string().default(''),
  migrationNotes: z.string().default(''),
  affectedUserGroups: z.string().default(''),
});

// Review Decision Schema
export const reviewDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'EDITED', 'REOPENED']),
  reviewer: z.string().min(1, 'Reviewer identity is required'),
  editedText: z.string().optional(),
  reviewNotes: z.string().optional(),
});

// AI Generation Structured Output Statement Schema
export const generatedStatementSchema = z.object({
  statementText: z.string().min(5, 'Statement text must be substantive'),
  audience: z.enum(['TECHNICAL', 'STAKEHOLDER']),
  impactCategory: z.enum(['LOW', 'MEDIUM', 'HIGH', 'BREAKING']),
  verificationStatus: z.enum(['SUPPORTED', 'PARTIALLY_SUPPORTED', 'UNSUPPORTED', 'UNKNOWN_MISSING_INFO']),
  riskWarning: z.string().nullable().optional(),
  sourceItemIds: z.array(z.string()).default([]),
  evidenceExcerpts: z.array(
    z.object({
      sourceId: z.string(),
      sourceType: z.enum(['RELEASE_ITEM', 'QA_EVIDENCE']),
      excerpt: z.string(),
    })
  ).default([]),
});

// Complete AI Output Schema
export const aiGeneratedBriefSchema = z.object({
  technicalSummary: z.string().min(10, 'Technical summary must be meaningful'),
  stakeholderSummary: z.string().min(10, 'Stakeholder summary must be meaningful'),
  statements: z.array(generatedStatementSchema).min(1, 'At least one generated statement is required'),
  detectedRisks: z.array(z.string()).default([]),
  missingInformationNotes: z.array(z.string()).default([]),
});

/**
 * Deterministically checks for missing required sections in a release package.
 * Does not rely on an LLM to decide whether required fields are present.
 */
export function validateRequiredSections(pkg: {
  name?: string;
  version?: string;
  features?: unknown[];
  bugFixes?: unknown[];
  changedBehavior?: unknown[];
  qaEvidence?: unknown[];
  knownLimitations?: string;
  migrationNotes?: string;
  affectedUserGroups?: string;
}): { isValid: boolean; checks: MissingSectionCheck[]; missingCount: number } {
  const checks: MissingSectionCheck[] = [
    {
      section: 'Release Name & Version',
      isMissing: !pkg.name?.trim() || !pkg.version?.trim(),
      message: 'Both release name and semver version identifier are required.',
    },
    {
      section: 'Completed Features',
      isMissing: !Array.isArray(pkg.features) || pkg.features.length === 0,
      message: 'At least one completed feature with stable ID and description is required.',
    },
    {
      section: 'Bug Fixes',
      isMissing: !Array.isArray(pkg.bugFixes) || pkg.bugFixes.length === 0,
      message: 'Bug fixes section must be documented (or marked none).',
    },
    {
      section: 'Changed Behaviour',
      isMissing: !Array.isArray(pkg.changedBehavior) || pkg.changedBehavior.length === 0,
      message: 'Changed system/user behavior must be explicitly noted.',
    },
    {
      section: 'QA Summary & Evidence',
      isMissing: !Array.isArray(pkg.qaEvidence) || pkg.qaEvidence.length === 0,
      message: 'QA test summary and verified evidence records are required.',
    },
    {
      section: 'Known Limitations',
      isMissing: !pkg.knownLimitations || pkg.knownLimitations.trim().length === 0,
      message: 'Known limitations or edge cases must be disclosed.',
    },
    {
      section: 'Migration & Configuration Notes',
      isMissing: !pkg.migrationNotes || pkg.migrationNotes.trim().length === 0,
      message: 'Database migrations, environment flags, or config steps must be specified.',
    },
    {
      section: 'Affected User Groups',
      isMissing: !pkg.affectedUserGroups || pkg.affectedUserGroups.trim().length === 0,
      message: 'Affected user cohorts or roles must be documented.',
    },
  ];

  const missingCount = checks.filter((c) => c.isMissing).length;
  return {
    isValid: missingCount === 0,
    checks,
    missingCount,
  };
}
