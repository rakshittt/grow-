/**
 * Spy agent node implementations.
 */
import {
  triggerApifyRun,
  pollRunStatus,
  fetchRunResults,
  sendSlackReport,
  type ApifyRunInput,
} from '@/lib/agents/shared/apify-client'
import {
  analyzeCompetitorAds,
  generateReportNarrative,
} from '@/lib/agents/shared/ai-client'
import { eq, sql } from 'drizzle-orm'
import { db, spyTrackersTable, actionLogsTable } from '@/lib/db'
import type { SpyState } from './state'

const MAX_POLL_ATTEMPTS = 20     // 20 × 15s = max 5 min wait
const POLL_INTERVAL_MS = 15_000

// ─── Node 1: Trigger Apify scrape run ────────────────────────────────────────

export async function triggerApifyScrape(state: SpyState): Promise<Partial<SpyState>> {
  const { tracker } = state
  console.log(`[Spy] Triggering Apify run for tracker: ${tracker.name}`)

  const input: ApifyRunInput = {
    country: tracker.country_code,
    adType: 'ALL',
    limit: tracker.max_results,
    ...(tracker.competitor_page_url
      ? { startUrls: [{ url: tracker.competitor_page_url }] }
      : { searchTerms: [tracker.competitor_name, ...tracker.search_terms] }
    ),
  }

  try {
    const runId = await triggerApifyRun(input)
    console.log(`[Spy] Apify run triggered: ${runId}`)

    await db
      .update(spyTrackersTable)
      .set({ apify_run_id: runId })
      .where(eq(spyTrackersTable.id, tracker.id))

    return { apify_run_id: runId, poll_attempts: 0 }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { errors: [`triggerApifyScrape: ${message}`] }
  }
}

// ─── Node 2: Poll Apify run status ────────────────────────────────────────────

export async function pollApifyStatus(state: SpyState): Promise<Partial<SpyState>> {
  if (!state.apify_run_id) {
    return { errors: ['pollApifyStatus: no run_id to poll'] }
  }

  console.log(`[Spy] Polling Apify run ${state.apify_run_id} (attempt ${state.poll_attempts + 1})`)

  if (state.poll_attempts > 0) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }

  try {
    const status = await pollRunStatus(state.apify_run_id)
    console.log(`[Spy] Run status: ${status.status}`)

    if (status.status === 'SUCCEEDED') {
      return {
        apify_dataset_id: status.defaultDatasetId,
        poll_attempts: state.poll_attempts + 1,
      }
    }

    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status.status)) {
      return { errors: [`Apify run ${status.status}: ${state.apify_run_id}`] }
    }

    return { poll_attempts: state.poll_attempts + 1 }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { errors: [`pollApifyStatus: ${message}`] }
  }
}

// ─── Node 3: Fetch and filter scraped results ─────────────────────────────────

export async function fetchScrapedResults(state: SpyState): Promise<Partial<SpyState>> {
  if (!state.apify_dataset_id) {
    return { errors: ['fetchScrapedResults: no dataset_id'] }
  }

  console.log(`[Spy] Fetching results from dataset ${state.apify_dataset_id}`)

  try {
    const ads = await fetchRunResults(
      state.apify_dataset_id,
      state.tracker.min_longevity_days
    )

    console.log(`[Spy] Found ${ads.length} ads meeting longevity threshold`)
    return { scraped_ads: ads }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { errors: [`fetchScrapedResults: ${message}`] }
  }
}

// ─── Node 4: Analyze ads with Claude ─────────────────────────────────────────

export async function analyzeWithClaude(state: SpyState): Promise<Partial<SpyState>> {
  console.log(`[Spy] Analyzing ${state.scraped_ads.length} ads with Claude`)

  try {
    const report = await analyzeCompetitorAds(
      state.scraped_ads,
      state.tracker.competitor_name
    )

    return { report }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { errors: [`analyzeWithClaude: ${message}`] }
  }
}

// ─── Node 5: Persist report + update tracker ──────────────────────────────────

export async function persistReport(state: SpyState): Promise<Partial<SpyState>> {
  if (!state.report) {
    return { errors: ['persistReport: no report to save'] }
  }

  console.log(`[Spy] Persisting report for tracker ${state.tracker.id}`)

  const now     = new Date()
  const nextRun = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const summary = {
    // Summary fields (used in trackers-table quick preview)
    top_ads_count:      state.report.top_ads.length,
    avg_longevity_days: state.report.avg_longevity_days,
    top_format:         state.report.dominant_format,
    insights:           state.report.key_insights,
    recommended_tests:  state.report.recommended_tests,
    confidence:         state.report.confidence,
    generated_at:       now.toISOString(),
    // Full report data (used in /spy/[id] detail page)
    top_ads:            state.report.top_ads,
  }

  await db
    .update(spyTrackersTable)
    .set({
      last_run_at:         now,
      next_run_at:         nextRun,
      last_report_summary: summary,
      total_runs:          sql`${spyTrackersTable.total_runs} + 1`,
      apify_run_id:        null,
      updated_at:          now,
    })
    .where(eq(spyTrackersTable.id, state.tracker.id))

  const [log] = await db
    .insert(actionLogsTable)
    .values({
      agency_id:          state.agency_id,
      agent_type:         'spy',
      action_type:        'SPY_REPORT_READY',
      spy_tracker_id:     state.tracker.id,
      target_entity_type: 'report',
      target_entity_id:   state.apify_run_id ?? 'unknown',
      target_entity_name: `${state.tracker.name} – Daily Report`,
      current_value:      null,
      proposed_value:     summary,
      reasoning:          state.report.key_insights,
      confidence_score:   String(state.report.confidence),
      status:             'executed',
      requires_approval:  false,
    })
    .returning({ id: actionLogsTable.id })

  return { action_log_id: log?.id ?? null }
}

// ─── Node 6: Deliver report via Slack ────────────────────────────────────────

export async function deliverReport(state: SpyState): Promise<Partial<SpyState>> {
  if (!state.report || !state.agency_slack_webhook) {
    console.log(`[Spy] Skipping Slack delivery (no webhook or no report)`)
    return {}
  }

  console.log(`[Spy] Sending Slack report`)

  try {
    const narrative = await generateReportNarrative(state.report, state.tracker.competitor_name)
    const topAd = state.report.top_ads[0]

    await sendSlackReport(state.agency_slack_webhook, {
      trackerName:       state.tracker.name,
      competitorName:    state.tracker.competitor_name,
      topAdsCount:       state.report.top_ads.length,
      longestRunningDays: topAd?.active_days ?? 0,
      topFormat:         state.report.dominant_format,
      insights:          narrative,
    })
  } catch (err) {
    // Slack failures are non-fatal — report is still saved
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[Spy] Slack delivery failed (non-fatal): ${message}`)
  }

  return {}
}

// ─── Routing functions ────────────────────────────────────────────────────────

export function routeAfterPoll(state: SpyState): string {
  if (state.errors.length > 0) return 'handle_error'
  if (state.apify_dataset_id) return 'fetch_results'
  if (state.poll_attempts >= MAX_POLL_ATTEMPTS) return 'handle_error'
  return 'poll_status'
}

export async function handleError(state: SpyState): Promise<Partial<SpyState>> {
  const errorSummary = state.errors.join(' | ')
  console.error(`[Spy] Agent terminated with errors: ${errorSummary}`)

  await db
    .update(spyTrackersTable)
    .set({ last_run_at: new Date(), updated_at: new Date() })
    .where(eq(spyTrackersTable.id, state.tracker.id))

  return {}
}
