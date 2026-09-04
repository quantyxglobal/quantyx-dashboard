'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { FileSpreadsheet, FileText, Upload, Loader2, Download, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export function FileConverter() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const [convertedFile, setConvertedFile] = useState<{ name: string; blob: Blob } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/csv'
      ]
      
      const validExtensions = ['.xlsx', '.xls', '.csv']
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))
      
      if (!hasValidExtension && !validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please select an Excel (.xlsx, .xls) or CSV file.')
        e.target.value = ''
        return
      }
      
      setSelectedFile(file)
      setConvertedFile(null)
    }
  }

  const handleConvert = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first')
      return
    }

    setIsConverting(true)
    
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)

      const response = await fetch('/api/convert/excel-to-word', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Conversion failed')
      }

      // Get the blob from response
      const blob = await response.blob()
      const fileName = selectedFile.name.replace(/\.(xlsx|xls|csv)$/i, '.docx')

      setConvertedFile({ name: fileName, blob })
      toast.success('File converted successfully!')
    } catch (error: any) {
      console.error('Conversion error:', error)
      toast.error(error.message || 'Failed to convert file. Please try again.')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDownload = () => {
    if (!convertedFile) return

    const url = URL.createObjectURL(convertedFile.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = convertedFile.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success('Download started')
  }

  const handleReset = () => {
    setSelectedFile(null)
    setConvertedFile(null)
    // Reset file input
    const fileInput = document.getElementById('file-input') as HTMLInputElement
    if (fileInput) fileInput.value = ''
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Excel to Word Converter</CardTitle>
            <CardDescription>
              Convert Excel spreadsheets and CSV files to Word documents
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* File Upload Section */}
        <div className="space-y-3">
          <Label htmlFor="file-input" className="text-sm font-medium">
            Select File
          </Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <input
                id="file-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                disabled={isConverting}
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
          
          {selectedFile && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm flex-1">{selectedFile.name}</span>
              <span className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </span>
            </div>
          )}
        </div>

        {/* Convert Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleConvert}
            disabled={!selectedFile || isConverting}
            size="lg"
            className="gap-2"
          >
            {isConverting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Converting...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Convert to Word
              </>
            )}
          </Button>
        </div>

        {/* Conversion Result */}
        {convertedFile && (
          <div className="space-y-3 p-4 rounded-lg border border-green-200 bg-green-50">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Conversion Complete!</span>
            </div>
            
            <div className="flex items-center gap-2 p-3 rounded-lg bg-white">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-sm flex-1">{convertedFile.name}</span>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1 gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              <Button onClick={handleReset} variant="outline" className="flex-1">
                Convert Another
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="p-4 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            Conversion Notes
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
            <li>Supports .xlsx, .xls, and .csv files</li>
            <li>Each sheet becomes a separate section in the Word document</li>
            <li>Tables maintain their structure and formatting</li>
            <li>File size limit: 10 MB</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
