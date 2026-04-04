import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ChunkedUploadService } from '@/lib/chunked-upload-service'

/**
 * Gets upload progress for a specific upload ID
 * GET /api/upload/progress/[uploadId]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { uploadId } = await params

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      )
    }

    // Get progress from the chunked upload service
    const progress = ChunkedUploadService.getUploadProgress(uploadId)

    if (!progress) {
      return NextResponse.json(
        { error: 'Upload not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      progress
    })

  } catch (error) {
    console.error('Progress tracking error:', error)
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
 * Cancels an active upload
 * DELETE /api/upload/progress/[uploadId]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ uploadId: string }> }
) {
  try {
    // Authenticate user
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { uploadId } = await params

    if (!uploadId) {
      return NextResponse.json(
        { error: 'Upload ID is required' },
        { status: 400 }
      )
    }

    // Cancel the upload
    const cancelled = ChunkedUploadService.cancelUpload(uploadId)

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Upload not found or already completed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Upload cancelled successfully'
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