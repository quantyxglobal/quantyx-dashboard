import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { randomUUID } from 'crypto'

// Load environment variables
dotenv.config()

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const services = [
  { id: randomUUID(), name: "Medical Chronology", slug: "medical-chronology", description: "Comprehensive medical chronology services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Narrative Summary", slug: "narrative-summary", description: "Medical narrative summary services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Demand Letter", slug: "demand-letter", description: "Legal demand letter preparation", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Life Care Plan", slug: "life-care-plan", description: "Life care planning services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Medical Opinion", slug: "medical-opinion", description: "Expert medical opinion services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Medical Expenses Summary", slug: "medical-expenses", description: "Medical expenses analysis", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Hyperlinks", slug: "hyperlinks", description: "Document hyperlinking services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Bookmarks", slug: "bookmarks", description: "Document bookmarking services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Med-A-Word", slug: "med-a-word", description: "Medical terminology services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Deposition Preparation", slug: "deposition-prep", description: "Deposition preparation services", is_active: true, updated_at: new Date().toISOString() },
  { id: randomUUID(), name: "Life Care Plans (LCP) Support", slug: "lcp-support", description: "LCP support services", is_active: true, updated_at: new Date().toISOString() },
]

async function seedServices() {
  try {
    console.log('Checking existing services...')
    
    // Check if services already exist
    const { data: existingServices, error: checkError } = await supabase
      .from('services')
      .select('slug')
    
    if (checkError) {
      console.error('Error checking existing services:', checkError)
      return
    }
    
    const existingSlugs = existingServices?.map(s => s.slug) || []
    console.log('Existing service slugs:', existingSlugs)
    
    // Filter out services that already exist
    const newServices = services.filter(service => !existingSlugs.includes(service.slug))
    
    if (newServices.length === 0) {
      console.log('All services already exist in the database')
      return
    }
    
    console.log(`Inserting ${newServices.length} new services...`)
    
    // Insert new services
    const { data, error } = await supabase
      .from('services')
      .insert(newServices)
      .select()
    
    if (error) {
      console.error('Error inserting services:', error)
      return
    }
    
    console.log('Successfully inserted services:', data)
    console.log(`✅ Seeded ${newServices.length} services successfully!`)
    
  } catch (error) {
    console.error('Error seeding services:', error)
  }
}

seedServices()