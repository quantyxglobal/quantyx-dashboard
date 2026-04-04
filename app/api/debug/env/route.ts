import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Log all environment variables to CloudWatch
  console.log('=== FULL ENVIRONMENT VARIABLES ===')
  console.log(JSON.stringify(process.env, null, 2))
  console.log('=== END ENVIRONMENT VARIABLES ===')
  
  // Get all env var keys
  const allEnvKeys = Object.keys(process.env).sort()
  
  // Filter for our specific variables
  const ourVars = allEnvKeys.filter(key => 
    key.includes('NEXTAUTH') || 
    key.includes('DATABASE') || 
    key.includes('SUPABASE') ||
    key.includes('AWS')
  )
  
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
    // Show all environment variable keys
    allEnvKeys: allEnvKeys,
    // Show our specific variable keys
    ourVariableKeys: ourVars,
    // Show count
    totalEnvVars: allEnvKeys.length,
  })
}
