import { NextResponse } from 'next/server'

// CORS configuration for website API routes
// For website public APIs, use permissive CORS
// Updated: 2026-04-05 14:30 UTC to fix CORS issues
export function getCorsHeaders(origin: string | null) {
  console.log('[CORS v2] Request origin:', origin)
  
  // Use wildcard for website API routes to allow all origins
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  }
  
  console.log('[CORS v2] Returning headers:', headers)
  return headers
}

