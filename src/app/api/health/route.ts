import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  let dbStatus = 'CONNECTED';
  let dbError: string | null = null;
  let releaseCount = 0;

  try {
    releaseCount = await prisma.release.count();
  } catch (err) {
    dbStatus = 'DISCONNECTED';
    dbError = err instanceof Error ? err.message : String(err);
  }

  const apiKeyConfigured = Boolean(process.env.OPENAI_API_KEY?.trim());
  const demoModeForced = process.env.DEMO_MODE === 'true';
  const isDemo = demoModeForced || !apiKeyConfigured;

  return NextResponse.json({
    status: dbStatus === 'CONNECTED' ? 'HEALTHY' : 'DEGRADED',
    timestamp: new Date().toISOString(),
    database: {
      provider: 'SQLite / Prisma (ACID Relational Engine: dev.db)',
      status: dbStatus,
      releasesCount: releaseCount,
      error: dbError,
    },
    aiEngine: {
      isDemoMode: isDemo,
      provider: apiKeyConfigured && !demoModeForced ? 'OpenAI-Compatible Live API' : 'Deterministic Rule-Based Local Synthesizer',
      model: apiKeyConfigured && !demoModeForced ? process.env.OPENAI_MODEL || 'gpt-4o-mini' : 'demo-rule-engine-v1',
      apiKeyConfigured,
      demoModeForced,
      note: isDemo 
        ? 'Running in zero-key deterministic demo mode. Generates truthful, evidence-grounded briefs without external API requests. To enable live LLM synthesis, set OPENAI_API_KEY in .env.'
        : 'Live model configured for server-side generation.',
    },
    security: {
      autoDeploymentDisabled: true,
      humanReviewRequired: true,
      clientKeyExposure: 'NONE (Server-side exclusive)',
    },
  });
}
