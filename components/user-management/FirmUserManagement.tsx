'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { UserPlus, Users, Mail, Calendar, Clock } from 'lucide-react'
import { InviteUserModal } from './InviteUserModal'
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
  users: User[]
}

interface PendingInvitation {
  id: string
  email: string
  name: string
  role: string
  expires_at: Date
  created_at: Date
  inviter: {
    name: string
    email: string
  }
}

interface FirmUserManagementProps {
  firm: Firm
  currentUser: User
  pendingInvitations: PendingInvitation[]
}

export function FirmUserManagement({ firm, currentUser, pendingInvitations }: FirmUserManagementProps) {
  const [inviteModalOpen, setInviteModalOpen] = useState(false)
  const router = useRouter()

  const handleInviteSuccess = () => {
    setInviteModalOpen(false)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Current Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Firm Members ({firm.users.length})
            </CardTitle>
            <CardDescription>
              Users who have access to {firm.name}
            </CardDescription>
          </div>
          <Button 
            onClick={() => setInviteModalOpen(true)}
            className="bg-gradient-to-r from-primary to-primary-glow hover:opacity-90 text-primary-foreground shadow-elegant transition-all duration-300"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {firm.users.map((user) => (
              <div 
                key={user.id}
                className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-foreground">{user.name}</h3>
                      {user.id === currentUser.id && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge 
                    variant={user.role === 'admin' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {user.role}
                  </Badge>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-accent" />
              Pending Invitations ({pendingInvitations.length})
            </CardTitle>
            <CardDescription>
              Users who have been invited but haven&apos;t joined yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingInvitations.map((invitation) => (
                <div 
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full flex items-center justify-center">
                      <Clock className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">{invitation.name}</h3>
                      <p className="text-sm text-muted-foreground">{invitation.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited by {invitation.inviter.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="capitalize">
                      {invitation.role}
                    </Badge>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sent {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <InviteUserModal 
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        firmId={firm.id}
        firmName={firm.name}
        onSuccess={handleInviteSuccess}
      />
    </div>
  )
}