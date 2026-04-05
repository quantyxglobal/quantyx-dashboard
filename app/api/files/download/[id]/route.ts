import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { S3Service } from '@/lib/s3-service'
import { SupabaseDB } from '@/lib/supabase-db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get file information from database using Supabase
    const fileData = await SupabaseDB.getFileById(id)
    
    if (!fileData) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get case information to check authorization
    const caseData = await SupabaseDB.getCase(fileData.case_id)
    
    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Check authorization
    const userCanAccess = 
      session.user.role === 'admin' || 
      session.user.role === 'super_admin' ||
      caseData.owner_id === session.user.id ||
      fileData.uploaded_by_id === session.user.id

    if (!userCanAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Generate presigned URL for download
    const downloadUrl = await S3Service.getDownloadUrl(fileData.s3_key, 3600) // 1 hour expiry

    return NextResponse.json({
      downloadUrl,
      filename: fileData.original_filename,
      contentType: fileData.mime_type,
      size: fileData.file_size
    })

  } catch (error) {
    console.error('[FILE_DOWNLOAD] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}