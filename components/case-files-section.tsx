"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AdditionalFileUploadModal } from "@/components/additional-file-upload-modal"
import { Upload, FileInput, FileOutput, Download } from "lucide-react"
import { File } from "@prisma/client"
import { toast } from "sonner"
import { formatDate } from "@/lib/date-utils"

interface CaseFilesSectionProps {
  caseId: string
  rawFiles: File[]
  outputFiles: File[]
  additionalFiles: File[]
  existingServices: string[]
  isClient: boolean
  caseServices?: Array<{ service?: { name: string; slug: string } }>
  additionalUploads?: Array<{
    id: string
    upload_date: string
    services: string[]
    specific_instructions?: string
    files: File[]
  }>
}

const formatFileSize = (bytes: number | bigint): string => {
  const size = typeof bytes === 'bigint' ? Number(bytes) : bytes
  if (size === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(size) / Math.log(k))
  return parseFloat((size / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const handleFileDownload = async (fileId: string, filename: string) => {
  try {
    const response = await fetch(`/api/files/download/${fileId}`)
    
    if (!response.ok) {
      throw new Error('Failed to get download URL')
    }

    const { downloadUrl } = await response.json()
    
    // Create a temporary link and trigger download
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    link.target = '_blank'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast.success(`Downloading ${filename}`)
  } catch (error) {
    console.error('Download error:', error)
    toast.error('Failed to download file')
  }
}

export function CaseFilesSection({ 
  caseId, 
  rawFiles, 
  outputFiles,
  additionalFiles,
  existingServices, 
  isClient,
  caseServices = [],
  additionalUploads = []
}: CaseFilesSectionProps) {
  const [showAddFilesModal, setShowAddFilesModal] = useState(false)

  // If we have additionalUploads data, use that; otherwise fall back to grouping by date
  const hasAdditionalUploadsData = additionalUploads.length > 0
  
  // Group additional files by date folder (fallback method)
  const groupedAdditionalFiles = !hasAdditionalUploadsData ? additionalFiles.reduce((acc, file) => {
    // Extract date from S3 key: cases/{caseNumber}/additional files-MM-DD-YY/
    const match = file.s3_key.match(/additional files-(\d{2}-\d{2}-\d{2})/)
    const dateFolder = match ? match[1] : 'unknown'
    
    if (!acc[dateFolder]) {
      acc[dateFolder] = []
    }
    acc[dateFolder].push(file)
    return acc
  }, {} as Record<string, File[]>) : {}

  return (
    <div className="space-y-6">
      {/* Input Files Section */}
      <Card className="shadow-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileInput className="w-5 h-5 text-primary" />
              Input Files ({rawFiles.length})
            </CardTitle>
            {isClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddFilesModal(true)}
                className="flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Add Files
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {rawFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rawFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted/70 transition-colors group"
                >
                  <FileInput className="w-5 h-5 text-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate" title={file.original_filename || file.filename}>
                      {file.original_filename || file.filename}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFileDownload(file.id, file.original_filename || file.filename)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileInput className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No Input Files</p>
              <p className="text-muted-foreground">
                No input files have been uploaded yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Files Modal */}
      {isClient && (
        <AdditionalFileUploadModal
          isOpen={showAddFilesModal}
          onClose={() => setShowAddFilesModal(false)}
          caseId={caseId}
          existingServices={existingServices}
        />
      )}

      {/* Additional Files Cards - One card per upload */}
      {hasAdditionalUploadsData ? (
        // Use additionalUploads data with services and instructions
        additionalUploads
          .sort((a, b) => new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime())
          .map((upload) => {
            const uploadDate = new Date(upload.upload_date)
            const dateStr = formatDate(uploadDate) // Already in MM/DD/YY format
            
            // Convert service slugs to readable names
            const serviceNameMap: Record<string, string> = {
              'medical-chronology': 'Medical Chronology',
              'narrative-summary': 'Narrative Summary',
              'demand-letter': 'Demand Letter',
              'life-care-plan': 'Life Care Plan',
              'medical-opinion': 'Medical Opinion',
              'medical-expenses': 'Medical Expenses Summary',
              'hyperlinks': 'Hyperlinks',
              'bookmarks': 'Bookmarks',
              'med-a-word': 'Med-A-Word',
              'deposition-prep': 'Deposition Preparation',
              'lcp-support': 'Life Care Plans (LCP) Support'
            }
            
            return (
              <Card key={upload.id} className="shadow-card border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-purple-600" />
                    Additional Files - {dateStr}
                  </CardTitle>
                  {/* Services badges */}
                  {upload.services && upload.services.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      <span className="text-sm font-medium text-muted-foreground">Services:</span>
                      {upload.services.map((serviceSlug: string, idx: number) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/20 border-purple-300 dark:border-purple-700">
                          {serviceNameMap[serviceSlug] || serviceSlug}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {/* Specific Instructions */}
                  {upload.specific_instructions && upload.specific_instructions.trim() && (
                    <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                      <p className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-1">Specific Instructions:</p>
                      <p className="text-sm text-purple-700 dark:text-purple-300 whitespace-pre-wrap">{upload.specific_instructions}</p>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {upload.files.length} file{upload.files.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {upload.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors group"
                      >
                        <Upload className="w-5 h-5 text-purple-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate" title={file.original_filename || file.filename}>
                            {file.original_filename || file.filename}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span>{formatDate(file.created_at)}</span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleFileDownload(file.id, file.original_filename || file.filename)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Download file"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })
      ) : (
        // Fallback: Group by date folder from S3 key
        Object.entries(groupedAdditionalFiles)
          .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
          .map(([dateFolder, files]) => {
            // dateFolder is in MM-DD-YY format from S3 key, display as MM/DD/YY
            const displayDate = dateFolder.replace(/-/g, '/')
            
            return (
            <Card key={dateFolder} className="shadow-card border-purple-200 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-600" />
                  Additional Files - {displayDate}
                </CardTitle>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">
                    {files.length} file{files.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-950/30 transition-colors group"
                    >
                      <Upload className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate" title={file.original_filename || file.filename}>
                          {file.original_filename || file.filename}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>•</span>
                          <span>{formatDate(file.created_at)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleFileDownload(file.id, file.original_filename || file.filename)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )
          })
      )}

      {/* Output Files Section */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileOutput className="w-5 h-5 text-green-600" />
            Output Files ({outputFiles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {outputFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {outputFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors group"
                >
                  <FileOutput className="w-5 h-5 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate" title={file.original_filename || file.filename}>
                      {file.original_filename || file.filename}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{formatFileSize(file.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFileDownload(file.id, file.original_filename || file.filename)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Download file"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileOutput className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No Output Files</p>
              <p className="text-muted-foreground">
                No output files have been generated yet.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

