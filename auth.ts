import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { getRuntimeEnvVar } from './lib/runtime-env'

// Get NEXTAUTH_SECRET at runtime (not build time)
function getNextAuthSecret(): string {
  // Try runtime env first (for AWS Amplify Secrets)
  const runtimeSecret = getRuntimeEnvVar('NEXTAUTH_SECRET')
  if (runtimeSecret) {
    console.log('[AUTH] Using runtime NEXTAUTH_SECRET')
    return runtimeSecret
  }
  
  // Fallback to process.env (for local development)
  const buildSecret = process.env.NEXTAUTH_SECRET
  if (buildSecret) {
    console.log('[AUTH] Using build-time NEXTAUTH_SECRET')
    return buildSecret
  }
  
  console.error('[AUTH] NEXTAUTH_SECRET not found in runtime or build-time env')
  throw new Error('NEXTAUTH_SECRET environment variable is required')
}

const secret = getNextAuthSecret()

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
