'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { EnhancedFileUpload } from '@/components/ui/enhanced-file-upload'
import { Upload, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface FileUploadModalProps {
  caseId: string
  trigger?: React.ReactNode
}

export function FileUploadModal({ caseId, trigger }: FileUploadModalProps) {
  const [open, setOpen] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadComplete, setUploadComplete] = useState(false)
  
  const handleFilesSelected = (files: File[]) => {
    setUploadedFiles(files)
    setUploadComplete(false)
  }

  const handleFileUploaded = (file: File, result: any) => {
    // Handle individual file upload completion
    console.log('File uploaded:', file.name, result)
  }

  const handleFileRemoved = (fileId: string) => {
    // Handle file removal
    setUploadComplete(false)
  }
  
  const handleUpload = async () => {
    if (uploadedFiles.length === 0) return
    
    setIsUploading(true)
    
    try {
      const formData = new FormData()
      uploadedFiles.forEach(file => {
        formData.append('files', file)
      })
      formData.append('caseId', caseId)
      
      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }
      
      toast.success(`${uploadedFiles.length} file(s) uploaded successfully`)
      setUploadComplete(true)
      
      // Reset and close after a short delay
      setTimeout(() => {
        setUploadedFiles([])
        setUploadComplete(false)
        setOpen(false)
      }, 1500)
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed'
      toast.error(message)
    } finally {
      setIsUploading(false)
    }
  }
  
  const handleClose = () => {
    if (!isUploading) {
      setUploadedFiles([])
      setUploadComplete(false)
      setOpen(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="professional" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Upload File
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Output Files</DialogTitle>
          <DialogDescription>
            Upload files to this case. Supports Excel, CD images, ISO, DICOM, and ZIP files up to 15GB each.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <EnhancedFileUpload
            onFilesSelected={handleFilesSelected}
            onFileUploaded={handleFileUploaded}
            onFileRemoved={handleFileRemoved}
            maxFiles={5}
            multiple={true}
            showProgress={true}
            autoUpload={false}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.iso,.dcm,.dicom"
            disabled={isUploading}
            className="w-full"
          />
          
          {/* Success Message */}
          {uploadComplete && (
            <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg mt-4">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800">Files uploaded successfully!</p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            {uploadComplete ? 'Close' : 'Cancel'}
          </Button>
          <Button
            variant="professional"
            onClick={handleUpload}
            disabled={uploadedFiles.length === 0 || isUploading || uploadComplete}
          >
            {isUploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {uploadedFiles.length} File{uploadedFiles.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}