import NextAuth from 'next-auth'
import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { SupabaseDB } from '@/lib/supabase-db'
import bcrypt from 'bcryptjs'

// Force dynamic rendering - CRITICAL for runtime env access
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

// Create auth config function that accesses env vars at runtime
function getAuthConfig(): NextAuthConfig {
  // Access environment variables at runtime, not build time
  const secret = process.env.NEXTAUTH_SECRET
  const nextAuthUrl = process.env.NEXTAUTH_URL
  
  console.log('[NEXTAUTH_ROUTE] Runtime environment check:', {
    hasSecret: !!secret,
    secretLength: secret?.length || 0,
    secretIsEmpty: secret === '',
    hasUrl: !!nextAuthUrl,
    urlValue: nextAuthUrl,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('NEXTAUTH')).join(', ')
  })
  
  // Check for both undefined and empty string
  if (!secret || secret === '') {
    console.error('[NEXTAUTH_ROUTE] CRITICAL: NEXTAUTH_SECRET is missing or empty!')
    throw new Error('NEXTAUTH_SECRET environment variable is required')
  }
  
  return {
    secret,
    providers: [
      Credentials({
        name: "credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" }
        },
        async authorize(credentials) {
          console.log('[AUTH] Authorize called')
          
          if (!credentials?.email || !credentials?.password) {
            return null
          }

          const validatedFields = loginSchema.safeParse(credentials)
          if (!validatedFields.success) {
            return null
          }

          const { email, password } = validatedFields.data

          try {
            const user = await SupabaseDB.getUserByEmail(email)
            if (!user || !user.password_hash) {
              return null
            }

            const passwordMatch = await bcrypt.compare(password, user.password_hash)
            if (!passwordMatch) {
              return null
            }

            let mappedRole: 'admin' | 'client' | 'employee'
            if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
              mappedRole = 'admin'
            } else if (user.role === 'EMPLOYEE') {
              mappedRole = 'employee'
            } else {
              mappedRole = 'client'
            }
            
            return {
              id: user.id,
              email: user.email,
              name: `${user.first_name} ${user.last_name}`,
              role: mappedRole,
              organization_id: user.organization_id ?? undefined
            }
          } catch (error) {
            console.error('[AUTH] Authentication failed:', error)
            return null
          }
        }
      })
    ],
    session: {
      strategy: 'jwt',
      maxAge: 24 * 60 * 60,
    },
    callbacks: {
      async signIn({ user }) {
        if (!user) return false
        
        try {
          const { getSupabaseClient } = await import('@/lib/supabase-db')
          const client = getSupabaseClient()
          await client
            .from('users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id)
        } catch (error) {
          console.error('[AUTH] Failed to update last login:', error)
        }
        
        return true
      },
      async redirect({ url, baseUrl }) {
        if (url.startsWith('/')) return `${baseUrl}${url}`
        if (url.startsWith(baseUrl)) return url
        return baseUrl
      },
      async jwt({ token, user, trigger, session }) {
        if (user) {
          token.id = user.id
          token.role = user.role
          token.organization_id = user.organization_id
          token.sessionStart = Date.now()
        }
        
        if (token.sessionStart) {
          const sessionAge = Date.now() - (token.sessionStart as number)
          const maxAge = 24 * 60 * 60 * 1000
          
          if (sessionAge > maxAge) {
            return null as any
          }
        }
        
        if (trigger === 'update' && session) {
          token = { ...token, ...session }
        }
        
        return token
      },
      async session({ session, token }) {
        if (token && session.user) {
          session.user.id = token.id as string
          session.user.role = token.role as 'admin' | 'client' | 'employee'
          session.user.organization_id = token.organization_id as string | undefined
          (session as any).sessionStart = token.sessionStart
        }
        
        return session
      }
    },
    pages: {
      signIn: '/login',
      error: '/login'
    },
    trustHost: true,
  }
}

// Initialize NextAuth inside each request handler - NOT at module level
export async function GET(req: Request, ctx: any) {
  console.log('[NEXTAUTH_ROUTE] GET request received')
  try {
    const config = getAuthConfig()
    const handler = NextAuth(config)
    return handler.handlers.GET(req, ctx)
  } catch (error) {
    console.error('[NEXTAUTH_ROUTE] GET handler error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export async function POST(req: Request, ctx: any) {
  console.log('[NEXTAUTH_ROUTE] POST request received')
  try {
    // Rate limit the credentials sign-in endpoint
    const { checkRateLimit, recordFailedAttempt, getBackoffMs, getClientIp } = await import('@/lib/rate-limit')
    const ip = getClientIp(req)
    const limit = checkRateLimit(ip)

    if (!limit.allowed) {
      return new Response(
        JSON.stringify({
          error: limit.isBlocked
            ? 'Too many failed attempts. Your IP has been temporarily blocked.'
            : 'Too many requests. Please slow down.',
          retryAfter: limit.retryAfter,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(limit.retryAfter),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
          },
        }
      )
    }

    // Apply exponential backoff for repeat offenders
    const backoffMs = getBackoffMs(ip)
    if (backoffMs > 0) {
      await new Promise(resolve => setTimeout(resolve, backoffMs))
    }

    const config = getAuthConfig()
    const handler = NextAuth(config)
    const response = await handler.handlers.POST(req, ctx)

    // Record failed attempt if NextAuth returned an error (redirect to /login?error=...)
    if (response instanceof Response) {
      const location = response.headers.get('location') || ''
      if (location.includes('error=')) {
        recordFailedAttempt(ip)
      }
    }

    return response
  } catch (error) {
    console.error('[NEXTAUTH_ROUTE] POST handler error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
