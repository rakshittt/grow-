'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, usersTable, agenciesTable } from '@/lib/db'

async function getSessionUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session.user
}

/** Step 1 – Meta OAuth placeholder: just records the step completion. */
export async function completeMetaStep(_adAccountId?: string) {
  const user = await getSessionUser()

  await db
    .update(usersTable)
    .set({ onboarding_step: 1 })
    .where(eq(usersTable.id, user.id))

  revalidatePath('/onboarding')
}

/** Step 2 – Save global spend guardrails to the agency row. */
export async function saveGuardrails(formData: FormData) {
  const user = await getSessionUser()

  const maxDailyBudget    = formData.get('max_daily_budget') as string
  const notificationEmail = formData.get('notification_email') as string

  await db
    .update(agenciesTable)
    .set({
      plan_spend_limit_usd: maxDailyBudget || '1000',
      notification_email:   notificationEmail || null,
    })
    .where(eq(agenciesTable.id, user.agencyId))

  await db
    .update(usersTable)
    .set({ onboarding_step: 2 })
    .where(eq(usersTable.id, user.id))

  revalidatePath('/onboarding')
}

/** Step 3 – Save Slack webhook and mark onboarding complete. */
export async function saveSlackAndComplete(formData: FormData) {
  const user = await getSessionUser()

  const slackWebhook = formData.get('slack_webhook_url') as string

  if (slackWebhook) {
    await db
      .update(agenciesTable)
      .set({ slack_webhook_url: slackWebhook })
      .where(eq(agenciesTable.id, user.agencyId))
  }

  await db
    .update(usersTable)
    .set({ onboarding_step: 3, onboarding_completed: true })
    .where(eq(usersTable.id, user.id))

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

/** Test a Slack webhook URL by sending a test message. */
export async function testSlackWebhook(webhookUrl: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: "✅ *MarketerAgents* connected successfully! You'll receive AI agent alerts here.",
      }),
    })

    if (!res.ok) {
      return { ok: false, error: 'Slack returned an error. Check your webhook URL.' }
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Could not reach Slack. Verify the URL and try again.' }
  }
}
