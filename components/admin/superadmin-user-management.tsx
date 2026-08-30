"use client"

import { useState, useMemo } from 'react'
import { ResetPasswordModal } from '@/components/admin/reset-password-modal'
import { SuperAdminCreateAccountModal } from '@/components/admin/superadmin-create-account-modal'
import { DeleteUserModal } from '@/components/admin/delete-user-modal'
import { MFAManagementControls } from '@/components/admin/MFAManagementControls'
import { UserMFAActions } from '@/components/admin/UserMFAActions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Users, Shield, Filter, Search } from 'lucide-react'

interface User {
  id: string
  first_name: string
  last_name: string
  email: string
  role: string
  organization?: {
    id: string
    name: string
    display_name?: string
  }
}

interface Firm {
  id: string
  name: string
  isFirm?: boolean
}

interface SuperAdminUserManagementProps {
  users: User[]
  firms: Firm[]
}

export function SuperAdminUserManagement({ users, firms }: SuperAdminUserManagementProps) {
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [firmFilter, setFirmFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Filter users based on selected filters
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Role filter
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false
      }

      // Firm filter
      if (firmFilter !== 'all') {
        if (firmFilter === 'no-org') {
          if (user.organization) return false
        } else {
          if (!user.organization || user.organization.id !== firmFilter) return false
        }
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const fullName = `${user.first_name} ${user.last_name}`.toLowerCase()
        const email = user.email.toLowerCase()
        const orgName = user.organization?.display_name?.toLowerCase() || user.organization?.name?.toLowerCase() || ''
        
        if (!fullName.includes(query) && !email.includes(query) && !orgName.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [users, roleFilter, firmFilter, searchQuery])

  // Get unique roles
  const roles = useMemo(() => {
    const uniqueRoles = new Set(users.map(u => u.role))
    return Array.from(uniqueRoles).sort()
  }, [users])

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-destructive via-destructive/80 to-primary bg-clip-text text-transparent leading-tight">
              User Management
            </h1>
          </div>
          <p className="text-base text-muted-foreground leading-relaxed">
            Manage all user accounts across the system. You can reset passwords and delete any user.
          </p>
        </div>
        <SuperAdminCreateAccountModal firms={firms} />
      </div>

      {/* MFA Management Controls */}
      <MFAManagementControls />

      {/* Filters Section */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-destructive" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or firm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Role Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {roles.map(role => (
                    <SelectItem key={role} value={role}>
                      {role === 'SUPER_ADMIN' ? 'Super Admin' : 
                       role === 'ADMIN' ? 'Admin' : 
                       role === 'EMPLOYEE' ? 'Employee' : 
                       role === 'CLIENT' ? 'Client' : role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Firm Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization</label>
              <Select value={firmFilter} onValueChange={setFirmFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  <SelectItem value="no-org">No Organization</SelectItem>
                  {firms.map(firm => (
                    <SelectItem key={firm.id} value={firm.id}>
                      {firm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters Summary */}
          {(roleFilter !== 'all' || firmFilter !== 'all' || searchQuery) && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Active filters:</span>
              {roleFilter !== 'all' && (
                <Badge variant="outline" className="bg-primary/10">
                  Role: {roleFilter === 'SUPER_ADMIN' ? 'Super Admin' : 
                         roleFilter === 'ADMIN' ? 'Admin' : 
                         roleFilter === 'EMPLOYEE' ? 'Employee' : 
                         roleFilter === 'CLIENT' ? 'Client' : roleFilter}
                </Badge>
              )}
              {firmFilter !== 'all' && (
                <Badge variant="outline" className="bg-primary/10">
                  Org: {firmFilter === 'no-org' ? 'No Organization' : firms.find(f => f.id === firmFilter)?.name}
                </Badge>
              )}
              {searchQuery && (
                <Badge variant="outline" className="bg-primary/10">
                  Search: "{searchQuery}"
                </Badge>
              )}
              <button
                onClick={() => {
                  setRoleFilter('all')
                  setFirmFilter('all')
                  setSearchQuery('')
                }}
                className="text-destructive hover:underline ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Users List */}
      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-destructive/20 to-destructive/10">
              <Users className="h-5 w-5 text-destructive" />
            </div>
            {filteredUsers.length === users.length ? (
              <>All Users ({users.length})</>
            ) : (
              <>Filtered Users ({filteredUsers.length} of {users.length})</>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-lg font-medium mb-2">No users found</p>
              <p className="text-muted-foreground">
                Try adjusting your filters or search query
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-border rounded-xl hover:border-destructive/30 hover:shadow-md transition-all duration-300 bg-card"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-base text-foreground">
                        {user.first_name} {user.last_name}
                      </p>
                      <Badge 
                        variant={user.role === 'SUPER_ADMIN' ? 'destructive' : user.role === 'ADMIN' ? 'default' : user.role === 'EMPLOYEE' ? 'outline' : 'secondary'}
                        className={
                          user.role === 'SUPER_ADMIN' 
                            ? 'bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground border-0' 
                            : user.role === 'ADMIN'
                            ? 'bg-gradient-to-r from-primary to-primary-glow text-primary-foreground border-0' 
                            : user.role === 'EMPLOYEE'
                            ? 'bg-blue-50 text-blue-700 border-blue-300'
                            : 'bg-secondary text-secondary-foreground'
                        }
                      >
                        {user.role === 'SUPER_ADMIN' ? 'Super Admin' : 
                         user.role === 'ADMIN' ? 'Admin' : 
                         user.role === 'EMPLOYEE' ? 'Employee' : 
                         user.role === 'CLIENT' ? 'Client' : user.role.toLowerCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{user.email}</p>
                    {user.organization && (
                      <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-1">
                        <span className="text-destructive">•</span> {user.organization.display_name || user.organization.name}
                      </p>
                    )}
                    {!user.organization && user.role === 'SUPER_ADMIN' && (
                      <p className="text-sm text-destructive/70 leading-relaxed flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        System Administrator (No Organization)
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <UserMFAActions
                      userId={user.id}
                      userName={`${user.first_name} ${user.last_name}`}
                    />
                    <ResetPasswordModal
                      userId={user.id}
                      userName={`${user.first_name} ${user.last_name}`}
                      userRole={user.role}
                    />
                    {user.role !== 'SUPER_ADMIN' && (
                      <DeleteUserModal
                        userId={user.id}
                        userName={`${user.first_name} ${user.last_name}`}
                        userEmail={user.email}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
