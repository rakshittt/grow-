/**
 * GET /api/cron/spy
 * Vercel Cron Job — runs every hour, kicks off spy agent for any tracker
 * whose next_run_at is due.
 *
 * Secured with CRON_SECRET header (set in vercel.json + env vars).
 */
import { NextResponse, type NextRequest } from 'next/server'
import { eq, and, lte } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'
import { db, spyTrackersTable, agenciesTable } from '@/lib/db'
import { spyGraph } from '@/lib/agents/spy/graph'
import type { SpyTracker } from '@/lib/db/schema'

export const maxDuration = 300 // 5 min max (Vercel Pro)

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent public invocation
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // Find all active trackers that are due for a run
  const dueTrackers = await db.query.spyTrackersTable.findMany({
    where: and(
      eq(spyTrackersTable.status, 'active'),
      lte(spyTrackersTable.next_run_at, now),
    ),
  })

  if (dueTrackers.length === 0) {
    return NextResponse.json({ ok: true, ran: 0, message: 'No trackers due for a run.' })
  }

  // Fetch agency Slack webhooks in one go
  const agencyIds = [...new Set(dueTrackers.map(t => t.agency_id))]
  const agencies  = await db.query.agenciesTable.findMany({
    where: (a, { inArray }) => inArray(a.id, agencyIds),
    columns: { id: true, slack_webhook_url: true },
  })
  const slackMap = Object.fromEntries(agencies.map(a => [a.id, a.slack_webhook_url]))

  // Fire agents in parallel (fire-and-forget; errors are caught per tracker)
  let started = 0
  await Promise.all(
    dueTrackers.map(async (tracker) => {
      const threadId = `spy_${tracker.id}_${uuidv4()}`
      try {
        await spyGraph.invoke(
          {
            agency_id:            tracker.agency_id,
            tracker:              tracker as SpyTracker,
            agency_slack_webhook: slackMap[tracker.agency_id] ?? null,
          },
          { configurable: { thread_id: threadId } }
        )
        started++
      } catch (err) {
        console.error(`[Cron/Spy] Error for tracker ${tracker.id}:`, err)
      }
    })
  )

  return NextResponse.json({ ok: true, ran: started, total: dueTrackers.length })
}
