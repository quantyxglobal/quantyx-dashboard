'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Building2, Users, FileText, Search, Plus, UserX, Settings, Trash2, ChevronDown, ChevronUp, ExternalLink, Edit, GitMerge, UserCog } from 'lucide-react'
import { CreateFirmModal } from './CreateFirmModal'
import { AssignUserModal } from './AssignUserModal'
import { DeleteCaseModal } from './delete-case-modal'
import { DeleteOrganizationModal } from './delete-organization-modal'
import { EditFirmModal } from './EditFirmModal'
import { MergeFirmsModal } from './MergeFirmsModal'
import { MoveClientsModal } from './MoveClientsModal'
import { formatDistanceToNow } from 'date-fns'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import Link from 'next/link'

interface User {
  id: string
  name: string
  email: string
  role: string
  created_at: Date
}

interface Case {
  id: string
  title: string
  status: string
  created_at: string
  updated_at: string
}

interface Firm {
  id: string
  name: string
  firm_sequence: number
  created_at: Date
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  country?: string
  users: User[]
  cases: Case[]
  _count: {
    users: number
    cases: number
  }
}

interface SuperAdminFirmManagementProps {
  firms: Firm[]
  orphanedUsers: User[]
}

export function SuperAdminFirmManagement({ firms, orphanedUsers }: SuperAdminFirmManagementProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [createFirmModalOpen, setCreateFirmModalOpen] = useState(false)
  const [assignUserModalOpen, setAssignUserModalOpen] = useState(false)
  const [editFirmModalOpen, setEditFirmModalOpen] = useState(false)
  const [mergeFirmsModalOpen, setMergeFirmsModalOpen] = useState(false)
  const [moveClientsModalOpen, setMoveClientsModalOpen] = useState(false)
  const [selectedFirm, setSelectedFirm] = useState<Firm | null>(null)
  const [expandedFirms, setExpandedFirms] = useState<Set<string>>(new Set())
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
    router.refresh()
  }

  const toggleFirmExpanded = (firmId: string) => {
    const newExpanded = new Set(expandedFirms)
    if (newExpanded.has(firmId)) {
      newExpanded.delete(firmId)
    } else {
      newExpanded.add(firmId)
    }
    setExpandedFirms(newExpanded)
  }

  const getCaseStatusCounts = (cases: Case[]) => {
    const counts = cases.reduce((acc, case_) => {
      acc[case_.status] = (acc[case_.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    return counts
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-accent/20 text-accent-foreground border border-accent/30'
      case 'in_progress':
        return 'bg-primary/20 text-primary border border-primary/30'
      case 'under_review':
        return 'bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500/30'
      case 'completed':
        return 'bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/30'
      case 'delivered':
        return 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border border-purple-500/30'
      case 'on_hold':
        return 'bg-gray-500/20 text-gray-700 dark:text-gray-400 border border-gray-500/30'
      default:
        return 'bg-muted text-muted-foreground border border-border'
    }
  }

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
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
            className="pl-10 focus:ring-2 focus:ring-destructive border-destructive/20"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setCreateFirmModalOpen(true)}
            className="bg-gradient-to-r from-destructive to-destructive/80 hover:opacity-90 text-destructive-foreground shadow-elegant transition-all duration-300"
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
                  <div className="w-8 h-8 bg-gradient-to-br from-accent/10 to-destructive/10 rounded-full flex items-center justify-center">
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
      <div className="space-y-4">
        {filteredFirms.map((firm) => {
          const caseStatusCounts = getCaseStatusCounts(firm.cases)
          const isExpanded = expandedFirms.has(firm.id)
          
          return (
            <Card key={firm.id} className="border-destructive/20 hover:shadow-lg transition-shadow">
              <Collapsible open={isExpanded} onOpenChange={() => toggleFirmExpanded(firm.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
                        <Building2 className="h-5 w-5 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{firm.name}</CardTitle>
                          <Badge variant="outline" className="text-xs border-destructive/30">
                            #{firm.firm_sequence.toString().padStart(4, '0')}
                          </Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {firm._count.users} user{firm._count.users !== 1 ? 's' : ''} • {firm._count.cases} case{firm._count.cases !== 1 ? 's' : ''}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="hover:bg-primary/10 hover:text-primary"
                        onClick={() => {
                          setSelectedFirm(firm)
                          setEditFirmModalOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="hover:bg-orange-500/10 hover:text-orange-600"
                        onClick={() => {
                          setSelectedFirm(firm)
                          setMoveClientsModalOpen(true)
                        }}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="hover:bg-purple-500/10 hover:text-purple-600"
                        onClick={() => {
                          setSelectedFirm(firm)
                          setMergeFirmsModalOpen(true)
                        }}
                      >
                        <GitMerge className="h-4 w-4" />
                      </Button>
                      <DeleteOrganizationModal
                        organizationId={firm.id}
                        organizationName={firm.name}
                        caseCount={firm._count.cases}
                      />
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="hover:bg-destructive/10">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>
                
                <CollapsibleContent>
                  <CardContent className="space-y-4 pt-0">
                    {/* Organization Address */}
                    {(firm.address_line1 || firm.city || firm.state || firm.country) && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <Building2 className="h-3 w-3" />
                          Organization Address
                        </p>
                        <div className="p-3 bg-destructive/5 rounded border border-destructive/10 text-sm">
                          {firm.address_line1 && <p>{firm.address_line1}</p>}
                          {firm.address_line2 && <p>{firm.address_line2}</p>}
                          {(firm.city || firm.state || firm.country) && (
                            <p>
                              {[firm.city, firm.state, firm.country].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Case Status Breakdown */}
                    {firm._count.cases > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Case Status</p>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(caseStatusCounts).map(([status, count]) => (
                            <Badge 
                              key={status} 
                              variant="secondary" 
                              className="text-xs capitalize bg-destructive/10 text-destructive border-destructive/20"
                            >
                              {status.replace('_', ' ')}: {count}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Cases List */}
                    {firm.cases.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <FileText className="h-3 w-3" />
                          Cases in this Organization
                        </p>
                        <div className="space-y-2">
                          {firm.cases.map((caseItem, index) => (
                            <div key={caseItem.id} className="flex items-center gap-2 p-3 bg-destructive/5 rounded border border-destructive/10 hover:border-destructive/20 transition-colors">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Link 
                                    href={`/superadmin/case/${caseItem.id}`}
                                    className="text-sm font-medium truncate hover:text-destructive transition-colors flex items-center gap-1"
                                  >
                                    {caseItem.title}
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                  <Badge 
                                    className={`text-xs ${getStatusColor(caseItem.status)}`}
                                  >
                                    {formatStatus(caseItem.status)}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Created {formatDistanceToNow(new Date(caseItem.created_at), { addSuffix: true })}
                                </p>
                              </div>
                              <DeleteCaseModal
                                caseId={caseItem.id}
                                caseNumber={`#${index + 1}`}
                                caseTitle={caseItem.title}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Users List */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        Users in this Organization
                      </p>
                      <div className="space-y-2">
                        {firm.users.map((user) => (
                          <div key={user.id} className="flex items-center gap-2 p-2 bg-destructive/5 rounded border border-destructive/10">
                            <div className="w-8 h-8 bg-gradient-to-br from-destructive/20 to-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium">
                                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{user.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                            </div>
                            <Badge 
                              variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                              className={user.role === 'ADMIN' ? 'bg-destructive text-destructive-foreground' : 'text-xs capitalize'}
                            >
                              {user.role.toLowerCase()}
                            </Badge>
                          </div>
                        ))}
                        {firm.users.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No users assigned to this organization
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 border-t border-destructive/10">
                      <p className="text-xs text-muted-foreground">
                        Created {formatDistanceToNow(new Date(firm.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          )
        })}
      </div>

      {filteredFirms.length === 0 && (
        <Card className="border-destructive/20">
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No firms found</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm ? 'No firms match your search criteria.' : 'No firms have been created yet.'}
            </p>
            {!searchTerm && (
              <Button 
                onClick={() => setCreateFirmModalOpen(true)}
                className="bg-gradient-to-r from-destructive to-destructive/80 hover:opacity-90 text-destructive-foreground shadow-elegant transition-all duration-300"
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

      {selectedFirm && (
        <>
          <EditFirmModal 
            open={editFirmModalOpen}
            onOpenChange={setEditFirmModalOpen}
            firm={selectedFirm}
            onSuccess={handleSuccess}
          />

          <MergeFirmsModal 
            open={mergeFirmsModalOpen}
            onOpenChange={setMergeFirmsModalOpen}
            sourceFirm={selectedFirm}
            allFirms={firms}
            onSuccess={handleSuccess}
          />

          <MoveClientsModal 
            open={moveClientsModalOpen}
            onOpenChange={setMoveClientsModalOpen}
            sourceFirm={selectedFirm}
            allFirms={firms}
            onSuccess={handleSuccess}
          />
        </>
      )}
    </div>
  )
}
