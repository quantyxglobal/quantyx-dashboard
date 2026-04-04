/**
 * Supabase-based authentication helper
 * Uses API route for authentication to bypass RLS issues
 */

export interface AuthUser {
  id: string
  email: string
  first_name: string
  last_name: string
  role: string
  is_active: boolean
  organization_id: string | null
  organization?: {
    id: string
    name: string
    display_name: string
  } | null
}

export async function authenticateUser(email: string, password: string): Promise<AuthUser | null> {
  try {
    console.log('[SUPABASE_AUTH] Attempting authentication via API for:', email)
    
    // Use absolute URL for server-side fetch
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
    const response = await fetch(`${baseUrl}/api/auth/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      console.log('[SUPABASE_AUTH] API authentication failed:', response.status)
      return null
    }

    const { user } = await response.json()
    console.log('[SUPABASE_AUTH] API authentication successful')
    
    // Keep original role - let auth.config.ts handle the mapping
    // Don't modify the role here to avoid double mapping
    
    return user as AuthUser

  } catch (error) {
    console.error('[SUPABASE_AUTH] Authentication error:', error)
    return null
  }
}