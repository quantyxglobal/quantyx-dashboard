import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { z } from 'zod'
import { SupabaseDB } from '@/lib/supabase-db'
import bcrypt from 'bcryptjs'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

// Retry database connection with reduced attempts for faster failover
async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2, // Reduced from 3
  baseDelay: number = 500  // Reduced from 1000ms
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      if (attempt === maxRetries) {
        throw error
      }
      
      // Only retry on connection errors
      if (error.message?.includes('ETIMEDOUT') || 
          error.message?.includes('Can\'t reach database') ||
          error.message?.includes('Connection terminated')) {
        const delay = baseDelay * attempt // Linear backoff instead of exponential
        console.log(`[AUTH] Database connection failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      
      // Don't retry on other errors (auth failures, etc.)
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}

export const authConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        console.log('[AUTH] Authorize called with:', { email: credentials?.email })
        
        if (!credentials?.email || !credentials?.password) {
          console.log('[AUTH] Missing credentials')
          return null
        }

        // Validate credentials format
        const validatedFields = loginSchema.safeParse(credentials)
        
        if (!validatedFields.success) {
          console.log('[AUTH] Validation failed:', validatedFields.error)
          return null
        }

        const { email, password } = validatedFields.data
        console.log('[AUTH] Attempting authentication for:', email)

        try {
          // Use Supabase directly (faster, no Prisma connection issues)
          console.log('[AUTH] Querying Supabase for user:', email)
          const user = await SupabaseDB.getUserByEmail(email)

          console.log('[AUTH] Database query result:', user ? 'User found' : 'User not found')

          if (!user) {
            console.log('[AUTH] User not found in database')
            return null
          }

          if (!user.password_hash) {
            console.log('[AUTH] User has no password hash')
            return null
          }

          // Verify password with bcrypt
          const passwordMatch = await bcrypt.compare(password, user.password_hash)
          console.log('[AUTH] Password match:', passwordMatch)

          if (!passwordMatch) {
            console.log('[AUTH] Password mismatch')
            return null
          }

          console.log('[AUTH] Authentication successful')
          // Return user object with required fields - preserve original role from database
          return {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            role: user.role, // Keep original role: SUPER_ADMIN, ADMIN, EMPLOYEE, CLIENT
            organization_id: user.organization_id ?? undefined
          }
        } catch (error) {
          console.error('[AUTH] Supabase authentication failed:', error)
          return null
        }
      }
    })
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log('[AUTH] SignIn callback:', user ? 'User authenticated' : 'No user')
      if (!user) return false
      
      // Update last login time in database
      try {
        const { getSupabaseClient } = await import('@/lib/supabase-db')
        const client = getSupabaseClient()
        await client
          .from('users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', user.id)
      } catch (error) {
        console.error('[AUTH] Failed to update last login:', error)
        // Don't fail login if this fails
      }
      
      return true
    },
    async redirect({ url, baseUrl }) {
      // Allow relative URLs and same-origin URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      if (url.startsWith(baseUrl)) return url
      
      // For any other URLs, redirect to base URL for security
      return baseUrl
    },
    async jwt({ token, user, trigger, session }) {
      console.log('[AUTH] JWT callback:', { 
        hasToken: !!token, 
        hasUser: !!user, 
        userRole: user?.role, 
        tokenRole: token?.role,
        trigger 
      })
      
      // Add role and organization_id to token on sign in
      if (user) {
        token.id = user.id
        // Preserve original role from database (SUPER_ADMIN, ADMIN, EMPLOYEE, CLIENT)
        console.log('[AUTH] JWT preserving role:', user.role)
        token.role = user.role
        token.organization_id = user.organization_id
        // Set session start time for 24-hour expiration tracking
        token.sessionStart = Date.now()
      }
      
      // Check if session has expired (24 hours = 86400000 milliseconds)
      if (token.sessionStart) {
        const sessionAge = Date.now() - (token.sessionStart as number)
        const maxAge = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        
        if (sessionAge > maxAge) {
          console.log('[AUTH] Session expired after 24 hours, forcing logout')
          // Return null to invalidate the token
          return null as any
        }
      }
      
      // Handle session updates
      if (trigger === 'update' && session) {
        token = { ...token, ...session }
      }
      
      return token
    },
    async session({ session, token }) {
      console.log('[AUTH] Session callback:', { hasSession: !!session, hasToken: !!token, tokenRole: token?.role })
      // Add role and organization_id to session
      if (token && session.user) {
        session.user.id = token.id as string
        // Preserve original role from token (SUPER_ADMIN, ADMIN, EMPLOYEE, CLIENT)
        session.user.role = token.role as 'SUPER_ADMIN' | 'ADMIN' | 'EMPLOYEE' | 'CLIENT'
        session.user.organization_id = token.organization_id as string | undefined
        // Add session start time for client-side timeout handling
        (session as any).sessionStart = token.sessionStart
        console.log('[AUTH] Session role set to:', session.user.role)
      }
      
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login' // Redirect errors back to login page
  },
  debug: process.env.NODE_ENV === 'development',
  trustHost: true, // Add this for development
  basePath: '/api/auth', // Explicitly set the base path
} satisfies NextAuthConfig
