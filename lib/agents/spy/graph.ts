/**
 * Spy agent LangGraph state machine.
 *
 * Flow:
 *   START
 *     → trigger_apify_scrape   (fire Apify Meta Ad Library scraper)
 *     → poll_apify_status      (poll until SUCCEEDED; loops with 15s delay)
 *     → fetch_scraped_results  (download + filter by longevity)
 *     → analyze_with_claude    (Claude analyzes ad patterns, produces structured report)
 *     → persist_report         (saves to spy_trackers + action_logs)
 *     → deliver_report         (Slack notification with AI narrative)
 *     → END
 *
 * Error path:
 *   Any node → errors[] → handle_error → END
 *
 * The Spy agent does NOT require HITL approval — it only reads data and
 * delivers a report. The user can "Refine next search" from the dashboard.
 */
import { StateGraph, START, END } from '@langchain/langgraph'
import { SpyStateAnnotation } from './state'
import {
  triggerApifyScrape,
  pollApifyStatus,
  fetchScrapedResults,
  analyzeWithClaude,
  persistReport,
  deliverReport,
  handleError,
  routeAfterPoll,
} from './nodes'

const workflow = new StateGraph(SpyStateAnnotation)
  // ── Nodes ───────────────────────────────────────────────────────────────────
  .addNode('trigger_apify_scrape', triggerApifyScrape)
  .addNode('poll_apify_status', pollApifyStatus)
  .addNode('fetch_scraped_results', fetchScrapedResults)
  .addNode('analyze_with_claude', analyzeWithClaude)
  .addNode('persist_report', persistReport)
  .addNode('deliver_report', deliverReport)
  .addNode('handle_error', handleError)

  // ── Edges ────────────────────────────────────────────────────────────────────
  .addEdge(START, 'trigger_apify_scrape')

  // After trigger: start polling
  .addConditionalEdges('trigger_apify_scrape', (s) => s.errors.length > 0 ? 'handle_error' : 'poll_status', {
    poll_status: 'poll_apify_status',
    handle_error: 'handle_error',
  })

  // Polling loop: keep polling until done or timeout
  .addConditionalEdges('poll_apify_status', routeAfterPoll, {
    poll_status: 'poll_apify_status',
    fetch_results: 'fetch_scraped_results',
    handle_error: 'handle_error',
  })

  .addConditionalEdges('fetch_scraped_results', (s) => s.errors.length > 0 ? 'handle_error' : 'analyze', {
    analyze: 'analyze_with_claude',
    handle_error: 'handle_error',
  })

  .addConditionalEdges('analyze_with_claude', (s) => s.errors.length > 0 ? 'handle_error' : 'persist', {
    persist: 'persist_report',
    handle_error: 'handle_error',
  })

  .addEdge('persist_report', 'deliver_report')
  .addEdge('deliver_report', END)
  .addEdge('handle_error', END)

export const spyGraph = workflow.compile()
