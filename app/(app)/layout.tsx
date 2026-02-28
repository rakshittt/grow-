import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, usersTable, agenciesTable, actionLogsTable } from '@/lib/db'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [profile, agency, pendingLogs] = await Promise.all([
    db.query.usersTable.findFirst({
      where: eq(usersTable.id, session.user.id),
      columns: { full_name: true, avatar_url: true },
    }),
    db.query.agenciesTable.findFirst({
      where: eq(agenciesTable.id, session.user.agencyId),
      columns: { name: true },
    }),
    db.query.actionLogsTable.findMany({
      where: and(
        eq(actionLogsTable.agency_id, session.user.agencyId),
        eq(actionLogsTable.status, 'pending_human_approval'),
      ),
      columns: { id: true },
    }),
  ])

  const pendingCount = pendingLogs.length

  return (
    <div className="flex h-screen overflow-hidden bg-muted/30">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          userEmail={session.user.email}
          userName={profile?.full_name ?? undefined}
          userAvatar={profile?.avatar_url ?? undefined}
          agencyName={agency?.name ?? undefined}
          pendingCount={pendingCount}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
