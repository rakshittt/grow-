import { redirect } from 'next/navigation'
import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { Shield, Unplug, ExternalLink, Bell } from 'lucide-react'
import { auth } from '@/lib/auth'
import { db, agenciesTable, metaAdAccountsTable } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SettingsMetaAccounts } from '@/components/features/settings/meta-accounts'
import { SettingsSlackForm } from '@/components/features/settings/slack-form'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [agency, metaAccounts] = await Promise.all([
    db.query.agenciesTable.findFirst({
      where: eq(agenciesTable.id, session.user.agencyId),
      columns: {
        name: true,
        plan: true,
        slack_webhook_url: true,
        notification_email: true,
        trial_ends_at: true,
      },
    }),
    db.query.metaAdAccountsTable.findMany({
      where: eq(metaAdAccountsTable.agency_id, session.user.agencyId),
      columns: {
        id: true,
        ad_account_id: true,
        ad_account_name: true,
        business_name: true,
        currency: true,
        timezone: true,
        status: true,
        token_expires_at: true,
        created_at: true,
      },
      orderBy: (t, { asc }) => [asc(t.created_at)],
    }),
  ])

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-xl font-semibold">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your agency profile, integrations, and notification preferences.
        </p>
      </div>

      {/* Plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium capitalize">{agency?.plan ?? 'trial'}</span>
                {agency?.plan === 'trial' && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    {agency.trial_ends_at
                      ? `Expires ${new Date(agency.trial_ends_at).toLocaleDateString()}`
                      : 'Trial'}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{agency?.name}</p>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/billing">Upgrade plan</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meta Ad Accounts */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Meta Ad Accounts</CardTitle>
              <CardDescription className="mt-1">
                Connected accounts used by the Optimizer agent. Re-connect to refresh an expired token.
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/api/auth/meta/connect">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Connect account
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <SettingsMetaAccounts accounts={metaAccounts} />
        </CardContent>
      </Card>

      {/* Slack */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Slack Notifications
          </CardTitle>
          <CardDescription>
            Receive agent reports and approval reminders in your Slack workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <SettingsSlackForm
            currentWebhook={agency?.slack_webhook_url ?? ''}
            currentEmail={agency?.notification_email ?? ''}
            agencyName={agency?.name ?? ''}
          />
        </CardContent>
      </Card>
    </div>
  )
}
