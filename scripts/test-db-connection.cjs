const { PrismaClient } = require('@prisma/client')

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })

  try {
    console.log('Testing database connection...')
    
    // Test basic connection
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Test query
    const userCount = await prisma.user.count()
    console.log(`✅ Found ${userCount} users in database`)
    
    // Test finding admin user
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@quantyxglobal.com' },
      include: { organization: true }
    })
    
    if (adminUser) {
      console.log('✅ Admin user found:', {
        id: adminUser.id,
        email: adminUser.email,
        role: adminUser.role,
        organization: adminUser.organization?.name
      })
    } else {
      console.log('❌ Admin user not found')
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    console.error('Error details:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()