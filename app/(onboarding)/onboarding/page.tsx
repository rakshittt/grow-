import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, usersTable } from '@/lib/db'
import { OnboardingWizard } from '@/components/features/onboarding/wizard'

export default async function OnboardingPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const profile = await db.query.usersTable.findFirst({
    where: eq(usersTable.id, session.user.id),
    columns: { onboarding_step: true, onboarding_completed: true },
  })

  // Already completed — send to dashboard
  if (profile?.onboarding_completed) redirect('/dashboard')

  return <OnboardingWizard initialStep={profile?.onboarding_step ?? 0} />
}
