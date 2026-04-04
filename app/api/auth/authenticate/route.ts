import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy-loaded Supabase client
let _supabaseClient: SupabaseClient | null = null

function getSupabaseClient(): SupabaseClient {
  if (!_supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase environment variables are required')
    }
    
    _supabaseClient = createClient(supabaseUrl, supabaseServiceKey)
  }
  return _supabaseClient
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    console.log('[API_AUTH] Attempting authentication for:', email)

    // Query user using service role key (bypasses RLS)
    const supabase = getSupabaseClient()
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        organization_id,
        password_hash,
        organization:organizations(id, name, display_name)
      `)
      .eq('email', email)

    if (error) {
      console.log('[API_AUTH] Database error:', error.message)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!users || users.length === 0) {
      console.log('[API_AUTH] User not found')
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Take the first user if multiple exist
    const user = users[0]

    if (!user || !user.is_active) {
      console.log('[API_AUTH] User not found or inactive')
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!user.password_hash) {
      console.log('[API_AUTH] User has no password hash')
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    console.log('[API_AUTH] Password match result:', passwordMatch)
    
    if (!passwordMatch) {
      console.log('[API_AUTH] Password mismatch')
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    console.log('[API_AUTH] Authentication successful')

    // Return user data (without password hash)
    const { password_hash, ...userWithoutPassword } = user
    return NextResponse.json({ user: userWithoutPassword })

  } catch (error) {
    console.error('[API_AUTH] Authentication error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}