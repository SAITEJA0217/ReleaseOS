'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Save,
  ShieldCheck,
  FileText,
  Layers,
  Bug,
  GitCommit,
  HelpCircle,
} from 'lucide-react';
import { ReleaseItemPayload, QAEvidencePayload, ReleasePackageInput } from '@/types';
import { validateRequiredSections } from '@/lib/validations/release';

export default function CreateReleasePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [features, setFeatures] = useState<ReleaseItemPayload[]>([
    { id: 'FEAT-101', category: 'FEATURE', title: '', description: '', sourceReference: '' },
  ]);
  const [bugFixes, setBugFixes] = useState<ReleaseItemPayload[]>([
    { id: 'BUG-201', category: 'BUG_FIX', title: '', description: '', sourceReference: '' },
  ]);
  const [changedBehavior, setChangedBehavior] = useState<ReleaseItemPayload[]>([
    { id: 'CHG-301', category: 'CHANGED_BEHAVIOR', title: '', description: '', sourceReference: '' },
  ]);
  const [qaEvidence, setQaEvidence] = useState<QAEvidencePayload[]>([
    {
      id: 'QA-TEST-01',
      testType: 'E2E / Integration',
      summary: '',
      evidenceDetails: '',
      passed: true,
      sourceReference: '',
    },
  ]);
  const [knownLimitations, setKnownLimitations] = useState('');
  const [migrationNotes, setMigrationNotes] = useState('');
  const [affectedUserGroups, setAffectedUserGroups] = useState('');

  // Deterministic section completeness validation
  const validation = validateRequiredSections({
    name,
    version,
    features: features.filter((f) => f.title.trim() && f.description.trim()),
    bugFixes: bugFixes.filter((b) => b.title.trim() && b.description.trim()),
    changedBehavior: changedBehavior.filter((c) => c.title.trim() && c.description.trim()),
    qaEvidence: qaEvidence.filter((q) => q.summary.trim() && q.evidenceDetails.trim()),
    knownLimitations,
    migrationNotes,
    affectedUserGroups,
  });

  // Pre-fill realistic enterprise sample data
  const loadEnterpriseTemplate = () => {
    setName('Release Apex - Distributed Event Streaming Engine');
    setVersion('2.4.0');
    setFeatures([
      {
        id: 'FEAT-301',
        category: 'FEATURE',
        title: 'Kafka Consumer Group Auto-Rebalancing',
        description: 'Implements cooperative-sticky rebalancing protocol across distributed consumer worker nodes to prevent message lag spikes.',
        sourceReference: 'PR #1420 / RFC-094',
      },
      {
        id: 'FEAT-302',
        category: 'FEATURE',
        title: 'Snappy Payload Compression',
        description: 'Enables hardware-accelerated Snappy compression on outbound event streams, reducing inter-region bandwidth usage by 42%.',
        sourceReference: 'PR #1435',
      },
    ]);
    setBugFixes([
      {
        id: 'BUG-401',
        category: 'BUG_FIX',
        title: 'Worker Thread Deadlock on TLS Timeout',
        description: 'Resolved socket write deadlock when upstream Kafka broker drops SSL connection during bulk flush operations.',
        sourceReference: 'Issue #1184 / Hotfix #1185',
      },
    ]);
    setChangedBehavior([
      {
        id: 'CHG-501',
        category: 'CHANGED_BEHAVIOR',
        title: 'Default Partition Replication Factor Raised to 3',
        description: 'Breaking change: Single-broker development clusters must explicitly override replication_factor=1 in config file or topics will fail creation.',
        sourceReference: 'PR #1440',
      },
    ]);
    setQaEvidence([
      {
        id: 'QA-BENCH-01',
        testType: 'Throughput & Soak Test',
        summary: '250,000 msg/sec sustained throughput across 6 worker nodes',
        evidenceDetails: 'Validated 72-hour sustained streaming test with zero dropped frames and p99 latency under 8.4ms.',
        passed: true,
        sourceReference: 'Datadog Benchmark Run #8491',
      },
      {
        id: 'QA-CHAOS-02',
        testType: 'Chaos Engineering / Partition Split',
        summary: 'Simulated 2-broker sudden failure during peak rebalance',
        evidenceDetails: 'Cooperative rebalance completed in 420ms without partition starvation or duplicate consumer assignments.',
        passed: true,
        sourceReference: 'ChaosMesh Pipeline #392',
      },
    ]);
    setKnownLimitations('Dynamic partition expansion on active live topics requires a 30-second read-only quiescence window.');
    setMigrationNotes('Run ansible playbook update_cluster_configs.yml. Ensure broker nodes have snappy libraries installed.');
    setAffectedUserGroups('Data platform engineers, Real-time analytics consumers, Infrastructure SRE teams.');
  };

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const payload: ReleasePackageInput = {
      name,
      version,
      features: features.filter((f) => f.title.trim()),
      bugFixes: bugFixes.filter((b) => b.title.trim()),
      changedBehavior: changedBehavior.filter((c) => c.title.trim()),
      qaEvidence: qaEvidence.filter((q) => q.summary.trim()),
      knownLimitations,
      migrationNotes,
      affectedUserGroups,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save release package');
      }

      router.push(`/releases/${data.release.id}`);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fadeIn pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <Link
            href="/"
            className="inline-flex items-center space-x-1.5 text-xs text-slate-400 hover:text-white transition-colors mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Create Structured Release Package
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Provide verifiable release artifacts. Every factual statement in generated briefs will link directly to these stable source IDs.
          </p>
        </div>

        <button
          type="button"
          onClick={loadEnterpriseTemplate}
          className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-accent-blue bg-blue-950/60 border border-blue-800/60 hover:bg-blue-900/40 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-accent-blue" />
          <span>Load Enterprise Sample Template</span>
        </button>
      </div>

      {/* Validation Checklist / Deterministic Section Tracker */}
      <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
            Deterministic Section Completeness Tracker
          </span>
          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-medium ${
              validation.isValid
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                : 'bg-amber-950 text-amber-400 border border-amber-800/60'
            }`}
          >
            {validation.isValid ? '✓ All 8 Sections Ready' : `⚠ ${validation.missingCount} Missing Sections`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {validation.checks.map((c) => (
            <div
              key={c.section}
              className={`p-2 rounded-lg border text-[11px] flex items-center space-x-2 ${
                c.isMissing
                  ? 'border-amber-900/50 bg-amber-950/20 text-amber-400'
                  : 'border-emerald-900/50 bg-emerald-950/20 text-emerald-300'
              }`}
            >
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: c.isMissing ? '#f59e0b' : '#10b981' }} />
              <span className="truncate">{c.section}</span>
            </div>
          ))}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl border border-rose-800/80 bg-rose-950/40 text-rose-300 text-xs flex items-start space-x-3">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">Failed to save release package</div>
            <div className="mt-1 text-slate-300">{errorMessage}</div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Section 1: Release Name & Version */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
            <span className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 text-accent-blue text-xs font-mono font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-base font-semibold text-white">Release Identity</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Release Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Release Horizon - Payment & Multi-Currency Engine"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                SemVer Version Identifier <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 1.4.0 or v1.4.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-accent-blue"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Completed Features */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 text-accent-blue text-xs font-mono font-bold flex items-center justify-center">
                2
              </span>
              <h2 className="text-base font-semibold text-white">Completed Features</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setFeatures([
                  ...features,
                  { id: `FEAT-${features.length + 101}`, category: 'FEATURE', title: '', description: '', sourceReference: '' },
                ])
              }
              className="inline-flex items-center space-x-1 text-xs text-accent-blue hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Feature Item</span>
            </button>
          </div>

          <div className="space-y-3">
            {features.map((feat, index) => (
              <div key={index} className="p-3.5 rounded-lg border border-slate-850 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-accent-blue bg-blue-950 px-2 py-0.5 rounded border border-blue-800">
                      {feat.id}
                    </span>
                    <input
                      type="text"
                      placeholder="Feature Title (e.g., Dynamic FX Conversion)"
                      value={feat.title}
                      onChange={(e) => {
                        const updated = [...features];
                        updated[index].title = e.target.value;
                        setFeatures(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white w-64 sm:w-80 focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Source Ref (e.g. PR #1042)"
                      value={feat.sourceReference}
                      onChange={(e) => {
                        const updated = [...features];
                        updated[index].sourceReference = e.target.value;
                        setFeatures(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-36 font-mono focus:outline-none focus:border-accent-blue"
                    />
                    {features.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFeatures(features.filter((_, i) => i !== index))}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  placeholder="Detailed description of what this feature accomplishes and technical mechanisms..."
                  value={feat.description}
                  onChange={(e) => {
                    const updated = [...features];
                    updated[index].description = e.target.value;
                    setFeatures(updated);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Bug Fixes */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 text-accent-blue text-xs font-mono font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-base font-semibold text-white">Defects & Bug Fixes</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setBugFixes([
                  ...bugFixes,
                  { id: `BUG-${bugFixes.length + 201}`, category: 'BUG_FIX', title: '', description: '', sourceReference: '' },
                ])
              }
              className="inline-flex items-center space-x-1 text-xs text-accent-blue hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Bug Fix Item</span>
            </button>
          </div>

          <div className="space-y-3">
            {bugFixes.map((bug, index) => (
              <div key={index} className="p-3.5 rounded-lg border border-slate-850 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                      {bug.id}
                    </span>
                    <input
                      type="text"
                      placeholder="Bug Title (e.g., Parallel Double-Refund Race Condition)"
                      value={bug.title}
                      onChange={(e) => {
                        const updated = [...bugFixes];
                        updated[index].title = e.target.value;
                        setBugFixes(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white w-64 sm:w-80 focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Source Ref (e.g. Issue #892)"
                      value={bug.sourceReference}
                      onChange={(e) => {
                        const updated = [...bugFixes];
                        updated[index].sourceReference = e.target.value;
                        setBugFixes(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-36 font-mono focus:outline-none focus:border-accent-blue"
                    />
                    {bugFixes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBugFixes(bugFixes.filter((_, i) => i !== index))}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  placeholder="Root cause explanation and what was resolved..."
                  value={bug.description}
                  onChange={(e) => {
                    const updated = [...bugFixes];
                    updated[index].description = e.target.value;
                    setBugFixes(updated);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Changed Behaviour */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 text-accent-blue text-xs font-mono font-bold flex items-center justify-center">
                4
              </span>
              <h2 className="text-base font-semibold text-white">Changed Behaviour & Deprecations</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setChangedBehavior([
                  ...changedBehavior,
                  { id: `CHG-${changedBehavior.length + 301}`, category: 'CHANGED_BEHAVIOR', title: '', description: '', sourceReference: '' },
                ])
              }
              className="inline-flex items-center space-x-1 text-xs text-accent-blue hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Changed Behavior</span>
            </button>
          </div>

          <div className="space-y-3">
            {changedBehavior.map((chg, index) => (
              <div key={index} className="p-3.5 rounded-lg border border-slate-850 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950 px-2 py-0.5 rounded border border-amber-800">
                      {chg.id}
                    </span>
                    <input
                      type="text"
                      placeholder="Behavior Title (e.g., Deprecation of v1/charges)"
                      value={chg.title}
                      onChange={(e) => {
                        const updated = [...changedBehavior];
                        updated[index].title = e.target.value;
                        setChangedBehavior(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white w-64 sm:w-80 focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      placeholder="Source Ref (e.g. RFC-089)"
                      value={chg.sourceReference}
                      onChange={(e) => {
                        const updated = [...changedBehavior];
                        updated[index].sourceReference = e.target.value;
                        setChangedBehavior(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-36 font-mono focus:outline-none focus:border-accent-blue"
                    />
                    {changedBehavior.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setChangedBehavior(changedBehavior.filter((_, i) => i !== index))}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  placeholder="Explain breaking contract changes, payload deprecations, or workflow differences..."
                  value={chg.description}
                  onChange={(e) => {
                    const updated = [...changedBehavior];
                    updated[index].description = e.target.value;
                    setChangedBehavior(updated);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Section 5: QA Summary & Verified Evidence */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 text-accent-blue text-xs font-mono font-bold flex items-center justify-center">
                5
              </span>
              <h2 className="text-base font-semibold text-white">QA Summary & Test Evidence</h2>
            </div>
            <button
              type="button"
              onClick={() =>
                setQaEvidence([
                  ...qaEvidence,
                  {
                    id: `QA-TEST-${String(qaEvidence.length + 1).padStart(2, '0')}`,
                    testType: 'Load / Stress',
                    summary: '',
                    evidenceDetails: '',
                    passed: true,
                    sourceReference: '',
                  },
                ])
              }
              className="inline-flex items-center space-x-1 text-xs text-accent-blue hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add QA Record</span>
            </button>
          </div>

          <div className="space-y-3">
            {qaEvidence.map((qa, index) => (
              <div key={index} className="p-3.5 rounded-lg border border-slate-850 bg-slate-900/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                      {qa.id}
                    </span>
                    <input
                      type="text"
                      placeholder="Test Type (e.g. Load, E2E, Security)"
                      value={qa.testType}
                      onChange={(e) => {
                        const updated = [...qaEvidence];
                        updated[index].testType = e.target.value;
                        setQaEvidence(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-36 focus:outline-none focus:border-accent-blue"
                    />
                    <input
                      type="text"
                      placeholder="Summary of Test Run"
                      value={qa.summary}
                      onChange={(e) => {
                        const updated = [...qaEvidence];
                        updated[index].summary = e.target.value;
                        setQaEvidence(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white w-48 sm:w-64 focus:outline-none focus:border-accent-blue"
                    />
                  </div>

                  <div className="flex items-center space-x-3">
                    <label className="flex items-center space-x-1.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={qa.passed}
                        onChange={(e) => {
                          const updated = [...qaEvidence];
                          updated[index].passed = e.target.checked;
                          setQaEvidence(updated);
                        }}
                        className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0"
                      />
                      <span className={qa.passed ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                        {qa.passed ? 'PASSED' : 'FAILED'}
                      </span>
                    </label>

                    <input
                      type="text"
                      placeholder="Source Ref (e.g. CI Run #9482)"
                      value={qa.sourceReference}
                      onChange={(e) => {
                        const updated = [...qaEvidence];
                        updated[index].sourceReference = e.target.value;
                        setQaEvidence(updated);
                      }}
                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 w-32 font-mono focus:outline-none focus:border-accent-blue"
                    />

                    {qaEvidence.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setQaEvidence(qaEvidence.filter((_, i) => i !== index))}
                        className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={2}
                  placeholder="Concrete evidence details, metrics, throughput thresholds, or logs..."
                  value={qa.evidenceDetails}
                  onChange={(e) => {
                    const updated = [...qaEvidence];
                    updated[index].evidenceDetails = e.target.value;
                    setQaEvidence(updated);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Section 6, 7, 8: Meta Information */}
        <div className="rounded-xl border border-slate-800 bg-obsidian-950 p-6 space-y-5">
          <div className="flex items-center space-x-2 border-b border-slate-800/80 pb-3">
            <span className="w-6 h-6 rounded-full bg-blue-950 border border-blue-800 text-accent-blue text-xs font-mono font-bold flex items-center justify-center">
              6-8
            </span>
            <h2 className="text-base font-semibold text-white">Limitations, Migration & Affected Users</h2>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <span>6. Known Limitations & Edge Cases</span>
                <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Explicitly declare known limitations, unmonitored thresholds, or throughput ceilings..."
                value={knownLimitations}
                onChange={(e) => setKnownLimitations(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <span>7. Migration or Configuration Notes</span>
                <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Database migrations, environment secrets, client-side configuration steps..."
                value={migrationNotes}
                onChange={(e) => setMigrationNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
                <span>8. Affected User Groups</span>
                <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. E-commerce merchants, Global checkout consumers, Billing platform admins"
                value={affectedUserGroups}
                onChange={(e) => setAffectedUserGroups(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent-blue"
              />
            </div>
          </div>
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-between pt-4">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-glow disabled:opacity-50 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Persisting Release Package...' : 'Save & Open Release Workspace'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
