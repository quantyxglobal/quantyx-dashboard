import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { SupabaseDB, getSupabaseClient } from '@/lib/supabase-db'
import { S3Service } from '@/lib/s3-service'
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

    const formData = await request.formData()
    const specificInstructions = formData.get('specific_instructions') as string
    const servicesData = formData.get('services') as string
    
    console.log(`[ADDITIONAL_FILES] Received specific_instructions:`, specificInstructions)
    console.log(`[ADDITIONAL_FILES] Received services data:`, servicesData)
    
    let services: string[] = []
    try {
      if (servicesData) {
        services = JSON.parse(servicesData)
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid services data' }, { status: 400 })
    }
    
    console.log(`[ADDITIONAL_FILES] Parsed services:`, services)

    // Handle file uploads with date-based folder structure
    const files = formData.getAll('files') as File[]
    const uploadedFiles: any[] = []
    const uploadDate = new Date()

    console.log(`[ADDITIONAL_FILES] Processing ${files.length} files for case ${caseRecord.case_number}`)

    for (const file of files) {
      if (file.size > 0) {
        try {
          console.log(`[ADDITIONAL_FILES] Uploading file: ${file.name} (${file.size} bytes)`)
          
          // Generate S3 key with date-based folder: cases/{caseNumber}/additional-dd-mm-yy/
          const s3Key = S3Service.generateAdditionalFileKey(file.name, caseRecord.case_number, uploadDate)
          
          // Upload to S3
          const uploadResult = await S3Service.uploadFile(s3Key, file, file.type)
          
          console.log(`[ADDITIONAL_FILES] File uploaded successfully: ${s3Key}`)
          
          uploadedFiles.push({
            case_id: caseId,
            filename: file.name,
            original_filename: file.name,
            s3_key: s3Key,
            file_size: file.size,
            mime_type: file.type,
            source: 'ADDITIONAL_UPLOAD' as const,
            uploaded_by_id: session.user.id,
          })
        } catch (error) {
          console.error('[ADDITIONAL_FILES] File upload error:', error)
          return NextResponse.json({ 
            error: `Failed to upload file: ${file.name}` 
          }, { status: 500 })
        }
      }
    }

    // Create additional file upload record if we have files or services
    let additionalUploadId: string | undefined
    if (uploadedFiles.length > 0 || services.length > 0) {
      console.log(`[ADDITIONAL_FILES] Creating additional upload record`)
      const additionalUpload = await SupabaseDB.createAdditionalFileUpload({
        case_id: caseId,
        uploaded_by: session.user.id,
        services: services,
        specific_instructions: specificInstructions || undefined,
        upload_date: uploadDate
      })
      additionalUploadId = additionalUpload.id
      
      // Update case's special_instructions with the new request
      if (specificInstructions && specificInstructions.trim() && services.length > 0) {
        try {
          console.log(`[ADDITIONAL_FILES] Updating special_instructions - instructions: "${specificInstructions}", services count: ${services.length}`)
          
          // Get service names
          const serviceNames = await Promise.all(
            services.map(async (serviceSlug) => {
              console.log(`[ADDITIONAL_FILES] Looking up service: ${serviceSlug}`)
              const service = await SupabaseDB.getServiceBySlug(serviceSlug)
              console.log(`[ADDITIONAL_FILES] Found service:`, service)
              return service?.name || serviceSlug
            })
          )
          
          console.log(`[ADDITIONAL_FILES] Service names:`, serviceNames)
          
          // Format the new instruction entry
          const dateStr = uploadDate.toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
          })
          const servicesStr = serviceNames.join(', ')
          const newEntry = `• ${specificInstructions.trim()} (${servicesStr}) - Added ${dateStr}`
          
          console.log(`[ADDITIONAL_FILES] New entry to add:`, newEntry)
          
          // Get current special_instructions
          const currentInstructions = caseRecord.special_instructions || ''
          
          console.log(`[ADDITIONAL_FILES] Current instructions:`, currentInstructions)
          
          // Append the new entry
          const updatedInstructions = currentInstructions 
            ? `${currentInstructions}\n${newEntry}`
            : newEntry
          
          console.log(`[ADDITIONAL_FILES] Updated instructions:`, updatedInstructions)
          
          // Update the case
          const supabase = getSupabaseClient()
          const { data, error } = await supabase
            .from('cases')
            .update({ 
              special_instructions: updatedInstructions,
              updated_at: new Date().toISOString() 
            })
            .eq('id', caseId)
            .select()
          
          if (error) {
            console.error('[ADDITIONAL_FILES] Error updating special_instructions:', error)
            throw error
          }
          
          console.log(`[ADDITIONAL_FILES] Successfully updated case special_instructions`, data)
        } catch (error) {
          console.error('[ADDITIONAL_FILES] Failed to update special_instructions:', error)
          // Don't fail the operation if this fails
        }
      } else {
        console.log(`[ADDITIONAL_FILES] Skipping special_instructions update - instructions: "${specificInstructions}", services: ${services.length}`)
      }
    }

    // Save files to database with additional_upload_id
    if (uploadedFiles.length > 0 && additionalUploadId) {
      console.log(`[ADDITIONAL_FILES] Saving ${uploadedFiles.length} files to database`)
      await SupabaseDB.createFilesWithAdditionalUpload(
        uploadedFiles.map(file => ({
          ...file,
          additional_upload_id: additionalUploadId
        }))
      )
    }

    // Update case timestamp
    const supabase = getSupabaseClient()
    await supabase
      .from('cases')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', caseId)

    // Log the action
    await SupabaseDB.createAuditLog({
      action: 'UPLOAD',
      entity_type: 'case',
      entity_id: caseId,
      user_id: session.user.id,
      organization_id: user.organization_id,
      new_values: { 
        files_count: uploadedFiles.length, 
        services_count: services.length,
        specific_instructions: specificInstructions 
      }
    })

    // Send additional files notification email
    try {
      const emailService = createEmailService()
      await emailService.sendAdditionalFilesNotification(
        caseId,
        uploadedFiles.length,
        session.user.name || session.user.email
      )
    } catch (emailError) {
      console.error('[ADDITIONAL_FILES] Failed to send notification:', emailError)
      // Don't fail the operation if email fails
    }

    console.log(`[ADDITIONAL_FILES] Successfully processed additional files for case ${caseRecord.case_number}`)

    // If case status is DELIVERED, change it back to PENDING
    if (caseRecord.status === 'DELIVERED') {
      console.log('[ADDITIONAL_FILES] Case was DELIVERED, changing status to PENDING')
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
          reason: 'additional_files_uploaded',
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
        console.error('[ADDITIONAL_FILES] Failed to send status change notification:', emailError)
        // Don't fail the operation if email fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      filesUploaded: uploadedFiles.length,
      servicesAdded: services.length
    })

  } catch (error) {
    console.error('[ADDITIONAL_FILES] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}