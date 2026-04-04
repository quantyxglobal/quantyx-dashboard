import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'

interface SpecialInstructionsSectionProps {
  specialInstructions: string | null
}

export function SpecialInstructionsSection({ specialInstructions }: SpecialInstructionsSectionProps) {
  if (!specialInstructions) {
    return (
      <Card className="border-muted/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Specific Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground italic">No specific instructions provided for this case.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Specific Instructions
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            Important
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-background/80 rounded-lg p-4 border border-border">
          <p className="text-foreground leading-relaxed whitespace-pre-wrap">
            {specialInstructions}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}