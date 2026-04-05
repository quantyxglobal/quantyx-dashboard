import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'

// S3 Client Configuration - support both standard and Amplify naming
const getS3Config = () => {
  const accessKeyId = process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION
  
  console.log('[CHUNK_UPLOAD] S3 Config check:', {
    hasAccessKey: !!accessKeyId,
    hasSecretKey: !!secretAccessKey,
    region: region,
    usingCustomRegion: !!process.env.CUSTOM_AWS_REGION,
    usingAmplifyPrefix: !!(process.env.AMPLIFY_AWS_ACCESS_KEY_ID)
  })
  
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
    const bucketName = process.env.AMPLIFY_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME
    
    if (!bucketName) {
      throw new Error('S3 bucket name not configured')
    }
    
    console.log('[CHUNK_UPLOAD] Uploading to bucket:', bucketName)
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
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