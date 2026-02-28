/**
 * POST /api/agents/spy
 * Body: { tracker_id: string }
 */
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, spyTrackersTable, agenciesTable } from '@/lib/db'
import { spyGraph } from '@/lib/agents/spy/graph'
import type { SpyTracker } from '@/lib/db/schema'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let tracker_id: string
  try {
    const body = await request.json()
    tracker_id = body.tracker_id
    if (!tracker_id) throw new Error('missing tracker_id')
  } catch {
    return NextResponse.json({ error: 'Invalid request body. Provide { tracker_id }' }, { status: 400 })
  }

  const tracker = await db.query.spyTrackersTable.findFirst({
    where: and(
      eq(spyTrackersTable.id, tracker_id),
      eq(spyTrackersTable.agency_id, session.user.agencyId),
      eq(spyTrackersTable.status, 'active'),
    ),
  })

  if (!tracker) {
    return NextResponse.json({ error: 'Tracker not found or not active' }, { status: 404 })
  }

  const agency = await db.query.agenciesTable.findFirst({
    where: eq(agenciesTable.id, session.user.agencyId),
    columns: { slack_webhook_url: true },
  })

  const threadId = `spy_${tracker_id}_${uuidv4()}`

  runSpyAgent({
    agency_id:            session.user.agencyId,
    tracker:              tracker as SpyTracker,
    agency_slack_webhook: agency?.slack_webhook_url ?? null,
    thread_id:            threadId,
  }).catch(err => {
    console.error(`[Spy API] Unhandled agent error for tracker ${tracker_id}:`, err)
  })

  return NextResponse.json({
    ok: true,
    thread_id: threadId,
    message: 'Spy agent started. The report will appear in your dashboard when ready.',
  }, { status: 202 })
}

async function runSpyAgent(input: {
  agency_id: string
  tracker: SpyTracker
  agency_slack_webhook: string | null
  thread_id: string
}) {
  console.log(`[Spy API] Starting agent run for tracker: ${input.tracker.name}`)

  await spyGraph.invoke(
    {
      agency_id:            input.agency_id,
      tracker:              input.tracker,
      agency_slack_webhook: input.agency_slack_webhook,
    },
    { configurable: { thread_id: input.thread_id } }
  )
}
