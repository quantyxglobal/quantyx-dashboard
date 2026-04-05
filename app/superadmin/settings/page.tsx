import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { SupabaseDB } from '@/lib/supabase-db'
import SuperAdminSettingsClient from '@/components/admin/SuperAdminSettingsClient'

export default async function SuperAdminSettingsPage() {
  const session = await auth()

  if (!session) {
    redirect('/login')
  }

  // Only super admin users can access this page
  if (session.user.role !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  // Get current next_firm_id setting
  const setting = await SupabaseDB.getSystemSetting('next_firm_id')
  const currentNextFirmId = setting 
    ? (typeof setting.value === 'string' ? parseInt(setting.value) : setting.value)
    : 1000

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage system-wide configuration settings
        </p>
      </div>

      <SuperAdminSettingsClient currentNextFirmId={currentNextFirmId} />
    </div>
  )
}
