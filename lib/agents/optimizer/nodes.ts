/**
 * Optimizer agent node implementations.
 */
import { interrupt } from '@langchain/langgraph'
import { eq, sql } from 'drizzle-orm'
import { fetchCampaigns, fetchAds, updateCampaignBudget, setAdStatus } from '@/lib/agents/shared/meta-client'
import { analyzePerformanceAndPropose } from '@/lib/agents/shared/ai-client'
import { db, actionLogsTable, optimizerRulesTable } from '@/lib/db'
import type { OptimizerState } from './state'

// ─── Node 1: Fetch campaign + ad data from Meta API ──────────────────────────

export async function fetchCampaignData(state: OptimizerState): Promise<Partial<OptimizerState>> {
  console.log(`[Optimizer] Fetching campaigns for account ${state.ad_account.ad_account_id}`)

  try {
    const campaigns = await fetchCampaigns(
      state.ad_account.ad_account_id,
      state.ad_account.access_token,
      state.rule.attribution_window
    )

    const filtered = state.rule.campaign_ids.length > 0
      ? campaigns.filter(c => state.rule.campaign_ids.includes(c.id))
      : campaigns.filter(c => c.status === 'ACTIVE')

    const allAds = (await Promise.all(
      filtered.slice(0, 5).map(c => fetchAds(c.id, state.ad_account.access_token))
    )).flat()

    return { campaigns: filtered, ads: allAds }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { errors: [`fetchCampaignData: ${message}`] }
  }
}

// ─── Node 2: Analyze performance + propose actions via Claude ─────────────────

export async function analyzePerformance(state: OptimizerState): Promise<Partial<OptimizerState>> {
  if (state.campaigns.length === 0) {
    return { run_summary: 'No active campaigns found for this rule.' }
  }

  console.log(`[Optimizer] Analyzing ${state.campaigns.length} campaigns with Claude`)

  try {
    const actions = await analyzePerformanceAndPropose(
      state.campaigns,
      state.ads,
      state.rule
    )

    console.log(`[Optimizer] Claude proposed ${actions.length} actions`)
    return {
      proposed_actions: actions,
      run_summary: `Analyzed ${state.campaigns.length} campaigns. ${actions.length} action(s) proposed.`,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { errors: [`analyzePerformance: ${message}`] }
  }
}

// ─── Node 3: Guardrail check ──────────────────────────────────────────────────

export function checkGuardrails(state: OptimizerState): Partial<OptimizerState> {
  const rule = state.rule
  const safe = state.proposed_actions.filter(action => {
    if (action.action_type === 'INCREASE_BUDGET') {
      const proposed = action.proposed_value.daily_budget_usd as number
      if (rule.max_daily_budget_usd && proposed > Number(rule.max_daily_budget_usd)) {
        console.warn(`[Optimizer] GUARDRAIL BLOCKED: Proposed $${proposed} exceeds ceiling $${rule.max_daily_budget_usd}`)
        return false
      }
    }

    if (action.action_type === 'DECREASE_BUDGET') {
      const proposed = action.proposed_value.daily_budget_usd as number
      if (rule.min_daily_budget_usd && proposed < Number(rule.min_daily_budget_usd)) {
        console.warn(`[Optimizer] GUARDRAIL BLOCKED: Proposed $${proposed} below floor $${rule.min_daily_budget_usd}`)
        return false
      }
    }

    if (action.action_type === 'PAUSE_AD') {
      const spend = (action.current_value.spend_7d as number) ?? 0
      if (spend < Number(rule.min_spend_before_action_usd)) {
        console.warn(`[Optimizer] GUARDRAIL BLOCKED: Ad spend $${spend} below min $${rule.min_spend_before_action_usd}`)
        return false
      }
    }

    return true
  })

  return { proposed_actions: safe }
}

// ─── Node 4: Wait for human approval ─────────────────────────────────────────

export async function waitForHuman(state: OptimizerState): Promise<Partial<OptimizerState>> {
  const action = state.proposed_actions[state.current_action_index]

  if (!action) {
    return { run_summary: 'All actions processed.' }
  }

  console.log(`[Optimizer] Waiting for human approval on: ${action.action_type} → ${action.target_entity_name}`)

  const [log] = await db
    .insert(actionLogsTable)
    .values({
      agency_id:          state.agency_id,
      agent_type:         'optimizer',
      action_type:        action.action_type,
      meta_ad_account_id: state.ad_account.id,
      optimizer_rule_id:  state.rule.id,
      target_entity_type: action.target_entity_type,
      target_entity_id:   action.target_entity_id,
      target_entity_name: action.target_entity_name,
      current_value:      action.current_value,
      proposed_value:     action.proposed_value,
      reasoning:          action.reasoning,
      confidence_score:   String(action.confidence_score),
      status:             'pending_human_approval',
      requires_approval:  state.rule.require_approval,
      langgraph_thread_id: state.thread_id,
      expires_at:         new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .returning({ id: actionLogsTable.id })

  if (!log) {
    return { errors: ['waitForHuman: DB insert failed'] }
  }

  const decision = interrupt({
    action_log_id:      log.id,
    action_type:        action.action_type,
    target_entity_name: action.target_entity_name,
    message:            'Action is pending human approval in the MarketerAgents dashboard.',
  })

  return {
    current_action_log_id: log.id,
    human_approved: (decision as { approved: boolean }).approved ?? null,
  }
}

// ─── Node 5: Execute approved action ─────────────────────────────────────────

export async function executeAction(state: OptimizerState): Promise<Partial<OptimizerState>> {
  const action = state.proposed_actions[state.current_action_index]
  const logId  = state.current_action_log_id

  if (!action || !logId) {
    return { errors: ['executeAction: missing action or log_id'] }
  }

  console.log(`[Optimizer] Executing approved action: ${action.action_type}`)

  await db
    .update(actionLogsTable)
    .set({ status: 'executing', executing_at: new Date() })
    .where(eq(actionLogsTable.id, logId))

  try {
    let result: unknown

    switch (action.action_type) {
      case 'INCREASE_BUDGET':
      case 'DECREASE_BUDGET': {
        const budgetUsd   = action.proposed_value.daily_budget_usd as number
        const budgetCents = Math.round(budgetUsd * 100)
        result = await updateCampaignBudget(
          action.target_entity_id,
          budgetCents,
          state.ad_account.access_token
        )
        break
      }
      case 'PAUSE_AD': {
        result = await setAdStatus(action.target_entity_id, 'PAUSED', state.ad_account.access_token)
        break
      }
      case 'RESUME_AD': {
        result = await setAdStatus(action.target_entity_id, 'ACTIVE', state.ad_account.access_token)
        break
      }
      default:
        result = { skipped: true, reason: `Action type ${action.action_type} not yet implemented` }
    }

    await db
      .update(actionLogsTable)
      .set({ status: 'executed', executed_at: new Date(), execution_result: result as Record<string, unknown> })
      .where(eq(actionLogsTable.id, logId))

    await db
      .update(optimizerRulesTable)
      .set({ total_actions_taken: sql`${optimizerRulesTable.total_actions_taken} + 1` })
      .where(eq(optimizerRulesTable.id, state.rule.id))

    return {
      executed_actions:      [{ action_log_id: logId, result }],
      current_action_index:  state.current_action_index + 1,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)

    await db
      .update(actionLogsTable)
      .set({ status: 'failed', error_message: message })
      .where(eq(actionLogsTable.id, logId))

    return {
      errors:               [`executeAction: ${message}`],
      current_action_index: state.current_action_index + 1,
    }
  }
}

// ─── Node 6: Skip denied action ───────────────────────────────────────────────

export async function skipDeniedAction(state: OptimizerState): Promise<Partial<OptimizerState>> {
  const logId = state.current_action_log_id
  if (logId) {
    await db
      .update(actionLogsTable)
      .set({ status: 'denied', denied_at: new Date() })
      .where(eq(actionLogsTable.id, logId))
  }

  return {
    current_action_index:  state.current_action_index + 1,
    human_approved:        null,
    current_action_log_id: null,
  }
}

// ─── Node 7: Finalize run ─────────────────────────────────────────────────────

export async function finalizeRun(state: OptimizerState): Promise<Partial<OptimizerState>> {
  const nextRun = new Date(Date.now() + Number(state.rule.check_interval_minutes) * 60 * 1000)

  await db
    .update(optimizerRulesTable)
    .set({ last_run_at: new Date(), next_run_at: nextRun })
    .where(eq(optimizerRulesTable.id, state.rule.id))

  console.log(`[Optimizer] Run complete. ${state.executed_actions.length} actions executed.`)
  return {}
}

// ─── Routing functions ────────────────────────────────────────────────────────

export function routeAfterGuardrails(state: OptimizerState): string {
  if (state.proposed_actions.length === 0) return 'finalize'
  if (state.current_action_index >= state.proposed_actions.length) return 'finalize'
  return 'wait_for_human'
}

export function routeAfterHuman(state: OptimizerState): string {
  if (state.human_approved === true) return 'execute'
  return 'skip_denied'
}

export function routeAfterAction(state: OptimizerState): string {
  if (state.current_action_index >= state.proposed_actions.length) return 'finalize'
  if (state.errors.length > 3) return 'finalize'
  return 'wait_for_human'
}
