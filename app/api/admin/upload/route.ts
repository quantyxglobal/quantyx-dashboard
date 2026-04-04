import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isValidFileType, isValidFileSize } from '@/lib/s3'
import { S3Service } from '@/lib/s3-service'
import { SupabaseDB } from '@/lib/supabase-db'
import { revalidatePath } from 'next/cache'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/upload
 * 
 * Handles file uploads from admin users.
 * Validates file type and size, uploads to S3, and saves metadata to database.
 * 
 * @param request - The incoming request with multipart form data
 * @returns JSON response with success status or error
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin role
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    const caseId = formData.get('caseId') as string | null

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      )
    }

    // Verify case exists using SupabaseDB and get case number
    const caseExists = await SupabaseDB.getCaseById(caseId)

    if (!caseExists) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Get the case number for S3 folder structure
    const caseNumber = caseExists.case_number

    // Process each file
    const uploadedFiles = []
    
    for (const file of files) {
      // Validate file type
      if (!isValidFileType(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type for ${file.name}. Allowed types: PDF, JPEG, PNG, DOC, DOCX` },
          { status: 400 }
        )
      }

      // Validate file size (max 50MB)
      if (!isValidFileSize(file.size)) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds maximum of 50MB` },
          { status: 400 }
        )
      }

      // Upload to S3 using output folder structure with case NUMBER
      // This creates: cases/{caseNumber}/output/{timestamp}-{random}-{filename}
      const s3Key = S3Service.generateOutputFileKey(file.name, caseNumber, 'cases')
      const { url: s3Url } = await S3Service.uploadFile(s3Key, file)

      // Generate unique file ID
      const fileId = `${Date.now()}-${Math.random().toString(36).substring(7)}`

      // Save file metadata to database using SupabaseDB
      // Use ADDITIONAL_UPLOAD as source for admin-uploaded output files
      const fileRecord = await SupabaseDB.createFile({
        id: fileId,
        filename: file.name,
        original_filename: file.name,
        file_extension: file.name.split('.').pop() || null,
        mime_type: file.type,
        file_size: file.size,
        s3_bucket: process.env.AWS_S3_BUCKET_NAME || 'default-bucket',
        s3_key: s3Key,
        s3_region: process.env.AWS_REGION || 'us-east-1',
        source: 'ADDITIONAL_UPLOAD',
        category: 'OTHER',
        case_id: caseId,
        uploaded_by_id: session.user.id
      })
      
      uploadedFiles.push({
        id: fileRecord.id,
        file_name: fileRecord.filename,
        file_size: fileRecord.file_size,
        mime_type: fileRecord.mime_type
      })
    }

    // Revalidate case pages to show new files
    revalidatePath(`/admin/case/${caseId}`)
    revalidatePath(`/superadmin/case/${caseId}`)
    revalidatePath(`/dashboard/case/${caseId}`)

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
      count: uploadedFiles.length
    })
  } catch (error) {
    // Log error server-side with full details for debugging
    console.error('[UPLOAD_ERROR] Full error details:', error)
    console.error('[UPLOAD_ERROR] Error message:', error instanceof Error ? error.message : 'Unknown error')
    console.error('[UPLOAD_ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Log error server-side with context (no sensitive info)
    console.error('File upload error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (await auth())?.user?.id,
      timestamp: new Date().toISOString()
    })
    
    // Handle specific error types
    if (error instanceof Error) {
      // S3 errors
      if (error.message.includes('S3') || error.message.includes('AWS')) {
        return NextResponse.json(
          { error: 'File storage temporarily unavailable. Please try again.' },
          { status: 503 }
        )
      }
      
      // Database errors (Prisma)
      if (error.message.includes('Prisma') || error.message.includes('database')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again.' },
          { status: 503 }
        )
      }
    }
    
    // Generic error (no sensitive info exposed)
    return NextResponse.json(
      { error: 'File upload failed. Please try again.' },
      { status: 500 }
    )
  }
}
