import { Annotation } from '@langchain/langgraph'
import type { ProposedAction } from '@/lib/agents/shared/ai-client'
import type { MetaCampaign, MetaAd } from '@/lib/agents/shared/meta-client'
import type { OptimizerRule, MetaAdAccount } from '@/lib/db'

/**
 * LangGraph state for the Optimizer agent.
 *
 * Each optimizer run processes one rule set against its connected ad account.
 * If the rule covers multiple campaigns, it loops through each proposed action
 * and creates a separate action_log + HITL checkpoint per action.
 */
export const OptimizerStateAnnotation = Annotation.Root({
  // ── Inputs (set once at graph invocation) ───────────────────────────────────
  agency_id: Annotation<string>(),
  rule: Annotation<OptimizerRule>(),
  ad_account: Annotation<MetaAdAccount>(),

  // ── Fetched data ──────────────────────────────────────────────────────────
  campaigns: Annotation<MetaCampaign[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),
  ads: Annotation<MetaAd[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),

  // ── AI analysis output ────────────────────────────────────────────────────
  proposed_actions: Annotation<ProposedAction[]>({
    default: () => [],
    reducer: (_, next) => next,
  }),
  current_action_index: Annotation<number>({
    default: () => 0,
    reducer: (_, next) => next,
  }),

  // ── HITL state ────────────────────────────────────────────────────────────
  /** action_logs.id of the current pending approval */
  current_action_log_id: Annotation<string | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  /** Human's decision: true = approved, false = denied */
  human_approved: Annotation<boolean | null>({
    default: () => null,
    reducer: (_, next) => next,
  }),
  /** LangGraph thread_id — stored in action_logs for resumption */
  thread_id: Annotation<string>({
    default: () => '',
    reducer: (_, next) => next,
  }),

  // ── Execution results ─────────────────────────────────────────────────────
  executed_actions: Annotation<Array<{ action_log_id: string; result: unknown }>>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),
  errors: Annotation<string[]>({
    default: () => [],
    reducer: (prev, next) => [...prev, ...next],
  }),

  // ── Run metadata ──────────────────────────────────────────────────────────
  run_summary: Annotation<string>({
    default: () => '',
    reducer: (_, next) => next,
  }),
})

export type OptimizerState = typeof OptimizerStateAnnotation.State
