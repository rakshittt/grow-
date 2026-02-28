/**
 * GET /api/auth/meta/connect
 * Builds the Meta OAuth authorization URL and redirects the user to it.
 * Uses agencyId as the CSRF state token (verified in the callback).
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (!process.env.META_APP_ID || !process.env.META_REDIRECT_URI) {
    return NextResponse.redirect(
      new URL('/onboarding?meta=error&reason=not_configured', request.url)
    )
  }

  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID,
    redirect_uri:  process.env.META_REDIRECT_URI,
    scope:         'ads_read,ads_management,business_management',
    response_type: 'code',
    state:         session.user.agencyId, // used as CSRF token in callback
  })

  const metaOAuthUrl = `https://www.facebook.com/dialog/oauth?${params.toString()}`
  return NextResponse.redirect(metaOAuthUrl)
}
