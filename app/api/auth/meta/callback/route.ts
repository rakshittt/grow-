/**
 * GET /api/auth/meta/callback
 * Meta OAuth callback handler.
 *
 * Flow:
 *  1. Validate state (CSRF) + code params
 *  2. Exchange short-lived code → short-lived token
 *  3. Exchange short-lived token → long-lived token (~60 days)
 *  4. Fetch all ad accounts accessible to the user
 *  5. Upsert each account into meta_ad_accounts
 *  6. Redirect to /onboarding?meta=connected
 */
import { NextResponse, type NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db, metaAdAccountsTable } from '@/lib/db'

const META_API_BASE = `https://graph.facebook.com/${process.env.META_API_VERSION ?? 'v25.0'}`

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { searchParams } = request.nextUrl
  const code          = searchParams.get('code')
  const state         = searchParams.get('state')
  const errorParam    = searchParams.get('error')

  const onboardingUrl = (meta: string) =>
    new URL(`/onboarding?meta=${meta}`, request.url)

  // User denied the OAuth dialog
  if (errorParam) {
    return NextResponse.redirect(onboardingUrl('denied'))
  }

  // Validate CSRF state — must match the agencyId we sent
  if (!code || state !== session.user.agencyId) {
    return NextResponse.redirect(onboardingUrl('error'))
  }

  // ── Step 1: Exchange code → short-lived token ──────────────────────────────
  let shortLivedToken: string
  try {
    const tokenUrl = new URL(`${META_API_BASE}/oauth/access_token`)
    tokenUrl.searchParams.set('client_id',    process.env.META_APP_ID!)
    tokenUrl.searchParams.set('client_secret', process.env.META_APP_SECRET!)
    tokenUrl.searchParams.set('redirect_uri',  process.env.META_REDIRECT_URI!)
    tokenUrl.searchParams.set('code',          code)

    const tokenRes = await fetch(tokenUrl.toString())
    if (!tokenRes.ok) throw new Error(await tokenRes.text())

    const tokenData = await tokenRes.json()
    shortLivedToken = tokenData.access_token
  } catch (err) {
    console.error('[Meta OAuth] Token exchange failed:', err)
    return NextResponse.redirect(onboardingUrl('error'))
  }

  // ── Step 2: Exchange short-lived → long-lived token (~60 days) ────────────
  let accessToken: string
  let tokenExpiresAt: Date | null = null
  try {
    const llUrl = new URL(`${META_API_BASE}/oauth/access_token`)
    llUrl.searchParams.set('grant_type',        'fb_exchange_token')
    llUrl.searchParams.set('client_id',          process.env.META_APP_ID!)
    llUrl.searchParams.set('client_secret',      process.env.META_APP_SECRET!)
    llUrl.searchParams.set('fb_exchange_token',  shortLivedToken)

    const llRes = await fetch(llUrl.toString())
    if (!llRes.ok) throw new Error(await llRes.text())

    const llData = await llRes.json()
    accessToken  = llData.access_token
    tokenExpiresAt = llData.expires_in
      ? new Date(Date.now() + Number(llData.expires_in) * 1000)
      : null
  } catch {
    // Fall back to short-lived token if exchange fails
    accessToken = shortLivedToken
  }

  // ── Step 3: Fetch ad accounts ──────────────────────────────────────────────
  let rawAccounts: Record<string, unknown>[] = []
  try {
    const accountsUrl = new URL(`${META_API_BASE}/me/adaccounts`)
    accountsUrl.searchParams.set(
      'fields',
      'id,name,currency,timezone_name,business{id,name}'
    )
    accountsUrl.searchParams.set('access_token', accessToken)
    accountsUrl.searchParams.set('limit', '50')

    const accountsRes = await fetch(accountsUrl.toString())
    if (!accountsRes.ok) throw new Error(await accountsRes.text())

    const accountsData = await accountsRes.json()
    rawAccounts = accountsData.data ?? []
  } catch (err) {
    console.error('[Meta OAuth] Fetching ad accounts failed:', err)
    return NextResponse.redirect(onboardingUrl('error'))
  }

  // ── Step 4: Upsert each ad account ────────────────────────────────────────
  for (const acct of rawAccounts) {
    // Meta returns IDs as "act_123456" or plain "123456" — normalise to "act_..."
    const rawId      = acct.id as string
    const adAcctId   = rawId.startsWith('act_') ? rawId : `act_${rawId}`
    const business   = acct.business as { id?: string; name?: string } | undefined

    const existing = await db.query.metaAdAccountsTable.findFirst({
      where: and(
        eq(metaAdAccountsTable.agency_id,     session.user.agencyId),
        eq(metaAdAccountsTable.ad_account_id, adAcctId),
      ),
      columns: { id: true },
    })

    if (existing) {
      await db
        .update(metaAdAccountsTable)
        .set({
          access_token:     accessToken,
          token_expires_at: tokenExpiresAt,
          status:           'active',
          updated_at:       new Date(),
        })
        .where(eq(metaAdAccountsTable.id, existing.id))
    } else {
      await db.insert(metaAdAccountsTable).values({
        agency_id:        session.user.agencyId,
        connected_by:     session.user.id,
        ad_account_id:    adAcctId,
        ad_account_name:  acct.name as string,
        business_id:      business?.id    ?? null,
        business_name:    business?.name  ?? null,
        currency:         (acct.currency as string)      ?? 'USD',
        timezone:         (acct.timezone_name as string) ?? 'America/New_York',
        access_token:     accessToken,
        token_expires_at: tokenExpiresAt,
        granted_scopes:   ['ads_read', 'ads_management', 'business_management'],
      })
    }
  }

  return NextResponse.redirect(onboardingUrl('connected'))
}
