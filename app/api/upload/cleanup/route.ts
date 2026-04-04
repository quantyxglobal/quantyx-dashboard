import { NextRequest, NextResponse } from 'next/server'
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'
import { z } from 'zod'

// S3 Client Configuration - support both standard and Amplify naming
const getS3Config = () => {
  const accessKeyId = process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION
  
  if (!accessKeyId || !secretAccessKey || !region) {
    throw new Error('Missing AWS credentials or region')
  }
  
  return {
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  }
}

const s3Client = new S3Client(getS3Config())

// Request validation schema
const cleanupRequestSchema = z.object({
  uploadId: z.string().min(1)
})

/**
 * Cleans up temporary chunks for a failed or cancelled upload
 * POST /api/upload/cleanup
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
    const { uploadId } = cleanupRequestSchema.parse(body)

    console.log(`[CLEANUP] Starting cleanup for upload: ${uploadId}`)

    const bucketName = process.env.AMPLIFY_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME
    
    if (!bucketName) {
      throw new Error('S3 bucket name not configured')
    }

    // List all chunks for this upload
    const listCommand = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: `temp/chunks/${uploadId}/`
    })

    const listResponse = await s3Client.send(listCommand)
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log(`[CLEANUP] No chunks found for upload: ${uploadId}`)
      return NextResponse.json({
        success: true,
        message: 'No chunks to clean up',
        deletedCount: 0
      })
    }

    // Delete all chunks
    const objectsToDelete = listResponse.Contents.map(obj => ({ Key: obj.Key! }))
    
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucketName,
      Delete: {
        Objects: objectsToDelete
      }
    })

    const deleteResponse = await s3Client.send(deleteCommand)
    
    const deletedCount = deleteResponse.Deleted?.length || 0
    console.log(`[CLEANUP] Deleted ${deletedCount} chunks for upload: ${uploadId}`)

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} chunks`,
      deletedCount
    })

  } catch (error) {
    console.error('[CLEANUP] Cleanup error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to cleanup chunks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
