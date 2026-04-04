/**
 * Runtime Environment Variable Access
 * 
 * This module provides access to environment variables that are injected at runtime
 * by AWS Amplify Secrets, bypassing Next.js build-time processing.
 */

// Cache for environment variables
let envCache: Record<string, string | undefined> | null = null

/**
 * Get runtime environment variables
 * This bypasses Next.js's build-time env processing
 */
function getRuntimeEnv(): Record<string, string | undefined> {
  if (envCache) return envCache
  
  // Access process.env directly at runtime
  // Use dynamic property access to prevent Next.js from inlining these at build time
  const envKeys = [
    'NEXTAUTH_SECRET',
    'NEXTAUTH_URL',
    'DATABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'AWS_S3_BUCKET_NAME',
  ]
  
  envCache = {}
  for (const key of envKeys) {
    // Use bracket notation to prevent build-time inlining
    const value = (process.env as any)[key]
    envCache[key] = value || undefined
  }
  
  return envCache
}

/**
 * Get a runtime environment variable
 */
export function getRuntimeEnvVar(key: string): string | undefined {
  const env = getRuntimeEnv()
  return env[key]
}

/**
 * Get a required runtime environment variable (throws if missing)
 */
export function getRequiredRuntimeEnvVar(key: string): string {
  const value = getRuntimeEnvVar(key)
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`)
  }
  return value
}

/**
 * Reset the cache (useful for testing)
 */
export function resetEnvCache() {
  envCache = null
}
