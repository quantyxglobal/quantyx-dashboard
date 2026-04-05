import { getCorsHeaders } from '@/lib/cors'

// Debug endpoint to check environment variables
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin')
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin)
    }
  })
}

export async function GET(req: Request) {
  try {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)
    
    // Return sanitized environment info (don't expose secrets)
    const envInfo = {
      AWS_REGION: process.env.AWS_REGION || 'not set',
      CUSTOM_AWS_REGION: process.env.CUSTOM_AWS_REGION || 'not set',
      AWS_S3_BUCKET_NAME: process.env.AWS_S3_BUCKET_NAME || 'not set',
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'set (hidden)' : 'not set',
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? 'set (hidden)' : 'not set',
      NODE_ENV: process.env.NODE_ENV || 'not set',
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      isLambda: !!process.env.AWS_LAMBDA_FUNCTION_NAME,
      lambdaRegion: process.env.AWS_REGION || 'not set',
      requestOrigin: origin || 'not set',
      timestamp: new Date().toISOString()
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        environment: envInfo
      }),
      { 
        status: 200, 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )

  } catch (error) {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)
    
    console.error('[DEBUG ENV] Error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to get environment info',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
}
