/**
 * Chunked File Upload Utility
 * 
 * Handles uploading large files (up to 15GB) in chunks to avoid body size limits
 */

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks
const MAX_FILE_SIZE = 15 * 1024 * 1024 * 1024 // 15GB max
const SMALL_FILE_THRESHOLD = 10 * 1024 * 1024 // 10MB - files smaller than this use direct upload

export interface ChunkedUploadOptions {
  file: File
  s3Key: string
  caseId?: string // Optional case ID for creating file record
  onProgress?: (progress: number) => void
  onChunkComplete?: (chunkNumber: number, totalChunks: number) => void
}

export interface ChunkedUploadResult {
  success: boolean
  uploadId: string
  s3Key: string
  totalChunks: number
  fileSize: number
  error?: string
}

/**
 * Generate unique upload ID
 */
function generateUploadId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * Upload a file in chunks
 */
export async function uploadFileInChunks({
  file,
  s3Key,
  caseId,
  onProgress,
  onChunkComplete
}: ChunkedUploadOptions): Promise<ChunkedUploadResult> {
  
  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of 15GB`)
  }

  // Generate unique upload ID
  const uploadId = generateUploadId()
  
  // Calculate number of chunks
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  
  console.log(`[CHUNKED_UPLOAD] Starting upload: ${file.name}`)
  console.log(`[CHUNKED_UPLOAD] File size: ${formatFileSize(file.size)}`)
  console.log(`[CHUNKED_UPLOAD] Total chunks: ${totalChunks}`)
  console.log(`[CHUNKED_UPLOAD] Upload ID: ${uploadId}`)

  try {
    // Upload each chunk
    for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
      const start = chunkNumber * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      console.log(`[CHUNKED_UPLOAD] Uploading chunk ${chunkNumber + 1}/${totalChunks} (${formatFileSize(chunk.size)})`)

      // Upload chunk with retry logic
      let retries = 3
      let uploaded = false
      
      while (retries > 0 && !uploaded) {
        try {
          const response = await fetch('/api/upload/chunk', {
            method: 'POST',
            headers: {
              'X-Upload-Id': uploadId,
              'X-Chunk-Number': chunkNumber.toString(),
              'X-S3-Key': s3Key,
              'X-Total-Chunks': totalChunks.toString(),
              'X-File-Name': file.name,
              'X-File-Size': file.size.toString(),
            },
            body: chunk
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to upload chunk')
          }

          uploaded = true
          
          // Update progress
          const progress = ((chunkNumber + 1) / totalChunks) * 100
          onProgress?.(progress)
          onChunkComplete?.(chunkNumber + 1, totalChunks)
          
        } catch (error) {
          retries--
          if (retries === 0) {
            throw error
          }
          console.warn(`[CHUNKED_UPLOAD] Chunk ${chunkNumber} failed, retrying... (${retries} attempts left)`)
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

    console.log(`[CHUNKED_UPLOAD] All chunks uploaded, assembling file...`)

    // Assemble chunks into final file
    const assembleResponse = await fetch('/api/upload/assemble', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        uploadId,
        s3Key,
        totalChunks,
        filename: file.name,
        mimeType: file.type,
        fileSize: file.size,
        caseId // Pass caseId for database record creation
      })
    })

    if (!assembleResponse.ok) {
      const error = await assembleResponse.json()
      throw new Error(error.error || 'Failed to assemble file')
    }

    const result = await assembleResponse.json()
    console.log(`[CHUNKED_UPLOAD] Upload complete:`, result)

    return {
      success: true,
      uploadId,
      s3Key,
      totalChunks,
      fileSize: file.size
    }

  } catch (error) {
    console.error('[CHUNKED_UPLOAD] Upload failed:', error)
    
    // Attempt cleanup on failure
    try {
      await fetch('/api/upload/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadId })
      })
    } catch (cleanupError) {
      console.error('[CHUNKED_UPLOAD] Cleanup failed:', cleanupError)
    }
    
    return {
      success: false,
      uploadId,
      s3Key,
      totalChunks,
      fileSize: file.size,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Determine if a file should use chunked upload
 */
export function shouldUseChunkedUpload(fileSize: number): boolean {
  // Use chunked upload for files larger than 10MB
  return fileSize > SMALL_FILE_THRESHOLD
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number): { valid: boolean; error?: string } {
  if (fileSize === 0) {
    return { valid: false, error: 'File is empty' }
  }
  
  if (fileSize > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size (${formatFileSize(fileSize)}) exceeds maximum allowed size of ${formatFileSize(MAX_FILE_SIZE)}` 
    }
  }
  
  return { valid: true }
}
