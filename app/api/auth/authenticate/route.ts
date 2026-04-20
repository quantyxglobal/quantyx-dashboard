import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { checkRateLimit, recordFailedAttempt, recordSuccessfulLogin, getBackoffMs, getClientIp } from '@/lib/rate-limit'

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
  const ip = getClientIp(request)

  // --- Rate limit check ---
  const limit = checkRateLimit(ip)
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: limit.isBlocked
          ? 'Too many failed attempts. Your IP has been temporarily blocked.'
          : 'Too many requests. Please slow down.',
        retryAfter: limit.retryAfter,
        requiresCaptcha: limit.requiresCaptcha,
        isBlocked: limit.isBlocked,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(limit.retryAfter),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + limit.retryAfter),
        },
      }
    )
  }

  // Apply exponential backoff delay for repeat offenders
  const backoffMs = getBackoffMs(ip)
  if (backoffMs > 0) {
    await new Promise(resolve => setTimeout(resolve, backoffMs))
  }

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
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!users || users.length === 0) {
      console.log('[API_AUTH] User not found')
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Take the first user if multiple exist
    const user = users[0]

    if (!user || !user.is_active) {
      console.log('[API_AUTH] User not found or inactive')
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    if (!user.password_hash) {
      console.log('[API_AUTH] User has no password hash')
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash)
    console.log('[API_AUTH] Password match result:', passwordMatch)

    if (!passwordMatch) {
      console.log('[API_AUTH] Password mismatch')
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    console.log('[API_AUTH] Authentication successful')
    recordSuccessfulLogin(ip)

    // Return user data (without password hash)
    const { password_hash, ...userWithoutPassword } = user
    return NextResponse.json(
      { user: userWithoutPassword },
      {
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(limit.remaining - 1),
        },
      }
    )
  } catch (error) {
    console.error('[API_AUTH] Authentication error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
