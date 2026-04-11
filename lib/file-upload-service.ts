import { z } from 'zod'
import { ChunkedUploadService } from './chunked-upload-service'
import { FileStorageService, type StorageLocation } from './file-storage-service'

// Enhanced file size limit: 15GB in bytes
export const MAX_FILE_SIZE = 15 * 1024 * 1024 * 1024 // 15GB

// SECURITY FIX: Whitelist allowed file types instead of allowing all
// Medical and legal document types only
export const ALLOWED_MIME_TYPES = [
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-word',
  'application/rtf',
  'text/plain',
  'text/rtf',
  
  // Spreadsheets
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/bmp',
  'image/tiff',
  'image/webp',
  
  // Medical imaging
  'application/dicom',
  'application/x-dicom',
  
  // Archives (for medical records)
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  
  // CD/ISO images (for medical records)
  'application/x-iso9660-image',
  'application/x-cd-image',
  
  // Generic binary (for .img files)
  'application/octet-stream'
] as const

// SECURITY: Dangerous file extensions that should NEVER be allowed
const DANGEROUS_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'scr', 'pif', 'vbs', 'js', 'jse', 'wsf', 'wsh',
  'msi', 'msp', 'scf', 'lnk', 'inf', 'reg', 'dll', 'sys', 'drv', 'cpl',
  'jar', 'app', 'deb', 'rpm', 'dmg', 'pkg', 'sh', 'bash', 'ps1', 'psm1',
  'asp', 'aspx', 'php', 'jsp', 'cgi', 'pl', 'py', 'rb', 'go'
]

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
   * SECURITY FIX: Whitelist approach - only allow specific medical/legal file types
   * @param mimeType - The MIME type of the file
   * @param fileName - The file name (used for extension-based validation)
   * @returns True if file type is allowed
   */
  static isValidFileType(mimeType: string, fileName: string): boolean {
    // First check: Validate file extension for dangerous types
    const extension = this.getFileExtension(fileName).toLowerCase().replace('.', '')
    
    if (DANGEROUS_EXTENSIONS.includes(extension)) {
      console.warn(`[FILE_UPLOAD_SECURITY] Blocked dangerous file extension: ${extension}`)
      return false
    }
    
    // Second check: Validate MIME type against whitelist
    // Special handling for octet-stream (generic binary)
    if (mimeType === 'application/octet-stream') {
      // Only allow octet-stream for specific medical file extensions
      const allowedBinaryExtensions = ['img', 'iso', 'dcm', 'dicom']
      const isAllowedBinary = allowedBinaryExtensions.includes(extension)
      
      if (!isAllowedBinary) {
        console.warn(`[FILE_UPLOAD_SECURITY] Blocked octet-stream with extension: ${extension}`)
        return false
      }
      
      return true
    }
    
    // Check if MIME type is in whitelist
    const isAllowed = ALLOWED_MIME_TYPES.includes(mimeType as any)
    
    if (!isAllowed) {
      console.warn(`[FILE_UPLOAD_SECURITY] Blocked MIME type: ${mimeType} for file: ${fileName}`)
    }
    
    return isAllowed
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
    
    // Check if it's a dangerous extension
    if (DANGEROUS_EXTENSIONS.includes(extension.replace('.', ''))) {
      return `File type "${extension}" is not allowed for security reasons. Executable and script files are blocked.`
    }
    
    // Generic error for other invalid types
    return `File type "${extension || mimeType}" is not supported. Allowed types: PDF, DOC, DOCX, XLS, XLSX, images (JPG, PNG, GIF), medical imaging (DICOM), and archives (ZIP, RAR, ISO).`
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

// Lazy Zod schema for enhanced file validation to avoid module-level evaluation
export const getEnhancedFileUploadSchema = () => z.object({
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

export type EnhancedFileUploadInput = z.infer<ReturnType<typeof getEnhancedFileUploadSchema>>