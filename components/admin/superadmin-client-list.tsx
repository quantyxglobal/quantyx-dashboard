import { Organization } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { formatDate } from '@/lib/date-utils'

interface OrganizationWithCount extends Organization {
  _count: {
    cases: number
  }
}

interface SuperAdminClientListProps {
  firms: OrganizationWithCount[]
}

export function SuperAdminClientList({ firms }: SuperAdminClientListProps) {
  if (firms.length === 0) {
    return (
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
              <Building2 className="h-5 w-5 text-destructive" />
            </div>
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
    <Card className="border-destructive/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
            <Building2 className="h-5 w-5 text-destructive" />
          </div>
          Organizations ({firms.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border border-destructive/20">
          <table className="w-full">
            <thead className="bg-destructive/5">
              <tr className="border-b border-destructive/20">
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
                  className="border-b border-destructive/10 last:border-0 hover:bg-destructive/5 transition-colors"
                >
                  <td className="py-3 px-4 text-base font-medium text-foreground leading-snug">
                    {firm.name}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium rounded-full bg-destructive/10 text-destructive">
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
