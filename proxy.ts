import { auth } from '@/lib/auth'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const session = await auth()
  const { pathname } = request.nextUrl

  const isLandingPage   = pathname === '/'
  const isAuthRoute     = pathname.startsWith('/login') || pathname.startsWith('/signup')
  const isCallbackRoute = pathname.startsWith('/api/auth')
  const isApiRoute      = pathname.startsWith('/api/')
  const isPublic        = isLandingPage || isAuthRoute || isCallbackRoute || isApiRoute

  // Unauthenticated user trying to access a protected route
  if (!session?.user && !isPublic) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user visiting login/signup — send to dashboard
  if (session?.user && isAuthRoute) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    dashboardUrl.search = ''
    return NextResponse.redirect(dashboardUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
