import { z } from 'zod'
import { ChunkedUploadService } from './chunked-upload-service'
import { FileStorageService, type StorageLocation } from './file-storage-service'

// Enhanced file size limit: 15GB in bytes
export const MAX_FILE_SIZE = 15 * 1024 * 1024 * 1024 // 15GB

// Allow all file types - no restrictions
export const ALLOWED_MIME_TYPES = [] as const // Empty array means all types allowed

// File type categories for better error messages
export const FILE_TYPE_CATEGORIES = {
  excel: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  cdImage: ['application/x-iso9660-image', 'application/x-cd-image'],
  iso: ['application/x-iso9660-image', 'application/x-cd-image'],
  dicom: ['application/dicom', 'application/x-dicom'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  binary: ['application/octet-stream'] // For generic binary files like .img
} as const

export interface FileValidationResult {
  valid: boolean
  error?: string
  errorCode?: string
}

export interface FileUploadResult {
  success: boolean
  uploadId?: string
  s3Key?: string
  useChunkedUpload: boolean
  error?: string
  errorCode?: string
}

export interface FileMetadata {
  originalName: string
  size: number
  mimeType: string
  extension: string
}

/**
 * Enhanced file validation service for the Quantyx Dashboard
 * Supports all file types up to 15GB
 */
export class FileUploadService {
  /**
   * Validates if a file meets all upload requirements
   * @param file - The file to validate
   * @returns Validation result with error details if invalid
   */
  static validateFile(file: File): FileValidationResult {
    // Check if file is empty first
    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty. Please select a valid file.',
        errorCode: 'FILE_EMPTY'
      }
    }

    // Check file size
    if (!this.isValidFileSize(file.size)) {
      return {
        valid: false,
        error: `File size exceeds the maximum limit of ${this.formatFileSize(MAX_FILE_SIZE)}. Your file is ${this.formatFileSize(file.size)}.`,
        errorCode: 'FILE_TOO_LARGE'
      }
    }

    // Check file type
    if (!this.isValidFileType(file.type, file.name)) {
      return {
        valid: false,
        error: this.getFileTypeError(file.type, file.name),
        errorCode: 'INVALID_FILE_TYPE'
      }
    }

    return { valid: true }
  }

  /**
   * Validates if a file type is allowed
   * All file types are now allowed - no restrictions
   * @param mimeType - The MIME type of the file
   * @param fileName - The file name (used for extension-based validation)
   * @returns True (always allows all file types)
   */
  static isValidFileType(mimeType: string, fileName: string): boolean {
    // Accept all file types
    return true
  }

  /**
   * Validates if a file size is within limits
   * @param size - File size in bytes
   * @returns True if file size is valid
   */
  static isValidFileSize(size: number): boolean {
    return size > 0 && size <= MAX_FILE_SIZE
  }

  /**
   * Determines if a file should use chunked upload
   * @param size - File size in bytes
   * @returns True if file should use chunked upload (>100MB)
   */
  static shouldUseChunkedUpload(size: number): boolean {
    const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024 // 100MB
    return size > CHUNKED_UPLOAD_THRESHOLD
  }

  /**
   * Determines if upload progress should be shown
   * @param size - File size in bytes
   * @returns True if progress should be shown (>10MB)
   */
  static shouldShowProgress(size: number): boolean {
    const PROGRESS_THRESHOLD = 10 * 1024 * 1024 // 10MB
    return size > PROGRESS_THRESHOLD
  }

  /**
   * Extracts file metadata
   * @param file - The file to extract metadata from
   * @returns File metadata object
   */
  static extractFileMetadata(file: File): FileMetadata {
    return {
      originalName: file.name,
      size: file.size,
      mimeType: file.type,
      extension: this.getFileExtension(file.name)
    }
  }

  /**
   * Gets file extension from filename
   * @param fileName - The file name
   * @returns File extension including the dot
   */
  private static getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : ''
  }

  /**
   * Formats file size in human-readable format
   * @param bytes - File size in bytes
   * @returns Formatted file size string
   */
  private static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let size = bytes
    let unitIndex = 0

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }

    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
  }

  /**
   * Generates descriptive error message for invalid file types
   * @param mimeType - The MIME type of the file
   * @param fileName - The file name
   * @returns Descriptive error message
   */
  private static getFileTypeError(mimeType: string, fileName: string): string {
    const extension = this.getFileExtension(fileName).toLowerCase()
    
    // This should never be called since all file types are allowed
    return `Invalid file type "${extension || mimeType}". All file types are supported.`
  }

  /**
   * Gets the category of a file type for better error handling
   * @param mimeType - The MIME type of the file
   * @returns File type category or null if not found
   */
  static getFileTypeCategory(mimeType: string): keyof typeof FILE_TYPE_CATEGORIES | null {
    for (const [category, types] of Object.entries(FILE_TYPE_CATEGORIES)) {
      if (types.includes(mimeType as any)) {
        return category as keyof typeof FILE_TYPE_CATEGORIES
      }
    }
    return null
  }

  /**
   * Gets upload progress for chunked uploads
   * @param uploadId - The upload ID to track
   * @returns Upload progress or null if not found
   */
  static getUploadProgress(uploadId: string) {
    return ChunkedUploadService.getUploadProgress(uploadId)
  }

  /**
   * Cancels an active chunked upload
   * @param uploadId - The upload ID to cancel
   * @returns True if cancellation was successful
   */
  static cancelUpload(uploadId: string): boolean {
    return ChunkedUploadService.cancelUpload(uploadId)
  }

  /**
   * Generates a secure download link for a file
   * @param s3Key - The S3 key for the file
   * @param customFileName - Optional custom filename for download
   * @returns Secure download link or null if failed
   */
  static async generateDownloadLink(s3Key: string, customFileName?: string) {
    return FileStorageService.generateSecureDownloadLink(s3Key, customFileName)
  }

  /**
   * Gets file metadata from storage
   * @param s3Key - The S3 key for the file
   * @returns File metadata or null if not found
   */
  static async getFileMetadata(s3Key: string) {
    return FileStorageService.getFileMetadata(s3Key)
  }

  /**
   * Validates that a file exists in storage
   * @param s3Key - The S3 key to validate
   * @returns True if file exists
   */
  static async validateFileExists(s3Key: string): Promise<boolean> {
    return FileStorageService.validateFileExists(s3Key)
  }
}

// Zod schema for enhanced file validation
export const enhancedFileUploadSchema = z.object({
  file: z.instanceof(File)
    .refine(
      (file) => FileUploadService.isValidFileSize(file.size),
      (file) => ({
        message: `File size exceeds the maximum limit of ${FileUploadService['formatFileSize'](MAX_FILE_SIZE)}. Your file is ${FileUploadService['formatFileSize'](file.size)}.`
      })
    )
    .refine(
      (file) => FileUploadService.isValidFileType(file.type, file.name),
      (file) => ({
        message: FileUploadService['getFileTypeError'](file.type, file.name)
      })
    ),
  caseId: z.string().uuid('Invalid case ID'),
  uploadType: z.enum(['initial', 'additional']).default('initial')
})

export type EnhancedFileUploadInput = z.infer<typeof enhancedFileUploadSchema>