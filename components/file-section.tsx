import { File } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { FileDownloadButton } from '@/components/file-download-button'
import { FileText, FileIcon } from 'lucide-react'
import { formatDateTime } from '@/lib/date-utils'

interface FileSectionProps {
  files: File[]
  title: string
  emptyMessage: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function getFileTypeLabel(category: string): string {
  const categoryLabels: Record<string, string> = {
    'MEDICAL_RECORD': 'Medical Record',
    'LEGAL_DOCUMENT': 'Legal Document', 
    'CORRESPONDENCE': 'Correspondence',
    'REPORT': 'Report',
    'CHRONOLOGY': 'Chronology',
    'OPINION': 'Medical Opinion',
    'HYPERLINK': 'Hyperlink Report',
    'DEMAND_LETTER': 'Demand Letter',
    'OTHER': 'Other'
  }
  return categoryLabels[category] || category
}

export function FileSection({ files, title, emptyMessage }: FileSectionProps) {
  return (
    <div className="bg-card rounded-lg border border-border p-6 shadow-card">
      <h2 className="text-xl font-semibold text-foreground mb-4 leading-tight">{title}</h2>

      {files.length === 0 ? (
        <div className="text-center py-12">
          <FileIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-base text-muted-foreground px-4 leading-relaxed">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {files.map((file) => {
            const uploadDate = formatDateTime(file.created_at)

            return (
              <div
                key={file.id}
                className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-md border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <FileText className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-base text-foreground truncate leading-snug">
                      {file.filename}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {getFileTypeLabel(file.category)}
                      </Badge>
                      <span className="text-sm text-muted-foreground leading-relaxed">
                        {formatFileSize(Number(file.file_size))}
                      </span>
                      <span className="text-sm text-muted-foreground hidden sm:inline">
                        •
                      </span>
                      <span className="text-sm text-muted-foreground leading-relaxed">
                        {uploadDate}
                      </span>
                    </div>
                  </div>
                </div>

                <FileDownloadButton fileId={file.id} fileName={file.filename} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
