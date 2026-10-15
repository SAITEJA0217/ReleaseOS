import { prisma } from '@/lib/db';
import { validateRequiredSections } from '@/lib/validations/release';
import DashboardClient, { ReleaseListItem, SystemHealth } from '@/components/dashboard/DashboardClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  let initialReleases: ReleaseListItem[] = [];
  let initialHealth: SystemHealth | null = null;

  try {
    const releases = await prisma.release.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: true,
            qaEvidence: true,
          },
        },
        generatedBriefs: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            statements: {
              include: {
                reviewDecisions: {
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    initialReleases = releases.map((rel: any) => {
      const latestVersion = rel.versions[0];
      const latestBrief = rel.generatedBriefs[0];

      let pendingReviewCount = 0;
      let unsupportedWarningsCount = 0;
      let staleCount = 0;

      if (latestBrief) {
        for (const stmt of latestBrief.statements) {
          const latestDecision = stmt.reviewDecisions[0]?.decision;
          if (!latestDecision || latestDecision === 'REOPENED') {
            pendingReviewCount++;
          }
          if (stmt.verificationStatus === 'UNSUPPORTED' || stmt.verificationStatus === 'PARTIALLY_SUPPORTED' || stmt.riskWarning) {
            unsupportedWarningsCount++;
          }
          if (stmt.isStale) {
            staleCount++;
          }
        }
      }

      // Check missing sections on latest version package
      const missingCheck = latestVersion
        ? validateRequiredSections({
            name: rel.name,
            version: latestVersion.version,
            features: latestVersion.items.filter((i: any) => i.category === 'FEATURE'),
            bugFixes: latestVersion.items.filter((i: any) => i.category === 'BUG_FIX'),
            changedBehavior: latestVersion.items.filter((i: any) => i.category === 'CHANGED_BEHAVIOR'),
            qaEvidence: latestVersion.qaEvidence,
            knownLimitations: latestVersion.limitations,
            migrationNotes: latestVersion.migrationNotes,
            affectedUserGroups: latestVersion.affectedUserGroups,
          })
        : { isValid: false, missingCount: 8, checks: [] };

      return {
        id: rel.id,
        name: rel.name,
        currentVersion: rel.currentVersion,
        status: rel.status,
        createdAt: rel.createdAt.toISOString(),
        updatedAt: rel.updatedAt.toISOString(),
        versionsCount: rel.versions.length,
        hasBrief: Boolean(latestBrief),
        latestBriefId: latestBrief?.id,
        pendingReviewCount,
        unsupportedWarningsCount,
        staleCount,
        missingSectionsCount: missingCheck.missingCount,
      };
    });

    const apiKey = process.env.GROQ_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
    const apiKeyConfigured = Boolean(apiKey);
    const demoModeForced = process.env.DEMO_MODE === 'true';
    const isDemo = demoModeForced || !apiKeyConfigured;
    const isGroq = Boolean(process.env.GROQ_API_KEY || apiKey?.startsWith('gsk_') || process.env.OPENAI_BASE_URL?.includes('groq'));

    const providerName = isDemo
      ? 'Deterministic Rule-Based Local Synthesizer'
      : isGroq
      ? 'Groq Cloud High-Speed Inference API'
      : 'OpenAI-Compatible Live API';

    const activeModel = apiKeyConfigured && !demoModeForced
      ? process.env.GROQ_MODEL || process.env.OPENAI_MODEL || (isGroq ? 'qwen/qwen3.8-27b' : 'gpt-4o-mini')
      : 'demo-rule-engine-v1';

    initialHealth = {
      status: 'HEALTHY',
      database: {
        provider: 'Neon Serverless PostgreSQL (Prisma ORM)',
        status: 'CONNECTED',
        releasesCount: releases.length,
      },
      aiEngine: {
        isDemoMode: isDemo,
        provider: providerName,
        model: activeModel,
        apiKeyConfigured,
        note: isDemo
          ? 'Running in zero-key deterministic demo mode. Generates truthful, evidence-grounded briefs without external API requests. To enable live LLM synthesis, set GROQ_API_KEY in .env.'
          : `Live inference active via ${providerName} (${activeModel}).`,
      },
    };
  } catch (err) {
    console.error('Error fetching initial releases on server in page.tsx:', err);
  }

  return (
    <DashboardClient
      initialReleases={initialReleases}
      initialHealth={initialHealth}
    />
  );
}
