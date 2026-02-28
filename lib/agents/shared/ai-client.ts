/**
 * AI client wrapper using Vercel AI SDK + Claude 3.5 Sonnet.
 * Centralises model config and provides typed helpers for agent prompts.
 */
import { generateObject, generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'
import type { MetaCampaign, MetaAd } from './meta-client'
import type { ScrapedAd } from './apify-client'
import type { OptimizerRule } from '@/lib/db'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Using gpt-4o for testing; swap to claude-opus-4-6 / claude-sonnet-4-6 for production
const MODEL = openai('gpt-4o')

// ─── Optimizer Analysis ───────────────────────────────────────────────────────

export const ProposedActionSchema = z.object({
  action_type: z.enum([
    'INCREASE_BUDGET',
    'DECREASE_BUDGET',
    'PAUSE_AD',
    'RESUME_AD',
    'ADJUST_BID',
    'NO_ACTION',
  ]),
  target_entity_type: z.enum(['campaign', 'adset', 'ad']),
  target_entity_id: z.string(),
  target_entity_name: z.string(),
  current_value: z.record(z.string(), z.unknown()),
  proposed_value: z.record(z.string(), z.unknown()),
  reasoning: z.string().describe('Plain-English explanation shown to the user in the approval inbox'),
  confidence_score: z.number().min(0).max(1),
  urgency: z.enum(['low', 'medium', 'high']),
})

export type ProposedAction = z.infer<typeof ProposedActionSchema>

const ProposedActionsSchema = z.object({
  actions: z.array(ProposedActionSchema),
  summary: z.string().describe('One-sentence summary of the optimizer run'),
})

/**
 * Analyze campaign performance data against the rule's guardrails and
 * return a list of recommended actions with plain-English reasoning.
 */
export async function analyzePerformanceAndPropose(
  campaigns: MetaCampaign[],
  ads: MetaAd[],
  rule: OptimizerRule
): Promise<ProposedAction[]> {
  const { object } = await generateObject({
    model: MODEL,
    schema: ProposedActionsSchema,
    system: `You are an expert Meta Ads optimizer. Your job is to analyze campaign performance data and recommend specific, justified actions within strict guardrails. Be conservative — when in doubt, do nothing. Every recommendation must have clear data-backed reasoning that a human media buyer will find convincing.`,
    prompt: `
Analyze the following Meta Ads performance data and propose actions based on the rule's guardrails.

## Rule Configuration
- Name: ${rule.name}
- Max daily budget ceiling: $${rule.max_daily_budget_usd ?? 'unlimited'} (HARD LIMIT — never exceed)
- Min daily budget floor: $${rule.min_daily_budget_usd ?? 0}
- Target ROAS: ${rule.target_roas ?? 'not set'}x
- Min ROAS before pausing: ${rule.min_roas_threshold ?? 'not set'}x
- Attribution window: ${rule.attribution_window}
- Min spend before any action: $${rule.min_spend_before_action_usd}
- Max single budget increase: ${rule.max_budget_increase_pct}%
- Max ad frequency before pause: ${rule.max_ad_frequency ?? 'not set'}

## Campaign Data (last 7 days)
${JSON.stringify(campaigns, null, 2)}

## Ad-Level Data (last 7 days)
${JSON.stringify(ads.slice(0, 20), null, 2)}

## Instructions
1. Only propose actions that are within the guardrail limits above.
2. For INCREASE_BUDGET: new value must not exceed max_daily_budget_usd.
3. For PAUSE_AD: only if spend > min_spend_before_action_usd AND ROAS < min_roas_threshold.
4. Express budget values in USD (not cents).
5. If no action is warranted, return a single NO_ACTION entry.
6. The reasoning field will be shown directly to the human in the approval UI — write it clearly.
`.trim(),
  })

  return object.actions.filter(a => a.action_type !== 'NO_ACTION')
}

// ─── Spy Analysis ─────────────────────────────────────────────────────────────

export const SpyReportSchema = z.object({
  top_ads: z.array(z.object({
    ad_id: z.string(),
    page_name: z.string(),
    media_type: z.string(),
    active_days: z.number(),
    why_it_works: z.string().describe('2-3 sentence analysis of why this ad has longevity'),
    hook_pattern: z.string().describe('The opening hook pattern used'),
    cta_pattern: z.string().describe('The call-to-action pattern used'),
  })),
  dominant_format: z.string(),
  avg_longevity_days: z.number(),
  key_insights: z.string().describe('3-5 sentence strategic summary for the agency'),
  recommended_tests: z.array(z.string()).describe('Specific creative tests to run based on findings'),
  confidence: z.number().min(0).max(1),
})

export type SpyReport = z.infer<typeof SpyReportSchema>

/**
 * Analyze scraped competitor ads and produce a structured intelligence report.
 */
export async function analyzeCompetitorAds(
  ads: ScrapedAd[],
  competitorName: string,
  context?: string
): Promise<SpyReport> {
  if (ads.length === 0) {
    return {
      top_ads: [],
      dominant_format: 'UNKNOWN',
      avg_longevity_days: 0,
      key_insights: `No ads meeting the longevity threshold were found for ${competitorName}. This could mean they are frequently refreshing creatives (a sign of testing) or the scraper did not find matching ads.`,
      recommended_tests: [],
      confidence: 0.3,
    }
  }

  const { object } = await generateObject({
    model: MODEL,
    schema: SpyReportSchema,
    system: `You are a world-class creative strategist and Meta Ads expert. You analyze competitor advertising patterns to extract actionable intelligence for growth agencies. Focus on what makes ads run for a long time (longevity = the market is rewarding this creative).`,
    prompt: `
Analyze these competitor ads scraped from the Meta Ad Library for ${competitorName}.
These are sorted by longevity (longest-running first). Focus on the top ads — long-running ads are proven performers.

${context ? `Context about the client: ${context}\n` : ''}

## Scraped Ads (${ads.length} total, sorted by longevity)
${JSON.stringify(ads.slice(0, 15), null, 2)}

Produce a strategic intelligence report that helps a performance marketing agency understand:
1. What creative formats and hooks are working
2. Why the long-running ads have longevity
3. What specific tests the agency should run against their own campaigns
`.trim(),
  })

  return object
}

/**
 * Generate a concise plain-text Slack-friendly report summary.
 */
export async function generateReportNarrative(report: SpyReport, competitorName: string): Promise<string> {
  const { text } = await generateText({
    model: MODEL,
    prompt: `Summarize this competitor ad intelligence report for ${competitorName} in 3 punchy bullet points for a Slack message. Be specific and actionable. Max 50 words total.

Report: ${JSON.stringify(report)}`,
  })

  return text
}
