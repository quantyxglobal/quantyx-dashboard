import { beforeAll, afterAll } from 'vitest'
import dotenv from 'dotenv'
import { supabaseAdmin, signOutTestUser } from './test-auth-utils'

// Load environment variables for testing
dotenv.config()

beforeAll(async () => {
  // Setup test environment
  console.log('Setting up test environment...')
  
  // Verify database connection
  const { data, error } = await supabaseAdmin.from('users').select('count').limit(1)
  if (error) {
    console.error('Database connection failed:', error)
    throw new Error('Cannot connect to test database')
  }
  
  console.log('Database connection verified')
})

afterAll(async () => {
  // Cleanup test environment
  console.log('Cleaning up test environment...')
  
  // Sign out any authenticated users
  await signOutTestUser()
  
  // Clean up any test data that might have been left behind
  await supabaseAdmin.from('cases').delete().like('title', '%test%')
  await supabaseAdmin.from('users').delete().like('email', '%@test.com')
  await supabaseAdmin.from('organizations').delete().like('name', '%Test%')
})