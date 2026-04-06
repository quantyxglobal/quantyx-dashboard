'use server'

import { auth } from '@/auth'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'
import { revalidatePath } from 'next/cache'

/**
 * Assign a case to multiple employees
 * Only ADMIN and SUPER_ADMIN can assign cases
 */
export async function assignCaseToEmployees(caseId: string, employeeIds: string[]) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return { success: false, error: 'Unauthorized' }
  }

  try {
    console.log('[ASSIGN_CASE] Starting assignment - caseId:', caseId, 'employeeIds:', employeeIds)
    
    // Get current user to verify role
    const currentUser = await SupabaseDB.getUserById(session.user.id)
    
    console.log('[ASSIGN_CASE] Current user:', currentUser?.email, 'role:', currentUser?.role)
    
    if (!currentUser || ((currentUser as any).role !== 'ADMIN' && (currentUser as any).role !== 'SUPER_ADMIN')) {
      console.log('[ASSIGN_CASE] Access denied - invalid role')
      return { success: false, error: 'Only admins can assign cases' }
    }

    // Get the case to verify it exists
    const caseData = await SupabaseDB.getCaseById(caseId)
    
    if (!caseData) {
      console.log('[ASSIGN_CASE] Case not found:', caseId)
      return { success: false, error: 'Case not found' }
    }

    console.log('[ASSIGN_CASE] Case found:', caseData.case_number)

    // Get current assignments for audit log
    const currentAssignments = await SupabaseDB.getCaseAssignments(caseId)
    const oldEmployeeIds = currentAssignments.map((a: any) => a.user_id)
    
    console.log('[ASSIGN_CASE] Current assignments:', oldEmployeeIds)

    // If assigning to employees, verify they exist and are employees
    if (employeeIds.length > 0) {
      console.log('[ASSIGN_CASE] Verifying', employeeIds.length, 'employees')
      
      for (const employeeId of employeeIds) {
        const employee = await SupabaseDB.getUserById(employeeId)
        
        if (!employee) {
          console.log('[ASSIGN_CASE] Employee not found:', employeeId)
          return { success: false, error: `Employee not found: ${employeeId}` }
        }

        if ((employee as any).role !== 'EMPLOYEE') {
          console.log('[ASSIGN_CASE] User is not an employee:', (employee as any).email, 'role:', (employee as any).role)
          return { success: false, error: `User ${(employee as any).email} is not an employee` }
        }

        // For ADMIN users, verify employee is in same organization
        if ((currentUser as any).role === 'ADMIN' && (employee as any).organization_id !== (currentUser as any).organization_id) {
          console.log('[ASSIGN_CASE] Employee from different org:', (employee as any).email)
          return { success: false, error: `Cannot assign to employee ${(employee as any).email} from different organization` }
        }
      }
    } else {
      console.log('[ASSIGN_CASE] Unassigning all employees')
    }

    console.log('[ASSIGN_CASE] Updating case assignments')
    
    // Update the case assignments using the new junction table
    await SupabaseDB.updateCaseAssignments(caseId, employeeIds, session.user.id)
    
    console.log('[ASSIGN_CASE] Assignments updated successfully')

    // Create audit log
    await SupabaseDB.createAuditLog({
      action: 'ASSIGNMENT',
      entity_type: 'case',
      entity_id: caseId,
      user_id: session.user.id,
      organization_id: (currentUser as any).organization_id || '',
      old_values: { assigned_employee_ids: oldEmployeeIds },
      new_values: { assigned_employee_ids: employeeIds }
    })
    
    console.log('[ASSIGN_CASE] Audit log created')

    // Revalidate relevant paths
    revalidatePath(`/admin/case/${caseId}`)
    revalidatePath(`/superadmin/case/${caseId}`)
    revalidatePath('/admin')
    revalidatePath('/superadmin')
    
    console.log('[ASSIGN_CASE] Assignment completed successfully')

    return { success: true }
  } catch (error) {
    console.error('[ASSIGN_CASE] Error:', error)
    console.error('[ASSIGN_CASE] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      caseId,
      employeeIds
    })
    return { success: false, error: 'An unexpected error occurred' }
  }
}

/**
 * Legacy function for backward compatibility - assigns to single employee
 * @deprecated Use assignCaseToEmployees instead
 */
export async function assignCaseToEmployee(caseId: string, employeeId: string | null) {
  return assignCaseToEmployees(caseId, employeeId ? [employeeId] : [])
}
