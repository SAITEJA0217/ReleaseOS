// Core TypeScript Type Definitions for ReleaseOS

export type ReleaseStatus = 'DRAFT' | 'IN_REVIEW' | 'READY_FOR_APPROVAL' | 'REVIEWED' | 'ARCHIVED';

export type ItemCategory = 'FEATURE' | 'BUG_FIX' | 'CHANGED_BEHAVIOR';

export type AudienceType = 'TECHNICAL' | 'STAKEHOLDER';

export type ImpactCategory = 'LOW' | 'MEDIUM' | 'HIGH' | 'BREAKING';

export type VerificationStatus = 
  | 'SUPPORTED' 
  | 'PARTIALLY_SUPPORTED' 
  | 'UNSUPPORTED' 
  | 'UNKNOWN_MISSING_INFO';

export type DecisionType = 'APPROVED' | 'REJECTED' | 'EDITED' | 'REOPENED';

export type EvidenceSourceType = 'RELEASE_ITEM' | 'QA_EVIDENCE';

export interface ReleaseItemPayload {
  id: string; // e.g. "FEAT-101"
  category: ItemCategory;
  title: string;
  description: string;
  sourceReference: string; // e.g. "PR #1024", "Jira PAY-89"
}

export interface QAEvidencePayload {
  id: string; // e.g. "QA-LOAD-01"
  testType: string; // "E2E", "Unit", "Load", "Security", "Manual"
  summary: string;
  evidenceDetails: string;
  passed: boolean;
  sourceReference: string; // e.g. "CI Run #4819"
}

export interface ReleasePackageInput {
  name: string;
  version: string;
  features: ReleaseItemPayload[];
  bugFixes: ReleaseItemPayload[];
  changedBehavior: ReleaseItemPayload[];
  qaEvidence: QAEvidencePayload[];
  knownLimitations: string;
  migrationNotes: string;
  affectedUserGroups: string;
}

export interface MissingSectionCheck {
  section: string;
  isMissing: boolean;
  message: string;
}

export interface EvidenceReferenceView {
  id: string;
  sourceId: string;
  sourceType: EvidenceSourceType;
  excerpt: string;
  isValid: boolean;
  invalidReason?: string | null;
  sourceItem?: {
    id: string;
    title: string;
    description: string;
    category?: string;
    sourceReference: string;
  } | null;
}

export interface ReviewDecisionView {
  id: string;
  decision: DecisionType;
  reviewer: string;
  editedText?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
}

export interface BriefStatementView {
  id: string;
  statementText: string;
  audience: AudienceType;
  impactCategory: ImpactCategory;
  verificationStatus: VerificationStatus;
  riskWarning?: string | null;
  isStale: boolean;
  staleReason?: string | null;
  sourceItemIds: string[];
  evidenceReferences: EvidenceReferenceView[];
  reviewDecisions: ReviewDecisionView[];
  currentStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EDITED';
  effectiveText: string;
}

export interface GeneratedBriefView {
  id: string;
  releaseId: string;
  versionId: string;
  modelUsed: string;
  generationStatus: string;
  technicalSummary: string;
  stakeholderSummary: string;
  diagnosticLogs: Record<string, unknown>;
  createdAt: string;
  statements: BriefStatementView[];
}

export interface VersionDiffItem {
  type: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
  category: ItemCategory | 'QA_EVIDENCE' | 'META';
  id: string;
  title: string;
  oldContent?: string;
  newContent?: string;
  changeExplanation?: string;
}

export interface VersionComparisonResult {
  baseVersion: string;
  targetVersion: string;
  hasChanges: boolean;
  addedItemsCount: number;
  removedItemsCount: number;
  modifiedItemsCount: number;
  items: VersionDiffItem[];
  limitationsDiff?: { old: string; new: string; changed: boolean };
  migrationDiff?: { old: string; new: string; changed: boolean };
  affectedUsersDiff?: { old: string; new: string; changed: boolean };
}

export interface FinalReviewedBrief {
  releaseName: string;
  version: string;
  generatedAt: string;
  reviewedAt: string;
  reviewStatus: 'FULLY_REVIEWED' | 'PARTIALLY_REVIEWED' | 'REJECTED';
  totalApprovedStatements: number;
  totalRejectedStatements: number;
  totalUnresolvedStatements: number;
  technicalBrief: {
    summary: string;
    approvedStatements: BriefStatementView[];
  };
  stakeholderBrief: {
    summary: string;
    approvedStatements: BriefStatementView[];
  };
  qaSummary: QAEvidencePayload[];
  knownLimitations: string;
  migrationNotes: string;
  affectedUserGroups: string;
  exclusionsAndUnresolved: string[];
  reviewers: string[];
  disclaimer: string;
}
