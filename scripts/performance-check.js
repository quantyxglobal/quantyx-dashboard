#!/usr/bin/env node

/**
 * Performance monitoring script for medilegal dashboard
 * Run with: node scripts/performance-check.js
 */

const { performance } = require('perf_hooks');

async function checkDatabaseConnection() {
  console.log('🔍 Checking database connection...');
  const start = performance.now();
  
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    await prisma.$connect();
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();
    
    const duration = performance.now() - start;
    console.log(`✅ Database connection: ${duration.toFixed(2)}ms`);
    
    if (duration > 1000) {
      console.log('⚠️  Database connection is slow (>1s)');
    }
    
    return duration;
  } catch (error) {
    console.log(`❌ Database connection failed: ${error.message}`);
    return null;
  }
}

async function checkAPIEndpoint(url, description) {
  console.log(`🔍 Checking ${description}...`);
  const start = performance.now();
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Performance-Check-Script'
      }
    });
    
    const duration = performance.now() - start;
    const status = response.status;
    
    if (status === 200) {
      console.log(`✅ ${description}: ${duration.toFixed(2)}ms (${status})`);
    } else {
      console.log(`⚠️  ${description}: ${duration.toFixed(2)}ms (${status})`);
    }
    
    if (duration > 2000) {
      console.log(`⚠️  ${description} is slow (>2s)`);
    }
    
    return { duration, status };
  } catch (error) {
    console.log(`❌ ${description} failed: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🚀 Performance Check Starting...\n');
  
  const results = {};
  
  // Check database
  results.database = await checkDatabaseConnection();
  
  console.log('\n📊 Performance Summary:');
  console.log('========================');
  
  if (results.database) {
    console.log(`Database: ${results.database.toFixed(2)}ms`);
    
    if (results.database < 500) {
      console.log('🎉 Database performance is excellent!');
    } else if (results.database < 1000) {
      console.log('✅ Database performance is good');
    } else if (results.database < 2000) {
      console.log('⚠️  Database performance needs improvement');
    } else {
      console.log('❌ Database performance is poor');
    }
  }
  
  console.log('\n💡 Performance Tips:');
  console.log('- Database connection should be <500ms');
  console.log('- API endpoints should respond <2s');
  console.log('- Run the performance-indexes.sql when database is accessible');
  console.log('- Monitor middleware auth cache hit rate');
}

main().catch(console.error);