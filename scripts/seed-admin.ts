import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function seedAdmin() {
  try {
    console.log('🌱 Seeding admin user...')
    
    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@quantixglobal.com' }
    })
    
    if (existingAdmin) {
      console.log('✅ Admin user already exists')
      return
    }
    
    // Create default organization
    let organization = await prisma.organization.findUnique({
      where: { slug: 'quantix-global' }
    })
    
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Quantix Global',
          display_name: 'Quantix Global Medilegal Services',
          slug: 'quantix-global',
          description: 'Professional medilegal services',
          email: 'admin@quantixglobal.com',
          phone: '+91-XXXXXXXXXX',
          country: 'India',
          case_id_prefix: 'QG'
        }
      })
      console.log('✅ Created default organization')
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@quantixglobal.com',
        password_hash: hashedPassword,
        first_name: 'Admin',
        last_name: 'User',
        display_name: 'System Administrator',
        role: 'SUPER_ADMIN',
        is_active: true,
        email_verified: true,
        organization_id: organization.id
      }
    })
    
    console.log('✅ Created admin user:', adminUser.email)
    console.log('📧 Email: admin@quantixglobal.com')
    console.log('🔑 Password: admin123')
    console.log('⚠️  Please change the password after first login!')
    
  } catch (error) {
    console.error('❌ Error seeding admin user:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedAdmin()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })