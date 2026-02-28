import { Annotation } from '@langchain/langgraph'
import type { ScrapedAd } from '@/lib/agents/shared/apify-client'
import type { SpyReport } from '@/lib/agents/shared/ai-client'
import type { SpyTracker } from '@/lib/db'

export const SpyStateAnnotation = Annotation.Root({
  // ── Inputs ────────────────────────────────────────────────────────────────
  agency_id: Annotation<string>(),
  tracker: Annotation<SpyTracker>(),
  agency_slack_webhook: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),

  // ── Apify run state ───────────────────────────────────────────────────────
  apify_run_id: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  apify_dataset_id: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  poll_attempts: Annotation<number>({
    default: () => 0,
    reducer: (_, next) => next,
  }),

  // ── Scraped data ──────────────────────────────────────────────────────────
  scraped_ads: Annotation<ScrapedAd[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),

  // ── AI analysis output ────────────────────────────────────────────────────
  report: Annotation<SpyReport | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  action_log_id: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),

  // ── Errors ────────────────────────────────────────────────────────────────
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),
})

export type SpyState = typeof SpyStateAnnotation.State
