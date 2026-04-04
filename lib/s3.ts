import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { FileUploadService, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from './file-upload-service'

// S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

// Legacy constants for backward compatibility
const LEGACY_MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB
const LEGACY_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

/**
 * Validates if a MIME type is allowed (legacy - use FileUploadService.isValidFileType for new uploads)
 */
export function isValidFileType(mimeType: string): boolean {
  return LEGACY_ALLOWED_MIME_TYPES.includes(mimeType)
}

/**
 * Validates if a file size is within limits (legacy - use FileUploadService.isValidFileSize for new uploads)
 */
export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= LEGACY_MAX_FILE_SIZE
}

/**
 * Enhanced validation functions (use these for new uploads)
 */
export const isValidEnhancedFileType = FileUploadService.isValidFileType
export const isValidEnhancedFileSize = FileUploadService.isValidFileSize
export const validateEnhancedFile = FileUploadService.validateFile

/**
 * Uploads a file to S3 with proper folder structure
 * @param file - The file to upload
 * @param caseId - The case ID this file belongs to
 * @param fileType - The type of file (input for client uploads, output for admin uploads)
 * @returns The S3 key of the uploaded file
 * 
 * S3 Structure:
 * - Cases/{caseId}/input/  - Client uploaded files
 * - Cases/{caseId}/output/ - Admin uploaded files (generated outputs)
 */
export async function uploadFileToS3(
  file: File,
  caseId: string,
  fileType: 'input' | 'output'
): Promise<string> {
  const timestamp = Date.now()
  const key = `Cases/${caseId}/${fileType}/${timestamp}-${file.name}`
  
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
    Body: Buffer.from(await file.arrayBuffer()),
    ContentType: file.type
  })
  
  await s3Client.send(command)
  return key
}

/**
 * Generates a pre-signed URL for downloading a file from S3
 * @param s3Key - The S3 key of the file
 * @returns A pre-signed URL valid for 1 hour
 */
export async function generatePresignedUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: s3Key
  })
  
  return getSignedUrl(s3Client, command, { expiresIn: 3600 }) // 1 hour
}
