'use server'

import { auth } from '@/auth'
import { SupabaseDB, CaseStatus } from '@/lib/supabase-db'
import { revalidatePath } from 'next/cache'
import { supabaseEmailService } from '@/lib/supabase-email-service'

export async function updateCaseStatus(caseId: string, status: CaseStatus) {
  try {
    const session = await auth()

    // Check if user is admin or super admin
    if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'SUPER_ADMIN')) {
      return { error: 'Access denied', status: 403 }
    }

    // Verify actual role from database to ensure proper authorization
    const user = await SupabaseDB.getUserById(session.user.id) as any
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN')) {
      return { error: 'Access denied', status: 403 }
    }

    // Get old status before update
    const oldCase = await SupabaseDB.getCaseById(caseId) as any
    const oldStatus = oldCase?.status || 'UNKNOWN'

    // Verify case exists and update status
    const updatedCase = await SupabaseDB.updateCaseStatus(caseId, status)

    if (!updatedCase) {
      return { error: 'Case not found', status: 404 }
    }

    // Send email notification about status update to info@quantyxg.com
    try {
      await supabaseEmailService.sendCaseStatusUpdateNotification(
        caseId,
        oldStatus,
        status,
        session.user.name || session.user.email
      )
    } catch (emailError) {
      console.error('Failed to send case status update email:', emailError)
      // Don't fail the entire operation if email fails
    }

    // Revalidate affected paths
    revalidatePath('/admin')
    revalidatePath(`/admin/case/${caseId}`)
    revalidatePath('/superadmin')
    revalidatePath(`/superadmin/case/${caseId}`)
    revalidatePath('/dashboard')
    revalidatePath(`/dashboard/case/${caseId}`)

    return { success: true }
  } catch (error) {
    // Log error server-side with context (no sensitive info)
    console.error('Update case status error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      caseId,
      timestamp: new Date().toISOString()
    })
    
    // Generic error (no sensitive info exposed)
    return { error: 'Failed to update case status. Please try again.', status: 500 }
  }
}
