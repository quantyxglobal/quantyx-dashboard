import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use Supabase directly for fast, reliable access
    const services = await SupabaseDB.getActiveServices()

    // Map services to the desired format
    const formattedServices = services.map(service => ({
      id: service.slug || service.id, // Use slug as ID for frontend
      name: service.name,
      description: service.description
    }))

    return NextResponse.json({ services: formattedServices })
  } catch (error) {
    console.error('Error fetching services:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}