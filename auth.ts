import NextAuth from 'next-auth'
import { authConfig } from './auth.config'

// Ensure NEXTAUTH_SECRET is available
const secret = process.env.NEXTAUTH_SECRET
if (!secret) {
  console.error('[AUTH] NEXTAUTH_SECRET environment variable is not set!')
  throw new Error('NEXTAUTH_SECRET environment variable is required')
}

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
