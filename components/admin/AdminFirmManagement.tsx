'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Building2, Users, FileText, Search, Plus, UserX, Settings } from 'lucide-react'
import { CreateFirmModal } from './CreateFirmModal'
import { AssignUserModal } from './AssignUserModal'
import { formatDistanceToNow } from 'date-fns'

interface User {
  id: string
  name: string
  email: string
  role: string
  created_at: Date
}

interface Firm {
  id: string
  name: string
  firm_sequence: number
  created_at: Date
  users: User[]
  cases: Array<{ id: string; status: string }>
  _count: {
    users: number
    cases: number
  }
}

interface AdminFirmManagementProps {
  firms: Firm[]
  orphanedUsers: User[]
}

export function AdminFirmManagement({ firms, orphanedUsers }: AdminFirmManagementProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [createFirmModalOpen, setCreateFirmModalOpen] = useState(false)
  const [assignUserModalOpen, setAssignUserModalOpen] = useState(false)
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null)
  const router = useRouter()

  const filteredFirms = firms.filter(firm =>
    firm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    firm.users.some(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
    )
  )

  const handleSuccess = () => {
    setCreateFirmModalOpen(false)
    setAssignUserModalOpen(false)
    setSelectedFirm(null)
    router.refresh()
  }

  const getCaseStatusCounts = (cases: Array<{ id: string; status: string }>) => {
    const counts = cases.reduce((acc, case_) => {
      acc[case_.status] = (acc[case_.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return counts
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search firms or users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setCreateFirmModalOpen(true)}
            className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-elegant transition-all duration-300"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Firm
          </Button>
          {orphanedUsers.length > 0 && (
            <Button 
              variant="outline"
              onClick={() => setAssignUserModalOpen(true)}
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
            >
              <UserX className="h-4 w-4 mr-2" />
              Assign Users ({orphanedUsers.length})
            </Button>
          )}
        </div>
      </div>

      {/* Orphaned Users Alert */}
      {orphanedUsers.length > 0 && (
        <Card className="border-accent/20 bg-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-accent">
              <UserX className="h-5 w-5" />
              Unassigned Users ({orphanedUsers.length})
            </CardTitle>
            <CardDescription>
              These users are not assigned to any firm and cannot access the system properly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {orphanedUsers.slice(0, 6).map((user) => (
                <div key={user.id} className="flex items-center gap-2 p-2 bg-background rounded border">
                  <div className="w-8 h-8 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </div>
              ))}
              {orphanedUsers.length > 6 && (
                <div className="flex items-center justify-center p-2 bg-muted rounded border">
                  <span className="text-sm text-muted-foreground">
                    +{orphanedUsers.length - 6} more
                  </span>
                </div>
              )}
            </div>
            <Button 
              onClick={() => setAssignUserModalOpen(true)}
              className="mt-4 w-full sm:w-auto"
              variant="outline"
            >
              <Settings className="h-4 w-4 mr-2" />
              Assign Users to Firms
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Firms List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredFirms.map((firm) => {
          const caseStatusCounts = getCaseStatusCounts(firm.cases)
          
          return (
            <Card key={firm.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <div>
                      <CardTitle className="text-lg">{firm.name}</CardTitle>
                      <CardDescription>
                        Firm #{firm.firm_sequence.toString().padStart(4, '0')}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {firm._count.users} user{firm._count.users !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {firm._count.cases} case{firm._count.cases !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Case Status Breakdown */}
                {firm._count.cases > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Case Status</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(caseStatusCounts).map(([status, count]) => (
                        <Badge 
                          key={status} 
                          variant="secondary" 
                          className="text-xs capitalize"
                        >
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Users */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Recent Users</p>
                  <div className="space-y-1">
                    {firm.users.slice(0, 3).map((user) => (
                      <div key={user.id} className="flex items-center gap-2 text-sm">
                        <div className="w-6 h-6 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium">
                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </span>
                        </div>
                        <span className="flex-1 truncate">{user.name}</span>
                        <Badge 
                          variant={user.role === 'admin' ? 'default' : 'secondary'}
                          className="text-xs capitalize"
                        >
                          {user.role}
                        </Badge>
                      </div>
                    ))}
                    {firm.users.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-8">
                        +{firm.users.length - 3} more users
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Created {formatDistanceToNow(new Date(firm.created_at), { addSuffix: true })}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredFirms.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No firms found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No firms match your search criteria.' : 'No firms have been created yet.'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setCreateFirmModalOpen(true)}
                className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-elegant transition-all duration-300"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Firm
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <CreateFirmModal 
        open={createFirmModalOpen}
        onOpenChange={setCreateFirmModalOpen}
        onSuccess={handleSuccess}
      />

      <AssignUserModal 
        open={assignUserModalOpen}
        onOpenChange={setAssignUserModalOpen}
        orphanedUsers={orphanedUsers}
        firms={firms}
        onSuccess={handleSuccess}
      />
    </div>
  )
}