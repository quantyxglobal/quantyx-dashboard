import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testApiAuth() {
  try {
    console.log('🔍 Testing API authentication logic...')
    
    const email = 'admin@quantixglobal.com'
    const password = 'admin123'
    
    console.log('📧 Testing with email:', email)
    
    // Test the exact same query as the API
    const { data: users, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        organization_id,
        password_hash,
        organization:organizations(id, name, display_name)
      `)
      .eq('email', email)

    console.log('🔍 Query error:', error)
    console.log('📊 Users found:', users?.length || 0)
    
    if (users && users.length > 0) {
      const user = users[0]
      console.log('\n👤 User details:')
      console.log('  ID:', user.id)
      console.log('  Email:', user.email)
      console.log('  Active:', user.is_active)
      console.log('  Has password hash:', !!user.password_hash)
      console.log('  Password hash length:', user.password_hash?.length || 0)
      
      if (user.password_hash) {
        // Test password verification
        const passwordMatch = await bcrypt.compare(password, user.password_hash)
        console.log('🔑 Password match:', passwordMatch)
      }
      
      console.log('  Organization:', user.organization)
    } else {
      console.log('❌ No users returned from query')
    }
    
    // Also test with anon key permissions
    console.log('\n🔐 Testing table permissions...')
    const { data: testQuery, error: testError } = await supabase
      .from('users')
      .select('id, email')
      .limit(1)
    
    console.log('📊 Test query error:', testError)
    console.log('📊 Test query results:', testQuery?.length || 0)
    
  } catch (error) {
    console.error('❌ Error testing API auth:', error)
  }
}

testApiAuth()