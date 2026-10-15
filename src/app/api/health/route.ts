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
    ? process.env.GROQ_MODEL || process.env.OPENAI_MODEL || (isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini')
    : 'demo-rule-engine-v1';

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
      provider: providerName,
      model: activeModel,
      apiKeyConfigured,
      demoModeForced,
      note: isDemo 
        ? 'Running in zero-key deterministic demo mode. Generates truthful, evidence-grounded briefs without external API requests. To enable live LLM synthesis, set GROQ_API_KEY or OPENAI_API_KEY in .env.'
        : `Live inference active via ${providerName} (${activeModel}).`,
    },
    security: {
      autoDeploymentDisabled: true,
      humanReviewRequired: true,
      clientKeyExposure: 'NONE (Server-side exclusive)',
    },
  });
}
