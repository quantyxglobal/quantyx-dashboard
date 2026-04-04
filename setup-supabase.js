import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', supabaseUrl);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Test connection by trying to run a simple query
    const { data, error } = await supabase.rpc('version');
    
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      
      // Try a different approach - check if we can access any table
      const { data: testData, error: testError } = await supabase
        .from('users')
        .select('count')
        .limit(0);
        
      if (testError) {
        console.log('Table access error:', testError.message);
        if (testError.message.includes('relation "public.users" does not exist')) {
          console.log('✅ Connection works but tables don\'t exist yet');
          return true;
        }
      }
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('Database version:', data);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  }
}

testSupabaseConnection();