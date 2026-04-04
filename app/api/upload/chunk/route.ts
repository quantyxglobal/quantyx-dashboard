import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'

// S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

/**
 * Handles individual chunk uploads for chunked file upload
 * POST /api/upload/chunk
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

    // Get headers
    const uploadId = request.headers.get('X-Upload-Id')
    const chunkNumber = request.headers.get('X-Chunk-Number')
    const s3Key = request.headers.get('X-S3-Key')

    if (!uploadId || !chunkNumber || !s3Key) {
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      )
    }

    // Get chunk data
    const chunkBuffer = Buffer.from(await request.arrayBuffer())
    
    if (chunkBuffer.length === 0) {
      return NextResponse.json(
        { error: 'Empty chunk data' },
        { status: 400 }
      )
    }

    // Upload chunk to S3 temporary location
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: `temp/chunks/${uploadId}/${chunkNumber}`,
      Body: chunkBuffer,
      ContentType: 'application/octet-stream',
      Metadata: {
        uploadId,
        chunkNumber,
        originalS3Key: s3Key,
        userId: session.user.id
      }
    })

    await s3Client.send(command)

    return NextResponse.json({
      success: true,
      uploadId,
      chunkNumber: parseInt(chunkNumber),
      size: chunkBuffer.length
    })

  } catch (error) {
    console.error('Chunk upload error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload chunk',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}