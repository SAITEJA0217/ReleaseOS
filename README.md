# ReleaseOS — AI Release Communication & Readiness Assistant

> An evidence-traceable, human-gated AI release readiness and communication platform for software engineering and product teams.

[![Tests: Vitest](https://img.shields.io/badge/Tests-15%20Passed-emerald.svg)](https://vitest.dev)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue.svg)](https://www.typescriptlang.org)
[![Framework: Next.js](https://img.shields.io/badge/Next.js-14%20App%20Router-black.svg)](https://nextjs.org)
[![Database: Prisma / PostgreSQL](https://img.shields.io/badge/ORM-Prisma%205-5A67D8.svg)](https://www.prisma.io)
[![Safety: Zero-Deploy Lock](https://img.shields.io/badge/Safety-AI%20Never%20Deploys-red.svg)](#security-and-responsible-ai-architecture)

---

## 🚀 Live Deployment & Reviewer Quick Links

| Resource | URL | Description |
|---|---|---|
| **Production Application** | [https://a-delta-orcin.vercel.app](https://a-delta-orcin.vercel.app) | Live deployed app hosted on Vercel |
| **GitHub Repository** | [https://github.com/SAITEJA0217/ReleaseOS](https://github.com/SAITEJA0217/ReleaseOS) | Full source code with isolated secrets |
| **Cloud Database** | Neon Serverless PostgreSQL | High-performance pooled PostgreSQL |
| **AI Synthesis Engine** | Groq Cloud High-Speed Inference | `qwen/qwen3.8-27b` (~2.5s inference) |
| **Health Check Endpoint** | [https://a-delta-orcin.vercel.app/api/health](https://a-delta-orcin.vercel.app/api/health) | Live telemetry and provider statuses |

---

## 📋 Reviewer Instructions

Follow this recommended evaluation path to inspect and verify the system in under 5 minutes:

### 1. System Health & Infrastructure Inspection
- Open [https://a-delta-orcin.vercel.app](https://a-delta-orcin.vercel.app).
- Observe the **System Telemetry Banner** at the top of the dashboard:
  - Confirms **Neon Serverless PostgreSQL (CONNECTED)**.
  - Confirms **Groq Cloud High-Speed Inference API (`qwen/qwen3.8-27b`) (Active)**.
  - Confirms zero client-side secret leakage and human-review gate lock.
- View raw JSON health at [https://a-delta-orcin.vercel.app/api/health](https://a-delta-orcin.vercel.app/api/health).

### 2. Live AI Brief Synthesis
- On the dashboard, click **Open Workspace** on the pre-loaded release: `Release Horizon - Multi-Currency Payment Engine (v1.4.0)`.
- Click **Regenerate Briefs** / **Synthesize Release Brief**.
- Watch the live Groq inference execute in real-time (~2.5–5s) and populate:
  - An **Internal Technical Brief** with architectural breakdown.
  - A **Client/Stakeholder Brief** with business impacts.
  - Structured statements categorized with impact levels (`BREAKING`, `HIGH`, `MEDIUM`, `LOW`).

### 3. Evidence Citation Grounding & Traceability
- Look at Statement 1 or Statement 2 in the Review Workbench.
- Click any evidence citation badge (e.g. `FEAT-101`, `QA-E2E-02`).
- The **Evidence Reference Inspector** drawer slides open, displaying:
  - Exact source item text and git PR / ticket references.
  - Deterministic verification status (`SUPPORTED` or `UNSUPPORTED`).
  - Evidence validation rationale.

### 4. Human Review & Audit Workflow
- **Approve**: Click **Approve** on Statement 1. Notice the reviewer identity (`Staff Engineer`) and live timestamp lock in.
- **Reject & Exclude**: Click **Reject & Exclude** on another statement, enter a reason (e.g. *"Requires penetration test signoff"*), and submit.
- **Reviewed Final Brief Verification**: Click the **Reviewed Final Brief** tab.
  - Verify that **ONLY** approved statements are present in the final release brief.
  - Verify that the rejected statement is barred and clearly cataloged under **Audit Exclusions & Unresolved Claims** with its rejection reason.
  - Verify the mandatory safety disclaimer: *"ReleaseOS assists in synthesis and evidence traceability; it does NOT deploy code or authorize production rollouts automatically."*

### 5. Stale Statement Detection
- Make a change to a source item (or simulate via API `POST /api/releases/[id]/statements/stale`).
- Notice ReleaseOS detects cryptographic content fingerprint divergence and flags affected statements as **STALE**, requiring re-review.

---

## 🧪 Sample Inputs for Testing

You can use the **1-Click Template** button in the UI (`/releases/new`), or submit the following verified payload via API or form:

### Sample Release Package (v2.1.0 — Global Webhook Gateway)

```json
{
  "name": "Global Webhook Gateway",
  "version": "2.1.0",
  "features": [
    {
      "id": "FEAT-301",
      "title": "HMAC-SHA256 Signature Verification",
      "description": "Every incoming and outgoing webhook now includes a cryptographically signed X-Signature-256 header with replay protection.",
      "sourceReference": "PR #412 (security/crypto-engine)"
    },
    {
      "id": "FEAT-302",
      "title": "Automatic Exponential Backoff Retry Pipeline",
      "description": "Failed webhook deliveries are queued into a distributed Redis queue and retried with jitter up to 72 hours.",
      "sourceReference": "PR #418 (infra/retry-queue)"
    }
  ],
  "bugFixes": [
    {
      "id": "BUG-204",
      "title": "Fix TCP Socket Leak on TLS Handshake Timeout",
      "description": "Resolved lingering TCP socket descriptors when external customer webhooks fail to respond within 3000ms.",
      "sourceReference": "Issue #891 / Commit 8f4a1c"
    }
  ],
  "changedBehavior": [
    {
      "id": "DEP-105",
      "title": "Deprecate Legacy v1 Webhook Header Payload",
      "description": "The X-Legacy-Webhook-Key header is deprecated and will be removed in v3.0.0. Clients must migrate to Bearer tokens.",
      "sourceReference": "RFC-77 / PR #429"
    }
  ],
  "qaEvidence": [
    {
      "id": "QA-SEC-01",
      "testType": "SECURITY",
      "summary": "100% test pass on HMAC replay attack prevention test suite.",
      "evidenceDetails": "500 concurrent replayed requests rejected with 401 Unauthorized across test clusters.",
      "passed": true,
      "sourceReference": "Run #9841 / security-pipeline"
    },
    {
      "id": "QA-LOAD-01",
      "testType": "LOAD_TEST",
      "summary": "Sustained 50,000 deliveries/sec at p99 latency < 45ms.",
      "evidenceDetails": "Soak test ran for 4 consecutive hours with zero socket exhaustions.",
      "passed": true,
      "sourceReference": "Grafana Dashboard / Run #9843"
    }
  ],
  "limitations": "Maximum payload size capped at 10MB per webhook dispatch. Custom SSL certificates with self-signed CAs are not supported.",
  "migrationNotes": "Database migration `20261015_add_webhook_signatures` is zero-downtime and runs backward-compatible column additions.",
  "affectedUserGroups": "Platform integrators, third-party webhook consumers, and API gateway administrators."
}
```

---

## 1. Product Overview

In modern continuous delivery environments, engineering release notes and stakeholder communications suffer from three systemic risks:
1. **Hallucinated or Exaggerated Claims**: Factual statements exceeding empirical QA testing (e.g., claiming "zero downtime" or "infinite scalability" without load test evidence).
2. **Untraced Information Gaps**: Disconnects between customer-facing release notes and git PRs, bug tickets, or database migrations.
3. **Stale Communications**: Release packages evolve rapidly between initial draft and production deployment; when an engineer changes an API contract, previously generated and approved statements quietly become invalid.

**ReleaseOS** solves this by establishing a deterministic, citation-grounded verification pipeline:
- Ingests structured software release packages (features, bug fixes, changed behaviors, QA test runs, limitations, migrations, and affected user cohorts).
- Synthesizes two distinct briefs: an **Internal Technical Release Brief** (for engineers, DevOps, and SREs) and a **Non-Technical Stakeholder/Client Brief** (for customers, PMs, and executives).
- Every single factual statement is mapped to a physical database record (`FEAT-...`, `QA-...`, `BUG-...`) with cryptographic content fingerprints.
- If an underlying source item changes or is deleted, ReleaseOS identifies the affected statements and marks them **STALE**, requiring renewed human review.
- The **Reviewed Final Brief** strictly excludes rejected or unresolved claims.
- **Fundamental Safety Invariant**: The AI agent **NEVER** deploys software, triggers infrastructure changes, or independently authorizes a production rollout.

---

## 2. Core Architecture & Evidence Traceability Engine

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Structured Release Package                        │
 │  (Features, Bug Fixes, Changed Behavior, QA Evidence, Limitations)     │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │            Deterministic Section Completeness Validator                │
 │    (Rule-based evaluation of all 8 mandatory release package sections) │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                    Server-Side AI Synthesis Engine                     │
 │  • OpenAI-Compatible Live LLM (when OPENAI_API_KEY is supplied)        │
 │  • Deterministic Rule Synthesizer (when running in Zero-Key Demo Mode) │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                  Evidence Grounding & Citation Verifier                │
 │  • Enforces valid foreign citations against stored database IDs        │
 │  • Classifies Verification Status:                                     │
 │      SUPPORTED | PARTIALLY_SUPPORTED | UNSUPPORTED | UNKNOWN           │
 │  • Flags ungrounded claims, missing citations, or test failures       │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │               Human-in-the-Loop Review & Audit Workbench               │
 │  • Statement Inspection with full cited source excerpts                │
 │  • Actions: Approve | Reject & Exclude | Edit Inline | Reopen          │
 │  • Dependency Fingerprint Tracking & Automatic Stale Invalidation      │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                         Reviewed Final Brief                           │
 │  • ONLY contains human-approved statements                             │
 │  • Explicitly records rejected and unresolved exclusions               │
 │  • Clean print layout and Markdown / PDF export                        │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Key Features Implemented

### A. Operations & Readiness Console (Dashboard)
- Real-time KPI telemetry calculated directly from persistent database records:
  - Total immutable version snapshots.
  - Statements awaiting human review.
  - Releases with missing mandatory sections.
  - Releases with unsupported claims or stale warning flags.
- Real-time system health banner showing active database provider, connection status, and AI synthesis mode (Live LLM vs Zero-Key Local Mode).
- Filterable and searchable release inventory with live status tags (`DRAFT`, `IN_REVIEW`, `REVIEWED`).

### B. Structured Release Package Editor
- Multi-entry form covering all 8 mandatory release-package sections:
  1. Release name and SemVer version identifier.
  2. Completed features (ID, Title, Description, Source Reference).
  3. Bug fixes (ID, Title, Description, Source Reference).
  4. Changed behaviour & contract deprecations (ID, Title, Description, Source Reference).
  5. QA summary & verified evidence (ID, Test Type, Summary, Evidence Details, Passed boolean, Source Reference).
  6. Known limitations and unmonitored thresholds.
  7. Migration or configuration notes.
  8. Affected user cohorts and roles.
- Deterministic section completeness tracker running live rule-based validation (never delegates field completeness checks to an LLM).
- 1-click **Enterprise Template Loader** for instant testing and evaluation.

### C. Evidence-Backed AI Generation Workflow
- Server-side generation using strict Zod schema parsing.
- Generates separate technical and stakeholder outputs with tailored impact classifications: `LOW`, `MEDIUM`, `HIGH`, `BREAKING`.
- Grounds every generated statement against physical database records.
- Flags claims exceeding QA test thresholds (e.g. "100% zero downtime" claims that lack empirical soak test proof).
- Dual Engine Design:
  - If `OPENAI_API_KEY` is provided, executes live server-side LLM inference.
  - If API keys are omitted or `DEMO_MODE=true`, automatically runs the deterministic local synthesis engine, generating 100% truthful, evidence-backed briefs with zero network latency.

### D. Evidence Inspector
- Interactive citation badges on every statement card (`FEAT-102`, `QA-LOAD-01`).
- Clicking any citation opens the Evidence Inspector drawer/modal, displaying:
  - Database record existence status (verifies whether the source exists or was removed).
  - Exact supporting text excerpt and source reference (PR number, Jira ID, CI run).
  - QA pass/fail status and test metrics.

### E. Human Review & Audit Workbench
- Reviewer actions:
  - **Approve**: Persists approval with reviewer name and timestamp.
  - **Reject & Exclude**: Removes the claim from the final brief and records the reviewer's justification note.
  - **Edit Inline**: Allows the reviewer to modify wording while preserving the audit trail of the original AI output.
  - **Reopen**: Allows previously approved statements to be re-evaluated when requirements change.
- Preserves full chronological review decision history.

### F. Immutable Release Versioning & Granular Diffing
- Stores separate, immutable version snapshots (`v1.3.0`, `v1.4.0`, etc.) with SHA-256 content fingerprints.
- Interactive Version Diff Viewer: Select any two versions to inspect:
  - Added items (green).
  - Removed items (red).
  - Modified items (amber with before/after comparisons).
  - QA test differentials and limitations diffs.

### G. Stale Statement Detection Engine
- Each statement stores a snapshot of the cryptographic fingerprints of its cited source items.
- When an engineer modifies or removes a release item:
  - ReleaseOS determines exactly which statements depend on the modified item.
  - Marks affected statements as **STALE** with the precise reason (e.g., `"Source item FEAT-102 content or scope was modified"`).
  - Statements citing unaffected sources remain current and valid!
  - Automatically reopens previously approved decisions on stale statements to enforce renewed human signoff.

### H. Reviewed Final Brief & Clean Print Export
- Professional document layout containing ONLY explicitly approved content.
- Unresolved and rejected statements are quarantined under the "Audit Exclusions" section.
- Signoff block with reviewer names, timestamps, and safety disclaimers.
- Clean Markdown export ("Copy Markdown") and print-ready layout (`window.print()` / PDF export).

---

## 4. Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript (Strict type checking) |
| **Styling** | Tailwind CSS (Dark Obsidian SaaS Design System) |
| **Icons** | Lucide React |
| **Validation** | Zod (Request schemas, package validation, AI structured output) |
| **Database & ORM** | Prisma 5 with persistent SQL storage (PostgreSQL in production, SQLite local engine) |
| **AI Synthesis** | Server-side OpenAI-compatible API + Deterministic Zero-Key Local Synthesizer |
| **Test Suite** | Vitest with 15 focused end-to-end and unit test scenarios |
| **Logging** | Structured JSON logging with sanitization, timing, and correlation IDs |

---

## 5. Getting Started (Local Setup)

### Prerequisites
- Node.js `v18.x` or higher (`v24.x` verified)
- npm `v9.x` or higher (`v11.x` verified)

### 1. Clone & Install Dependencies
```bash
git clone <repo-url>
cd release-os
npm install
```

### 2. Environment Configuration
Copy the provided `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Default `.env` settings:
```ini
DATABASE_URL="file:./dev.db"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
DEMO_MODE="false"

# Optional: Add your live OpenAI-compatible key for live model generation
# OPENAI_API_KEY="sk-..."
# OPENAI_BASE_URL="https://api.openai.com/v1"
# OPENAI_MODEL="gpt-4o-mini"
```

### 3. Initialize Persistent Database
Generate the Prisma Client and push the database schema:
```bash
npm run db:generate
npm run db:push
```

### 4. Seed Demo Release Data
Populate the database with a multi-version sample package (`Release Horizon v1.4.0` and `v1.3.0` with features, QA tests, generated statements, and review decisions):
```bash
npm run db:seed
```

### 5. Start Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 6. Running Tests

Run the complete Vitest test suite covering all 15 required verification scenarios:
```bash
npm test
```
To run tests in watch mode:
```bash
npm run test:watch
```

All 15 focused test scenarios pass:
1. Missing required release sections detection.
2. Valid release package creation.
3. Invalid API input rejection.
4. Non-existent evidence reference detection (`UNSUPPORTED`).
5. Unsupported-claim warnings for exaggerated claims.
6. Separate technical and stakeholder brief output.
7. Release version persistence and content fingerprinting.
8. Added, removed, and modified version items diffing.
9. Stale statement detection for modified source dependencies.
10. Unchanged statements remaining current.
11. Human approval and rejection persistence.
12. Final brief strictly excluding rejected and unresolved statements.
13. AI provider failure handling without fabricating output.
14. Malformed AI structured output rejection.
15. Historical review decision audit trail preservation.

---

## 7. Production Build & Deployment

### Production Build
Validate production bundling and static page optimization:
```bash
npm run build
npm start
```

### Deploying to Vercel with PostgreSQL (e.g. Neon, Supabase, AWS RDS)
1. In your cloud PostgreSQL instance (Neon, Supabase, or AWS RDS), copy your connection string:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/releaseos?sslmode=require"
   ```
2. Switch Prisma datasource to PostgreSQL:
   ```bash
   cp prisma/schema.postgresql.prisma prisma/schema.prisma
   npx prisma generate
   npx prisma db push
   ```
3. Set the following environment variables in your Vercel Project Settings:
   - `DATABASE_URL`: Connection string to your managed PostgreSQL database.
   - `OPENAI_API_KEY`: Your OpenAI or compatible LLM provider API key (server-side only).
   - `OPENAI_MODEL`: `gpt-4o-mini` (or equivalent).
   - `NEXT_PUBLIC_APP_URL`: Your Vercel production URL.
4. Deploy with Vercel CLI or via GitHub integration:
   ```bash
   vercel --prod
   ```

---

## 8. Demo Walkthrough Guide

Follow these steps to experience the complete ReleaseOS workflow:
1. **Explore the Dashboard**:
   - Observe live KPI cards showing versions, pending reviews, and quality flags.
   - Note the system telemetry banner showing active DB connection and AI mode.
2. **Open the Seeded Release Horizon (1.4.0)**:
   - Click **Open Workspace** on the Release Horizon row.
3. **Inspect Statements in the Review Workbench**:
   - Review statements with `BREAKING` and `MEDIUM` impact tags.
   - Notice the unverified statement card with the red **Claim Exceeds Evidence Warning** ("100% zero downtime").
4. **Inspect Evidence Citations**:
   - Click the citation badge `FEAT-102` on Statement 1.
   - The Evidence Reference Inspector opens, showing the exact source text, verification status, and PR reference.
5. **Take Review Actions**:
   - Click **Approve** on Statement 2. Notice the reviewer identity (`Staff Engineer`) and timestamp update immediately.
   - Click **Reject & Exclude** on Statement 4 (the exaggerated claim) and enter a reason (e.g., "Violates evidence thresholds").
6. **Compare Versions**:
   - Switch to the **Version Diff & History** tab.
   - Select Base Version `1.3.0` and Target Version `1.4.0`.
   - Click **Compare Versions** to see green/red/amber differential indicators for added features, resolved bug fixes, and new QA tests.
7. **View & Export the Reviewed Final Brief**:
   - Switch to the **Reviewed Final Brief** tab.
   - Notice that the final brief contains ONLY approved statements.
   - The rejected statement appears explicitly under **Audit Exclusions & Unresolved Claims**.
   - Click **Copy Markdown** or **Print Document / PDF** for an audit-ready compliance export.

---

## 9. Security and Responsible AI Architecture

- **Prompt Injection Defense**: User-supplied release content is parsed purely as untrusted data inputs within structured Zod schemas. System instructions explicitly forbid executing tools or commands.
- **Server-Side API Credentials**: `OPENAI_API_KEY` is accessed exclusively in server-side Next.js route handlers and is NEVER exposed in client bundles or API payloads.
- **Strict Evidence Grounding**: The system does not trust LLM self-reporting; every cited source ID is cross-referenced against stored database records. If an ID does not exist, it is deterministically flagged as `UNSUPPORTED`.
- **Zero-Deploy Safety Lock**: ReleaseOS assists in synthesis and evidence traceability; it contains NO deployment APIs, webhook triggers for release execution, or automated production rollout capabilities. Human approval is strictly required.

---

## 10. Limitations & Excluded Scope

- **Direct VCS Pull Requests Execution**: While ReleaseOS cites PR numbers and git commits, it does not directly trigger git push or git merge operations by design.
- **Live Continuous Integration Triggering**: QA test runs are ingested as evidence artifacts rather than triggering external CI builds.
- **Automated Deployments**: As specified in the product invariants, automated deployment is excluded by design to prevent unverified production rollouts.
