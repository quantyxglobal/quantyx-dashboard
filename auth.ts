import NextAuth, { type NextAuthConfig } from 'next-auth'
import { authConfig } from './auth.config'
import type { NextRequest } from 'next/server'

// Lazy initialization of NextAuth
let authInstance: ReturnType<typeof NextAuth> | null = null

function getAuthInstance() {
  if (!authInstance) {
    // Access environment variables at runtime, not build time
    const secret = process.env.NEXTAUTH_SECRET
    
    // Check for both undefined and empty string
    if (!secret || secret === '') {
      console.error('[AUTH] NEXTAUTH_SECRET not available at runtime:', {
        type: typeof secret,
        value: secret,
        length: secret?.length,
        allEnvKeys: Object.keys(process.env).filter(k => k.includes('NEXTAUTH'))
      })
      throw new Error('NEXTAUTH_SECRET environment variable is required')
    }
    
    console.log('[AUTH] Initializing NextAuth with secret from runtime env (length:', secret.length, ')')
    
    authInstance = NextAuth({
      ...authConfig,
      session: {
        strategy: 'jwt',
        maxAge: 24 * 60 * 60, // 24 hours in seconds
        updateAge: 60 * 60, // Update session every hour
      },
      cookies: {
        sessionToken: {
          name: `${process.env.NODE_ENV === 'production' ? '__Secure-' : ''}next-auth.session-token`,
          options: {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60, // 24 hours
          },
        },
      },
      secret,
      useSecureCookies: process.env.NODE_ENV === 'production',
    })
  }
  
  return authInstance
}

// Export lazy-loaded auth functions
export const auth = (...args: Parameters<ReturnType<typeof NextAuth>['auth']>) => {
  return getAuthInstance().auth(...args)
}

export const signIn = (...args: Parameters<ReturnType<typeof NextAuth>['signIn']>) => {
  return getAuthInstance().signIn(...args)
}

export const signOut = (...args: Parameters<ReturnType<typeof NextAuth>['signOut']>) => {
  return getAuthInstance().signOut(...args)
}

// Export handlers as functions that call the lazy-loaded instance
export const handlers = {
  GET: async (req: NextRequest) => {
    return getAuthInstance().handlers.GET(req)
  },
  POST: async (req: NextRequest) => {
    return getAuthInstance().handlers.POST(req)
  },
}
