import { NextResponse } from 'next/server'

// CORS configuration for website API routes
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:8080',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Max-Age': '86400', // 24 hours
}

// Helper to create CORS-enabled responses
export function corsResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders })
}

// Helper for OPTIONS requests
export function handleOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders })
}
