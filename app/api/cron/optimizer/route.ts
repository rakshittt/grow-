/**
 * GET /api/cron/optimizer
 * Vercel Cron Job — runs every hour, kicks off optimizer agent for any
 * rule whose next_run_at is due.
 *
 * Secured with CRON_SECRET header (set in vercel.json + env vars).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { eq, and, lte } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, optimizerRulesTable, metaAdAccountsTable } from '@/lib/db'
import { optimizerGraph } from '@/lib/agents/optimizer/graph'
import type { OptimizerRule, MetaAdAccount } from '@/lib/db/schema'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  const dueRules = await db.query.optimizerRulesTable.findMany({
    where: and(
      eq(optimizerRulesTable.status, 'active'),
      lte(optimizerRulesTable.next_run_at, now),
    ),
  })

  if (dueRules.length === 0) {
    return NextResponse.json({ ok: true, ran: 0, message: 'No rules due for a run.' })
  }

  let started = 0
  const errors: string[] = []

  await Promise.all(
    dueRules.map(async (rule) => {
      if (!rule.meta_ad_account_id) return

      const adAccount = await db.query.metaAdAccountsTable.findFirst({
        where: and(
          eq(metaAdAccountsTable.id, rule.meta_ad_account_id),
          eq(metaAdAccountsTable.status, 'active'),
        ),
      })

      if (!adAccount) {
        errors.push(`Rule ${rule.id}: no active Meta account`)
        return
      }

      const today    = now.toISOString().split('T')[0]
      const threadId = `optimizer_${rule.id}_${today}_${uuidv4().slice(0, 8)}`

      try {
        await optimizerGraph.invoke(
          {
            agency_id:  rule.agency_id,
            rule:       rule as OptimizerRule,
            ad_account: adAccount as MetaAdAccount,
            thread_id:  threadId,
          },
          { configurable: { thread_id: threadId } }
        )
        started++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Interrupt (awaiting approval) is expected — not an error
        if (!msg.includes('interrupt')) {
          errors.push(`Rule ${rule.id}: ${msg}`)
          console.error(`[Cron/Optimizer] Error for rule ${rule.id}:`, err)
        } else {
          started++
        }
      }
    })
  )

  return NextResponse.json({ ok: true, ran: started, total: dueRules.length, errors })
}
