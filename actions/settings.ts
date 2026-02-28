'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, agenciesTable, metaAdAccountsTable } from '@/lib/db'

async function getSessionUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session.user
}

/** Update agency Slack webhook + notification email. */
export async function saveAgencySettings(formData: FormData): Promise<{ error?: string }> {
  try {
    const user             = await getSessionUser()
    const slack_webhook    = (formData.get('slack_webhook_url') as string) || null
    const notification_email = (formData.get('notification_email') as string) || null
    const agency_name      = (formData.get('agency_name') as string) || null

    await db
      .update(agenciesTable)
      .set({
        ...(agency_name        && { name: agency_name }),
        slack_webhook_url:      slack_webhook,
        notification_email:     notification_email,
        updated_at:             new Date(),
      })
      .where(eq(agenciesTable.id, user.agencyId))

    revalidatePath('/settings')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save settings' }
  }
}

/** Disconnect (soft-delete by setting status=revoked) a Meta ad account. */
export async function disconnectMetaAccount(accountId: string): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser()

    await db
      .update(metaAdAccountsTable)
      .set({ status: 'revoked', updated_at: new Date() })
      .where(and(
        eq(metaAdAccountsTable.id, accountId),
        eq(metaAdAccountsTable.agency_id, user.agencyId),
      ))

    revalidatePath('/settings')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to disconnect account' }
  }
}
