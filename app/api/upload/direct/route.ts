import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { FileUploadService } from '@/lib/file-upload-service'
import { FileStorageService, type FileStorageMetadata } from '@/lib/file-storage-service'
import { v4 as uuidv4 } from 'uuid'

/**
 * Handles direct file uploads for smaller files (<100MB)
 * POST /api/upload/direct
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const caseId = formData.get('caseId') as string
    const firmId = formData.get('firmId') as string
    const uploadType = formData.get('uploadType') as string
    const s3Key = formData.get('s3Key') as string

    if (!file || !caseId || !firmId || !uploadType || !s3Key) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate the file
    const validation = FileUploadService.validateFile(file)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: validation.error,
          errorCode: validation.errorCode
        },
        { status: 400 }
      )
    }

    // Check if file should use chunked upload instead
    if (FileUploadService.shouldUseChunkedUpload(file.size)) {
      return NextResponse.json(
        { error: 'File too large for direct upload. Use chunked upload instead.' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    // Prepare file metadata
    const metadata: FileStorageMetadata = {
      originalFileName: file.name,
      uploadTimestamp: new Date(),
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      uploadedBy: session.user.id,
      caseId,
      uploadType: uploadType as 'initial' | 'additional',
      uniqueId: uuidv4()
    }

    // Store file with metadata using the file storage service
    const result = await FileStorageService.storeFileWithMetadata(s3Key, metadata, fileBuffer)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to store file' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      s3Key: result.s3Key,
      uniqueFileName: result.uniqueFileName,
      fileName: file.name,
      fileSize: file.size,
      uploadType
    })

  } catch (error) {
    console.error('Direct upload error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}