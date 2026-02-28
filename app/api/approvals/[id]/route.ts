/**
 * PATCH /api/approvals/[id]
 * Body: { action: 'approve' | 'deny', denial_reason?: string }
 */
import { NextResponse } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { Command } from '@langchain/langgraph'
import { auth } from '@/lib/auth'
import { db, actionLogsTable, metaAdAccountsTable } from '@/lib/db'
import { optimizerGraph } from '@/lib/agents/optimizer/graph'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id: actionLogId } = await params

  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!['owner', 'admin'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Only owners and admins can approve or deny actions' }, { status: 403 })
  }

  let action: 'approve' | 'deny'
  let denial_reason: string | undefined

  try {
    const body = await request.json()
    if (!['approve', 'deny'].includes(body.action)) throw new Error('action must be "approve" or "deny"')
    action        = body.action
    denial_reason = body.denial_reason
  } catch (err) {
    return NextResponse.json({ error: `Invalid body: ${err instanceof Error ? err.message : 'parse error'}` }, { status: 400 })
  }

  const log = await db.query.actionLogsTable.findFirst({
    where: and(
      eq(actionLogsTable.id, actionLogId),
      eq(actionLogsTable.agency_id, session.user.agencyId),
    ),
  })

  if (!log) {
    return NextResponse.json({ error: 'Action not found' }, { status: 404 })
  }

  if (log.status !== 'pending_human_approval') {
    return NextResponse.json({
      error: `Action is already in status "${log.status}" — cannot be actioned again`,
    }, { status: 409 })
  }

  if (log.expires_at && new Date(log.expires_at) < new Date()) {
    await db
      .update(actionLogsTable)
      .set({ status: 'cancelled' })
      .where(eq(actionLogsTable.id, actionLogId))

    return NextResponse.json({ error: 'Approval window expired — action has been cancelled' }, { status: 410 })
  }

  const now        = new Date()
  const isApproved = action === 'approve'

  await db
    .update(actionLogsTable)
    .set({
      status:        isApproved ? 'approved' : 'denied',
      updated_at:    now,
      ...(isApproved
        ? { approved_by: session.user.id, approved_at: now }
        : { denied_by: session.user.id, denied_at: now, denial_reason: denial_reason ?? null }
      ),
    })
    .where(eq(actionLogsTable.id, actionLogId))

  // Resume the LangGraph thread for optimizer actions
  if (log.agent_type === 'optimizer' && log.langgraph_thread_id) {
    try {
      await optimizerGraph.invoke(
        new Command({
          resume: { approved: isApproved, denial_reason: denial_reason ?? null },
        }),
        { configurable: { thread_id: log.langgraph_thread_id } }
      )
    } catch (err) {
      console.error(`[Approvals API] Graph resume error for thread ${log.langgraph_thread_id}:`, err)

      if (isApproved) {
        console.log(`[Approvals API] Falling back to direct execution for action ${actionLogId}`)
        await directExecuteFallback(log)
      }
    }
  }

  return NextResponse.json({
    ok: true,
    action_log_id: actionLogId,
    status:        isApproved ? 'approved' : 'denied',
    message: isApproved
      ? 'Action approved. The agent is executing the change.'
      : 'Action denied. The agent will skip this action.',
  })
}

async function directExecuteFallback(log: typeof actionLogsTable.$inferSelect) {
  try {
    if (!log.meta_ad_account_id) return

    const account = await db.query.metaAdAccountsTable.findFirst({
      where: eq(metaAdAccountsTable.id, log.meta_ad_account_id),
    })
    if (!account) return

    const { updateCampaignBudget, setAdStatus } = await import('@/lib/agents/shared/meta-client')
    const proposed = log.proposed_value as Record<string, unknown>
    let result: unknown

    if (log.action_type === 'INCREASE_BUDGET' || log.action_type === 'DECREASE_BUDGET') {
      result = await updateCampaignBudget(
        log.target_entity_id!,
        Math.round((proposed.daily_budget_usd as number) * 100),
        account.access_token
      )
    } else if (log.action_type === 'PAUSE_AD') {
      result = await setAdStatus(log.target_entity_id!, 'PAUSED', account.access_token)
    } else if (log.action_type === 'RESUME_AD') {
      result = await setAdStatus(log.target_entity_id!, 'ACTIVE', account.access_token)
    }

    await db
      .update(actionLogsTable)
      .set({ status: 'executed', executed_at: new Date(), execution_result: result as Record<string, unknown> })
      .where(eq(actionLogsTable.id, log.id))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(actionLogsTable)
      .set({ status: 'failed', error_message: `Fallback execution failed: ${message}` })
      .where(eq(actionLogsTable.id, log.id))
  }
}
