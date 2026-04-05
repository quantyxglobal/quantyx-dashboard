import { getCorsHeaders } from "@/lib/cors"

// Simple test endpoint to verify CORS configuration
export const dynamic = "force-dynamic"

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin")
  console.log('[TEST CORS] OPTIONS request from origin:', origin)
  
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin)
    }
  })
}

export async function GET(req: Request) {
  const origin = req.headers.get("origin")
  console.log('[TEST CORS] GET request from origin:', origin)
  
  return new Response(
    JSON.stringify({ 
      success: true,
      message: "CORS test successful",
      receivedOrigin: origin,
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...getCorsHeaders(origin)
      }
    }
  )
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin")
  console.log('[TEST CORS] POST request from origin:', origin)
  
  try {
    const body = await req.json()
    
    return new Response(
      JSON.stringify({
        success: true,
        message: "CORS POST test successful",
        receivedOrigin: origin,
        receivedData: body,
        timestamp: new Date().toISOString()
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin)
        }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to parse request body",
        receivedOrigin: origin,
        timestamp: new Date().toISOString()
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...getCorsHeaders(origin)
        }
      }
    )
  }
}
