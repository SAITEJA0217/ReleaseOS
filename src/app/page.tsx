'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Layers,
  FileText,
  AlertTriangle,
  ShieldAlert,
  PlusCircle,
  ExternalLink,
  GitBranch,
  RefreshCw,
  Clock,
  Sparkles,
  Database,
  CheckCircle2,
  ChevronRight,
  Search,
} from 'lucide-react';

interface ReleaseListItem {
  id: string;
  name: string;
  currentVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  versionsCount: number;
  hasBrief: boolean;
  latestBriefId?: string;
  pendingReviewCount: number;
  unsupportedWarningsCount: number;
  staleCount: number;
  missingSectionsCount: number;
}

interface SystemHealth {
  status: string;
  database: {
    provider: string;
    status: string;
    releasesCount: number;
  };
  aiEngine: {
    isDemoMode: boolean;
    provider: string;
    model: string;
    apiKeyConfigured: boolean;
    note: string;
  };
}

export default function DashboardPage() {
  const [releases, setReleases] = useState<ReleaseListItem[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'DRAFT' | 'IN_REVIEW' | 'REVIEWED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [relRes, healthRes] = await Promise.all([
        fetch('/api/releases'),
        fetch('/api/health'),
      ]);

      if (relRes.ok) {
        const relData = await relRes.json();
        setReleases(relData.releases || []);
      }
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
      }
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute aggregated real dashboard metrics derived from persisted data
  const totalReleases = releases.length;
  const totalVersions = releases.reduce((acc, r) => acc + r.versionsCount, 0);
  const pendingReviewTotal = releases.reduce((acc, r) => acc + r.pendingReviewCount, 0);
  const releasesWithMissingInfo = releases.filter((r) => r.missingSectionsCount > 0).length;
  const releasesWithWarnings = releases.filter((r) => r.unsupportedWarningsCount > 0 || r.staleCount > 0).length;

  const filteredReleases = releases.filter((r) => {
    const matchesFilter = filter === 'ALL' || r.status === filter;
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.currentVersion.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner / System Telemetry Mode */}
      {health && (
        <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-obsidian-950 via-slate-900 to-obsidian-950 p-4 sm:p-5 shadow-glass">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center space-x-3">
              <div className="p-2.5 rounded-lg bg-blue-950/60 border border-blue-800/50 text-accent-blue">
                <Sparkles className="w-5 h-5 text-accent-blue" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-semibold text-white tracking-wide">
                    {health.aiEngine.isDemoMode ? 'Deterministic Synthesis Engine (Zero-Key Demo Mode)' : `Active AI Model: ${health.aiEngine.model}`}
                  </h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${health.aiEngine.isDemoMode ? 'bg-amber-950 text-amber-400 border border-amber-800/60' : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'}`}>
                    {health.aiEngine.isDemoMode ? 'Truthful Demo Mode' : 'Live Inference'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  {health.aiEngine.note}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 text-xs font-mono border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-5 text-slate-400">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>{health.database.provider.split('(')[0].trim()}</span>
                <span className="text-emerald-400 font-semibold">• {health.database.status}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Release Readiness Console
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Evidence-traceable technical briefs, stakeholder summaries, and human-in-the-loop verification.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            title="Refresh Dashboard"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/releases/create"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-glow transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Release Package</span>
          </Link>
        </div>
      </div>

      {/* Persisted Metrics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Release Versions */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Versions</span>
            <div className="p-2 rounded-lg bg-slate-900 text-accent-blue border border-slate-800">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{totalVersions}</span>
            <span className="text-xs text-slate-500 font-medium">across {totalReleases} releases</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center space-x-1">
            <GitBranch className="w-3.5 h-3.5 text-slate-500" />
            <span>Immutable snapshots in DB</span>
          </div>
        </div>

        {/* Draft Statements Awaiting Review */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Awaiting Review</span>
            <div className="p-2 rounded-lg bg-slate-900 text-sky-400 border border-slate-800">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className={`text-3xl font-black ${pendingReviewTotal > 0 ? 'text-accent-blue' : 'text-slate-300'}`}>
              {pendingReviewTotal}
            </span>
            <span className="text-xs text-slate-500 font-medium">statements pending</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Human signoff required</span>
          </div>
        </div>

        {/* Releases with Missing Info */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Missing Required Info</span>
            <div className="p-2 rounded-lg bg-slate-900 text-amber-400 border border-slate-800">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className={`text-3xl font-black ${releasesWithMissingInfo > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {releasesWithMissingInfo}
            </span>
            <span className="text-xs text-slate-500 font-medium">releases incomplete</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>Deterministic checks applied</span>
          </div>
        </div>

        {/* Releases with Risk/Unsupported Warnings */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Claim / Risk Flags</span>
            <div className="p-2 rounded-lg bg-slate-900 text-rose-400 border border-slate-800">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className={`text-3xl font-black ${releasesWithWarnings > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {releasesWithWarnings}
            </span>
            <span className="text-xs text-slate-500 font-medium">releases flagged</span>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span>Unsupported or stale claims</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
        <div className="flex items-center space-x-2">
          {(['ALL', 'IN_REVIEW', 'DRAFT', 'REVIEWED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === tab ? 'bg-slate-800 text-white font-semibold border border-slate-700' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
            >
              {tab === 'ALL' ? 'All Releases' : tab.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search releases or versions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
          />
        </div>
      </div>

      {/* Releases Data Table / List */}
      <div className="rounded-xl border border-slate-800 bg-obsidian-950 overflow-hidden shadow-glass">
        {filteredReleases.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 mx-auto flex items-center justify-center text-slate-500">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white">No Releases Found</h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              {releases.length === 0
                ? 'Your release database is empty. Click below to create your first release package or seed demo data.'
                : 'No releases match your active filter criteria.'}
            </p>
            {releases.length === 0 && (
              <div className="mt-6 flex items-center justify-center space-x-3">
                <Link
                  href="/releases/create"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-glow transition-all"
                >
                  Create New Release
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/60 border-b border-slate-800 text-slate-400 font-mono uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 font-medium">Release Package</th>
                  <th className="px-4 py-3.5 font-medium">Version</th>
                  <th className="px-4 py-3.5 font-medium">Status</th>
                  <th className="px-4 py-3.5 font-medium">Readiness & Review</th>
                  <th className="px-4 py-3.5 font-medium">Quality Warnings</th>
                  <th className="px-4 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredReleases.map((rel) => {
                  const statusColors: Record<string, string> = {
                    DRAFT: 'bg-slate-800 text-slate-300 border-slate-700',
                    IN_REVIEW: 'bg-blue-950/80 text-accent-blue border-blue-800/60',
                    READY_FOR_APPROVAL: 'bg-amber-950/80 text-amber-300 border-amber-800/60',
                    REVIEWED: 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60',
                    ARCHIVED: 'bg-slate-900 text-slate-500 border-slate-800',
                  };

                  return (
                    <tr key={rel.id} className="hover:bg-slate-900/40 transition-colors group">
                      <td className="px-5 py-4">
                        <Link href={`/releases/${rel.id}`} className="font-semibold text-white group-hover:text-accent-blue transition-colors text-sm">
                          {rel.name}
                        </Link>
                        <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-1 font-mono">
                          <Clock className="w-3 h-3" />
                          <span>Updated {new Date(rel.updatedAt).toLocaleDateString()}</span>
                          <span>•</span>
                          <span>{rel.versionsCount} version {rel.versionsCount === 1 ? 'snapshot' : 'snapshots'}</span>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-200 font-medium">
                          v{rel.currentVersion.replace(/^v/, '')}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-medium border ${statusColors[rel.status] || 'bg-slate-800 text-slate-300'}`}>
                          {rel.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="px-4 py-4">
                        {rel.hasBrief ? (
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              {rel.pendingReviewCount > 0 ? (
                                <span className="inline-flex items-center space-x-1 text-sky-400 font-medium">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                                  <span>{rel.pendingReviewCount} awaiting review</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>All statements reviewed</span>
                                </span>
                              )}
                            </div>
                            {rel.staleCount > 0 && (
                              <div className="text-[11px] text-amber-400 font-medium">
                                ⚠ {rel.staleCount} stale statements (source changed)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">No brief generated yet</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          {rel.missingSectionsCount > 0 && (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/50 text-[11px] text-amber-300">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>{rel.missingSectionsCount} missing sections</span>
                            </span>
                          )}
                          {rel.unsupportedWarningsCount > 0 && (
                            <div className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/50 text-[11px] text-rose-300">
                              <ShieldAlert className="w-3 h-3 text-rose-400" />
                              <span>{rel.unsupportedWarningsCount} unverified / risk claims</span>
                            </div>
                          )}
                          {rel.missingSectionsCount === 0 && rel.unsupportedWarningsCount === 0 && (
                            <span className="text-emerald-400 text-xs flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Passed all deterministic checks</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-right">
                        <Link
                          href={`/releases/${rel.id}`}
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors text-xs font-medium"
                        >
                          <span>Open Workspace</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
