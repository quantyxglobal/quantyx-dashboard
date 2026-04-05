import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'
import { z } from 'zod'
import { SupabaseDB } from '@/lib/supabase-db'
import { randomUUID } from 'crypto'

// S3 Client Configuration - support both standard and Amplify naming
const getS3Config = () => {
  const accessKeyId = process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
  const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION
  
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
const assembleRequestSchema = z.object({
  uploadId: z.string().min(1),
  s3Key: z.string().min(1),
  totalChunks: z.number().int().positive(),
  filename: z.string().min(1),
  mimeType: z.string().optional(),
  fileSize: z.number().int().positive(),
  caseId: z.string().uuid().optional() // Optional case ID for creating file record
})

/**
 * Assembles uploaded chunks into the final file
 * POST /api/upload/assemble
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
    const { uploadId, s3Key, totalChunks, filename, mimeType, fileSize, caseId } = assembleRequestSchema.parse(body)

    // Collect all chunks
    const chunks: Buffer[] = []
    const missingChunks: number[] = []

    for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
      try {
        const chunkKey = `temp/chunks/${uploadId}/${chunkNumber}`
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET_NAME!,
          Key: chunkKey
        })

        const response = await s3Client.send(command)
        
        if (response.Body) {
          const chunkBuffer = Buffer.from(await response.Body.transformToByteArray())
          chunks[chunkNumber] = chunkBuffer
        } else {
          missingChunks.push(chunkNumber)
        }
      } catch (error) {
        console.error(`Failed to retrieve chunk ${chunkNumber}:`, error)
        missingChunks.push(chunkNumber)
      }
    }

    // Check if all chunks are present
    if (missingChunks.length > 0) {
      return NextResponse.json(
        { 
          error: 'Missing chunks',
          missingChunks
        },
        { status: 400 }
      )
    }

    // Assemble chunks into final file
    const assembledBuffer = Buffer.concat(chunks)

    // Upload assembled file to final location
    const finalCommand = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
      Body: assembledBuffer,
      ContentType: mimeType || 'application/octet-stream',
      Metadata: {
        uploadId,
        userId: session.user.id,
        assembledAt: new Date().toISOString(),
        totalChunks: totalChunks.toString(),
        originalFilename: filename,
        originalSize: fileSize.toString(),
        finalSize: assembledBuffer.length.toString()
      }
    })

    await s3Client.send(finalCommand)

    // Clean up temporary chunks
    const cleanupPromises = []
    for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
      const chunkKey = `temp/chunks/${uploadId}/${chunkNumber}`
      const deleteCommand = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: chunkKey
      })
      cleanupPromises.push(s3Client.send(deleteCommand))
    }

    // Clean up chunks in background (don't wait for completion)
    Promise.all(cleanupPromises).catch(error => {
      console.error('Failed to clean up some chunks:', error)
    })

    // Create file record in database if caseId provided
    let fileId: string | undefined
    if (caseId) {
      try {
        const fileExtension = filename.split('.').pop()
        const fileRecord = {
          id: randomUUID(),
          filename: filename,
          original_filename: filename,
          file_extension: fileExtension ? `.${fileExtension}` : null,
          mime_type: mimeType || 'application/octet-stream',
          file_size: assembledBuffer.length,
          s3_bucket: process.env.AWS_S3_BUCKET_NAME!,
          s3_key: s3Key,
          s3_region: process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION!,
          source: 'CASE_UPLOAD' as const,
          category: 'OTHER' as const,
          case_id: caseId,
          uploaded_by_id: session.user.id,
        }

        console.log('[ASSEMBLE] Creating file record with Supabase...')
        const createdFile = await SupabaseDB.createFile(fileRecord)
        fileId = createdFile.id
        console.log('[ASSEMBLE] Supabase file record created:', fileId)
      } catch (dbError) {
        console.error('[ASSEMBLE] Failed to create file record:', dbError)
        // Don't fail the entire operation if database insert fails
      }
    }

    return NextResponse.json({
      success: true,
      uploadId,
      s3Key,
      finalSize: assembledBuffer.length,
      totalChunks,
      fileId
    })

  } catch (error) {
    console.error('Chunk assembly error:', error)
    
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
        error: 'Failed to assemble chunks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}