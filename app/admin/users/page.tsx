import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { ResetPasswordModal } from '@/components/admin/reset-password-modal'
import { CreateClientModal } from '@/components/admin/create-client-modal'
import { DeleteUserModal } from '@/components/admin/delete-user-modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function AdminUsersPage() {
  const session = await auth()
  
  // Check for SUPER_ADMIN role
  if (!session || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'super_admin')) {
    redirect('/dashboard')
  }
  
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'super_admin'
  
  // Fetch all users from database with Supabase (include organization relation)
  const { data: users, error } = await supabase
    .from('users')
    .select(`
      id,
      first_name,
      last_name,
      email,
      role,
      created_at,
      organization_id,
      organizations (
        id,
        name,
        display_name
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching users:', error)
  }

  const usersData = users || []
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent leading-tight">
            User Management
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed">Manage user accounts, reset passwords, and delete client accounts</p>
        </div>
        <CreateClientModal />
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-primary-glow">
              <Users className="h-5 w-5 text-primary-foreground" />
            </div>
            All Users
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {usersData.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border border-border rounded-xl hover:border-primary/30 hover:shadow-md transition-all duration-300 bg-card"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-base text-foreground">
                      {user.first_name} {user.last_name}
                    </p>
                    <Badge 
                      variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                      className={user.role === 'ADMIN' 
                        ? 'bg-gradient-to-r from-primary to-primary-glow text-primary-foreground border-0' 
                        : 'bg-secondary text-secondary-foreground'
                      }
                    >
                      {user.role.toLowerCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{user.email}</p>
                  {user.organizations && (
                    <p className="text-sm text-muted-foreground leading-relaxed flex items-center gap-1">
                      <span className="text-primary">•</span> {user.organizations.display_name || user.organizations.name}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <ResetPasswordModal
                    userId={user.id}
                    userName={`${user.first_name} ${user.last_name}`}
                    userEmail={user.email}
                    userRole={user.role}
                    isSuperAdmin={isSuperAdmin}
                  />
                  <DeleteUserModal
                    userId={user.id}
                    userName={`${user.first_name} ${user.last_name}`}
                    userEmail={user.email}
                    userRole={user.role}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
