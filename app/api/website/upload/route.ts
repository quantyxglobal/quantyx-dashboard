import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'
import { getCorsHeaders } from '@/lib/cors'

// Force this route to be treated as an Edge API Route, not a Server Action
export const dynamic = 'force-dynamic'

// AWS S3 Configuration - lazy initialization
let _s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!_s3Client) {
    // Use CUSTOM_AWS_REGION first (set in next.config.ts from AMPLIFY_AWS_REGION)
    // Fall back to AMPLIFY_AWS_REGION, then AWS_REGION
    const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION!
    
    console.log('[WEBSITE UPLOAD] Initializing S3 client with region:', region)
    console.log('[WEBSITE UPLOAD] Available regions:', {
      CUSTOM_AWS_REGION: process.env.CUSTOM_AWS_REGION,
      AMPLIFY_AWS_REGION: process.env.AMPLIFY_AWS_REGION,
      AWS_REGION: process.env.AWS_REGION
    })
    
    _s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }
  return _s3Client
}

function getBucketName(): string {
  const bucketName = process.env.AWS_S3_BUCKET_NAME
  if (!bucketName) {
    throw new Error('AWS_S3_BUCKET_NAME environment variable is required')
  }
  return bucketName
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin')
  console.log('[WEBSITE UPLOAD] OPTIONS request from origin:', origin)
  
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin)
    }
  })
}

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)
    
    console.log('[WEBSITE UPLOAD] Starting file upload...')
    console.log('[WEBSITE UPLOAD] Request headers:', {
      origin: origin,
      host: req.headers.get('host'),
      contentType: req.headers.get('content-type')
    })
    
    const formData = await req.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'quote-requests'
    
    console.log('[WEBSITE UPLOAD] File:', file?.name, 'Folder:', folder)
    
    if (!file) {
      console.error('[WEBSITE UPLOAD] No file provided')
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { 
          status: 400, 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    // Validate AWS configuration
    const BUCKET_NAME = getBucketName()
    if (!BUCKET_NAME || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.error('[WEBSITE UPLOAD] Missing AWS configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Missing AWS credentials' }),
        { 
          status: 500, 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
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
    const s3Client = getS3Client()
    await s3Client.send(command)
    console.log('[WEBSITE UPLOAD] Upload successful')

    // Generate download URL (7 days expiry)
    const downloadCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key
    })
    const downloadUrl = await getSignedUrl(s3Client, downloadCommand, { expiresIn: 7 * 24 * 60 * 60 })

    console.log('[WEBSITE UPLOAD] Generated download URL')

    // Use correct region for response
    const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION!
    console.log('[WEBSITE UPLOAD] Using region for response:', region)

    return new Response(
      JSON.stringify({
        success: true,
        s3Key,
        downloadUrl,
        originalName: file.name,
        size: file.size,
        mimeType: file.type
      }),
      { 
        status: 200, 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )

  } catch (error) {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)
    
    console.error('[WEBSITE UPLOAD] File upload error:', error)
    console.error('[WEBSITE UPLOAD] Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    return new Response(
      JSON.stringify({ 
        error: 'Failed to upload file',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
}