const { Client } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetDatabase() {
  const dbClient = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await dbClient.connect();
    console.log('✅ Connected to database');
    
    // Clear all existing data
    console.log('\n🗑️  Clearing existing data...');
    
    // Delete in correct order to avoid foreign key constraints
    await dbClient.query('DELETE FROM audit_logs');
    await dbClient.query('DELETE FROM additional_requests');
    await dbClient.query('DELETE FROM case_services');
    await dbClient.query('DELETE FROM files');
    await dbClient.query('DELETE FROM cases');
    await dbClient.query('DELETE FROM user_invitations');
    await dbClient.query('DELETE FROM users');
    await dbClient.query('DELETE FROM firms');
    await dbClient.query('DELETE FROM services');
    
    console.log('✅ All existing data cleared');
    
    // Create services first
    console.log('\n📋 Creating services...');
    const services = [
      { name: 'Medical Chronology' },
      { name: 'Narrative Summary' },
      { name: 'Demand Letter' },
      { name: 'Life Care Plan' },
      { name: 'Medical Opinion' },
      { name: 'Medical Expenses Summary' },
      { name: 'Hyperlinks' },
      { name: 'Bookmarks' },
      { name: 'Med-A-Word' },
      { name: 'Deposition Preparation' },
      { name: 'Life Care Plans (LCP) Support' }
    ];
    
    for (const service of services) {
      await dbClient.query(
        'INSERT INTO services (id, name, active, created_at) VALUES (gen_random_uuid(), $1, true, NOW())',
        [service.name]
      );
    }
    console.log(`✅ Created ${services.length} services`);
    
    // Create firms
    console.log('\n🏢 Creating firms...');
    const firms = [
      { name: 'Smith & Associates Law Firm', sequence: 1 },
      { name: 'Johnson Medical Legal Group', sequence: 2 },
      { name: 'Davis & Partners', sequence: 3 }
    ];
    
    const firmIds = [];
    for (const firm of firms) {
      const result = await dbClient.query(
        'INSERT INTO firms (id, name, firm_sequence, case_sequence, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, 0, NOW(), NOW()) RETURNING id',
        [firm.name, firm.sequence]
      );
      firmIds.push(result.rows[0].id);
      console.log(`✅ Created firm: ${firm.name}`);
    }
    
    // Create users with VISIBLE passwords
    console.log('\n👥 Creating users with known passwords...');
    
    // Admin user
    const adminPassword = 'admin123';
    const adminHash = await bcrypt.hash(adminPassword, 10);
    
    const adminResult = await dbClient.query(
      'INSERT INTO users (id, name, email, password_hash, role, firm_id, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, NULL, NOW(), NOW()) RETURNING id, email',
      ['System Administrator', 'admin@medilegal.com', adminHash, 'admin']
    );
    
    console.log(`✅ Created admin: ${adminResult.rows[0].email} | Password: ${adminPassword}`);
    
    // Client users
    const clientPassword = 'client123';
    const clientHash = await bcrypt.hash(clientPassword, 10);
    
    const clients = [
      { name: 'Jennifer Smith', email: 'jennifer@smithlaw.com', firmId: firmIds[0] },
      { name: 'Michael Johnson', email: 'mjohnson@jmlg.com', firmId: firmIds[1] },
      { name: 'Sarah Davis', email: 'sdavis@davispartners.com', firmId: firmIds[2] }
    ];
    
    for (const clientUser of clients) {
      const result = await dbClient.query(
        'INSERT INTO users (id, name, email, password_hash, role, firm_id, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, email',
        [clientUser.name, clientUser.email, clientHash, 'client', clientUser.firmId]
      );
      console.log(`✅ Created client: ${result.rows[0].email} | Password: ${clientPassword}`);
    }
    
    // Create sample cases
    console.log('\n📁 Creating sample cases...');
    
    const cases = [
      {
        caseId: 'QGM_0001_001',
        firmId: firmIds[0],
        title: 'Personal Injury - Motor Vehicle Accident',
        description: 'Multi-vehicle collision case'
      },
      {
        caseId: 'QGM_0002_001', 
        firmId: firmIds[1],
        title: 'Medical Malpractice - Surgical Error',
        description: 'Surgical complications case'
      },
      {
        caseId: 'QGM_0003_001',
        firmId: firmIds[2], 
        title: 'Nursing Home Neglect',
        description: 'Elderly patient neglect case'
      }
    ];
    
    for (const caseData of cases) {
      await dbClient.query(
        'INSERT INTO cases (id, case_id, firm_id, case_title, description, timeline, status, created_at, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW())',
        [caseData.caseId, caseData.firmId, caseData.title, caseData.description, 'NORMAL', 'pending']
      );
      console.log(`✅ Created case: ${caseData.caseId} - ${caseData.title}`);
    }
    
    console.log('\n🎉 Database reset complete!');
    console.log('\n' + '='.repeat(60));
    console.log('🔐 LOGIN CREDENTIALS:');
    console.log('='.repeat(60));
    console.log('Admin Account:');
    console.log(`  Email: admin@medilegal.com`);
    console.log(`  Password: ${adminPassword}`);
    console.log('');
    console.log('Client Accounts (all use same password):');
    clients.forEach(clientUser => {
      console.log(`  Email: ${clientUser.email}`);
    });
    console.log(`  Password: ${clientPassword}`);
    console.log('='.repeat(60));
    console.log('🌐 Login URL: http://localhost:3001/login');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await dbClient.end();
  }
}

resetDatabase();