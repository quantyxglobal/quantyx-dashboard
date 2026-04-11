import { NextResponse } from 'next/server'

// CORS configuration for website API routes
// SECURITY FIX: Whitelist specific origins instead of wildcard
// Updated: 2026-04-11 - Security hardening

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'https://www.quantyxg.com',
  'https://quantyxg.com',
  'https://main.d3tgss74d264vy.amplifyapp.com', // Amplify preview
  // Add development origins only in non-production
  ...(process.env.NODE_ENV === 'development' ? [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:8080'
  ] : [])
]

export function getCorsHeaders(origin: string | null) {
  console.log('[CORS v3] Request origin:', origin)
  
  // Check if origin is allowed
  const isAllowed = origin && ALLOWED_ORIGINS.includes(origin)
  
  if (!isAllowed) {
    console.warn('[CORS v3] Origin not allowed:', origin)
    // Return empty headers to deny CORS
    return {}
  }
  
  // Return CORS headers only for allowed origins
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
  
  console.log('[CORS v3] Allowing origin:', origin)
  return headers
}

// Helper to create CORS response
export function createCorsResponse(data: any, origin: string | null, status: number = 200) {
  const headers = getCorsHeaders(origin)
  
  // If CORS not allowed, return 403
  if (Object.keys(headers).length === 0) {
    return NextResponse.json(
      { error: 'Origin not allowed' },
      { status: 403 }
    )
  }
  
  return NextResponse.json(data, {
    status,
    headers: headers as Record<string, string>
  })
}

// Helper for OPTIONS preflight requests
export function handleCorsPreFlight(origin: string | null) {
  const headers = getCorsHeaders(origin)
  
  // If CORS not allowed, return 403
  if (Object.keys(headers).length === 0) {
    return new NextResponse(null, { status: 403 })
  }
  
  return new NextResponse(null, {
    status: 204,
    headers: headers as Record<string, string>
  })
}

