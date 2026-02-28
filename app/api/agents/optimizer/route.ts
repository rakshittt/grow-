/**
 * POST /api/agents/optimizer
 * Body: { rule_id: string }
 */
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, optimizerRulesTable, metaAdAccountsTable } from '@/lib/db'
import { optimizerGraph } from '@/lib/agents/optimizer/graph'
import type { OptimizerRule, MetaAdAccount } from '@/lib/db/schema'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let rule_id: string
  try {
    const body = await request.json()
    rule_id = body.rule_id
    if (!rule_id) throw new Error('missing rule_id')
  } catch {
    return NextResponse.json({ error: 'Invalid request body. Provide { rule_id }' }, { status: 400 })
  }

  const rule = await db.query.optimizerRulesTable.findFirst({
    where: and(
      eq(optimizerRulesTable.id, rule_id),
      eq(optimizerRulesTable.agency_id, session.user.agencyId),
      eq(optimizerRulesTable.status, 'active'),
    ),
  })

  if (!rule) {
    return NextResponse.json({ error: 'Rule not found or not active' }, { status: 404 })
  }

  if (!rule.meta_ad_account_id) {
    return NextResponse.json({ error: 'Rule has no connected Meta ad account' }, { status: 400 })
  }

  const adAccount = await db.query.metaAdAccountsTable.findFirst({
    where: and(
      eq(metaAdAccountsTable.id, rule.meta_ad_account_id),
      eq(metaAdAccountsTable.agency_id, session.user.agencyId),
    ),
  })

  if (!adAccount) {
    return NextResponse.json({ error: 'Meta ad account not found or disconnected' }, { status: 404 })
  }

  const today    = new Date().toISOString().split('T')[0]
  const threadId = `optimizer_${rule_id}_${today}_${uuidv4().slice(0, 8)}`

  try {
    const result = await optimizerGraph.invoke(
      {
        agency_id:  session.user.agencyId,
        rule:       rule as OptimizerRule,
        ad_account: adAccount as MetaAdAccount,
        thread_id:  threadId,
      },
      { configurable: { thread_id: threadId } }
    )

    const graphState  = await optimizerGraph.getState({ configurable: { thread_id: threadId } })
    const isInterrupted = graphState.next && graphState.next.length > 0

    return NextResponse.json({
      ok: true,
      thread_id: threadId,
      status:    isInterrupted ? 'awaiting_approval' : 'completed',
      proposed_actions_count: result.proposed_actions?.length ?? 0,
      executed_actions_count: result.executed_actions?.length ?? 0,
      message: isInterrupted
        ? `Optimizer found ${result.proposed_actions?.length ?? 0} action(s). Check the Approvals inbox.`
        : `Optimizer run complete. ${result.executed_actions?.length ?? 0} action(s) taken.`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Optimizer API] Error for rule ${rule_id}:`, message)
    return NextResponse.json({ error: `Agent error: ${message}` }, { status: 500 })
  }
}
