import { v4 as uuidv4 } from 'uuid'
import { FileStorageService, type StorageLocation, type FileStorageMetadata } from './file-storage-service'

// Chunked upload configuration
export const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks
export const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024 // 100MB
export const MAX_CONCURRENT_CHUNKS = 3 // Maximum concurrent chunk uploads

export interface ChunkInfo {
  chunkNumber: number
  chunkSize: number
  totalChunks: number
  uploadId: string
  s3Key: string
}

export interface UploadProgress {
  uploadId: string
  fileName: string
  totalSize: number
  uploadedBytes: number
  percentage: number
  chunksCompleted: number
  totalChunks: number
  status: 'initializing' | 'uploading' | 'assembling' | 'completed' | 'failed'
  error?: string
}

export interface ChunkedUploadResult {
  success: boolean
  uploadId: string
  s3Key?: string
  error?: string
}

/**
 * Service for handling chunked file uploads for large files (>100MB)
 * Provides progress tracking and reliable upload for files up to 15GB
 */
export class ChunkedUploadService {
  private static uploadProgress = new Map<string, UploadProgress>()
  private static activeUploads = new Map<string, AbortController>()

  /**
   * Initiates a chunked upload for a large file
   * @param file - The file to upload
   * @param caseId - The case ID this file belongs to
   * @param firmId - The firm ID this file belongs to
   * @param uploadType - Type of upload (initial or additional)
   * @returns Upload result with upload ID for tracking
   */
  static async initiateChunkedUpload(
    file: File,
    caseId: string,
    firmId: string,
    uploadType: 'initial' | 'additional' = 'initial'
  ): Promise<ChunkedUploadResult> {
    try {
      const uploadId = uuidv4()
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      
      // Generate S3 key using the file storage service
      const location: StorageLocation = { firmId, caseId, uploadType }
      const s3Key = FileStorageService.generateS3Key(location, file.name)
      
      // Initialize progress tracking
      const progress: UploadProgress = {
        uploadId,
        fileName: file.name,
        totalSize: file.size,
        uploadedBytes: 0,
        percentage: 0,
        chunksCompleted: 0,
        totalChunks,
        status: 'initializing'
      }
      
      this.uploadProgress.set(uploadId, progress)
      
      // Create abort controller for cancellation
      const abortController = new AbortController()
      this.activeUploads.set(uploadId, abortController)
      
      // Start the chunked upload process
      this.performChunkedUpload(file, uploadId, s3Key, firmId, abortController.signal)
        .catch(error => {
          this.updateProgress(uploadId, {
            status: 'failed',
            error: error.message
          })
        })
      
      return {
        success: true,
        uploadId,
        s3Key
      }
    } catch (error) {
      return {
        success: false,
        uploadId: '',
        error: error instanceof Error ? error.message : 'Failed to initiate chunked upload'
      }
    }
  }

  /**
   * Gets the current upload progress for a given upload ID
   * @param uploadId - The upload ID to check progress for
   * @returns Current upload progress or null if not found
   */
  static getUploadProgress(uploadId: string): UploadProgress | null {
    return this.uploadProgress.get(uploadId) || null
  }

  /**
   * Cancels an active chunked upload
   * @param uploadId - The upload ID to cancel
   * @returns True if cancellation was successful
   */
  static cancelUpload(uploadId: string): boolean {
    const abortController = this.activeUploads.get(uploadId)
    if (abortController) {
      abortController.abort()
      this.activeUploads.delete(uploadId)
      this.updateProgress(uploadId, {
        status: 'failed',
        error: 'Upload cancelled by user'
      })
      return true
    }
    return false
  }

  /**
   * Cleans up completed or failed uploads from memory
   * @param uploadId - The upload ID to clean up
   */
  static cleanupUpload(uploadId: string): void {
    this.uploadProgress.delete(uploadId)
    this.activeUploads.delete(uploadId)
  }

  /**
   * Performs the actual chunked upload process
   * @param file - The file to upload
   * @param uploadId - The upload ID for tracking
   * @param s3Key - The S3 key for the file
   * @param firmId - The firm ID for the file
   * @param signal - Abort signal for cancellation
   */
  private static async performChunkedUpload(
    file: File,
    uploadId: string,
    s3Key: string,
    firmId: string,
    signal: AbortSignal
  ): Promise<void> {
    try {
      this.updateProgress(uploadId, { status: 'uploading' })
      
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
      const chunkPromises: Promise<void>[] = []
      const uploadedChunks = new Set<number>()
      
      // Create chunks and upload them with concurrency control
      for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
        const chunkPromise = this.uploadChunk(
          file,
          chunkNumber,
          uploadId,
          s3Key,
          signal,
          uploadedChunks
        )
        
        chunkPromises.push(chunkPromise)
        
        // Control concurrency
        if (chunkPromises.length >= MAX_CONCURRENT_CHUNKS) {
          await Promise.race(chunkPromises)
          // Remove completed promises
          for (let i = chunkPromises.length - 1; i >= 0; i--) {
            if (await this.isPromiseResolved(chunkPromises[i])) {
              chunkPromises.splice(i, 1)
            }
          }
        }
      }
      
      // Wait for all remaining chunks to complete
      await Promise.all(chunkPromises)
      
      if (signal.aborted) {
        throw new Error('Upload was cancelled')
      }
      
      // Assemble chunks on the server
      this.updateProgress(uploadId, { status: 'assembling' })
      await this.assembleChunks(uploadId, s3Key, totalChunks)
      
      // Mark as completed
      this.updateProgress(uploadId, { 
        status: 'completed',
        percentage: 100,
        uploadedBytes: file.size
      })
      
    } catch (error) {
      if (!signal.aborted) {
        throw error
      }
    }
  }

  /**
   * Uploads a single chunk of the file
   * @param file - The original file
   * @param chunkNumber - The chunk number (0-based)
   * @param uploadId - The upload ID for tracking
   * @param s3Key - The S3 key for the file
   * @param signal - Abort signal for cancellation
   * @param uploadedChunks - Set to track completed chunks
   */
  private static async uploadChunk(
    file: File,
    chunkNumber: number,
    uploadId: string,
    s3Key: string,
    signal: AbortSignal,
    uploadedChunks: Set<number>
  ): Promise<void> {
    const start = chunkNumber * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)
    
    const chunkKey = `${s3Key}.chunk.${chunkNumber}`
    
    try {
      // Upload chunk to temporary location
      const response = await fetch('/api/upload/chunk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Upload-Id': uploadId,
          'X-Chunk-Number': chunkNumber.toString(),
          'X-S3-Key': chunkKey
        },
        body: chunk,
        signal
      })
      
      if (!response.ok) {
        throw new Error(`Chunk ${chunkNumber} upload failed: ${response.statusText}`)
      }
      
      // Mark chunk as completed
      uploadedChunks.add(chunkNumber)
      
      // Update progress
      const progress = this.uploadProgress.get(uploadId)
      if (progress) {
        const newUploadedBytes = uploadedChunks.size * CHUNK_SIZE
        const actualUploadedBytes = Math.min(newUploadedBytes, progress.totalSize)
        
        this.updateProgress(uploadId, {
          uploadedBytes: actualUploadedBytes,
          percentage: Math.round((actualUploadedBytes / progress.totalSize) * 100),
          chunksCompleted: uploadedChunks.size
        })
      }
      
    } catch (error) {
      if (!signal.aborted) {
        throw new Error(`Failed to upload chunk ${chunkNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }

  /**
   * Assembles uploaded chunks into the final file
   * @param uploadId - The upload ID
   * @param s3Key - The final S3 key for the assembled file
   * @param totalChunks - Total number of chunks to assemble
   */
  private static async assembleChunks(
    uploadId: string,
    s3Key: string,
    totalChunks: number
  ): Promise<void> {
    const response = await fetch('/api/upload/assemble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadId,
        s3Key,
        totalChunks
      })
    })
    
    if (!response.ok) {
      throw new Error(`Failed to assemble chunks: ${response.statusText}`)
    }
  }

  /**
   * Updates the progress for a given upload
   * @param uploadId - The upload ID
   * @param updates - Progress updates to apply
   */
  private static updateProgress(uploadId: string, updates: Partial<UploadProgress>): void {
    const current = this.uploadProgress.get(uploadId)
    if (current) {
      this.uploadProgress.set(uploadId, { ...current, ...updates })
    }
  }

  /**
   * Checks if a promise has resolved (helper for concurrency control)
   * @param promise - The promise to check
   * @returns True if the promise has resolved
   */
  private static async isPromiseResolved(promise: Promise<any>): Promise<boolean> {
    try {
      await Promise.race([
        promise,
        new Promise(resolve => setTimeout(resolve, 0))
      ])
      return true
    } catch {
      return true // Consider failed promises as resolved for cleanup
    }
  }

  /**
   * Gets all active uploads (for monitoring/debugging)
   * @returns Array of active upload progress objects
   */
  static getActiveUploads(): UploadProgress[] {
    return Array.from(this.uploadProgress.values())
  }

  /**
   * Determines if a file should use chunked upload based on size
   * @param fileSize - Size of the file in bytes
   * @returns True if file should use chunked upload
   */
  static shouldUseChunkedUpload(fileSize: number): boolean {
    return fileSize > CHUNKED_UPLOAD_THRESHOLD
  }

  /**
   * Calculates optimal chunk size based on file size
   * @param fileSize - Size of the file in bytes
   * @returns Optimal chunk size in bytes
   */
  static getOptimalChunkSize(fileSize: number): number {
    // For very large files, use larger chunks to reduce overhead
    if (fileSize > 5 * 1024 * 1024 * 1024) { // > 5GB
      return 10 * 1024 * 1024 // 10MB chunks
    } else if (fileSize > 1024 * 1024 * 1024) { // > 1GB
      return 8 * 1024 * 1024 // 8MB chunks
    }
    return CHUNK_SIZE // Default 5MB chunks
  }
}