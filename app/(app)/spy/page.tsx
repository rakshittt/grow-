import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, spyTrackersTable, agenciesTable } from '@/lib/db'
import { CreateTrackerDialog } from '@/components/features/spy/create-tracker-dialog'
import { TrackersTable } from '@/components/features/spy/trackers-table'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function SpyPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [trackers, agency] = await Promise.all([
    db.query.spyTrackersTable.findMany({
      where: eq(spyTrackersTable.agency_id, session.user.agencyId),
      orderBy: (t, { desc }) => [desc(t.created_at)],
    }),
    db.query.agenciesTable.findFirst({
      where: eq(agenciesTable.id, session.user.agencyId),
      columns: { plan_spy_trackers: true },
    }),
  ])

  const activeCount  = trackers.filter(t => t.status === 'active').length
  const totalRuns    = trackers.reduce((s, t) => s + t.total_runs, 0)
  const trackerLimit = agency?.plan_spy_trackers ?? 3

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Competitor Spy</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Track competitors&apos; Meta ads daily. Surfaces longest-running (proven) creatives so you know what&apos;s actually working.
          </p>
        </div>
        <CreateTrackerDialog />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center py-4">
          <p className="text-2xl font-semibold">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Active Trackers</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-semibold">{totalRuns}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Scans Run</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-semibold">{trackerLimit}</p>
          <p className="text-xs text-muted-foreground mt-1">Tracker Limit (plan)</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Trackers</CardTitle>
          <CardDescription>Each tracker scans the Meta Ad Library on its schedule and delivers an AI-analysed report.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <TrackersTable trackers={trackers} />
        </CardContent>
      </Card>
    </div>
  )
}
