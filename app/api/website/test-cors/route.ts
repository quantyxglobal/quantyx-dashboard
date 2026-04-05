import { NextRequest, NextResponse } from 'next/server'
import { getCorsHeaders } from '../cors'

// Simple test endpoint to verify CORS configuration
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = getCorsHeaders(origin)
  
  console.log('[TEST CORS] OPTIONS request')
  console.log('[TEST CORS] Origin:', origin)
  console.log('[TEST CORS] Headers:', headers)
  
  return new NextResponse(null, { status: 204, headers })
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin')
  const dynamicCorsHeaders = getCorsHeaders(origin)
  
  console.log('[TEST CORS] GET request')
  console.log('[TEST CORS] Origin:', origin)
  console.log('[TEST CORS] Headers:', dynamicCorsHeaders)
  
  return NextResponse.json({
    success: true,
    message: 'CORS test successful',
    receivedOrigin: origin,
    corsHeaders: dynamicCorsHeaders,
    timestamp: new Date().toISOString()
  }, { 
    status: 200, 
    headers: dynamicCorsHeaders 
  })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  const dynamicCorsHeaders = getCorsHeaders(origin)
  
  console.log('[TEST CORS] POST request')
  console.log('[TEST CORS] Origin:', origin)
  console.log('[TEST CORS] Headers:', dynamicCorsHeaders)
  
  try {
    const body = await request.json()
    
    return NextResponse.json({
      success: true,
      message: 'CORS POST test successful',
      receivedOrigin: origin,
      receivedData: body,
      corsHeaders: dynamicCorsHeaders,
      timestamp: new Date().toISOString()
    }, { 
      status: 200, 
      headers: dynamicCorsHeaders 
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to parse request body',
      receivedOrigin: origin,
      timestamp: new Date().toISOString()
    }, { 
      status: 400, 
      headers: dynamicCorsHeaders 
    })
  }
}
