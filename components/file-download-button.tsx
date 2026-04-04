'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface FileDownloadButtonProps {
  fileId: string
  fileName: string
}

export function FileDownloadButton({ fileId, fileName }: FileDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    setIsLoading(true)

    try {
      const response = await fetch(`/api/files/${fileId}/download`)

      if (!response.ok) {
        if (response.status === 401) {
          toast.error('You are not authenticated. Please log in.')
          return
        }
        if (response.status === 403) {
          toast.error('You do not have permission to download this file.')
          return
        }
        if (response.status === 404) {
          toast.error('File not found.')
          return
        }
        toast.error('Failed to download file. Please try again.')
        return
      }

      const data = await response.json()

      if (!data.url) {
        toast.error('Failed to generate download URL.')
        return
      }

      // Open the pre-signed URL in a new tab
      window.open(data.url, '_blank')
      toast.success(`Downloading ${fileName}`)
    } catch (error) {
      console.error('Download error:', error)
      toast.error('An error occurred while downloading the file.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleDownload}
      disabled={isLoading}
      variant="outline"
      size="sm"
      className="flex-shrink-0"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Loading...
        </>
      ) : (
        <>
          <Download className="h-4 w-4 mr-2" />
          Download
        </>
      )}
    </Button>
  )
}
