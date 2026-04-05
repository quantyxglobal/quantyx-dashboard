import { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { formatDateForS3 } from './date-utils'

// Lazy-loaded S3 client
let _s3Client: S3Client | null = null

function getS3Client(): S3Client {
  if (!_s3Client) {
    // Use CUSTOM_AWS_REGION first (set in next.config.ts from AMPLIFY_AWS_REGION)
    // Fall back to AMPLIFY_AWS_REGION, then AWS_REGION
    const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION!
    
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
  return process.env.AWS_S3_BUCKET_NAME!
}

export class S3Service {
  /**
   * Upload a file to S3
   */
  static async uploadFile(
    key: string,
    file: File | Buffer,
    contentType?: string
  ): Promise<{ url: string; key: string }> {
    try {
      let body: Buffer
      let mimeType: string

      if (file instanceof File) {
        body = Buffer.from(await file.arrayBuffer())
        mimeType = file.type || contentType || 'application/octet-stream'
      } else {
        body = file
        mimeType = contentType || 'application/octet-stream'
      }

      const command = new PutObjectCommand({
        Bucket: getBucketName(),
        Key: key,
        Body: body,
        ContentType: mimeType,
      })

      await getS3Client().send(command)

      // Return the S3 URL using correct region
      const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION!
      const url = `https://${getBucketName()}.s3.${region}.amazonaws.com/${key}`
      
      return { url, key }
    } catch (error: any) {
      console.error('Error uploading file to S3:', error)
      const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION!
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        code: error.Code || error.$metadata?.httpStatusCode,
        requestId: error.$metadata?.requestId,
        bucket: getBucketName(),
        key: key,
        region
      })
      
      // Provide more specific error messages
      if (error.name === 'NoSuchBucket') {
        throw new Error(`S3 bucket '${getBucketName()}' does not exist`)
      } else if (error.name === 'AccessDenied' || error.Code === 'AccessDenied') {
        throw new Error(`Access denied to S3 bucket '${getBucketName()}'. Check AWS credentials and permissions.`)
      } else if (error.name === 'InvalidAccessKeyId') {
        throw new Error('Invalid AWS access key ID. Check your AWS credentials.')
      } else if (error.name === 'SignatureDoesNotMatch') {
        throw new Error('AWS signature does not match. Check your AWS secret access key.')
      }
      
      throw new Error(`Failed to upload file to S3: ${error.message || error.name || 'Unknown error'}`)
    }
  }

  /**
   * Generate a presigned URL for downloading a file
   */
  static async getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      })

      const url = await getSignedUrl(s3Client, command, { expiresIn })
      return url
    } catch (error) {
      console.error('Error generating presigned URL:', error)
      throw new Error(`Failed to generate download URL: ${error}`)
    }
  }

  /**
   * Generate a unique file key for S3 with case-specific folder structure
   * @param originalFilename - The original filename
   * @param caseIdentifier - The case number (e.g., QGM_369_0001) or case UUID
   * @param prefix - The S3 prefix (default: 'cases')
   */
  static generateFileKey(originalFilename: string, caseIdentifier: string, prefix: string = 'cases'): string {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Create case-specific folder structure: cases/{caseIdentifier}/input/{timestamp}-{random}-{sanitizedFilename}
    // caseIdentifier can be case number (QGM_369_0001) or UUID
    return `${prefix}/${caseIdentifier}/input/${timestamp}-${randomString}-${sanitizedFilename}`
  }

  /**
   * Generate a file key for output files
   * @param originalFilename - The original filename
   * @param caseIdentifier - The case number (e.g., QGM_369_0001) or case UUID
   * @param prefix - The S3 prefix (default: 'cases')
   */
  static generateOutputFileKey(originalFilename: string, caseIdentifier: string, prefix: string = 'cases'): string {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Create case-specific folder structure: cases/{caseIdentifier}/output/{timestamp}-{random}-{sanitizedFilename}
    // caseIdentifier can be case number (QGM_369_0001) or UUID
    return `${prefix}/${caseIdentifier}/output/${timestamp}-${randomString}-${sanitizedFilename}`
  }

  /**
   * Generate a file key for additional files with date-based folder
   * @param originalFilename - The original filename
   * @param caseIdentifier - The case number (e.g., QGM_369_0001) or case UUID
   * @param date - The date for the folder (defaults to current date)
   * @param prefix - The S3 prefix (default: 'cases')
   */
  static generateAdditionalFileKey(originalFilename: string, caseIdentifier: string, date?: Date, prefix: string = 'cases'): string {
    const timestamp = Date.now()
    const randomString = Math.random().toString(36).substring(2, 15)
    const sanitizedFilename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    // Format date as MM-DD-YY using centralized utility
    const dateFolder = formatDateForS3(date)
    
    // Create case-specific folder structure: cases/{caseIdentifier}/additional files-MM-DD-YY/{timestamp}-{random}-{sanitizedFilename}
    return `${prefix}/${caseIdentifier}/additional files-${dateFolder}/${timestamp}-${randomString}-${sanitizedFilename}`
  }

  /**
   * Get the S3 folder path for a specific case
   * @param caseIdentifier - The case number (e.g., QGM_369_0001) or case UUID
   * @param prefix - The S3 prefix (default: 'cases')
   */
  static getCaseFolderPath(caseIdentifier: string, prefix: string = 'cases'): string {
    return `${prefix}/${caseIdentifier}/`
  }

  /**
   * Generate a direct S3 URL for a file (for display purposes)
   */
  static getDirectS3Url(s3Key: string): string {
    const region = process.env.CUSTOM_AWS_REGION || process.env.AMPLIFY_AWS_REGION || process.env.AWS_REGION!
    return `https://${getBucketName()}.s3.${region}.amazonaws.com/${s3Key}`
  }

  /**
   * List all files for a specific case
   * @param caseIdentifier - The case number (e.g., QGM_369_0001) or case UUID
   * @param prefix - The S3 prefix (default: 'cases')
   */
  static async listCaseFiles(caseIdentifier: string, prefix: string = 'cases'): Promise<string[]> {
    try {
      const command = new ListObjectsV2Command({
        Bucket: getBucketName(),
        Prefix: `${prefix}/${caseIdentifier}/`,
      })

      const response = await getS3Client().send(command)
      return response.Contents?.map(obj => obj.Key || '') || []
    } catch (error) {
      console.error('Error listing case files:', error)
      throw new Error(`Failed to list case files: ${error}`)
    }
  }

  /**
   * Check if a file exists in S3
   */
  static async fileExists(s3Key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: getBucketName(),
        Key: s3Key,
      })

      await getS3Client().send(command)
      return true
    } catch (error) {
      return false
    }
  }
}