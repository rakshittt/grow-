'use server'

import { redirect } from 'next/navigation'
import { hash } from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { signIn, signOut } from '@/lib/auth'
import { db, usersTable, agenciesTable } from '@/lib/db'
import { AuthError } from 'next-auth'

export async function signInWithEmail(formData: FormData) {
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  try {
    await signIn('credentials', { email, password, redirectTo: '/dashboard' })
  } catch (err) {
    if (err instanceof AuthError) {
      const msg = err.type === 'CredentialsSignin'
        ? 'Invalid email or password.'
        : err.message
      redirect(`/login?error=${encodeURIComponent(msg)}`)
    }
    throw err // NEXT_REDIRECT — must re-throw
  }
}

export async function signUpWithEmail(formData: FormData) {
  const email    = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  // Check if email already exists
  const existing = await db.query.usersTable.findFirst({
    where: eq(usersTable.email, email),
    columns: { id: true },
  })
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent('An account with this email already exists.')}`)
  }

  const passwordHash = await hash(password, 12)

  // Create agency from email domain
  const domain = email.split('@')[1] ?? 'agency'
  const slug   = domain.replace(/\./g, '-') + '-' + Math.random().toString(36).slice(2, 8)

  const [newAgency] = await db
    .insert(agenciesTable)
    .values({
      name:          domain,
      slug,
      plan:          'trial',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    })
    .returning()

  await db.insert(usersTable).values({
    agency_id:     newAgency.id,
    email,
    password_hash: passwordHash,
    full_name:     fullName || null,
    role:          'owner',
  })

  // Sign in immediately after creating account
  try {
    await signIn('credentials', { email, password, redirectTo: '/onboarding' })
  } catch (err) {
    if (err instanceof AuthError) {
      redirect(`/signup?error=${encodeURIComponent(err.message)}`)
    }
    throw err // NEXT_REDIRECT
  }
}

export async function signInWithGoogle() {
  await signIn('google', { redirectTo: '/dashboard' })
}

export async function signOutAction() {
  await signOut({ redirectTo: '/login' })
}
