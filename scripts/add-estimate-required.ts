import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addEstimateRequiredColumn() {
  console.log('Adding estimate_required column to cases table...')
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "estimate_required" BOOLEAN NOT NULL DEFAULT false;
      COMMENT ON COLUMN "cases"."estimate_required" IS 'Indicates whether the client requires a cost estimate before work begins';
    `
  })

  if (error) {
    console.error('Error adding column:', error)
    // Try alternative approach
    console.log('Trying alternative approach...')
    
    const { error: altError } = await supabase
      .from('cases')
      .select('estimate_required')
      .limit(1)
    
    if (altError && altError.message.includes('column')) {
      console.error('Column does not exist and cannot be added via client. Please run migration manually.')
      console.log('\nRun this SQL in Supabase SQL Editor:')
      console.log('ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "estimate_required" BOOLEAN NOT NULL DEFAULT false;')
    } else {
      console.log('Column already exists or was added successfully!')
    }
  } else {
    console.log('Column added successfully!')
  }
}

addEstimateRequiredColumn()
