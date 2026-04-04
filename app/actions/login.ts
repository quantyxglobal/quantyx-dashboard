'use server'

import { signIn } from '@/auth'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { SupabaseDB } from '@/lib/supabase-db'
import { getLoginRedirect, type UserRole } from '@/lib/role-redirect'
import { verifyMFAToken, checkMFARequired } from './mfa-verify'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

// Check if user has MFA enabled and needs verification (weekly check)
export async function checkUserMFAStatus(email: string) {
  console.log('[CHECK_MFA_STATUS] Starting check for email:', email)
  try {
    console.log('[CHECK_MFA_STATUS] Fetching user from database...')
    const user = await SupabaseDB.getUserByEmail(email)
    console.log('[CHECK_MFA_STATUS] User fetch result:', user ? 'Found' : 'Not found')
    
    if (!user) {
      console.log('[CHECK_MFA_STATUS] User not found, returning error')
      return { error: 'User not found' }
    }
    
    const mfaEnabled = (user as any).mfa_enabled || false
    console.log('[CHECK_MFA_STATUS] MFA enabled status:', mfaEnabled)
    
    if (!mfaEnabled) {
      console.log('[CHECK_MFA_STATUS] MFA not enabled, returning false')
      return {
        mfaEnabled: false,
        mfaRequired: false,
        userId: (user as any).id
      }
    }
    
    // Check if MFA verification is required (weekly)
    console.log('[CHECK_MFA_STATUS] Checking if MFA verification required...')
    const mfaRequired = await checkMFARequired((user as any).id)
    console.log('[CHECK_MFA_STATUS] MFA required:', mfaRequired)
    
    return {
      mfaEnabled: true,
      mfaRequired,
      userId: (user as any).id
    }
  } catch (error) {
    console.error('[CHECK_MFA_STATUS] Error:', error)
    return { error: 'Failed to check MFA status' }
  }
}

// Verify password and MFA token together
export async function loginWithMFA(email: string, password: string, mfaToken: string, callbackUrl?: string) {
  try {
    // First verify password
    const user = await SupabaseDB.getUserByEmail(email)
    if (!user) {
      return { error: 'Invalid credentials' }
    }

    const bcrypt = await import('bcryptjs')
    const passwordMatch = await bcrypt.compare(password, (user as any).password_hash)
    
    if (!passwordMatch) {
      return { error: 'Invalid credentials' }
    }

    // Verify MFA token
    const mfaResult = await verifyMFAToken((user as any).id, mfaToken)
    
    if (mfaResult.error) {
      return { error: mfaResult.error }
    }

    // Get redirect URL
    const redirectTo = getLoginRedirect((user as any).role as UserRole, callbackUrl)
    
    // Sign in
    await signIn('credentials', {
      email,
      password,
      redirectTo
    })
    
    return { success: true }
  } catch (error: any) {
    console.error('[LOGIN_WITH_MFA] Error:', error)
    
    // In NextAuth v5, successful login throws NEXT_REDIRECT
    if (error?.message?.includes('NEXT_REDIRECT') || error?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error
    }
    
    return { error: 'Login failed' }
  }
}

export async function loginAction(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const callbackUrl = formData.get('callbackUrl') as string | undefined

  // Basic validation
  if (!email || !password) {
    redirect('/login?error=validation')
  }

  // Validate with schema
  const validation = loginSchema.safeParse({ email, password })
  if (!validation.success) {
    redirect('/login?error=validation')
  }

  try {
    console.log('[LOGIN_ACTION] Attempting login for:', email)
    
    // Get user from database to determine correct redirect
    let user: any = null
    let retries = 3
    let lastError: any = null
    
    // Retry logic for Supabase connection
    while (retries > 0 && !user) {
      try {
        user = await SupabaseDB.getUserByEmail(email)
        break
      } catch (error: any) {
        lastError = error
        console.log(`[LOGIN_ACTION] Error fetching user (${retries} retries left):`, {
          message: error?.message,
          details: error?.details || error?.toString(),
          hint: error?.hint,
          code: error?.code
        })
        
        retries--
        if (retries > 0) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * (4 - retries)))
        }
      }
    }
    
    if (!user) {
      console.log('[LOGIN_ACTION] User not found after retries')
      console.error('[LOGIN_ACTION] Last error:', lastError)
      redirect('/login?error=credentials')
    }

    // Use centralized redirect logic
    const redirectTo = getLoginRedirect(user.role as UserRole, callbackUrl)
    
    console.log('[LOGIN_ACTION] User role:', user.role, '- Redirecting to:', redirectTo)
    
    // Attempt to sign in with role-specific redirect
    await signIn('credentials', {
      email,
      password,
      redirectTo
    })
    
    console.log('[LOGIN_ACTION] Sign in successful')
  } catch (error: any) {
    console.error('[LOGIN_ACTION] Login error:', error?.message || error)
    
    // In NextAuth v5, successful login throws NEXT_REDIRECT
    if (error?.message?.includes('NEXT_REDIRECT') || error?.digest?.startsWith('NEXT_REDIRECT')) {
      console.log('[LOGIN_ACTION] Redirect detected (successful login)')
      throw error
    }
    
    // Check for credentials error
    if (error?.type === 'CredentialsSignin' || error?.message?.includes('CredentialsSignin')) {
      console.log('[LOGIN_ACTION] Invalid credentials')
      redirect('/login?error=credentials')
    }
    
    // Generic error
    console.log('[LOGIN_ACTION] Unknown error')
    redirect('/login?error=unknown')
  }
}
