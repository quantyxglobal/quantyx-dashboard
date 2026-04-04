import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SupabaseDB } from '@/lib/supabase-db'
import { MFASettingsClient } from '@/components/settings/MFASettingsClient'

export default async function MFASettingsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect('/login')
  }

  // Get user's MFA status
  const user = await SupabaseDB.getUserById(session.user.id)
  
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="container max-w-4xl py-8">
      <MFASettingsClient 
        mfaEnabled={user.mfa_enabled || false}
        userEmail={user.email}
      />
    </div>
  )
}
