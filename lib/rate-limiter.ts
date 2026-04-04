import { logSecurityViolation } from './audit-log'

/**
 * Rate limiting system for security attack prevention
 * Validates: Requirements 7.3
 */

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  skipSuccessfulRequests?: boolean // Don't count successful requests
  skipFailedRequests?: boolean // Don't count failed requests
}

interface RateLimitEntry {
  count: number
  resetTime: number
  firstRequest: number
}

// In-memory store for rate limiting (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Rate limit configurations for different operations
export const rateLimitConfigs: Record<string, RateLimitConfig> = {
  // Authentication operations
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    skipSuccessfulRequests: true
  },
  
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 registrations per hour
    skipSuccessfulRequests: true
  },

  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 password reset attempts per hour
    skipSuccessfulRequests: true
  },

  // User management operations
  createUser: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 user creations per hour
    skipSuccessfulRequests: false
  },

  inviteUser: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 20, // 20 invitations per hour
    skipSuccessfulRequests: false
  },

  // Case operations
  createCase: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50, // 50 cases per hour
    skipSuccessfulRequests: false
  },

  // File operations
  fileUpload: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100, // 100 file uploads per hour
    skipSuccessfulRequests: false
  },

  // API operations
  apiRequest: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 API requests per minute
    skipSuccessfulRequests: false
  },

  // Quote and contact operations
  quoteRequest: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5, // 5 quote requests per hour
    skipSuccessfulRequests: false
  },

  contactInquiry: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // 3 contact inquiries per hour
    skipSuccessfulRequests: false
  }
}

/**
 * Generate rate limit key based on operation and identifier
 */
function getRateLimitKey(operation: string, identifier: string): string {
  return `ratelimit:${operation}:${identifier}`
}

/**
 * Clean up expired entries from rate limit store
 */
function cleanupExpiredEntries(): void {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Check if request is within rate limit
 */
export async function checkRateLimit(
  operation: string,
  identifier: string, // IP address, user ID, or email
  context: {
    userId?: string
    ipAddress?: string
    userAgent?: string
    success?: boolean
  } = {}
): Promise<{
  allowed: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}> {
  const config = rateLimitConfigs[operation]
  if (!config) {
    // No rate limit configured for this operation
    return {
      allowed: true,
      limit: 0,
      remaining: 0,
      resetTime: 0
    }
  }

  // Skip counting based on configuration
  if (config.skipSuccessfulRequests && context.success === true) {
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs
    }
  }

  if (config.skipFailedRequests && context.success === false) {
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs
    }
  }

  // Clean up expired entries periodically
  if (Math.random() < 0.01) { // 1% chance to cleanup
    cleanupExpiredEntries()
  }

  const key = getRateLimitKey(operation, identifier)
  const now = Date.now()
  
  let entry = rateLimitStore.get(key)
  
  if (!entry || now > entry.resetTime) {
    // Create new entry or reset expired entry
    entry = {
      count: 1,
      resetTime: now + config.windowMs,
      firstRequest: now
    }
    rateLimitStore.set(key, entry)
    
    return {
      allowed: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      resetTime: entry.resetTime
    }
  }

  // Increment count
  entry.count++
  
  const allowed = entry.count <= config.maxRequests
  const remaining = Math.max(0, config.maxRequests - entry.count)
  
  if (!allowed) {
    // Log rate limit violation
    await logSecurityViolation({
      userId: context.userId,
      action: 'RATE_LIMIT_EXCEEDED',
      details: `Rate limit exceeded for operation: ${operation}. Limit: ${config.maxRequests}, Current: ${entry.count}`,
      entityType: 'rate_limit',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      attemptedOperation: operation
    })
  }

  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
    retryAfter: allowed ? undefined : Math.ceil((entry.resetTime - now) / 1000)
  }
}

/**
 * Rate limiting middleware for API routes
 */
export function createRateLimitMiddleware(operation: string) {
  return async function rateLimitMiddleware(
    request: Request,
    context: {
      userId?: string
      ipAddress?: string
      userAgent?: string
    }
  ): Promise<Response | null> {
    // Get identifier (prefer user ID, fallback to IP)
    const identifier = context.userId || context.ipAddress || 'unknown'
    
    const result = await checkRateLimit(operation, identifier, context)
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `Too many ${operation} requests. Try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
            'Retry-After': result.retryAfter?.toString() || '60'
          }
        }
      )
    }

    return null // Allow request to proceed
  }
}

/**
 * Get rate limit status for a user/IP
 */
export function getRateLimitStatus(
  operation: string,
  identifier: string
): {
  limit: number
  remaining: number
  resetTime: number
  isLimited: boolean
} {
  const config = rateLimitConfigs[operation]
  if (!config) {
    return {
      limit: 0,
      remaining: 0,
      resetTime: 0,
      isLimited: false
    }
  }

  const key = getRateLimitKey(operation, identifier)
  const entry = rateLimitStore.get(key)
  const now = Date.now()

  if (!entry || now > entry.resetTime) {
    return {
      limit: config.maxRequests,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      isLimited: false
    }
  }

  const remaining = Math.max(0, config.maxRequests - entry.count)
  const isLimited = entry.count >= config.maxRequests

  return {
    limit: config.maxRequests,
    remaining,
    resetTime: entry.resetTime,
    isLimited
  }
}

/**
 * Reset rate limit for a specific identifier (admin function)
 */
export function resetRateLimit(operation: string, identifier: string): boolean {
  const key = getRateLimitKey(operation, identifier)
  return rateLimitStore.delete(key)
}

/**
 * Get all active rate limits (admin function)
 */
export function getActiveRateLimits(): Array<{
  operation: string
  identifier: string
  count: number
  limit: number
  resetTime: number
}> {
  const results: Array<{
    operation: string
    identifier: string
    count: number
    limit: number
    resetTime: number
  }> = []

  for (const [key, entry] of rateLimitStore.entries()) {
    const [, operation, identifier] = key.split(':')
    const config = rateLimitConfigs[operation]
    
    if (config && Date.now() <= entry.resetTime) {
      results.push({
        operation,
        identifier,
        count: entry.count,
        limit: config.maxRequests,
        resetTime: entry.resetTime
      })
    }
  }

  return results
}