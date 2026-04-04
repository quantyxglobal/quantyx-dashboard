import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params

    // Get files for the specific case
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })

    if (filesError) {
      console.error('Error fetching files:', filesError)
      return NextResponse.json({ error: filesError.message }, { status: 500 })
    }

    // Get case information
    const { data: caseData, error: caseError } = await supabase
      .from('cases')
      .select('id, case_number, title')
      .eq('id', caseId)
      .single()

    if (caseError) {
      console.error('Error fetching case:', caseError)
      return NextResponse.json({ error: caseError.message }, { status: 500 })
    }

    return NextResponse.json({ 
      case: caseData,
      files: files || [],
      total: files?.length || 0,
      rawFiles: files?.filter(f => f.file_type === 'raw') || [],
      outputFiles: files?.filter(f => f.file_type === 'output') || []
    })
  } catch (error) {
    console.error('Error in debug files API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}