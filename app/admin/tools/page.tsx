import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileSpreadsheet, FileText, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default async function ToolsPage() {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  const { role } = session.user as any

  // Only internal staff can access tools
  if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER' && role !== 'EMPLOYEE') {
    redirect('/dashboard')
  }

  const tools = [
    {
      name: 'Excel to Word Converter',
      description: 'Convert Excel spreadsheets and CSV files to Word documents with preserved formatting.',
      icon: FileSpreadsheet,
      href: '/admin/tools/file-converter',
      color: 'from-primary/20 to-primary/10',
      iconColor: 'text-primary'
    },
    {
      name: 'PDF Merger',
      description: 'Merge multiple PDF files into a single document in your specified order.',
      icon: FileText,
      href: '/admin/tools/pdf-merger',
      color: 'from-red-500/20 to-red-600/10',
      iconColor: 'text-red-600'
    }
  ]

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-3">Document Tools</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Professional tools for document conversion and management. Available exclusively to internal staff.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {tools.map((tool) => {
            const Icon = tool.icon
            return (
              <Link key={tool.href} href={tool.href}>
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:border-primary/50 cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-xl bg-gradient-to-br ${tool.color}`}>
                        <Icon className={`h-8 w-8 ${tool.iconColor}`} />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="group-hover:text-primary transition-colors">
                          {tool.name}
                        </CardTitle>
                        <CardDescription className="mt-2">
                          {tool.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" className="gap-2 group-hover:gap-3 transition-all">
                      Open Tool
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
