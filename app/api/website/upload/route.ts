import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { corsHeaders, handleOptions, corsResponse } from '../cors'

// Force this route to be treated as an Edge API Route, not a Server Action
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME!

export async function OPTIONS(request: NextRequest) {
  return handleOptions()
}

export async function POST(request: NextRequest) {
  try {
    console.log('[WEBSITE UPLOAD] Starting file upload...')
    console.log('[WEBSITE UPLOAD] Request headers:', {
      origin: request.headers.get('origin'),
      host: request.headers.get('host'),
      contentType: request.headers.get('content-type')
    })
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'quote-requests'
    
    console.log('[WEBSITE UPLOAD] File:', file?.name, 'Folder:', folder)
    
    if (!file) {
      console.error('[WEBSITE UPLOAD] No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: corsHeaders }
      )
    }

    // Validate AWS configuration
    if (!BUCKET_NAME || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('[WEBSITE UPLOAD] Missing AWS configuration')
      return NextResponse.json(
        { error: 'Server configuration error: Missing AWS credentials' },
        { status: 500, headers: corsHeaders }
      )
    }

    // Generate unique file key
    const timestamp = new Date().toISOString().split('T')[0]
    const uniqueId = uuidv4().substring(0, 8)
    const fileExtension = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
    const s3Key = `${folder}/${timestamp}/${uniqueId}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`

    console.log('[WEBSITE UPLOAD] S3 Key:', s3Key)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    console.log('[WEBSITE UPLOAD] File size:', buffer.length, 'bytes')

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type || 'application/octet-stream',
      ServerSideEncryption: 'AES256',
      Metadata: {
        originalName: file.name,
        uploadedAt: new Date().toISOString(),
        source: 'quantix-website'
      }
    })

    console.log('[WEBSITE UPLOAD] Uploading to S3...')
    await s3Client.send(command)
    console.log('[WEBSITE UPLOAD] Upload successful')

    // Generate download URL (7 days expiry)
    const downloadCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    })
    const downloadUrl = await getSignedUrl(s3Client, downloadCommand, { expiresIn: 7 * 24 * 60 * 60 })

    console.log('[WEBSITE UPLOAD] Generated download URL')

    return NextResponse.json({
      success: true,
      s3Key,
      downloadUrl,
      originalName: file.name,
      size: file.size,
      mimeType: file.type
    }, { 
      status: 200, 
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('[WEBSITE UPLOAD] File upload error:', error)
    console.error('[WEBSITE UPLOAD] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return NextResponse.json(
      { 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500, headers: corsHeaders }
    )
  }
}