import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Direct access to process.env
  const directAccess = {
    NEXTAUTH_SECRET: process.env['NEXTAUTH_SECRET'],
    NEXTAUTH_URL: process.env['NEXTAUTH_URL'],
    DATABASE_URL: process.env['DATABASE_URL'],
    SUPABASE_SERVICE_ROLE_KEY: process.env['SUPABASE_SERVICE_ROLE_KEY'],
  }
  
  // Log all environment variables to CloudWatch
  console.log('=== DIRECT ACCESS TEST ===')
  console.log('NEXTAUTH_SECRET:', directAccess.NEXTAUTH_SECRET ? `EXISTS (${directAccess.NEXTAUTH_SECRET.length} chars)` : 'MISSING')
  console.log('NEXTAUTH_URL:', directAccess.NEXTAUTH_URL || 'MISSING')
  console.log('DATABASE_URL:', directAccess.DATABASE_URL ? 'EXISTS' : 'MISSING')
  console.log('SUPABASE_SERVICE_ROLE_KEY:', directAccess.SUPABASE_SERVICE_ROLE_KEY ? 'EXISTS' : 'MISSING')
  console.log('=== END DIRECT ACCESS TEST ===')
  
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
    // Direct access
    directAccess: {
      hasNextAuthSecret: !!directAccess.NEXTAUTH_SECRET,
      nextAuthSecretLength: directAccess.NEXTAUTH_SECRET?.length || 0,
      nextAuthSecretPreview: directAccess.NEXTAUTH_SECRET?.substring(0, 10) + '...' || 'MISSING',
      hasNextAuthUrl: !!directAccess.NEXTAUTH_URL,
      nextAuthUrl: directAccess.NEXTAUTH_URL || 'MISSING',
      hasDatabaseUrl: !!directAccess.DATABASE_URL,
      databaseUrlPreview: directAccess.DATABASE_URL?.substring(0, 20) + '...' || 'MISSING',
      hasSupabaseServiceKey: !!directAccess.SUPABASE_SERVICE_ROLE_KEY,
      supabaseKeyPreview: directAccess.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 10) + '...' || 'MISSING',
    },
    // Original checks
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0,
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    awsExecutionEnv: process.env.AWS_EXECUTION_ENV || 'not-aws',
    awsRegion: process.env.AWS_REGION || 'not-set',
    // Show all environment variable keys
    allEnvKeys: allEnvKeys,
    // Show our specific variable keys
    ourVariableKeys: ourVars,
    // Show count
    totalEnvVars: allEnvKeys.length,
  })
}
