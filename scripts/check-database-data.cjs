const { PrismaClient } = require('@prisma/client')

async function checkDatabaseData() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  })

  try {
    console.log('🔍 Checking database data...\n')
    
    // Check users
    const users = await prisma.user.findMany({
      include: { organization: true }
    })
    console.log(`👥 Users (${users.length}):`)
    users.forEach(user => {
      console.log(`  - ${user.email} (${user.role}) - ${user.organization?.name || 'No org'}`)
    })
    console.log()

    // Check organizations
    const organizations = await prisma.organization.findMany()
    console.log(`🏢 Organizations (${organizations.length}):`)
    organizations.forEach(org => {
      console.log(`  - ${org.name} (${org.display_name || 'No display name'})`)
    })
    console.log()

    // Check cases
    const cases = await prisma.case.findMany({
      include: {
        organization: true,
        services: true,
        files: true
      }
    })
    console.log(`📋 Cases (${cases.length}):`)
    cases.forEach(caseItem => {
      console.log(`  - Case #${caseItem.case_number}: ${caseItem.title}`)
      console.log(`    Status: ${caseItem.status}`)
      console.log(`    Organization: ${caseItem.organization?.name || 'None'}`)
      console.log(`    Services: ${caseItem.services?.map(s => s.name).join(', ') || 'None'}`)
      console.log(`    Files: ${caseItem.files?.length || 0}`)
      if (caseItem.special_instructions) {
        console.log(`    Special Instructions: ${caseItem.special_instructions.substring(0, 100)}...`)
      }
      console.log()
    })

    // Check services
    const services = await prisma.service.findMany()
    console.log(`🔧 Services (${services.length}):`)
    services.forEach(service => {
      console.log(`  - ${service.name}: ${service.description || 'No description'}`)
    })
    console.log()

    // Check files
    const files = await prisma.file.findMany({
      include: { case: true }
    })
    console.log(`📁 Files (${files.length}):`)
    files.forEach(file => {
      console.log(`  - ${file.filename} (${file.file_type}) - Case: ${file.case?.case_number || 'None'}`)
    })
    
  } catch (error) {
    console.error('❌ Database query failed:', error.message)
    console.error('Error details:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkDatabaseData()