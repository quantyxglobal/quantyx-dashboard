const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdminUser() {
  try {
    console.log('Creating admin user...')
    
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'admin@quantixglobal.com' }
    })
    
    if (existingUser) {
      console.log('Admin user already exists!')
      return
    }
    
    // Create or find default organization
    let organization = await prisma.organization.findFirst({
      where: { name: 'Quantix Global' }
    })
    
    if (!organization) {
      console.log('Creating default organization...')
      organization = await prisma.organization.create({
        data: {
          name: 'Quantix Global',
          display_name: 'Quantix Global',
          slug: 'quantix-global',
          description: 'Default organization for Quantix Global medilegal services',
          email: 'admin@quantixglobal.com'
        }
      })
      console.log('Organization created:', organization.name)
    }
    
    // Hash the password
    const password = 'admin123' // Change this to a secure password
    const passwordHash = await bcrypt.hash(password, 12)
    
    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@quantixglobal.com',
        first_name: 'Admin',
        last_name: 'User',
        password_hash: passwordHash,
        role: 'ADMIN',
        organization_id: organization.id,
        email_verified: true,
        is_active: true
      }
    })
    
    console.log('Admin user created successfully!')
    console.log('Email:', adminUser.email)
    console.log('Password:', password)
    console.log('Role:', adminUser.role)
    console.log('Organization:', organization.name)
    
  } catch (error) {
    console.error('Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()