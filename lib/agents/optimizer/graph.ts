/**
 * Optimizer LangGraph state machine.
 *
 * Flow:
 *   START
 *     → fetch_campaigns          (Meta API: pull live campaign + ad data)
 *     → analyze_performance      (Claude: analyze data, propose actions)
 *     → check_guardrails         (Hard enforcement of rule limits)
 *     → wait_for_human           (interrupt() — persists to DB, pauses graph)
 *         ↓ (user approves/denies in /approvals UI)
 *     → execute_action  OR  skip_denied
 *     → (loop back to wait_for_human for next action)
 *     → finalize_run
 *     → END
 *
 * Persistence:
 *   Uses MemorySaver in-process. The thread_id and checkpoint are also
 *   serialized to action_logs.langgraph_thread_id / langgraph_checkpoint
 *   so the approval API route can resume across serverless invocations.
 */
import { StateGraph, START, END, MemorySaver } from '@langchain/langgraph'
import { OptimizerStateAnnotation } from './state'
import {
  fetchCampaignData,
  analyzePerformance,
  checkGuardrails,
  waitForHuman,
  executeAction,
  skipDeniedAction,
  finalizeRun,
  routeAfterGuardrails,
  routeAfterHuman,
  routeAfterAction,
} from './nodes'

// In-process checkpointer — keeps graph state between the initial run and
// the resume (within the same server instance / long-lived container).
// For production on Vercel Edge, swap for a PostgresSaver backed by Supabase.
export const optimizerCheckpointer = new MemorySaver()

const workflow = new StateGraph(OptimizerStateAnnotation)
  // ── Nodes ───────────────────────────────────────────────────────────────────
  .addNode('fetch_campaigns', fetchCampaignData)
  .addNode('analyze_performance', analyzePerformance)
  .addNode('check_guardrails', checkGuardrails)
  .addNode('wait_for_human', waitForHuman)
  .addNode('execute_action', executeAction)
  .addNode('skip_denied', skipDeniedAction)
  .addNode('finalize_run', finalizeRun)

  // ── Edges ────────────────────────────────────────────────────────────────────
  .addEdge(START, 'fetch_campaigns')
  .addEdge('fetch_campaigns', 'analyze_performance')
  .addEdge('analyze_performance', 'check_guardrails')

  // After guardrails: route to first HITL action or finalize if nothing to do
  .addConditionalEdges('check_guardrails', routeAfterGuardrails, {
    wait_for_human: 'wait_for_human',
    finalize: 'finalize_run',
  })

  // After human decision (interrupt resume): execute or skip
  .addConditionalEdges('wait_for_human', routeAfterHuman, {
    execute: 'execute_action',
    skip_denied: 'skip_denied',
  })

  // After execution: loop to next action or finalize
  .addConditionalEdges('execute_action', routeAfterAction, {
    wait_for_human: 'wait_for_human',
    finalize: 'finalize_run',
  })

  // After skip: same routing as after execution
  .addConditionalEdges('skip_denied', routeAfterAction, {
    wait_for_human: 'wait_for_human',
    finalize: 'finalize_run',
  })

  .addEdge('finalize_run', END)

export const optimizerGraph = workflow.compile({
  checkpointer: optimizerCheckpointer,
  // Declare the interrupt node so LangGraph knows where to pause
  interruptBefore: ['wait_for_human'],
})
