'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Edit3,
  Clock,
  Layers,
  GitBranch,
  FileText,
  Copy,
  Download,
  Printer,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  ExternalLink,
  PlusCircle,
  HelpCircle,
  Check,
} from 'lucide-react';
import {
  BriefStatementView,
  VersionComparisonResult,
  FinalReviewedBrief,
  ItemCategory,
} from '@/types';

interface ReleaseDetail {
  id: string;
  name: string;
  currentVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  missingSections: {
    isValid: boolean;
    missingCount: number;
    checks: Array<{ section: string; isMissing: boolean; message: string }>;
  };
  currentVersionDetails: {
    id: string;
    version: string;
    name: string;
    limitations: string;
    migrationNotes: string;
    affectedUserGroups: string;
    features: any[];
    bugFixes: any[];
    changedBehavior: any[];
    qaEvidence: any[];
  } | null;
  versionsList: Array<{
    id: string;
    version: string;
    name: string;
    createdAt: string;
    itemsCount: number;
    qaCount: number;
  }>;
  brief: {
    id: string;
    modelUsed: string;
    generationStatus: string;
    technicalSummary: string;
    stakeholderSummary: string;
    diagnosticLogs: Record<string, any>;
    createdAt: string;
    statements: BriefStatementView[];
  } | null;
  auditEvents: Array<{
    id: string;
    action: string;
    actor: string;
    details: Record<string, any>;
    timestamp: string;
  }>;
}

export default function ReleaseWorkspacePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [release, setRelease] = useState<ReleaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active Workspace Tab
  const [activeTab, setActiveTab] = useState<'REVIEW' | 'SOURCES' | 'VERSIONS' | 'FINAL_BRIEF'>('REVIEW');

  // Review Workbench Filters
  const [audienceFilter, setAudienceFilter] = useState<'ALL' | 'TECHNICAL' | 'STAKEHOLDER'>('ALL');
  const [reviewerName, setReviewerName] = useState('Staff Engineer');

  // Inline Statement Editing State
  const [editingStatementId, setEditingStatementId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Selected Evidence Reference Drawer
  const [selectedReference, setSelectedReference] = useState<any | null>(null);

  // Version Comparison State
  const [baseVersion, setBaseVersion] = useState<string>('');
  const [targetVersion, setTargetVersion] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<VersionComparisonResult | null>(null);
  const [comparing, setComparing] = useState(false);

  // Snapshot Creation Modal State
  const [newSnapshotVersion, setNewSnapshotVersion] = useState('');
  const [showSnapshotModal, setShowSnapshotModal] = useState(false);

  // Final Brief State
  const [finalBriefData, setFinalBriefData] = useState<FinalReviewedBrief | null>(null);
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);

  // Fetch full release details
  const fetchRelease = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/releases/${id}`);
      if (!res.ok) throw new Error('Release not found');
      const data = await res.json();
      setRelease(data.release);

      // Default version comparison selections if versions available
      if (data.release.versionsList.length >= 2) {
        setTargetVersion(data.release.versionsList[0].version);
        setBaseVersion(data.release.versionsList[1].version);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRelease();
  }, [id]);

  // Fetch Reviewed Final Brief when switching to that tab
  useEffect(() => {
    if (activeTab === 'FINAL_BRIEF') {
      fetchFinalBrief();
    }
  }, [activeTab]);

  const fetchFinalBrief = async () => {
    try {
      const res = await fetch(`/api/releases/${id}/final-brief`);
      if (res.ok) {
        const data = await res.json();
        setFinalBriefData(data.finalBrief);
      }
    } catch (err) {
      console.error('Failed to load final brief', err);
    }
  };

  // Run AI Brief Generation
  const handleGenerateBrief = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/releases/${id}/generate`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate brief');
      setSuccessMessage(`AI Brief generation completed (${data.modelUsed}). ${data.statementCount} statements grounded with citations.`);
      await fetchRelease();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Review Statement Action (Approve / Reject / Edit)
  const handleReviewDecision = async (
    statementId: string,
    decision: 'APPROVED' | 'REJECTED' | 'EDITED' | 'REOPENED',
    customEditedText?: string,
    customNotes?: string
  ) => {
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/releases/${id}/statements/${statementId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          reviewer: reviewerName.trim() || 'Reviewer',
          editedText: customEditedText,
          reviewNotes: customNotes,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to record review');
      }

      setEditingStatementId(null);
      await fetchRelease();
      if (activeTab === 'FINAL_BRIEF') {
        await fetchFinalBrief();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  // Run Stale Statement Re-evaluation
  const handleReevaluateStaleness = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/releases/${id}/statements/stale`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reevaluate');
      setSuccessMessage(`Staleness scan complete: ${data.staleDetected} stale statement(s) detected out of ${data.totalEvaluated}.`);
      await fetchRelease();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  // Run Version Comparison
  const handleCompareVersions = async () => {
    if (!baseVersion || !targetVersion) return;
    setComparing(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/releases/${id}/compare?base=${baseVersion}&target=${targetVersion}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to compare');
      setComparisonResult(data.comparison);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setComparing(false);
    }
  };

  // Save New Snapshot Version
  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSnapshotVersion || !release?.currentVersionDetails) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/releases/${id}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: release.name,
          version: newSnapshotVersion.trim(),
          features: release.currentVersionDetails.features,
          bugFixes: release.currentVersionDetails.bugFixes,
          changedBehavior: release.currentVersionDetails.changedBehavior,
          qaEvidence: release.currentVersionDetails.qaEvidence,
          knownLimitations: release.currentVersionDetails.limitations,
          migrationNotes: release.currentVersionDetails.migrationNotes,
          affectedUserGroups: release.currentVersionDetails.affectedUserGroups,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save snapshot');
      setShowSnapshotModal(false);
      setNewSnapshotVersion('');
      setSuccessMessage(`New immutable snapshot version "${data.version.version}" created.`);
      await fetchRelease();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <RefreshCw className="w-6 h-6 text-accent-blue animate-spin" />
        <span className="text-xs text-slate-400 font-mono">Loading Release Workspace & Evidence Graph...</span>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="p-8 text-center space-y-3">
        <h2 className="text-lg font-bold text-white">Release Not Found</h2>
        <Link href="/" className="text-xs text-accent-blue underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const statements = release.brief?.statements || [];
  const filteredStatements = statements.filter(
    (s) => audienceFilter === 'ALL' || s.audience === audienceFilter
  );

  const approvedCount = statements.filter((s) => s.currentStatus === 'APPROVED' || s.currentStatus === 'EDITED').length;
  const rejectedCount = statements.filter((s) => s.currentStatus === 'REJECTED').length;
  const pendingCount = statements.filter((s) => s.currentStatus === 'PENDING').length;
  const staleCount = statements.filter((s) => s.isStale).length;

  return (
    <div className="space-y-6 animate-fadeIn pb-16">
      {/* Back Link & Quick Nav */}
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Console</span>
        </Link>

        <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Zero-Deploy Protection Active</span>
        </div>
      </div>

      {/* Main Release Header */}
      <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 shadow-glass">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{release.name}</h1>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-accent-blue border border-blue-800 font-semibold">
                v{release.currentVersion}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-900 border border-slate-800 text-slate-300">
                {release.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Target Audience: {release.currentVersionDetails?.affectedUserGroups || 'All Product Users'}
            </p>
          </div>

          {/* Primary Workspace Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleGenerateBrief}
              disabled={actionLoading}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-glow disabled:opacity-50 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{release.brief ? 'Regenerate Briefs' : 'Run AI Generation'}</span>
            </button>

            <button
              onClick={() => setShowSnapshotModal(true)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5 text-accent-blue" />
              <span>Save Version Snapshot</span>
            </button>

            <button
              onClick={handleReevaluateStaleness}
              disabled={actionLoading}
              title="Detect any statements that depend on modified release items"
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
              <span>Scan Staleness</span>
            </button>
          </div>
        </div>

        {/* Diagnostic Metadata Banner */}
        {release.brief && (
          <div className="mt-4 pt-4 border-t border-slate-850/80 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 gap-3">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="text-slate-500">Engine:</span>
                <span className="text-white font-medium">{release.brief.modelUsed}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span className="text-slate-500">Statements:</span>
                <span className="text-accent-blue font-bold">{statements.length}</span>
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-emerald-400">{approvedCount} Approved</span>
              <span>•</span>
              <span className="text-sky-400">{pendingCount} Pending</span>
              {rejectedCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-rose-400">{rejectedCount} Rejected</span>
                </>
              )}
              {staleCount > 0 && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-bold animate-pulse">⚠ {staleCount} Stale</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Missing Required Information Alert Banner (Deterministic) */}
      {!release.missingSections.isValid && (
        <div className="p-4 rounded-xl border border-amber-800/80 bg-amber-950/30 text-xs text-amber-200 space-y-2">
          <div className="flex items-center space-x-2 font-semibold text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>Missing Required Release Package Information ({release.missingSections.missingCount} sections incomplete)</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            Deterministic validation detected incomplete fields. While briefs can be synthesized for draft review, a production release brief requires all 8 sections to be fully documented.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {release.missingSections.checks
              .filter((c) => c.isMissing)
              .map((c) => (
                <span key={c.section} className="px-2 py-0.5 rounded bg-amber-900/60 border border-amber-800/80 text-[10px] font-mono font-medium text-amber-300">
                  Missing: {c.section}
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {successMessage && (
        <div className="p-3.5 rounded-xl border border-emerald-800/80 bg-emerald-950/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 rounded-xl border border-rose-800/80 bg-rose-950/40 text-rose-300 text-xs flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-slate-800 flex items-center space-x-1 sm:space-x-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('REVIEW')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'REVIEW'
              ? 'border-accent-blue text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-accent-blue" />
          <span>Review Workbench & Inspector</span>
          {pendingCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-950 text-accent-blue text-[10px] font-mono flex items-center justify-center font-bold">
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('SOURCES')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'SOURCES'
              ? 'border-accent-blue text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4 text-slate-400" />
          <span>Release Package & Sources</span>
        </button>

        <button
          onClick={() => setActiveTab('VERSIONS')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'VERSIONS'
              ? 'border-accent-blue text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <GitBranch className="w-4 h-4 text-slate-400" />
          <span>Version Diff & History</span>
        </button>

        <button
          onClick={() => setActiveTab('FINAL_BRIEF')}
          className={`pb-3 px-3 flex items-center space-x-2 border-b-2 transition-colors ${
            activeTab === 'FINAL_BRIEF'
              ? 'border-accent-blue text-white font-semibold'
              : 'border-transparent text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 text-slate-400" />
          <span>Reviewed Final Brief</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HUMAN REVIEW WORKBENCH & EVIDENCE INSPECTOR */}
      {/* ========================================================================= */}
      {activeTab === 'REVIEW' && (
        <div className="space-y-6">
          {!release.brief ? (
            <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500">
                <Sparkles className="w-6 h-6 text-accent-blue" />
              </div>
              <h3 className="text-base font-semibold text-white">No Brief Generated Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Execute the AI generation workflow to produce audience-specific technical and stakeholder briefs with grounded citations.
              </p>
              <button
                onClick={handleGenerateBrief}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-glow disabled:opacity-50"
              >
                {actionLoading ? 'Synthesizing...' : 'Generate Release Briefs Now'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Executive Audience Summaries Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-4 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent-blue bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                    Internal Technical Summary
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    {release.brief.technicalSummary}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-4 space-y-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-sky-400 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-800">
                    Client & Stakeholder Summary
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed pt-1">
                    {release.brief.stakeholderSummary}
                  </p>
                </div>
              </div>

              {/* Review Filter Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-obsidian-950 p-3.5 rounded-xl border border-slate-800">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-medium">Audience Filter:</span>
                  {(['ALL', 'TECHNICAL', 'STAKEHOLDER'] as const).map((aud) => (
                    <button
                      key={aud}
                      onClick={() => setAudienceFilter(aud)}
                      className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                        audienceFilter === aud
                          ? 'bg-slate-800 text-white font-semibold border border-slate-700'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {aud === 'ALL' ? 'All Statements' : aud}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-400">Reviewer Identity:</span>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Enter your name"
                    className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-white text-xs font-medium w-40 focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>

              {/* Statements List & Review Cards */}
              <div className="space-y-4">
                {filteredStatements.map((stmt) => {
                  const impactColors: Record<string, string> = {
                    LOW: 'bg-slate-900 text-slate-400 border-slate-800',
                    MEDIUM: 'bg-blue-950 text-blue-300 border-blue-800',
                    HIGH: 'bg-amber-950 text-amber-300 border-amber-800',
                    BREAKING: 'bg-rose-950 text-rose-300 border-rose-800 font-bold animate-pulse',
                  };

                  const verificationColors: Record<string, string> = {
                    SUPPORTED: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
                    PARTIALLY_SUPPORTED: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
                    UNSUPPORTED: 'bg-rose-950/80 text-rose-400 border-rose-800/60',
                    UNKNOWN_MISSING_INFO: 'bg-slate-900 text-slate-400 border-slate-800',
                  };

                  const isEditingThis = editingStatementId === stmt.id;

                  return (
                    <div
                      key={stmt.id}
                      className={`rounded-xl border transition-all p-5 space-y-4 bg-obsidian-950 ${
                        stmt.isStale
                          ? 'border-amber-700/80 bg-amber-950/10'
                          : stmt.currentStatus === 'APPROVED'
                          ? 'border-emerald-900/60'
                          : stmt.currentStatus === 'REJECTED'
                          ? 'border-rose-900/60 opacity-75'
                          : 'border-slate-800'
                      }`}
                    >
                      {/* Top Badges Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-850/80 pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            {stmt.audience}
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${impactColors[stmt.impactCategory]}`}>
                            Impact: {stmt.impactCategory}
                          </span>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${verificationColors[stmt.verificationStatus]}`}>
                            {stmt.verificationStatus.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Current Review Decision State Badge */}
                        <div className="flex items-center space-x-2">
                          {stmt.currentStatus === 'APPROVED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approved</span>
                            </span>
                          )}
                          {stmt.currentStatus === 'REJECTED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-950 text-rose-400 border border-rose-800">
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejected</span>
                            </span>
                          )}
                          {stmt.currentStatus === 'EDITED' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-950 text-sky-400 border border-sky-800">
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edited & Approved</span>
                            </span>
                          )}
                          {stmt.currentStatus === 'PENDING' && (
                            <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-900 text-slate-400 border border-slate-800">
                              <Clock className="w-3.5 h-3.5 text-sky-400" />
                              <span>Awaiting Review</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stale Warning Alert */}
                      {stmt.isStale && (
                        <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/80 text-amber-300 text-xs flex items-start space-x-2.5">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-bold">STALE STATEMENT — Source Dependency Changed</span>
                            <p className="text-[11px] text-amber-200/90 leading-relaxed">
                              {stmt.staleReason || 'A cited release item was modified after this statement was generated.'} Renewed human review is required before inclusion in final brief.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Unsupported Claim / Exaggerated Warning */}
                      {stmt.riskWarning && (
                        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-800/70 text-rose-300 text-xs flex items-start space-x-2.5">
                          <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <span className="font-bold">Claim Exceeds Evidence Warning</span>
                            <p className="text-[11px] text-rose-200/90 leading-relaxed">
                              {stmt.riskWarning}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Statement Text Content (or inline editor) */}
                      {isEditingThis ? (
                        <div className="space-y-3 p-3.5 rounded-lg bg-slate-900 border border-slate-700">
                          <div className="text-xs font-semibold text-white">Edit Statement Text (Preserves Audit Trail):</div>
                          <textarea
                            rows={3}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded p-2.5 text-xs text-white focus:outline-none focus:border-accent-blue"
                          />
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Reviewer justification note for this edit (optional)"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-accent-blue"
                          />
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleReviewDecision(stmt.id, 'EDITED', editText, editNotes)}
                              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                            >
                              Save Edit & Approve
                            </button>
                            <button
                              onClick={() => setEditingStatementId(null)}
                              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-100 font-medium leading-relaxed">
                          {stmt.effectiveText}
                          {stmt.currentStatus === 'EDITED' && (
                            <span className="ml-2 text-[10px] font-mono text-sky-400 italic">
                              (Reviewer modified from original AI output)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Cited Evidence Sources (Evidence Inspector Linkage) */}
                      <div className="space-y-2 pt-2 border-t border-slate-850">
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
                            Supporting Evidence Citations:
                          </span>
                        </div>

                        {stmt.evidenceReferences.length === 0 ? (
                          <div className="text-[11px] text-rose-400 italic flex items-center space-x-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>No evidence references attached to this claim.</span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {stmt.evidenceReferences.map((ref) => (
                              <button
                                key={ref.id}
                                onClick={() => setSelectedReference(ref)}
                                className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono transition-colors border ${
                                  !ref.isValid
                                    ? 'bg-rose-950 border-rose-800 text-rose-300 hover:bg-rose-900'
                                    : 'bg-slate-900 border-slate-800 text-accent-blue hover:bg-slate-850 hover:border-blue-700'
                                }`}
                              >
                                <span>{ref.sourceId}</span>
                                <ExternalLink className="w-3 h-3 text-slate-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Review Decision Buttons & History */}
                      <div className="pt-3 border-t border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleReviewDecision(stmt.id, 'APPROVED')}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 transition-colors shadow-sm"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>

                          <button
                            onClick={() => {
                              const reason = prompt('Please enter rejection reason / exclusion note:');
                              if (reason !== null) {
                                handleReviewDecision(stmt.id, 'REJECTED', undefined, reason);
                              }
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-200 bg-rose-950 hover:bg-rose-900 border border-rose-800 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject & Exclude</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingStatementId(stmt.id);
                              setEditText(stmt.effectiveText);
                              setEditNotes('');
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-850 border border-slate-800 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-accent-blue" />
                            <span>Edit Statement</span>
                          </button>

                          {stmt.currentStatus !== 'PENDING' && (
                            <button
                              onClick={() => handleReviewDecision(stmt.id, 'REOPENED', undefined, 'Manually reopened by reviewer')}
                              className="px-2.5 py-1.5 rounded text-xs text-slate-400 hover:text-white"
                            >
                              Reopen
                            </button>
                          )}
                        </div>

                        {/* Audit Trail of Latest Review */}
                        {stmt.reviewDecisions.length > 0 && (
                          <div className="text-[11px] text-slate-500 font-mono">
                            Reviewed by {stmt.reviewDecisions[0].reviewer} on{' '}
                            {new Date(stmt.reviewDecisions[0].createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RELEASE PACKAGE SOURCES */}
      {/* ========================================================================= */}
      {activeTab === 'SOURCES' && release.currentVersionDetails && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-6">
            <h2 className="text-base font-bold text-white border-b border-slate-800 pb-3">
              Release Package Inventory ({release.currentVersionDetails.version})
            </h2>

            {/* Features */}
            <div className="space-y-3">
              <h3 className="text-xs font-mono font-bold text-accent-blue uppercase tracking-wider">
                Features ({release.currentVersionDetails.features.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {release.currentVersionDetails.features.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg border border-slate-850 bg-slate-900/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-accent-blue">{f.id}</span>
                      <span className="font-mono text-[10px] text-slate-400">{f.sourceReference}</span>
                    </div>
                    <div className="font-semibold text-white text-xs">{f.title}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bug Fixes */}
            <div className="space-y-3 pt-4 border-t border-slate-850">
              <h3 className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider">
                Bug Fixes ({release.currentVersionDetails.bugFixes.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {release.currentVersionDetails.bugFixes.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg border border-slate-850 bg-slate-900/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-sky-400">{b.id}</span>
                      <span className="font-mono text-[10px] text-slate-400">{b.sourceReference}</span>
                    </div>
                    <div className="font-semibold text-white text-xs">{b.title}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{b.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* QA Evidence Records */}
            <div className="space-y-3 pt-4 border-t border-slate-850">
              <h3 className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                QA Verification Evidence ({release.currentVersionDetails.qaEvidence.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {release.currentVersionDetails.qaEvidence.map((q) => (
                  <div key={q.id} className="p-3 rounded-lg border border-slate-850 bg-slate-900/60 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-emerald-400">{q.id}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${q.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'}`}>
                        {q.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </div>
                    <div className="font-semibold text-white text-xs">{q.testType}: {q.summary}</div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">{q.evidenceDetails}</p>
                    <div className="text-[10px] font-mono text-slate-500 pt-1">Ref: {q.sourceReference}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Limitations & Migration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-850">
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-850 space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-amber-400">Known Limitations</span>
                <p className="text-xs text-slate-300">{release.currentVersionDetails.limitations || 'None declared'}</p>
              </div>
              <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-850 space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase text-accent-blue">Migration Notes</span>
                <p className="text-xs text-slate-300">{release.currentVersionDetails.migrationNotes || 'None declared'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: VERSION DIFF & COMPARISON */}
      {/* ========================================================================= */}
      {activeTab === 'VERSIONS' && (
        <div className="space-y-6">
          {/* Comparison Selector */}
          <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-4">
            <h2 className="text-base font-bold text-white">Compare Release Versions</h2>
            <p className="text-xs text-slate-400">
              Select any two immutable snapshots to inspect added, removed, and modified items, QA test differentials, and limitations changes.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-400">Base Version (Earlier):</label>
                <select
                  value={baseVersion}
                  onChange={(e) => setBaseVersion(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent-blue"
                >
                  <option value="">Select Base</option>
                  {release.versionsList.map((v) => (
                    <option key={v.id} value={v.version}>
                      v{v.version} ({v.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono text-slate-400">Target Version (Later):</label>
                <select
                  value={targetVersion}
                  onChange={(e) => setTargetVersion(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-accent-blue"
                >
                  <option value="">Select Target</option>
                  {release.versionsList.map((v) => (
                    <option key={v.id} value={v.version}>
                      v{v.version} ({v.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-5">
                <button
                  onClick={handleCompareVersions}
                  disabled={!baseVersion || !targetVersion || comparing}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {comparing ? 'Diffing...' : 'Compare Versions'}
                </button>
              </div>
            </div>
          </div>

          {/* Granular Diff View */}
          {comparisonResult && (
            <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-5 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-850 pb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-bold text-white">Diff:</span>
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                    v{comparisonResult.baseVersion} → v{comparisonResult.targetVersion}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs font-mono">
                  <span className="text-emerald-400 font-bold">+{comparisonResult.addedItemsCount} Added</span>
                  <span>•</span>
                  <span className="text-rose-400 font-bold">-{comparisonResult.removedItemsCount} Removed</span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold">~{comparisonResult.modifiedItemsCount} Modified</span>
                </div>
              </div>

              {/* Items Diff List */}
              <div className="space-y-3">
                {comparisonResult.items.map((item, idx) => {
                  const typeColors = {
                    ADDED: 'border-emerald-800/80 bg-emerald-950/20 text-emerald-300',
                    REMOVED: 'border-rose-800/80 bg-rose-950/20 text-rose-300',
                    MODIFIED: 'border-amber-800/80 bg-amber-950/20 text-amber-300',
                    UNCHANGED: 'border-slate-850 bg-slate-900/30 text-slate-400',
                  };

                  return (
                    <div key={idx} className={`p-3.5 rounded-lg border ${typeColors[item.type]} space-y-1.5`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs">{item.type}</span>
                          <span className="font-mono text-xs font-medium">[{item.category}]</span>
                          <span className="font-mono font-bold text-white text-xs">{item.id}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 italic">{item.changeExplanation}</span>
                      </div>

                      <div className="text-xs font-semibold text-white">{item.title}</div>

                      {item.type === 'MODIFIED' && item.oldContent && item.newContent && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-[11px] font-mono">
                          <div className="p-2 rounded bg-rose-950/40 border border-rose-900/50 text-rose-300">
                            <span className="text-[10px] uppercase text-rose-400 font-bold block mb-1">Previous ({comparisonResult.baseVersion}):</span>
                            {item.oldContent}
                          </div>
                          <div className="p-2 rounded bg-emerald-950/40 border border-emerald-900/50 text-emerald-300">
                            <span className="text-[10px] uppercase text-emerald-400 font-bold block mb-1">Current ({comparisonResult.targetVersion}):</span>
                            {item.newContent}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Limitations Diff */}
              {comparisonResult.limitationsDiff?.changed && (
                <div className="p-3.5 rounded-lg border border-amber-800 bg-amber-950/30 space-y-1 text-xs">
                  <span className="font-bold text-amber-300 font-mono">Limitations Diff:</span>
                  <div className="text-slate-300">New limitations declared in target version.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: REVIEWED FINAL BRIEF */}
      {/* ========================================================================= */}
      {activeTab === 'FINAL_BRIEF' && (
        <div className="space-y-6">
          {!finalBriefData ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              Loading reviewed final brief...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-obsidian-950 p-4 rounded-xl border border-slate-800 no-print">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-white font-mono">Review Signoff Status:</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold ${
                      finalBriefData.reviewStatus === 'FULLY_REVIEWED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : finalBriefData.reviewStatus === 'PARTIALLY_REVIEWED'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}
                  >
                    {finalBriefData.reviewStatus}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `# Release Brief: ${finalBriefData.releaseName} (v${finalBriefData.version})\n\n## Technical Summary\n${finalBriefData.technicalBrief.summary}\n\n## Approved Statements\n` +
                          finalBriefData.technicalBrief.approvedStatements.map((s) => `- ${s.effectiveText}`).join('\n')
                      );
                      setCopiedMarkdown(true);
                      setTimeout(() => setCopiedMarkdown(false), 2000);
                    }}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white"
                  >
                    {copiedMarkdown ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-accent-blue" />}
                    <span>{copiedMarkdown ? 'Copied Markdown' : 'Copy Markdown'}</span>
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-glow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Document / PDF</span>
                  </button>
                </div>
              </div>

              {/* Printable Professional Document Card */}
              <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-8 space-y-8 shadow-glass print-card">
                {/* Document Header */}
                <div className="border-b border-slate-800 pb-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-accent-blue font-bold">
                      Official Release Communication Brief
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      Date: {new Date(finalBriefData.reviewedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    {finalBriefData.releaseName}
                  </h1>
                  <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
                    <span>Version: v{finalBriefData.version}</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-semibold">{finalBriefData.totalApprovedStatements} Approved Claims</span>
                    {finalBriefData.totalRejectedStatements > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-rose-400 font-semibold">{finalBriefData.totalRejectedStatements} Rejected & Excluded</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Section 1: Technical Brief */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 border-b border-slate-850 pb-2">
                    1. Internal Technical Release Brief
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/40 p-3 rounded-lg border border-slate-850">
                    {finalBriefData.technicalBrief.summary}
                  </p>

                  <div className="space-y-2 pt-2">
                    {finalBriefData.technicalBrief.approvedStatements.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No technical statements approved yet.</p>
                    ) : (
                      finalBriefData.technicalBrief.approvedStatements.map((s) => (
                        <div key={s.id} className="p-3 rounded-lg border border-slate-850 bg-slate-900/50 space-y-1">
                          <div className="text-xs text-white font-medium">{s.effectiveText}</div>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                            <span>Impact: {s.impactCategory}</span>
                            <span>•</span>
                            <span>Citations: {s.sourceItemIds.join(', ') || 'None'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 2: Stakeholder / Client Brief */}
                <div className="space-y-4">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 border-b border-slate-850 pb-2">
                    2. Client & Stakeholder Brief
                  </h2>
                  <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/40 p-3 rounded-lg border border-slate-850">
                    {finalBriefData.stakeholderBrief.summary}
                  </p>

                  <div className="space-y-2 pt-2">
                    {finalBriefData.stakeholderBrief.approvedStatements.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No stakeholder statements approved yet.</p>
                    ) : (
                      finalBriefData.stakeholderBrief.approvedStatements.map((s) => (
                        <div key={s.id} className="p-3 rounded-lg border border-slate-850 bg-slate-900/50 space-y-1">
                          <div className="text-xs text-white font-medium">{s.effectiveText}</div>
                          <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-400">
                            <span>Impact: {s.impactCategory}</span>
                            <span>•</span>
                            <span>Citations: {s.sourceItemIds.join(', ') || 'None'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Section 3: Limitations, QA & Migrations */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-850 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-200 uppercase text-[10px] font-mono">Known Limitations</span>
                    <p className="text-slate-400 leading-relaxed">{finalBriefData.knownLimitations || 'None reported'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-200 uppercase text-[10px] font-mono">Migration Guidance</span>
                    <p className="text-slate-400 leading-relaxed">{finalBriefData.migrationNotes || 'Standard deployment'}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="font-bold text-slate-200 uppercase text-[10px] font-mono">Target Users</span>
                    <p className="text-slate-400 leading-relaxed">{finalBriefData.affectedUserGroups || 'General'}</p>
                  </div>
                </div>

                {/* Section 4: Exclusions & Unresolved Statements */}
                {finalBriefData.exclusionsAndUnresolved.length > 0 && (
                  <div className="p-4 rounded-xl border border-rose-900/60 bg-rose-950/20 space-y-2">
                    <span className="text-xs font-bold text-rose-300 font-mono uppercase tracking-wider">
                      Audit Exclusions & Unresolved Claims ({finalBriefData.exclusionsAndUnresolved.length})
                    </span>
                    <p className="text-[11px] text-slate-300">
                      The following statements were excluded from the official release brief because they were rejected by human reviewers or remain unresolved:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-xs text-rose-300/90 font-mono pt-1">
                      {finalBriefData.exclusionsAndUnresolved.map((exc, i) => (
                        <li key={i}>{exc}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Section 5: Signoff Block & Safety Disclaimer */}
                <div className="pt-6 border-t border-slate-800 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-slate-400">
                    <div>
                      <span className="text-slate-500">Human Reviewers: </span>
                      <span className="text-white font-semibold">
                        {finalBriefData.reviewers.length > 0 ? finalBriefData.reviewers.join(', ') : 'Pending Reviewer Signoff'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Signoff Timestamp: </span>
                      <span>{new Date(finalBriefData.reviewedAt).toISOString()}</span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-900/60 text-[11px] text-slate-400 leading-relaxed font-mono">
                    {finalBriefData.disclaimer}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* EVIDENCE REFERENCE INSPECTOR MODAL / DRAWER */}
      {/* ========================================================================= */}
      {selectedReference && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="rounded-xl border border-slate-800 bg-obsidian-950 max-w-lg w-full p-6 space-y-4 shadow-glass">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 font-mono">
                <span className="text-xs font-bold text-accent-blue bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                  {selectedReference.sourceId}
                </span>
                <span className="text-xs text-slate-400">({selectedReference.sourceType})</span>
              </div>
              <button
                onClick={() => setSelectedReference(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase block">Existence In Database:</span>
                <span className={selectedReference.isValid ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {selectedReference.isValid ? '✓ Verified Active Source Record' : `✗ INVALID: ${selectedReference.invalidReason}`}
                </span>
              </div>

              {selectedReference.sourceItem && (
                <div className="space-y-2 p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-semibold text-white">{selectedReference.sourceItem.title}</div>
                  <p className="text-slate-300 leading-relaxed">{selectedReference.sourceItem.description}</p>
                  <div className="text-[10px] font-mono text-slate-500">Source: {selectedReference.sourceItem.sourceReference}</div>
                </div>
              )}

              <div>
                <span className="text-slate-500 font-mono text-[10px] uppercase block">Cited Excerpt:</span>
                <p className="mt-1 p-2.5 rounded bg-slate-900 border border-slate-800 text-slate-200 italic">
                  "{selectedReference.excerpt}"
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedReference(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs text-white border border-slate-800 font-medium"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SNAPSHOT VERSION CREATION MODAL */}
      {/* ========================================================================= */}
      {showSnapshotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-sm animate-fadeIn">
          <form onSubmit={handleSaveSnapshot} className="rounded-xl border border-slate-800 bg-obsidian-950 max-w-md w-full p-6 space-y-4 shadow-glass">
            <h3 className="text-sm font-bold text-white">Save Immutable Release Version</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Creates a separate, immutable snapshot with cryptographic content fingerprinting. Historical snapshots are never overwritten.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">New SemVer Identifier:</label>
              <input
                type="text"
                required
                placeholder="e.g. 1.4.1"
                value={newSnapshotVersion}
                onChange={(e) => setNewSnapshotVersion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-accent-blue"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSnapshotModal(false)}
                className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading || !newSnapshotVersion}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Save Version Snapshot'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
