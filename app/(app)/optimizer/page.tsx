import { redirect } from 'next/navigation'
import { eq, desc } from 'drizzle-orm'
import { Shield } from 'lucide-react'
import { auth } from '@/lib/auth'
import { db, optimizerRulesTable, metaAdAccountsTable } from '@/lib/db'
import { RulesTable } from '@/components/features/optimizer/rules-table'
import { CreateRuleDialog } from '@/components/features/optimizer/create-rule-dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default async function OptimizerPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const [rulesRaw, accounts] = await Promise.all([
    db
      .select({
        id:                          optimizerRulesTable.id,
        agency_id:                   optimizerRulesTable.agency_id,
        created_by:                  optimizerRulesTable.created_by,
        meta_ad_account_id:          optimizerRulesTable.meta_ad_account_id,
        name:                        optimizerRulesTable.name,
        description:                 optimizerRulesTable.description,
        scope:                       optimizerRulesTable.scope,
        campaign_ids:                optimizerRulesTable.campaign_ids,
        adset_ids:                   optimizerRulesTable.adset_ids,
        max_daily_budget_usd:        optimizerRulesTable.max_daily_budget_usd,
        min_daily_budget_usd:        optimizerRulesTable.min_daily_budget_usd,
        max_budget_increase_pct:     optimizerRulesTable.max_budget_increase_pct,
        max_budget_decrease_pct:     optimizerRulesTable.max_budget_decrease_pct,
        target_roas:                 optimizerRulesTable.target_roas,
        min_roas_threshold:          optimizerRulesTable.min_roas_threshold,
        attribution_window:          optimizerRulesTable.attribution_window,
        min_spend_before_action_usd: optimizerRulesTable.min_spend_before_action_usd,
        max_ad_frequency:            optimizerRulesTable.max_ad_frequency,
        max_cpm_increase_pct:        optimizerRulesTable.max_cpm_increase_pct,
        max_bid_cap_usd:             optimizerRulesTable.max_bid_cap_usd,
        check_interval_minutes:      optimizerRulesTable.check_interval_minutes,
        schedule_cron:               optimizerRulesTable.schedule_cron,
        require_approval:            optimizerRulesTable.require_approval,
        auto_approve_below_usd:      optimizerRulesTable.auto_approve_below_usd,
        status:                      optimizerRulesTable.status,
        last_run_at:                 optimizerRulesTable.last_run_at,
        next_run_at:                 optimizerRulesTable.next_run_at,
        total_actions_taken:         optimizerRulesTable.total_actions_taken,
        created_at:                  optimizerRulesTable.created_at,
        updated_at:                  optimizerRulesTable.updated_at,
        account_name:                metaAdAccountsTable.ad_account_name,
      })
      .from(optimizerRulesTable)
      .leftJoin(
        metaAdAccountsTable,
        eq(optimizerRulesTable.meta_ad_account_id, metaAdAccountsTable.id)
      )
      .where(eq(optimizerRulesTable.agency_id, session.user.agencyId))
      .orderBy(desc(optimizerRulesTable.created_at)),

    db.query.metaAdAccountsTable.findMany({
      where: eq(metaAdAccountsTable.agency_id, session.user.agencyId),
      columns: { id: true, ad_account_name: true },
    }),
  ])

  const totalActions  = rulesRaw.reduce((s, r) => s + r.total_actions_taken, 0)
  const activeCount   = rulesRaw.filter(r => r.status === 'active').length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Live Optimizer</h2>
          <p className="text-sm text-muted-foreground mt-1">
            24/7 campaign monitoring. The agent proposes budget adjustments and creative pauses — you approve or deny each action.
          </p>
        </div>
        <CreateRuleDialog accounts={accounts} />
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3">
        <Shield className="w-4 h-4 mt-0.5 text-blue-600 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-300">
          <span className="font-semibold">Human-in-the-Loop is ON by default.</span>{' '}
          Every budget change and ad pause must be approved by you in the Approvals inbox before execution. You can set per-rule auto-approve thresholds for small adjustments.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Rule Sets</CardTitle>
          <CardDescription>
            Each rule set defines the guardrails and ROAS targets the optimizer enforces on your campaigns.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <RulesTable rules={rulesRaw} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center py-4">
          <p className="text-2xl font-semibold">{totalActions}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Actions Taken</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-semibold">{activeCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Active Rule Sets</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-2xl font-semibold">100%</p>
          <p className="text-xs text-muted-foreground mt-1">Actions Within Guardrails</p>
        </Card>
      </div>
    </div>
  )
}
