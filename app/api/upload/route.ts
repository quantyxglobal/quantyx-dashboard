import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { FileUploadService } from '@/lib/file-upload-service'
import { ChunkedUploadService } from '@/lib/chunked-upload-service'
import { userManagementService } from '@/lib/user-management-service'
import { z } from 'zod'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

// Lazy schema to avoid enum evaluation at module level
const getUploadInitiationSchema = () => z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileSize: z.number().min(1, 'File size must be greater than 0'),
  mimeType: z.string().min(1, 'MIME type is required'),
  caseId: z.string().uuid('Invalid case ID'),
  uploadType: z.enum(['initial', 'additional']).default('initial')
})

/**
 * POST /api/upload
 * Initiates chunked file upload for large files
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

    // Parse and validate request body
    const body = await request.json()
    const validatedData = getUploadInitiationSchema().parse(body)

    // Validate case access
    const hasAccess = await userManagementService.validateFirmAccess(session.user.id, validatedData.caseId)
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Access denied to this case' },
        { status: 403 }
      )
    }

    // Create a mock file object for validation
    const mockFile = {
      name: validatedData.fileName,
      size: validatedData.fileSize,
      type: validatedData.mimeType
    } as File

    // Validate the file
    const validation = FileUploadService.validateFile(mockFile)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: validation.error,
          errorCode: validation.errorCode
        },
        { status: 400 }
      )
    }

    // Determine upload strategy
    const useChunkedUpload = FileUploadService.shouldUseChunkedUpload(validatedData.fileSize)
    const showProgress = FileUploadService.shouldShowProgress(validatedData.fileSize)

    if (useChunkedUpload) {
      // Initialize chunked upload
      const uploadResult = await ChunkedUploadService.initializeUpload({
        fileName: validatedData.fileName,
        fileSize: validatedData.fileSize,
        mimeType: validatedData.mimeType,
        caseId: validatedData.caseId,
        uploadType: validatedData.uploadType,
        uploadedBy: session.user.id
      })

      if (!uploadResult.success) {
        return NextResponse.json(
          { 
            error: uploadResult.error || 'Failed to initialize chunked upload'
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        uploadStrategy: 'chunked',
        uploadId: uploadResult.uploadId,
        chunkSize: uploadResult.chunkSize,
        totalChunks: uploadResult.totalChunks,
        showProgress,
        s3Key: uploadResult.s3Key
      })
    } else {
      // For smaller files, return direct upload instructions
      const firmId = await getFirmIdForCase(validatedData.caseId)
      const s3Key = `firms/${firmId}/${validatedData.caseId}/${validatedData.uploadType === 'additional' ? 'additional_uploads' : 'uploads'}/${Date.now()}-${validatedData.fileName}`

      return NextResponse.json({
        success: true,
        uploadStrategy: 'direct',
        s3Key,
        showProgress,
        directUploadUrl: '/api/upload/direct'
      })
    }

  } catch (error) {
    console.error('Upload initiation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to initiate upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Helper function to get firm ID for a case
async function getFirmIdForCase(caseId: string): Promise<string> {
  const case_ = await userManagementService.prisma.case.findUnique({
    where: { id: caseId },
    select: { firm_id: true }
  })
  
  if (!case_) {
    throw new Error('Case not found')
  }
  
  return case_.firm_id
}

/**
 * GET /api/upload/[uploadId]/progress
 * Gets upload progress for chunked uploads
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('uploadId')

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      )
    }

    // Get upload progress
    const progress = ChunkedUploadService.getUploadProgress(uploadId)

    if (!progress) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Verify user has access to this upload
    if (progress.uploadedBy !== session.user.id) {
      const hasAccess = await userManagementService.validateFirmAccess(session.user.id, progress.caseId)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this upload' },
          { status: 403 }
        )
      }
    }

    return NextResponse.json({
      uploadId: progress.uploadId,
      fileName: progress.fileName,
      fileSize: progress.fileSize,
      uploadedChunks: progress.uploadedChunks,
      totalChunks: progress.totalChunks,
      bytesUploaded: progress.bytesUploaded,
      percentComplete: progress.percentComplete,
      status: progress.status,
      error: progress.error,
      startedAt: progress.startedAt,
      lastChunkAt: progress.lastChunkAt
    })

  } catch (error) {
    console.error('Upload progress error:', error)

    return NextResponse.json(
      { 
        error: 'Failed to get upload progress',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/upload/[uploadId]
 * Cancels an active chunked upload
 */
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('uploadId')

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      )
    }

    // Get upload progress to verify ownership
    const progress = ChunkedUploadService.getUploadProgress(uploadId)

    if (!progress) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    // Verify user has access to cancel this upload
    if (progress.uploadedBy !== session.user.id) {
      const hasAccess = await userManagementService.validateFirmAccess(session.user.id, progress.caseId)
      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Access denied to this upload' },
          { status: 403 }
        )
      }
    }

    // Cancel the upload
    const cancelled = ChunkedUploadService.cancelUpload(uploadId)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Failed to cancel upload' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Upload cancelled successfully',
      uploadId
    })

  } catch (error) {
    console.error('Upload cancellation error:', error)

    return NextResponse.json(
      { 
        error: 'Failed to cancel upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}