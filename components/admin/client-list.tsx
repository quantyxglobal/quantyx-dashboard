import { Organization } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

interface OrganizationWithCount extends Organization {
  _count: {
    cases: number
  }
}

interface ClientListProps {
  firms: OrganizationWithCount[]
}

export function ClientList({ firms }: ClientListProps) {
  if (firms.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5" />
            Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-base text-muted-foreground text-center py-8 leading-relaxed">
            No organizations found in the system.
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="p-2 rounded-lg bg-gradient-to-br from-accent to-accent/80">
            <Building2 className="h-5 w-5 text-accent-foreground" />
          </div>
          Organizations ({firms.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Organization Name
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Cases
                </th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {firms.map((firm) => (
                <tr 
                  key={firm.id}
                  className="border-b border-border last:border-0 hover:bg-primary/5 transition-colors"
                >
                  <td className="py-3 px-4 text-base font-medium text-foreground leading-snug">
                    {firm.name}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary">
                      {firm._count.cases}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-muted-foreground leading-relaxed">
                    {formatDate(firm.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
