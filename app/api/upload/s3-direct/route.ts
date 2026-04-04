import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// Supabase fallback client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

// S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

/**
 * Handles direct S3 uploads for small files with database record creation
 * POST /api/upload/s3-direct
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

    // Parse request body
    const body = await request.json()
    const { s3Key, fileName, fileSize, mimeType, caseId, fileData } = body

    if (!s3Key || !fileName || !fileSize || !caseId || !fileData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log(`[S3_DIRECT] Uploading ${fileName} (${fileSize} bytes) to ${s3Key}`)

    // Convert array back to buffer
    const fileBuffer = Buffer.from(fileData)

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimeType || 'application/octet-stream',
      Metadata: {
        userId: session.user.id,
        uploadedAt: new Date().toISOString(),
        originalFilename: fileName,
        caseId
      }
    })

    await s3Client.send(command)
    console.log(`[S3_DIRECT] File uploaded to S3 successfully`)

    // Create file record in database
    const fileExtension = fileName.split('.').pop()
    const fileRecord = {
      id: randomUUID(),
      filename: fileName,
      original_filename: fileName,
      file_extension: fileExtension ? `.${fileExtension}` : null,
      mime_type: mimeType || 'application/octet-stream',
      file_size: fileSize,
      s3_bucket: process.env.AWS_S3_BUCKET_NAME!,
      s3_key: s3Key,
      s3_region: process.env.AWS_REGION!,
      source: 'CASE_UPLOAD',
      category: 'OTHER',
      case_id: caseId,
      uploaded_by_id: session.user.id,
    }

    try {
      console.log('[S3_DIRECT] Creating file record with Prisma...')
      await prisma.file.create({
        data: {
          ...fileRecord,
          file_size: BigInt(fileSize), // Prisma needs BigInt
        },
      })
      console.log('[S3_DIRECT] Prisma file record created')
    } catch (prismaError) {
      console.log('[S3_DIRECT] Prisma failed, using Supabase fallback:', prismaError)
      
      const { error: fileError } = await supabase
        .from('files')
        .insert(fileRecord)

      if (fileError) {
        console.error('[S3_DIRECT] Supabase file creation failed:', fileError)
        throw new Error(`Failed to save file record: ${fileError.message}`)
      }
      console.log('[S3_DIRECT] Supabase file record created')
    }

    return NextResponse.json({
      success: true,
      s3Key,
      fileName,
      fileSize
    })

  } catch (error) {
    console.error('[S3_DIRECT] Upload error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
