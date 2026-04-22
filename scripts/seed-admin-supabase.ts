import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

// Load environment variables
config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing')
console.log('Service Key:', supabaseServiceKey ? 'Found' : 'Missing')

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function seedAdminUser() {
  try {
    console.log('🌱 Seeding admin user via Supabase...')
    
    // Check if admin user already exists
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', 'admin@quantyxglobal.com')
      .single()
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists:', existingAdmin.email)
      return
    }
    
    // Create default organization first
    let organization
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('slug', 'quantyx-global')
      .single()
    
    if (existingOrg) {
      organization = existingOrg
      console.log('✅ Using existing organization:', organization.name)
    } else {
      const { data: newOrg, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: 'quantyx Global',
          display_name: 'quantyx Global Medilegal Services',
          slug: 'quantyx-global',
          description: 'Professional medilegal services',
          email: 'admin@quantyxglobal.com',
          phone: '+91-XXXXXXXXXX',
          country: 'India',
          case_id_prefix: 'QG'
        })
        .select()
        .single()
      
      if (orgError) {
        console.error('❌ Error creating organization:', orgError)
        throw orgError
      }
      
      organization = newOrg
      console.log('✅ Created organization:', organization.name)
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    // Create admin user
    const { data: adminUser, error: userError } = await supabase
      .from('users')
      .insert({
        email: 'admin@quantyxglobal.com',
        password_hash: hashedPassword,
        first_name: 'Admin',
        last_name: 'User',
        display_name: 'System Administrator',
        role: 'SUPER_ADMIN',
        is_active: true,
        email_verified: true,
        organization_id: organization.id
      })
      .select()
      .single()
    
    if (userError) {
      console.error('❌ Error creating admin user:', userError)
      throw userError
    }
    
    console.log('✅ Created admin user:', adminUser.email)
    console.log('📧 Email: admin@quantyxglobal.com')
    console.log('🔑 Password: admin123')
    console.log('⚠️  Please change the password after first login!')
    
  } catch (error) {
    console.error('❌ Error seeding admin user:', error)
    throw error
  }
}

seedAdminUser()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })