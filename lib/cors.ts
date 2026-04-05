// CORS configuration for cross-origin requests
// Used by API routes to handle requests from website domain

export const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:8080",
  "https://main.d21id4oumvz7k0.amplifyapp.com",
  "https://quantyxg.com",
  "https://www.quantyxg.com",
  "https://dashboard.quantyxg.com"
]

export function getCorsHeaders(origin: string | null) {
  console.log('[CORS] Checking origin:', origin)
  console.log('[CORS] Allowed origins:', allowedOrigins)
  
  if (origin && allowedOrigins.includes(origin)) {
    console.log('[CORS] Origin allowed, returning headers')
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Allow-Credentials": "true"
    }
  }
  
  console.log('[CORS] Origin not allowed, returning empty headers')
  return {}
}
