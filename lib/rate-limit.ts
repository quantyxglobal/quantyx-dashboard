// medilegal-dashboard/lib/rate-limit.ts

interface RateLimitEntry {
  requests: number[]           // timestamps of requests in current window
  failedAttempts: number       // consecutive failed login attempts
  blockedUntil: number | null  // epoch ms when block expires
  lastFailure: number | null   // epoch ms of last failure
}

const store = new Map<string, RateLimitEntry>()

// Clean up stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    const isBlocked = entry.blockedUntil && entry.blockedUntil > now
    const hasRecentRequests = entry.requests.some(t => now - t < 60_000)
    if (!isBlocked && !hasRecentRequests) {
      store.delete(key)
    }
  }
}, 5 * 60 * 1000)

export interface RateLimitResult {
  allowed: boolean
  remaining: number          // requests remaining in window
  retryAfter: number         // seconds until next allowed request
  requiresCaptcha: boolean   // true after 3 failed attempts
  isBlocked: boolean         // true if IP is temporarily blocked
  backoffMs: number          // ms client should wait before retrying
}

const WINDOW_MS = 60_000               // 1 minute sliding window
const MAX_REQUESTS = 5                 // max requests per window
const MAX_FAILURES = 10                // failures before IP block
const BLOCK_DURATION_MS = 15 * 60_000 // 15 minute block
const CAPTCHA_THRESHOLD = 3            // failures before CAPTCHA required

function getEntry(ip: string): RateLimitEntry {
  if (!store.has(ip)) {
    store.set(ip, { requests: [], failedAttempts: 0, blockedUntil: null, lastFailure: null })
  }
  return store.get(ip)!
}

export function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now()
  const entry = getEntry(ip)

  // Check if IP is blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      requiresCaptcha: true,
      isBlocked: true,
      backoffMs: entry.blockedUntil - now,
    }
  }

  // Slide the window — remove timestamps older than 1 minute
  entry.requests = entry.requests.filter(t => now - t < WINDOW_MS)

  if (entry.requests.length >= MAX_REQUESTS) {
    const oldest = entry.requests[0]
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000)
    return {
      allowed: false,
      remaining: 0,
      retryAfter,
      requiresCaptcha: entry.failedAttempts >= CAPTCHA_THRESHOLD,
      isBlocked: false,
      backoffMs: oldest + WINDOW_MS - now,
    }
  }

  // Allow — record this request
  entry.requests.push(now)

  return {
    allowed: true,
    remaining: MAX_REQUESTS - entry.requests.length,
    retryAfter: 0,
    requiresCaptcha: entry.failedAttempts >= CAPTCHA_THRESHOLD,
    isBlocked: false,
    backoffMs: 0,
  }
}

export function recordFailedAttempt(ip: string): void {
  const now = Date.now()
  const entry = getEntry(ip)
  entry.failedAttempts += 1
  entry.lastFailure = now

  if (entry.failedAttempts >= MAX_FAILURES) {
    entry.blockedUntil = now + BLOCK_DURATION_MS
    console.warn(`[RATE_LIMIT] IP ${ip} blocked for 15 minutes after ${entry.failedAttempts} failed attempts`)
  }
}

export function recordSuccessfulLogin(ip: string): void {
  const entry = getEntry(ip)
  // Reset failure count on successful login
  entry.failedAttempts = 0
  entry.blockedUntil = null
  entry.lastFailure = null
}

export function getBackoffMs(ip: string): number {
  const entry = store.get(ip)
  if (!entry || entry.failedAttempts === 0) return 0
  // Exponential backoff: 2^(failures-1) seconds, capped at 30s
  return Math.min(Math.pow(2, entry.failedAttempts - 1) * 1000, 30_000)
}

export function getClientIp(request: Request): string {
  // Trust CloudFront / ALB / Amplify forwarded headers
  const forwarded = (request.headers as any).get?.('x-forwarded-for')
    ?? (request.headers as any)['x-forwarded-for']
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = (request.headers as any).get?.('x-real-ip')
    ?? (request.headers as any)['x-real-ip']
  if (realIp) return realIp.trim()
  return '127.0.0.1'
}
