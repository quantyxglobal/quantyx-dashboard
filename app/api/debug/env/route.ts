import { NextResponse } from 'next/server'

// Debug endpoint to check environment variables at runtime
// CRITICAL: This must use force-dynamic to access runtime env vars

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  // Access environment variables at runtime
  const nextAuthSecret = process.env.NEXTAUTH_SECRET
  const nextAuthUrl = process.env.NEXTAUTH_URL
  const databaseUrl = process.env.DATABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    runtime: 'nodejs',
    nodeEnv: process.env.NODE_ENV,
    
    // Check if variables exist and their characteristics
    NEXTAUTH_SECRET: {
      exists: !!nextAuthSecret,
      isEmpty: nextAuthSecret === '',
      length: nextAuthSecret?.length || 0,
      type: typeof nextAuthSecret,
      // Show first 10 chars for debugging (safe for logs)
      preview: nextAuthSecret ? `${nextAuthSecret.substring(0, 10)}...` : 'MISSING'
    },
    NEXTAUTH_URL: {
      exists: !!nextAuthUrl,
      isEmpty: nextAuthUrl === '',
      value: nextAuthUrl || 'MISSING'
    },
    DATABASE_URL: {
      exists: !!databaseUrl,
      isEmpty: databaseUrl === '',
      length: databaseUrl?.length || 0,
      preview: databaseUrl ? `${databaseUrl.substring(0, 20)}...` : 'MISSING'
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      exists: !!supabaseServiceKey,
      isEmpty: supabaseServiceKey === '',
      length: supabaseServiceKey?.length || 0,
      preview: supabaseServiceKey ? `${supabaseServiceKey.substring(0, 20)}...` : 'MISSING'
    },
    
    // List all NEXTAUTH-related env keys
    allNextAuthKeys: Object.keys(process.env).filter(k => k.includes('NEXTAUTH')),
    
    // AWS Amplify specific
    AWS_AMPLIFY_CREDENTIAL_LISTENER_ENABLED: process.env.AWS_AMPLIFY_CREDENTIAL_LISTENER_ENABLED || 'not set',
    
    // Check if we're in AWS Lambda
    isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
    lambdaFunction: process.env.AWS_LAMBDA_FUNCTION_NAME || 'not in lambda',
  })
}
