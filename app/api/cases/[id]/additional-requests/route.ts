import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB } from '@/lib/supabase-db'
import { createEmailService } from '@/lib/supabase-email-service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const caseId = id
    
    console.log('[ADDITIONAL_SERVICES] Processing request for case:', caseId)
    
    // Verify user has access to this case
    const user = await SupabaseDB.getUserById(session.user.id)

    if (!user?.organization_id) {
      return NextResponse.json({ error: 'User not associated with a firm' }, { status: 403 })
    }

    const caseRecord = await SupabaseDB.getCaseById(caseId)

    if (!caseRecord) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 })
    }

    // Check access - user must be from same firm or admin
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && caseRecord.organization_id !== user.organization_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { services, specific_instructions } = body

    if (!services || !Array.isArray(services) || services.length === 0) {
      return NextResponse.json({ error: 'At least one service must be selected' }, { status: 400 })
    }

    console.log('[ADDITIONAL_SERVICES] Requested services:', services)

    // Get service IDs from slugs
    const serviceRecords = await SupabaseDB.getServicesBySlugs(services)
    const serviceIds = serviceRecords.map(s => s.id)

    // Check which services don't already exist for this case
    const existingServices = await SupabaseDB.client
      .from('case_services')
      .select('service_id')
      .eq('case_id', caseId)
    
    const existingServiceIds = existingServices.data?.map(cs => cs.service_id) || []
    const newServiceIds = serviceIds.filter(serviceId => !existingServiceIds.includes(serviceId))
    
    if (newServiceIds.length === 0) {
      return NextResponse.json({ error: 'All selected services are already included in this case' }, { status: 400 })
    }

    console.log('[ADDITIONAL_SERVICES] Adding new services:', newServiceIds)

    // Add new services to case
    const now = new Date().toISOString()
    await SupabaseDB.createCaseServices(
      newServiceIds.map(serviceId => ({
        id: crypto.randomUUID(),
        case_id: caseId,
        service_id: serviceId,
        created_at: now,
        updated_at: now
      }))
    )

    // Update case's special_instructions with the new request
    if (specific_instructions && specific_instructions.trim()) {
      try {
        console.log('[ADDITIONAL_SERVICES] Updating special_instructions with:', specific_instructions)
        
        // Get service names for the new services
        const serviceNames = serviceRecords
          .filter(s => newServiceIds.includes(s.id))
          .map(s => s.name)
        
        // Format the new instruction entry
        const dateStr = new Date().toLocaleDateString('en-US', { 
          month: '2-digit', 
          day: '2-digit', 
          year: '2-digit' 
        })
        const servicesStr = serviceNames.join(', ')
        const newEntry = `• ${specific_instructions.trim()} (${servicesStr}) - Added ${dateStr}`
        
        console.log('[ADDITIONAL_SERVICES] New entry to add:', newEntry)
        
        // Get current special_instructions
        const currentInstructions = caseRecord.special_instructions || ''
        
        // Append the new entry
        const updatedInstructions = currentInstructions 
          ? `${currentInstructions}\n${newEntry}`
          : newEntry
        
        console.log('[ADDITIONAL_SERVICES] Updated instructions:', updatedInstructions)
        
        // Update the case
        const { data, error } = await SupabaseDB.client
          .from('cases')
          .update({ 
            special_instructions: updatedInstructions,
            updated_at: now 
          })
          .eq('id', caseId)
          .select()
        
        if (error) {
          console.error('[ADDITIONAL_SERVICES] Error updating special_instructions:', error)
          throw error
        }
        
        console.log('[ADDITIONAL_SERVICES] Successfully updated case special_instructions')
      } catch (error) {
        console.error('[ADDITIONAL_SERVICES] Failed to update special_instructions:', error)
        // Don't fail the operation if this fails
      }
    } else {
      console.log('[ADDITIONAL_SERVICES] No specific instructions provided, skipping update')
    }

    // Update case timestamp (if not already updated above)
    if (!specific_instructions || !specific_instructions.trim()) {
      await SupabaseDB.client
        .from('cases')
        .update({ updated_at: now })
        .eq('id', caseId)
    }

    // Log the action
    await SupabaseDB.createAuditLog({
      action: 'UPDATE',
      entity_type: 'case',
      entity_id: caseId,
      user_id: session.user.id,
      organization_id: user.organization_id,
      new_values: { 
        action: 'additional_services_requested',
        services: newServiceIds, 
        specific_instructions 
      }
    })

    // Send additional services request notification email
    try {
      const emailService = createEmailService()
      const serviceNames = serviceRecords.filter(s => newServiceIds.includes(s.id)).map(s => s.name)
      await emailService.sendAdditionalServicesNotification(
        caseId,
        serviceNames,
        session.user.name || session.user.email
      )
    } catch (emailError) {
      console.error('[ADDITIONAL_SERVICES] Failed to send notification:', emailError)
      // Don't fail the operation if email fails
    }

    console.log('[ADDITIONAL_SERVICES] Successfully added services')

    // If case status is DELIVERED, change it back to PENDING
    if (caseRecord.status === 'DELIVERED') {
      console.log('[ADDITIONAL_SERVICES] Case was DELIVERED, changing status to PENDING')
      await SupabaseDB.updateCaseStatus(caseId, 'PENDING')
      
      // Log the status change
      await SupabaseDB.createAuditLog({
        action: 'UPDATE',
        entity_type: 'case',
        entity_id: caseId,
        user_id: session.user.id,
        organization_id: user.organization_id,
        new_values: { 
          action: 'status_changed_to_pending',
          reason: 'additional_services_requested',
          old_status: 'DELIVERED',
          new_status: 'PENDING'
        }
      })
      
      // Send email notification about status change
      try {
        const emailService = createEmailService()
        await emailService.sendCaseStatusUpdateNotification(
          caseId,
          'DELIVERED',
          'PENDING',
          session.user.name || session.user.email
        )
      } catch (emailError) {
        console.error('[ADDITIONAL_SERVICES] Failed to send status change notification:', emailError)
        // Don't fail the operation if email fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      servicesAdded: newServiceIds.length
    })

  } catch (error) {
    console.error('[ADDITIONAL_SERVICES] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}