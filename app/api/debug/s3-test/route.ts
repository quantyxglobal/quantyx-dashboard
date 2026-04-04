import { NextResponse } from 'next/server'
import { S3Service } from '@/lib/s3-service'

export async function GET() {
  try {
    console.log('[S3_TEST] Starting S3 service test...')
    
    // Test 1: Check environment variables
    const envCheck = {
      AWS_REGION: !!process.env.AWS_REGION,
      AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
      AWS_S3_BUCKET_NAME: !!process.env.AWS_S3_BUCKET_NAME,
    }
    
    console.log('[S3_TEST] Environment variables:', envCheck)
    
    // Test 2: Generate file key
    const testCaseId = 'test-case-123'
    const testFilename = 'test-document.pdf'
    const fileKey = S3Service.generateFileKey(testFilename, testCaseId)
    
    console.log('[S3_TEST] Generated file key:', fileKey)
    
    // Test 3: Generate direct S3 URL
    const directUrl = S3Service.getDirectS3Url(fileKey)
    
    console.log('[S3_TEST] Generated direct URL:', directUrl)
    
    // Test 4: Try to list files (this will test S3 connectivity)
    let listResult = null
    let listError = null
    
    try {
      listResult = await S3Service.listCaseFiles(testCaseId)
      console.log('[S3_TEST] List files successful:', listResult.length, 'files found')
    } catch (error) {
      listError = error instanceof Error ? error.message : 'Unknown error'
      console.error('[S3_TEST] List files failed:', listError)
    }
    
    return NextResponse.json({
      success: true,
      message: 'S3 service test completed',
      results: {
        environmentVariables: envCheck,
        fileKeyGeneration: {
          input: { filename: testFilename, caseId: testCaseId },
          output: fileKey
        },
        directUrlGeneration: {
          input: fileKey,
          output: directUrl
        },
        s3Connectivity: {
          success: listError === null,
          error: listError,
          filesFound: listResult?.length || 0
        }
      }
    })
    
  } catch (error) {
    console.error('[S3_TEST] Test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'S3 service test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}