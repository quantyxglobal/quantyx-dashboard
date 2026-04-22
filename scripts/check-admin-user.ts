import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkAdminUser() {
  try {
    console.log('🔍 Checking admin user in database...')
    
    // Check for admin users
    const { data: adminUsers, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        first_name,
        last_name,
        role,
        is_active,
        organization_id,
        organization:organizations(id, name, display_name)
      `)
      .eq('email', 'admin@quantyxglobal.com')
    
    if (error) {
      console.error('❌ Error querying admin user:', error)
      return
    }
    
    console.log('📊 Admin users found:', adminUsers?.length || 0)
    
    if (adminUsers && adminUsers.length > 0) {
      adminUsers.forEach((user, index) => {
        console.log(`\n👤 Admin User ${index + 1}:`)
        console.log('  ID:', user.id)
        console.log('  Email:', user.email)
        console.log('  Name:', `${user.first_name} ${user.last_name}`)
        console.log('  Role:', user.role)
        console.log('  Active:', user.is_active)
        console.log('  Organization:', user.organization?.name || 'None')
      })
      
      if (adminUsers.length > 1) {
        console.log('\n⚠️  WARNING: Multiple admin users found! This might cause authentication issues.')
        console.log('   Consider removing duplicates.')
      }
    } else {
      console.log('❌ No admin user found with email: admin@quantyxglobal.com')
    }
    
  } catch (error) {
    console.error('❌ Error checking admin user:', error)
  }
}

checkAdminUser()