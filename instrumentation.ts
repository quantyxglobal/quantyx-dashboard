/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically called by Next.js when the server starts.
 * We use it to validate environment variables before the application runs.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip validation in production AWS Lambda environment
    // Environment variables are validated lazily when accessed
    if (process.env.AWS_EXECUTION_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log('⚠️ Running in AWS Lambda - skipping early environment validation')
      return
    }
    
    try {
      const { validateEnvOrThrow } = await import('./lib/env')
      
      // Validate environment variables at startup
      // This will throw and prevent the app from starting if validation fails
      validateEnvOrThrow()
      
      console.log('✅ Environment variables validated successfully')
    } catch (error) {
      console.error('⚠️ Environment validation failed:', error)
      // Don't throw in production - let the app start and fail gracefully later
      if (process.env.NODE_ENV !== 'production') {
        throw error
      }
    }
  }
}
