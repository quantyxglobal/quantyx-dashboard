import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { FileConverter } from '@/components/admin/file-converter'
import { FileSpreadsheet } from 'lucide-react'

export default async function FileConverterPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  const { role } = session.user as any

  // Only internal staff can access file conversion tools
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER' && role !== 'EMPLOYEE') {
    redirect('/dashboard')
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
              <FileSpreadsheet className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent leading-tight">
              File Conversion Tools
            </h1>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            Convert Excel spreadsheets and CSV files to Word documents. This tool is only available to internal staff.
          </p>
        </div>

        <FileConverter />
      </div>
    </div>
  )
}
