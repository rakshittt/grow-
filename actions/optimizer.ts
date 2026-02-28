'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, optimizerRulesTable } from '@/lib/db'

async function getSessionUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session.user
}

export async function createRule(
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser()

    const name                    = formData.get('name') as string
    const meta_ad_account_id      = (formData.get('meta_ad_account_id') as string) || null
    const scope                   = (formData.get('scope') as 'account' | 'campaign' | 'adset' | 'ad') || 'campaign'
    const max_daily_budget_usd    = (formData.get('max_daily_budget_usd') as string) || null
    const min_daily_budget_usd    = (formData.get('min_daily_budget_usd') as string) || null
    const target_roas             = (formData.get('target_roas') as string) || null
    const min_roas_threshold      = (formData.get('min_roas_threshold') as string) || null
    const max_budget_increase_pct = parseInt(formData.get('max_budget_increase_pct') as string) || 20
    const max_budget_decrease_pct = parseInt(formData.get('max_budget_decrease_pct') as string) || 20
    const min_spend               = (formData.get('min_spend_before_action_usd') as string) || '50'
    const attribution_window      = (formData.get('attribution_window') as
      '1d_click' | '7d_click' | '28d_click' | '1d_view' | '7d_view') || '7d_click'
    const auto_approve_below_usd  = (formData.get('auto_approve_below_usd') as string) || '0'

    if (!name) return { error: 'Rule name is required' }

    await db.insert(optimizerRulesTable).values({
      agency_id:                   user.agencyId,
      created_by:                  user.id,
      meta_ad_account_id,
      name,
      scope,
      max_daily_budget_usd,
      min_daily_budget_usd,
      target_roas,
      min_roas_threshold,
      max_budget_increase_pct,
      max_budget_decrease_pct,
      min_spend_before_action_usd: min_spend,
      attribution_window,
      require_approval:            true,
      auto_approve_below_usd,
    })

    revalidatePath('/optimizer')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create rule' }
  }
}

export async function updateRuleStatus(
  ruleId: string,
  status: 'active' | 'paused'
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser()

    await db
      .update(optimizerRulesTable)
      .set({ status, updated_at: new Date() })
      .where(and(
        eq(optimizerRulesTable.id, ruleId),
        eq(optimizerRulesTable.agency_id, user.agencyId),
      ))

    revalidatePath('/optimizer')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update rule' }
  }
}

export async function deleteRule(
  ruleId: string
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser()

    await db
      .delete(optimizerRulesTable)
      .where(and(
        eq(optimizerRulesTable.id, ruleId),
        eq(optimizerRulesTable.agency_id, user.agencyId),
      ))

    revalidatePath('/optimizer')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete rule' }
  }
}
