import { NextResponse } from 'next/server'
import { DatabaseService } from '@/lib/database-service'

export async function GET() {
  try {
    console.log('[DEBUG_CASES] Starting debug cases API...')
    
    // Use the centralized database service
    const cases = await DatabaseService.getAllCasesWithOrganization()
    
    console.log('[DEBUG_CASES] Found cases:', cases?.length || 0)
    
    return NextResponse.json({ 
      cases: cases || [],
      total: cases?.length || 0,
      message: 'Successfully fetched cases'
    })
  } catch (error) {
    console.error('[DEBUG_CASES] Error in debug cases API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      cases: [],
      total: 0
    }, { status: 500 })
  }
}