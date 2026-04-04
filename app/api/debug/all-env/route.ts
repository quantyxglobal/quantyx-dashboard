import { NextResponse } from 'next/server'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

/**
 * Debug endpoint to check all environment variables
 * GET /api/debug/all-env
 */
export async function GET() {
  try {
    // Check authentication
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only allow SUPER_ADMIN to access this endpoint
    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    // Helper function to check variable
    const checkVar = (name: string) => {
      const value = process.env[name]
      return {
        exists: !!value,
        isEmpty: value === '',
        length: value?.length || 0,
        type: typeof value,
        preview: value ? `${value.substring(0, 10)}...` : undefined
      }
    }

    const envCheck = {
      timestamp: new Date().toISOString(),
      runtime: 'nodejs',
      nodeEnv: process.env.NODE_ENV,
      
      // NextAuth variables
      nextAuth: {
        NEXTAUTH_SECRET: checkVar('NEXTAUTH_SECRET'),
        NEXTAUTH_URL: {
          exists: !!process.env.NEXTAUTH_URL,
          value: process.env.NEXTAUTH_URL
        }
      },

      // Database variables
      database: {
        DATABASE_URL: checkVar('DATABASE_URL')
      },

      // Supabase variables
      supabase: {
        NEXT_PUBLIC_SUPABASE_URL: {
          exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
          value: process.env.NEXT_PUBLIC_SUPABASE_URL
        },
        NEXT_PUBLIC_SUPABASE_ANON_KEY: checkVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
        SUPABASE_SERVICE_ROLE_KEY: checkVar('SUPABASE_SERVICE_ROLE_KEY')
      },

      // AWS variables (standard naming)
      awsStandard: {
        AWS_ACCESS_KEY_ID: checkVar('AWS_ACCESS_KEY_ID'),
        AWS_SECRET_ACCESS_KEY: checkVar('AWS_SECRET_ACCESS_KEY'),
        AWS_REGION: {
          exists: !!process.env.AWS_REGION,
          value: process.env.AWS_REGION
        },
        AWS_S3_BUCKET_NAME: {
          exists: !!process.env.AWS_S3_BUCKET_NAME,
          value: process.env.AWS_S3_BUCKET_NAME
        }
      },

      // AWS variables (Amplify naming)
      awsAmplify: {
        AMPLIFY_AWS_ACCESS_KEY_ID: checkVar('AMPLIFY_AWS_ACCESS_KEY_ID'),
        AMPLIFY_AWS_SECRET_ACCESS_KEY: checkVar('AMPLIFY_AWS_SECRET_ACCESS_KEY'),
        AMPLIFY_AWS_REGION: {
          exists: !!process.env.AMPLIFY_AWS_REGION,
          value: process.env.AMPLIFY_AWS_REGION
        },
        AMPLIFY_AWS_S3_BUCKET_NAME: {
          exists: !!process.env.AMPLIFY_AWS_S3_BUCKET_NAME,
          value: process.env.AMPLIFY_AWS_S3_BUCKET_NAME
        }
      },

      // Email variables
      email: {
        POSTMARK_API_KEY: checkVar('POSTMARK_API_KEY'),
        CASE_NOTIFICATION_EMAIL: {
          exists: !!process.env.CASE_NOTIFICATION_EMAIL,
          value: process.env.CASE_NOTIFICATION_EMAIL || 'info@quantyxg.com (default)'
        },
        ACCOUNT_NOTIFICATION_EMAIL: {
          exists: !!process.env.ACCOUNT_NOTIFICATION_EMAIL,
          value: process.env.ACCOUNT_NOTIFICATION_EMAIL || 'support@quantyxg.com (default)'
        }
      },

      // Check which AWS variables are being used
      awsResolution: {
        accessKeyId: process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID ? 'Available' : 'MISSING',
        secretAccessKey: process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY ? 'Available' : 'MISSING',
        region: process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION || 'MISSING',
        bucketName: process.env.AMPLIFY_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME || 'MISSING',
        usingAmplifyPrefix: !!(process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AMPLIFY_AWS_REGION)
      },

      // Lambda/Amplify specific
      amplifyContext: {
        isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
        lambdaFunction: process.env.AWS_LAMBDA_FUNCTION_NAME,
        amplifyAppId: process.env.AWS_APP_ID,
        amplifyBranch: process.env.AWS_BRANCH
      },

      // All environment variable keys (for debugging)
      allEnvKeys: Object.keys(process.env).filter(key => 
        key.includes('AWS') || 
        key.includes('POSTMARK') || 
        key.includes('NEXTAUTH') || 
        key.includes('SUPABASE') ||
        key.includes('DATABASE') ||
        key.includes('EMAIL') ||
        key.includes('NOTIFICATION')
      ).sort()
    }

    return NextResponse.json(envCheck, { status: 200 })

  } catch (error) {
    console.error('[DEBUG_ALL_ENV] Error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
