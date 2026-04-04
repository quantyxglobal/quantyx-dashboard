import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

// Get NEXTAUTH_SECRET - NextAuth will handle validation
const secret = process.env.NEXTAUTH_SECRET

// Log for debugging (will be removed in production via next.config.ts)
console.log('[AUTH] Initializing NextAuth with secret:', secret ? 'present' : 'MISSING')
console.log('[AUTH] Environment check:', {
  nodeEnv: process.env.NODE_ENV,
  hasSecret: !!secret,
  secretLength: secret?.length || 0
})

export const { auth, signIn, signOut, handlers } = NextAuth({
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
