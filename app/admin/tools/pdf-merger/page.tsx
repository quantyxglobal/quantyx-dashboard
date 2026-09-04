import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { PdfMerger } from '@/components/admin/pdf-merger'
import { FileText } from 'lucide-react'

export default async function PdfMergerPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  const { role } = session.user as any

  // Only internal staff can access PDF merger tools
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER' && role !== 'EMPLOYEE') {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-red-600/10">
              <FileText className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent leading-tight">
              PDF Merger Tool
            </h1>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            Merge multiple PDF files into a single document. Files will be combined in the exact order you specify. 
            This tool is only available to internal staff.
          </p>
        </div>

        <PdfMerger />
      </div>
    </div>
  )
}
