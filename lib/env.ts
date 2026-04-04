import { z } from 'zod'

/**
 * Environment variable validation schema
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // NextAuth
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  
  // Supabase (optional for some deployments)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  
  // Vercel Blob (optional for development)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  
  // AWS S3 (optional)
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET_NAME: z.string().optional(),
})

/**
 * Validates environment variables and throws if any are invalid
 * This is called during application startup via instrumentation.ts
 */
export function validateEnvOrThrow() {
  try {
    envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join('\n')
      throw new Error(`❌ Invalid environment variables:\n${missingVars}`)
    }
    throw error
  }
}

/**
 * Parsed and validated environment variables
 * Use this instead of process.env for type safety
 * Lazy-loaded to avoid accessing process.env during build
 */
let _env: z.infer<typeof envSchema> | null = null

function getEnv(): z.infer<typeof envSchema> {
  if (!_env) {
    try {
      _env = envSchema.parse(process.env)
    } catch (error) {
      // During build time, some env vars might not be available
      // Return a safe partial object to prevent build failures
      if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_URL) {
        console.warn('⚠️ Environment variables not fully available during build')
        _env = envSchema.partial().parse(process.env) as z.infer<typeof envSchema>
      } else {
        throw error
      }
    }
  }
  return _env
}

export const env = new Proxy({} as z.infer<typeof envSchema>, {
  get(target, prop) {
    return getEnv()[prop as keyof z.infer<typeof envSchema>]
  }
})