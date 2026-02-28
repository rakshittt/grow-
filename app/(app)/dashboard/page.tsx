import Link from 'next/link'
import { redirect } from 'next/navigation'
import { eq, desc, and } from 'drizzle-orm'
import { formatDistanceToNow } from 'date-fns'
import {
  Zap,
  CheckSquare,
  TrendingUp,
  Eye,
  ArrowRight,
  AlertCircle,
  Clock,
  Activity,
} from 'lucide-react'
import { auth } from '@/lib/auth'
import { db, actionLogsTable, spyTrackersTable, optimizerRulesTable } from '@/lib/db'
import { StatsCard } from '@/components/features/dashboard/stats-card'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

const STATUS_CONFIG = {
  pending_human_approval: { label: 'Pending',      variant: 'secondary'    as const, color: 'text-amber-600' },
  approved:               { label: 'Approved',     variant: 'outline'      as const, color: 'text-green-600' },
  executed:               { label: 'Executed',     variant: 'outline'      as const, color: 'text-green-700' },
  auto_approved:          { label: 'Auto-approved',variant: 'outline'      as const, color: 'text-blue-600'  },
  denied:                 { label: 'Denied',       variant: 'destructive'  as const, color: 'text-red-600'   },
  failed:                 { label: 'Failed',       variant: 'destructive'  as const, color: 'text-red-700'   },
  executing:              { label: 'Executing',    variant: 'secondary'    as const, color: 'text-blue-600'  },
  cancelled:              { label: 'Cancelled',    variant: 'outline'      as const, color: 'text-muted-foreground' },
}

const AGENT_CONFIG = {
  spy:       { label: 'Spy',       Icon: Eye,        color: 'text-purple-600 bg-purple-50' },
  optimizer: { label: 'Optimizer', Icon: TrendingUp, color: 'text-blue-600 bg-blue-50'    },
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const agencyId = session.user.agencyId

  const [recentLogs, pendingLogs, trackers, rules] = await Promise.all([
    db.query.actionLogsTable.findMany({
      where: eq(actionLogsTable.agency_id, agencyId),
      orderBy: [desc(actionLogsTable.created_at)],
      limit: 6,
    }),
    db.query.actionLogsTable.findMany({
      where: and(
        eq(actionLogsTable.agency_id, agencyId),
        eq(actionLogsTable.status, 'pending_human_approval'),
      ),
      columns: { id: true },
    }),
    db.query.spyTrackersTable.findMany({
      where: eq(spyTrackersTable.agency_id, agencyId),
      columns: { status: true, next_run_at: true, total_runs: true },
    }),
    db.query.optimizerRulesTable.findMany({
      where: eq(optimizerRulesTable.agency_id, agencyId),
      columns: { status: true, total_actions_taken: true, schedule_cron: true },
    }),
  ])

  const pendingCount        = pendingLogs.length
  const activeTrackers      = trackers.filter(t => t.status === 'active')
  const activeRules         = rules.filter(r => r.status === 'active')
  const totalActionsTaken   = rules.reduce((s, r) => s + r.total_actions_taken, 0)
  const activeAgentsCount   = (activeTrackers.length > 0 ? 1 : 0) + (activeRules.length > 0 ? 1 : 0)

  // Next spy run
  const nextSpyRun = activeTrackers
    .map(t => t.next_run_at)
    .filter(Boolean)
    .sort()
    .at(0)

  return (
    <div className="space-y-6">
      {/* Pending approvals alert */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300 flex-1">
            <span className="font-semibold">{pendingCount} agent action{pendingCount !== 1 ? 's' : ''}</span> {pendingCount !== 1 ? 'are' : 'is'} waiting for your approval.
          </p>
          <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100 dark:text-amber-300">
            <Link href="/approvals">Review now <ArrowRight className="w-3 h-3 ml-1" /></Link>
          </Button>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          label="Active Agents"
          value={activeAgentsCount}
          subtext={`${activeTrackers.length} spy · ${activeRules.length} optimizer`}
          icon={<Zap className="w-4 h-4" />}
        />
        <StatsCard
          label="Pending Approvals"
          value={pendingCount}
          subtext="require your review"
          icon={<CheckSquare className="w-4 h-4" />}
          className={pendingCount > 0 ? 'border-amber-200' : ''}
        />
        <StatsCard
          label="Total Actions Taken"
          value={totalActionsTaken}
          subtext="across all rule sets"
          icon={<Activity className="w-4 h-4" />}
        />
        <StatsCard
          label="Trackers Running"
          value={activeTrackers.length}
          subtext={nextSpyRun ? `Next scan ${formatDistanceToNow(new Date(nextSpyRun), { addSuffix: true })}` : 'No upcoming scans'}
          icon={<Eye className="w-4 h-4" />}
        />
      </div>

      {/* Content row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Agent Activity</CardTitle>
            <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground h-7">
              <Link href="/approvals">View all <ArrowRight className="w-3 h-3 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1 pt-0">
            {recentLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No agent activity yet. Start by creating a tracker or rule set.</p>
            ) : (
              recentLogs.map((log) => {
                const agentCfg = AGENT_CONFIG[log.agent_type]
                const { Icon }  = agentCfg
                const statusCfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.pending_human_approval

                return (
                  <div key={log.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
                    <div className={`p-1.5 rounded-md shrink-0 ${agentCfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {log.action_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {log.target_entity_name ?? log.action_type}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant={statusCfg.variant} className="text-[10px] h-4 px-1.5 py-0">
                        {statusCfg.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        {/* Agent status */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Agent Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
              <div className="p-2 rounded-md bg-purple-50 text-purple-600">
                <Eye className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Competitor Spy</p>
                  {activeTrackers.length > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Running
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Idle</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {trackers.length === 0
                    ? 'No trackers configured'
                    : `${activeTrackers.length} of ${trackers.length} active`}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link href="/spy">Manage</Link>
              </Button>
            </div>

            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3">
              <div className="p-2 rounded-md bg-blue-50 text-blue-600">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Live Optimizer</p>
                  {activeRules.length > 0 ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Running
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Idle</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {rules.length === 0
                    ? 'No rule sets configured'
                    : `${activeRules.length} rule${activeRules.length !== 1 ? 's' : ''} · ${totalActionsTaken} actions taken`}
                </p>
              </div>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link href="/optimizer">Manage</Link>
              </Button>
            </div>

            {recentLogs.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50/50 dark:bg-blue-950/20 px-4 py-3">
                <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-xs text-blue-800 dark:text-blue-300">
                  <span className="font-semibold">{totalActionsTaken} actions</span> taken by your agents — every single one within your guardrails.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
