import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SupabaseDB } from '@/lib/supabase-db'
import { MandatoryMFASetup } from '@/components/auth/MandatoryMFASetup'

export default async function SetupMFAPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get user's MFA status
  const user = await SupabaseDB.getUserById(session.user.id)
  
  if (!user) {
    redirect('/login')
  }

  // If MFA is already enabled, redirect to dashboard
  if ((user as any).mfa_enabled) {
    redirect('/dashboard')
  }

  // If MFA setup is not required, redirect to dashboard
  if (!(user as any).mfa_setup_required) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <MandatoryMFASetup 
        userEmail={(user as any).email}
        userId={(user as any).id}
      />
    </div>
  )
}
