import { auth } from '@/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SupabaseDB } from '@/lib/supabase-db'
import { 
  isProtectedRoute, 
  canAccessPath, 
  getRedirectForInvalidAccess,
  type UserRole 
} from '@/lib/role-redirect'

// Force middleware to run in Node.js runtime where all env vars are available
// Edge runtime in AWS Amplify doesn't have access to non-NEXT_PUBLIC_ variables
export const runtime = 'nodejs'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip all API routes - let them handle their own auth
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Skip static files and Next.js internals
  if (
    pathname.startsWith('/_next/') || 
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/static/') ||
    /\.(ico|png|jpg|jpeg|gif|svg|css|js|woff|woff2|ttf|eot|webp|avif|mp4|webm|pdf)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  // Skip public routes
  if (pathname === '/login' || pathname === '/register' || pathname === '/' || pathname === '/setup-mfa' || pathname === '/forgot-password' || pathname === '/reset-password') {
    return NextResponse.next()
  }

  // Check if this is a protected route
  if (!isProtectedRoute(pathname)) {
    return NextResponse.next()
  }

  try {
    const session = await auth()

    // Redirect unauthenticated users to login
    if (!session || !session.user) {
      console.log('[MIDDLEWARE] No session, redirecting to login')
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Check if user has required role property
    if (!session.user.role) {
      console.error('[MIDDLEWARE] User session missing role')
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'invalid_session')
      return NextResponse.redirect(loginUrl)
    }

    // Get actual user role from database for accurate role checking
    let actualRole: UserRole
    let mfaSetupRequired = false
    try {
      const user = await SupabaseDB.getUserById(session.user.id)
      if (!user) {
        console.error('[MIDDLEWARE] User not found in database')
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'user_not_found')
        return NextResponse.redirect(loginUrl)
      }
      actualRole = user.role as UserRole
      mfaSetupRequired = (user as any).mfa_setup_required || false
    } catch (error) {
      console.error('[MIDDLEWARE] Error fetching user:', error)
      // Fall back to session role if database query fails
      // Session now contains actual database roles (SUPER_ADMIN, ADMIN, EMPLOYEE, CLIENT)
      actualRole = session.user.role as UserRole
    }

    // MFA setup is now optional - users can set it up later from settings
    // if (mfaSetupRequired && pathname !== '/setup-mfa') {
    //   console.log('[MIDDLEWARE] MFA setup required, redirecting to /setup-mfa')
    //   return NextResponse.redirect(new URL('/setup-mfa', request.url))
    // }

    console.log('[MIDDLEWARE] User role:', actualRole, 'accessing:', pathname)

    // Check if user can access this path
    if (!canAccessPath(actualRole, pathname)) {
      console.log('[MIDDLEWARE] Access denied, redirecting to appropriate dashboard')
      const redirectUrl = getRedirectForInvalidAccess(actualRole, pathname)
      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    console.log('[MIDDLEWARE] Access granted to:', pathname)
    return NextResponse.next()
  } catch (error) {
    console.error('[MIDDLEWARE] Error:', error)
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'middleware_error')
    return NextResponse.redirect(loginUrl)
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static files with extensions
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}