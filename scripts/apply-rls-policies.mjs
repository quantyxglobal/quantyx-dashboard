#!/usr/bin/env node

/**
 * Script to apply RLS policies for teams table
 * 
 * Usage:
 *   node scripts/apply-rls-policies.mjs
 * 
 * Requirements:
 *   - Node.js installed
 *   - @supabase/supabase-js package
 *   - NEXT_PUBLIC_SUPABASE_URL in .env
 *   - SUPABASE_SERVICE_ROLE_KEY in .env
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
config({ path: join(__dirname, '..', '.env') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables!')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  console.error('\n💡 Alternative: Provide DATABASE_URL for direct connection')
  process.exit(1)
}

console.log('🔧 Applying RLS policies for teams table...\n')

const sqlScript = `
-- RLS Policies for teams table
DROP POLICY IF EXISTS "Service role can insert teams" ON public.teams;
DROP POLICY IF EXISTS "Service role can select teams" ON public.teams;
DROP POLICY IF EXISTS "Service role can update teams" ON public.teams;
DROP POLICY IF EXISTS "Service role can delete teams" ON public.teams;

CREATE POLICY "Service role can insert teams"
  ON public.teams FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can select teams"
  ON public.teams FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can update teams"
  ON public.teams FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete teams"
  ON public.teams FOR DELETE TO authenticated USING (true);

-- RLS Policies for case_assignment_history table
DROP POLICY IF EXISTS "Service role can insert case assignment history" ON public.case_assignment_history;
DROP POLICY IF EXISTS "Service role can select case assignment history" ON public.case_assignment_history;
DROP POLICY IF EXISTS "Service role can update case assignment history" ON public.case_assignment_history;
DROP POLICY IF EXISTS "Service role can delete case assignment history" ON public.case_assignment_history;

CREATE POLICY "Service role can insert case assignment history"
  ON public.case_assignment_history FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Service role can select case assignment history"
  ON public.case_assignment_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can update case assignment history"
  ON public.case_assignment_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Service role can delete case assignment history"
  ON public.case_assignment_history FOR DELETE TO authenticated USING (true);

-- Grant permissions
GRANT ALL ON public.teams TO authenticated;
GRANT ALL ON public.case_assignment_history TO authenticated;

-- Refresh RLS
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_assignment_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_assignment_history ENABLE ROW LEVEL SECURITY;
`

async function applyWithPostgres() {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment variables')
  }
  
  console.log('📦 Using direct PostgreSQL connection...')
  const client = new pg.Client({ connectionString: databaseUrl })
  
  try {
    await client.connect()
    console.log('✅ Connected to database')
    
    await client.query(sqlScript)
    console.log('✅ RLS policies applied successfully!')
    
    // Verify
    const result = await client.query(`
      SELECT schemaname, tablename, policyname, cmd
      FROM pg_policies
      WHERE tablename IN ('teams', 'case_assignment_history')
      ORDER BY tablename, policyname
    `)
    
    console.log(`\n✅ Found ${result.rows.length} policies:`)
    result.rows.forEach(p => {
      console.log(`   • ${p.tablename}: ${p.policyname} (${p.cmd})`)
    })
    
    await client.end()
    console.log('\n✅ Migration complete! You can now create teams.\n')
    process.exit(0)
  } catch (error) {
    await client.end()
    throw error
  }
}

async function main() {
  try {
    if (databaseUrl) {
      await applyWithPostgres()
    } else {
      console.log('\n⚠️  Direct database connection not available')
      console.log('\n📋 Please apply the migration manually:')
      console.log('   1. Go to: https://supabase.com/dashboard')
      console.log('   2. Navigate to: SQL Editor > New query')
      console.log('   3. Copy the contents of: scripts/apply-teams-rls-fix.sql')
      console.log('   4. Paste and click "Run"')
      console.log('\n   Or add DATABASE_URL to your .env file for automatic execution\n')
      process.exit(1)
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.log('\n📋 Please apply manually via Supabase Dashboard SQL Editor')
    console.log('   File: scripts/apply-teams-rls-fix.sql\n')
    process.exit(1)
  }
}

main()
