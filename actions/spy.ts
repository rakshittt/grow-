'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, spyTrackersTable } from '@/lib/db'

async function getSessionUser() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')
  return session.user
}

export async function createTracker(
  formData: FormData
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser()

    const name                = formData.get('name') as string
    const competitor_name     = formData.get('competitor_name') as string
    const competitor_page_url = (formData.get('competitor_page_url') as string) || null
    const country_code        = (formData.get('country_code') as string) || 'US'
    const min_longevity_days  = parseInt(formData.get('min_longevity_days') as string) || 7
    const search_terms_raw    = formData.get('search_terms') as string
    const search_terms        = search_terms_raw
      ? search_terms_raw.split(',').map(s => s.trim()).filter(Boolean)
      : []

    if (!name || !competitor_name) return { error: 'Name and competitor name are required' }

    await db.insert(spyTrackersTable).values({
      agency_id:            user.agencyId,
      created_by:           user.id,
      name,
      competitor_name,
      competitor_page_url,
      country_code,
      min_longevity_days,
      search_terms,
    })

    revalidatePath('/spy')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create tracker' }
  }
}

export async function updateTrackerStatus(
  trackerId: string,
  status: 'active' | 'paused'
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser()

    await db
      .update(spyTrackersTable)
      .set({ status, updated_at: new Date() })
      .where(and(
        eq(spyTrackersTable.id, trackerId),
        eq(spyTrackersTable.agency_id, user.agencyId),
      ))

    revalidatePath('/spy')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update tracker' }
  }
}

export async function deleteTracker(
  trackerId: string
): Promise<{ error?: string }> {
  try {
    const user = await getSessionUser()

    await db
      .delete(spyTrackersTable)
      .where(and(
        eq(spyTrackersTable.id, trackerId),
        eq(spyTrackersTable.agency_id, user.agencyId),
      ))

    revalidatePath('/spy')
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete tracker' }
  }
}
