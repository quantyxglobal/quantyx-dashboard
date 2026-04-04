import { NextResponse } from 'next/server'
import { S3Client, PutObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3'
import { auth } from '@/auth'

export const dynamic = 'force-dynamic'

/**
 * Test S3 connection and permissions
 * GET /api/debug/test-s3
 */
export async function GET() {
  try {
    // Check authentication
    const session = await auth()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Allow SUPER_ADMIN and ADMIN
    const allowedRoles = ['admin', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(session.user.role || '')) {
      return NextResponse.json({ 
        error: 'Forbidden - Admin access required'
      }, { status: 403 })
    }

    const results: any = {
      timestamp: new Date().toISOString(),
      config: {},
      tests: {}
    }

    // Get S3 configuration
    const accessKeyId = process.env.AMPLIFY_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AMPLIFY_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY
    const region = process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION
    const bucketName = process.env.AMPLIFY_AWS_S3_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME

    results.config = {
      hasAccessKey: !!accessKeyId,
      accessKeyPreview: accessKeyId ? `${accessKeyId.substring(0, 10)}...` : 'MISSING',
      hasSecretKey: !!secretAccessKey,
      region: region || 'MISSING',
      bucketName: bucketName || 'MISSING'
    }

    if (!accessKeyId || !secretAccessKey || !region || !bucketName) {
      return NextResponse.json({
        ...results,
        error: 'Missing required S3 configuration'
      }, { status: 500 })
    }

    // Create S3 client
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    })

    // Test 1: Check if bucket exists and is accessible
    try {
      const headCommand = new HeadBucketCommand({
        Bucket: bucketName
      })
      await s3Client.send(headCommand)
      results.tests.bucketAccess = {
        success: true,
        message: 'Bucket exists and is accessible'
      }
    } catch (error: any) {
      results.tests.bucketAccess = {
        success: false,
        error: error.message,
        code: error.Code || error.name,
        statusCode: error.$metadata?.httpStatusCode
      }
    }

    // Test 2: Try to upload a small test file
    try {
      const testKey = `test/debug-${Date.now()}.txt`
      const testContent = `S3 test from dashboard at ${new Date().toISOString()}`
      
      const putCommand = new PutObjectCommand({
        Bucket: bucketName,
        Key: testKey,
        Body: Buffer.from(testContent),
        ContentType: 'text/plain',
        Metadata: {
          test: 'true',
          userId: session.user.id
        }
      })

      await s3Client.send(putCommand)
      
      results.tests.uploadTest = {
        success: true,
        message: 'Successfully uploaded test file',
        key: testKey,
        size: testContent.length
      }
    } catch (error: any) {
      results.tests.uploadTest = {
        success: false,
        error: error.message,
        code: error.Code || error.name,
        statusCode: error.$metadata?.httpStatusCode
      }
    }

    // Overall status
    results.overallStatus = 
      results.tests.bucketAccess?.success && results.tests.uploadTest?.success
        ? 'ALL_TESTS_PASSED'
        : 'SOME_TESTS_FAILED'

    return NextResponse.json(results, { 
      status: results.overallStatus === 'ALL_TESTS_PASSED' ? 200 : 500 
    })

  } catch (error) {
    console.error('[DEBUG_TEST_S3] Error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
