import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, CheckCircle, MessageSquare } from 'lucide-react'

interface CaseDetailsSectionProps {
  description: string | null
}

export function CaseDetailsSection({ description }: CaseDetailsSectionProps) {
  if (!description) {
    return null
  }

  // Parse the description to extract different sections
  const parseDescription = (desc: string) => {
    const sections = {
      mainDescription: '',
      services: [] as string[],
      additionalRequests: ''
    }

    const lines = desc.split('\n')
    let currentSection = 'main'
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      if (trimmedLine === 'Services Required:') {
        currentSection = 'services'
        continue
      } else if (trimmedLine === 'Additional Requests:') {
        currentSection = 'additional'
        continue
      }
      
      if (currentSection === 'main' && trimmedLine) {
        sections.mainDescription += (sections.mainDescription ? '\n' : '') + trimmedLine
      } else if (currentSection === 'services' && trimmedLine) {
        // Split services by comma and clean them up
        const servicesList = trimmedLine.split(',').map(s => s.trim()).filter(s => s)
        sections.services.push(...servicesList)
      } else if (currentSection === 'additional' && trimmedLine) {
        sections.additionalRequests += (sections.additionalRequests ? '\n' : '') + trimmedLine
      }
    }
    
    return sections
  }

  const parsedData = parseDescription(description)

  return (
    <div className="space-y-6">
      {/* Case Description */}
      {parsedData.mainDescription && (
        <Card className="shadow-card bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Case Description
            </CardTitle>
            <CardDescription>
              Detailed information about this case
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {parsedData.mainDescription}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Requested Services */}
      {parsedData.services.length > 0 && (
        <Card className="shadow-card bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Requested Services
            </CardTitle>
            <CardDescription>
              Medilegal services requested for this case
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {parsedData.services.map((service, index) => (
                <Badge 
                  key={index} 
                  variant="secondary" 
                  className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors"
                >
                  {service}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Additional Requests */}
      {parsedData.additionalRequests && (
        <Card className="shadow-card bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Specific Instructions
            </CardTitle>
            <CardDescription>
              Additional requirements and specific instructions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                {parsedData.additionalRequests}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}