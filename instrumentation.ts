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
    const { validateEnvOrThrow } = await import('./lib/env')
    
    // Validate environment variables at startup
    // This will throw and prevent the app from starting if validation fails
    validateEnvOrThrow()
    
    console.log('✅ Environment variables validated successfully')
  }
}
