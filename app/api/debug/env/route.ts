import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Only allow in development or with a secret key
  const debugKey = process.env.DEBUG_KEY
  
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    awsExecutionEnv: process.env.AWS_EXECUTION_ENV || 'not-aws',
    awsRegion: process.env.AWS_REGION || 'not-set',
    // Show first 10 chars of NEXTAUTH_SECRET for debugging (safe)
    nextAuthSecretPreview: process.env.NEXTAUTH_SECRET?.substring(0, 10) + '...' || 'MISSING',
  })
}
