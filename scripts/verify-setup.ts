/**
 * Verification Script
 * 
 * This script checks if the database schema is correctly set up
 * Run with: npx tsx scripts/verify-setup.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function verifySetup() {
  console.log('🔍 Verifying database setup...\n')

  // Check cases table structure
  console.log('1. Checking cases table...')
  const { data: casesData, error: casesError } = await supabase
    .from('cases')
    .select('*')
    .limit(1)

  if (casesError) {
    console.error('❌ Error accessing cases table:', casesError.message)
  } else {
    console.log('✅ Cases table accessible')
    
    // Check if estimate_required column exists
    if (casesData && casesData.length > 0) {
      const hasEstimateRequired = 'estimate_required' in casesData[0]
      if (hasEstimateRequired) {
        console.log('✅ estimate_required column exists')
      } else {
        console.log('⚠️  estimate_required column NOT found')
        console.log('   Please run the migration: ADD_ESTIMATE_REQUIRED_COLUMN.sql')
      }
    } else {
      console.log('ℹ️  No cases in database yet - cannot verify estimate_required column')
      console.log('   Please run the migration: ADD_ESTIMATE_REQUIRED_COLUMN.sql')
    }
  }

  // Check files table structure
  console.log('\n2. Checking files table...')
  const { data: filesData, error: filesError } = await supabase
    .from('files')
    .select('*')
    .limit(1)

  if (filesError) {
    console.error('❌ Error accessing files table:', filesError.message)
  } else {
    console.log('✅ Files table accessible')
    
    if (filesData && filesData.length > 0) {
      const file = filesData[0]
      console.log('   File fields:', Object.keys(file).join(', '))
      
      // Check for correct fields
      const hasS3Key = 's3_key' in file
      const hasOriginalFilename = 'original_filename' in file
      const noFileType = !('file_type' in file)
      const noSource = !('source' in file)
      const noCategory = !('category' in file)
      
      if (hasS3Key) console.log('✅ s3_key field exists')
      if (hasOriginalFilename) console.log('✅ original_filename field exists')
      if (noFileType) console.log('✅ file_type field correctly absent')
      if (noSource) console.log('✅ source field correctly absent')
      if (noCategory) console.log('✅ category field correctly absent')
      
      if (!hasS3Key) console.log('⚠️  s3_key field missing')
      if (!hasOriginalFilename) console.log('⚠️  original_filename field missing')
      if (!noFileType) console.log('⚠️  file_type field should not exist')
      if (!noSource) console.log('⚠️  source field should not exist')
      if (!noCategory) console.log('⚠️  category field should not exist')
    } else {
      console.log('ℹ️  No files in database yet')
    }
  }

  // Check services table
  console.log('\n3. Checking services table...')
  const { data: servicesData, error: servicesError } = await supabase
    .from('services')
    .select('id, name, slug, is_active')
    .eq('is_active', true)

  if (servicesError) {
    console.error('❌ Error accessing services table:', servicesError.message)
  } else {
    console.log(`✅ Services table accessible (${servicesData?.length || 0} active services)`)
    if (servicesData && servicesData.length > 0) {
      console.log('   Active services:')
      servicesData.forEach(service => {
        console.log(`   - ${service.name} (${service.slug})`)
      })
    } else {
      console.log('⚠️  No active services found - please seed services')
    }
  }

  // Check AWS S3 configuration
  console.log('\n4. Checking AWS S3 configuration...')
  const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION,
    bucket: process.env.AWS_S3_BUCKET_NAME,
  }

  if (awsConfig.accessKeyId) console.log('✅ AWS_ACCESS_KEY_ID set')
  else console.log('❌ AWS_ACCESS_KEY_ID missing')

  if (awsConfig.secretAccessKey) console.log('✅ AWS_SECRET_ACCESS_KEY set')
  else console.log('❌ AWS_SECRET_ACCESS_KEY missing')

  if (awsConfig.region) console.log(`✅ AWS_REGION set (${awsConfig.region})`)
  else console.log('❌ AWS_REGION missing')

  if (awsConfig.bucket) console.log(`✅ AWS_S3_BUCKET_NAME set (${awsConfig.bucket})`)
  else console.log('❌ AWS_S3_BUCKET_NAME missing')

  console.log('\n✨ Verification complete!\n')
}

verifySetup().catch(console.error)
