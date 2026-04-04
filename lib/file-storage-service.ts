import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

// S3 Client Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
  }
})

// Storage configuration
export const DOWNLOAD_LINK_EXPIRY = 24 * 60 * 60 // 24 hours in seconds

export interface FileStorageMetadata {
  originalFileName: string
  uploadTimestamp: Date
  fileSize: number
  mimeType: string
  uploadedBy: string
  caseId: string
  uploadType: 'initial' | 'additional'
  uniqueId: string
}

export interface StorageLocation {
  firmId: string
  caseId: string
  uploadType: 'initial' | 'additional' | 'outputs'
}

export interface SecureDownloadLink {
  url: string
  expiresAt: Date
  fileName: string
  fileSize?: number
}

export interface FileStorageResult {
  success: boolean
  s3Key?: string
  uniqueFileName?: string
  metadata?: FileStorageMetadata
  error?: string
}

/**
 * Service for organizing file storage with proper directory structure,
 * unique filename generation, metadata preservation, and secure downloads
 */
export class FileStorageService {
  /**
   * Generates the S3 directory structure for file storage
   * @param location - Storage location details
   * @returns S3 directory path
   */
  static generateDirectoryPath(location: StorageLocation): string {
    const { firmId, caseId, uploadType } = location
    
    // Validate inputs
    if (!firmId || !caseId || !uploadType) {
      throw new Error('Invalid storage location: firmId, caseId, and uploadType are required')
    }
    
    // Sanitize firmId and caseId for safe S3 usage
    const sanitizedFirmId = this.sanitizePathComponent(firmId)
    const sanitizedCaseId = this.sanitizePathComponent(caseId)
    
    // Generate directory structure: firmId/caseId/uploadType/
    const directoryMap = {
      initial: 'uploads',
      additional: 'additional_uploads',
      outputs: 'outputs'
    }
    
    const directory = directoryMap[uploadType]
    return `firms/${sanitizedFirmId}/${sanitizedCaseId}/${directory}`
  }

  /**
   * Generates a unique filename while preserving the original extension
   * @param originalFileName - The original file name
   * @param uploadTimestamp - Optional timestamp (defaults to current time)
   * @returns Unique filename with preserved extension
   */
  static generateUniqueFileName(originalFileName: string, uploadTimestamp?: Date): string {
    if (!originalFileName) {
      throw new Error('Original filename is required')
    }
    
    const timestamp = uploadTimestamp || new Date()
    const uniqueId = uuidv4()
    
    // Extract file extension
    const lastDotIndex = originalFileName.lastIndexOf('.')
    const extension = lastDotIndex !== -1 ? originalFileName.substring(lastDotIndex) : ''
    const nameWithoutExtension = lastDotIndex !== -1 ? originalFileName.substring(0, lastDotIndex) : originalFileName
    
    // Generate unique filename: timestamp-uniqueId-originalName.ext
    const timestampStr = timestamp.getTime().toString()
    const sanitizedName = this.sanitizeFileName(nameWithoutExtension)
    
    return `${timestampStr}-${uniqueId}-${sanitizedName}${extension}`
  }

  /**
   * Generates the complete S3 key for a file
   * @param location - Storage location details
   * @param originalFileName - The original file name
   * @param uploadTimestamp - Optional timestamp (defaults to current time)
   * @returns Complete S3 key
   */
  static generateS3Key(location: StorageLocation, originalFileName: string, uploadTimestamp?: Date): string {
    const directoryPath = this.generateDirectoryPath(location)
    const uniqueFileName = this.generateUniqueFileName(originalFileName, uploadTimestamp)
    
    return `${directoryPath}/${uniqueFileName}`
  }

  /**
   * Stores file metadata in S3 object metadata
   * @param s3Key - The S3 key for the file
   * @param metadata - File metadata to store
   * @param fileBuffer - The file content buffer
   * @returns Storage result
   */
  static async storeFileWithMetadata(
    s3Key: string,
    metadata: FileStorageMetadata,
    fileBuffer: Buffer
  ): Promise<FileStorageResult> {
    try {
      // Prepare S3 metadata (all values must be strings)
      const s3Metadata = {
        originalFileName: metadata.originalFileName,
        uploadTimestamp: metadata.uploadTimestamp.toISOString(),
        fileSize: metadata.fileSize.toString(),
        mimeType: metadata.mimeType,
        uploadedBy: metadata.uploadedBy,
        caseId: metadata.caseId,
        uploadType: metadata.uploadType,
        uniqueId: metadata.uniqueId
      }

      // Upload file to S3 with metadata
      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: metadata.mimeType,
        Metadata: s3Metadata,
        // Add additional headers for better file handling
        ContentDisposition: `attachment; filename="${metadata.originalFileName}"`,
        CacheControl: 'private, max-age=0'
      })

      await s3Client.send(command)

      return {
        success: true,
        s3Key,
        uniqueFileName: this.extractFileNameFromS3Key(s3Key),
        metadata
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store file with metadata'
      }
    }
  }

  /**
   * Retrieves file metadata from S3
   * @param s3Key - The S3 key for the file
   * @returns File metadata or null if not found
   */
  static async getFileMetadata(s3Key: string): Promise<FileStorageMetadata | null> {
    try {
      const command = new HeadObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: s3Key
      })

      const response = await s3Client.send(command)
      
      if (!response.Metadata) {
        return null
      }

      // Parse metadata from S3 response
      const metadata: FileStorageMetadata = {
        originalFileName: response.Metadata.originalfilename || '',
        uploadTimestamp: new Date(response.Metadata.uploadtimestamp || ''),
        fileSize: parseInt(response.Metadata.filesize || '0'),
        mimeType: response.Metadata.mimetype || '',
        uploadedBy: response.Metadata.uploadedby || '',
        caseId: response.Metadata.caseid || '',
        uploadType: (response.Metadata.uploadtype as 'initial' | 'additional') || 'initial',
        uniqueId: response.Metadata.uniqueid || ''
      }

      return metadata
    } catch (error) {
      console.error('Failed to retrieve file metadata:', error)
      return null
    }
  }

  /**
   * Generates a secure download link that expires after 24 hours
   * @param s3Key - The S3 key for the file
   * @param customFileName - Optional custom filename for download
   * @returns Secure download link with expiration
   */
  static async generateSecureDownloadLink(s3Key: string, customFileName?: string): Promise<SecureDownloadLink | null> {
    try {
      // Get file metadata first
      const metadata = await this.getFileMetadata(s3Key)
      
      const command = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: s3Key,
        // Set response headers for download
        ResponseContentDisposition: customFileName 
          ? `attachment; filename="${customFileName}"`
          : metadata?.originalFileName 
            ? `attachment; filename="${metadata.originalFileName}"`
            : undefined
      })

      // Generate presigned URL with 24-hour expiration
      const url = await getSignedUrl(s3Client, command, { 
        expiresIn: DOWNLOAD_LINK_EXPIRY 
      })

      const expiresAt = new Date(Date.now() + (DOWNLOAD_LINK_EXPIRY * 1000))

      return {
        url,
        expiresAt,
        fileName: customFileName || metadata?.originalFileName || this.extractFileNameFromS3Key(s3Key),
        fileSize: metadata?.fileSize
      }
    } catch (error) {
      console.error('Failed to generate secure download link:', error)
      return null
    }
  }

  /**
   * Validates that a file exists in the expected storage structure
   * @param s3Key - The S3 key to validate
   * @returns True if file exists and structure is valid
   */
  static async validateFileExists(s3Key: string): Promise<boolean> {
    try {
      // Check if S3 key follows expected structure
      if (!this.isValidS3KeyStructure(s3Key)) {
        return false
      }

      // Check if file exists in S3
      const command = new HeadObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: s3Key
      })

      await s3Client.send(command)
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Validates S3 key structure follows the expected pattern
   * @param s3Key - The S3 key to validate
   * @returns True if structure is valid
   */
  static isValidS3KeyStructure(s3Key: string): boolean {
    // Expected pattern: firms/{firmId}/{caseId}/{uploads|additional_uploads|outputs}/{filename}
    const pattern = /^firms\/[^\/]+\/[^\/]+\/(uploads|additional_uploads|outputs)\/[^\/]+$/
    return pattern.test(s3Key)
  }

  /**
   * Extracts the filename from an S3 key
   * @param s3Key - The S3 key
   * @returns The filename portion
   */
  static extractFileNameFromS3Key(s3Key: string): string {
    const parts = s3Key.split('/')
    return parts[parts.length - 1] || ''
  }

  /**
   * Extracts storage location details from an S3 key
   * @param s3Key - The S3 key
   * @returns Storage location details or null if invalid
   */
  static extractStorageLocation(s3Key: string): StorageLocation | null {
    if (!this.isValidS3KeyStructure(s3Key)) {
      return null
    }

    const parts = s3Key.split('/')
    if (parts.length < 5) {
      return null
    }

    const firmId = parts[1]
    const caseId = parts[2]
    const uploadTypeDir = parts[3]

    // Map directory names back to upload types
    const uploadTypeMap: Record<string, 'initial' | 'additional' | 'outputs'> = {
      'uploads': 'initial',
      'additional_uploads': 'additional',
      'outputs': 'outputs'
    }

    const uploadType = uploadTypeMap[uploadTypeDir]
    if (!uploadType) {
      return null
    }

    return { firmId, caseId, uploadType }
  }

  /**
   * Sanitizes a filename for safe storage
   * @param fileName - The filename to sanitize
   * @returns Sanitized filename
   */
  private static sanitizeFileName(fileName: string): string {
    // Remove or replace unsafe characters
    return fileName
      .replace(/[<>:"/\\|?*]/g, '_') // Replace unsafe characters with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 100) // Limit length to 100 characters
  }

  /**
   * Sanitizes a path component (firmId, caseId) for safe S3 usage
   * @param component - The path component to sanitize
   * @returns Sanitized path component
   */
  private static sanitizePathComponent(component: string): string {
    // Remove or replace unsafe characters for S3 paths
    let sanitized = component
      .replace(/[<>:"/\\|?*]/g, '_') // Replace unsafe characters with underscore
      .replace(/\s+/g, '_') // Replace spaces with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 50) // Limit length to 50 characters for path components
    
    // Ensure we don't end up with an empty string
    if (!sanitized || sanitized.length === 0) {
      sanitized = 'sanitized'
    }
    
    return sanitized
  }

  /**
   * Lists all files in a case directory
   * @param firmId - The firm ID
   * @param caseId - The case ID
   * @param uploadType - Optional upload type filter
   * @returns Array of S3 keys for files in the case
   */
  static async listCaseFiles(
    firmId: string, 
    caseId: string, 
    uploadType?: 'initial' | 'additional' | 'outputs'
  ): Promise<string[]> {
    try {
      const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')
      
      let prefix: string
      if (uploadType) {
        const location: StorageLocation = { firmId, caseId, uploadType }
        prefix = `${this.generateDirectoryPath(location)}/`
      } else {
        prefix = `firms/${firmId}/${caseId}/`
      }

      const command = new ListObjectsV2Command({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Prefix: prefix
      })

      const response = await s3Client.send(command)
      
      return response.Contents?.map(obj => obj.Key!).filter(key => key) || []
    } catch (error) {
      console.error('Failed to list case files:', error)
      return []
    }
  }

  /**
   * Gets the total storage size for a case
   * @param firmId - The firm ID
   * @param caseId - The case ID
   * @returns Total size in bytes
   */
  static async getCaseStorageSize(firmId: string, caseId: string): Promise<number> {
    try {
      const files = await this.listCaseFiles(firmId, caseId)
      let totalSize = 0

      for (const s3Key of files) {
        const metadata = await this.getFileMetadata(s3Key)
        if (metadata) {
          totalSize += metadata.fileSize
        }
      }

      return totalSize
    } catch (error) {
      console.error('Failed to calculate case storage size:', error)
      return 0
    }
  }
}