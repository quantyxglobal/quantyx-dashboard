'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FileText, Loader2, Download, AlertCircle, CheckCircle, X, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface PdfFile {
  id: string
  file: File
  name: string
  size: number
}

export function PdfMerger() {
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([])
  const [isMerging, setIsMerging] = useState(false)
  const [mergedFile, setMergedFile] = useState<{ name: string; blob: Blob } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    
    if (files.length === 0) return

    // Validate all files are PDFs
    const invalidFiles = files.filter(file => !file.name.toLowerCase().endsWith('.pdf'))
    
    if (invalidFiles.length > 0) {
      toast.error(`Invalid file type: ${invalidFiles[0].name}. Please select only PDF files.`)
      e.target.value = ''
      return
    }

    // Add files to the list (maintaining order)
    const newFiles: PdfFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      name: file.name,
      size: file.size
    }))

    setPdfFiles(prev => [...prev, ...newFiles])
    setMergedFile(null)
    e.target.value = '' // Reset input to allow adding same file again
  }

  const removeFile = (id: string) => {
    setPdfFiles(prev => prev.filter(f => f.id !== id))
  }

  const moveUp = (index: number) => {
    if (index === 0) return
    
    setPdfFiles(prev => {
      const newFiles = [...prev]
      const temp = newFiles[index]
      newFiles[index] = newFiles[index - 1]
      newFiles[index - 1] = temp
      return newFiles
    })
  }

  const moveDown = (index: number) => {
    if (index === pdfFiles.length - 1) return
    
    setPdfFiles(prev => {
      const newFiles = [...prev]
      const temp = newFiles[index]
      newFiles[index] = newFiles[index + 1]
      newFiles[index + 1] = temp
      return newFiles
    })
  }

  const handleMerge = async () => {
    if (pdfFiles.length < 2) {
      toast.error('Please add at least 2 PDF files to merge')
      return
    }

    setIsMerging(true)
    
    try {
      const formData = new FormData()
      
      // Add files in the exact order they appear in the list
      pdfFiles.forEach(({ file }) => {
        formData.append('files', file)
      })

      console.log('[PDF MERGE UI] Merging PDFs in order:', pdfFiles.map(f => f.name))

      const response = await fetch('/api/convert/merge-pdf', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Merge failed')
      }

      // Get the blob from response
      const blob = await response.blob()
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      const fileName = `merged-document-${timestamp}.pdf`

      setMergedFile({ name: fileName, blob })
      toast.success('PDFs merged successfully!')
    } catch (error: any) {
      console.error('Merge error:', error)
      toast.error(error.message || 'Failed to merge PDFs. Please try again.')
    } finally {
      setIsMerging(false)
    }
  }

  const handleDownload = () => {
    if (!mergedFile) return

    const url = URL.createObjectURL(mergedFile.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = mergedFile.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Download started')
  }

  const handleReset = () => {
    setPdfFiles([])
    setMergedFile(null)
  }

  const totalSize = pdfFiles.reduce((acc, file) => acc + file.size, 0)

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>PDF Merger</CardTitle>
            <CardDescription>
              Merge multiple PDF files into a single document in the exact order you specify
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="space-y-3">
          <Label htmlFor="pdf-input" className="text-sm font-medium">
            Select PDF Files
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                id="pdf-input"
                type="file"
                accept=".pdf,application/pdf"
                multiple
                onChange={handleFileChange}
                disabled={isMerging}
                className="block w-full text-sm text-muted-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  file:cursor-pointer cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>
          
          {pdfFiles.length > 0 && (
            <div className="text-sm text-muted-foreground">
              {pdfFiles.length} file{pdfFiles.length !== 1 ? 's' : ''} selected • Total: {(totalSize / 1024 / 1024).toFixed(2)} MB
            </div>
          )}
        </div>

        {/* File List with Reordering */}
        {pdfFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Files to Merge (in order)</Label>
            <div className="space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3 bg-muted/30">
              {pdfFiles.map((pdfFile, index) => (
                <div
                  key={pdfFile.id}
                  className="flex items-center gap-2 p-3 rounded-lg bg-card border hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded bg-primary/10 text-primary text-sm font-medium">
                    {index + 1}
                  </div>
                  <FileText className="h-4 w-4 text-red-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{pdfFile.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(pdfFile.size / 1024).toFixed(2)} KB
                    </div>
                  </div>
                  
                  {/* Reorder buttons */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveUp(index)}
                      disabled={index === 0 || isMerging}
                      className="h-8 w-8 p-0"
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => moveDown(index)}
                      disabled={index === pdfFiles.length - 1 || isMerging}
                      className="h-8 w-8 p-0"
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(pdfFile.id)}
                      disabled={isMerging}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merge Button */}
        <div className="flex justify-center gap-3">
          <Button
            onClick={handleMerge}
            disabled={pdfFiles.length < 2 || isMerging}
            size="lg"
            className="gap-2"
          >
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Merge PDFs
              </>
            )}
          </Button>
          
          {pdfFiles.length > 0 && !isMerging && (
            <Button
              onClick={handleReset}
              variant="outline"
              size="lg"
            >
              Clear All
            </Button>
          )}
        </div>

        {/* Merge Result */}
        {mergedFile && (
          <div className="space-y-3 p-4 rounded-lg border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">PDFs Merged Successfully!</span>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white">
              <FileText className="h-4 w-4 text-red-600" />
              <span className="text-sm flex-1">{mergedFile.name}</span>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Download Merged PDF
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Merge More PDFs
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            How to Use
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Select multiple PDF files (minimum 2 required)</li>
            <li>Files will be merged in the exact order shown in the list</li>
            <li>Use ↑ ↓ buttons to reorder files before merging</li>
            <li>Click the trash icon to remove a file from the list</li>
            <li>Total file size limit: 50 MB</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
