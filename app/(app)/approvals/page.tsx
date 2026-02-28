import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { Shield } from 'lucide-react'
import { auth } from '@/lib/auth'
import { db, actionLogsTable } from '@/lib/db'
import { ApprovalsInbox } from '@/components/features/approvals/approvals-inbox'

export default async function ApprovalsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const logs = await db.query.actionLogsTable.findMany({
    where: eq(actionLogsTable.agency_id, session.user.agencyId),
    orderBy: [desc(actionLogsTable.created_at)],
    limit: 100,
  })

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold">Approvals Inbox</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review and action every recommendation your agents make. Approve to execute, deny to skip.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/60 dark:bg-green-950/20 px-4 py-3">
        <Shield className="w-4 h-4 mt-0.5 text-green-700 shrink-0" />
        <p className="text-xs text-green-800 dark:text-green-300">
          <span className="font-semibold">Nothing executes without you.</span>{' '}
          All pending approvals expire in 24 hours. Expired actions are automatically cancelled — the agent will re-evaluate on its next cycle.
        </p>
      </div>

      <ApprovalsInbox initialLogs={logs} />
    </div>
  )
}
