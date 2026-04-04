'use server'

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { S3Service } from '@/lib/s3-service'
import { caseIdGeneratorService } from '@/lib/case-id-generator'
import { supabaseEmailService } from '@/lib/supabase-email-service'
import { SupabaseDB } from '@/lib/supabase-db'
import { randomUUID } from 'crypto'

const getCreateCaseSchema = () => z.object({
  case_title: z.string().min(1, 'Case title is required').max(200, 'Case title must be less than 200 characters'),
  description: z.string().optional(),
  specific_instructions: z.string().optional(),
  timeline: z.enum(['SUPER_RUSH', 'EXPEDITE', 'NORMAL']).default('NORMAL'),
  estimate_required: z.boolean().default(false),
  services: z.array(z.string()).min(1, 'At least one service is required'),
})

export async function createCase(formData: FormData) {
  const session = await auth()
  
  if (!session) {
    redirect('/login')
  }

  // Get user's organization_id
  const user: any = await SupabaseDB.getUserById(session.user.id)

  if (!user || !user.organization_id) {
    return { success: false, error: 'User is not associated with an organization' }
  }

  // Parse services from JSON string
  let services: string[] = []
  try {
    const servicesData = formData.get('services')
    if (servicesData) {
      services = JSON.parse(servicesData as string)
    }
  } catch (error) {
    return { success: false, error: 'Invalid services data' }
  }

  const validatedFields = getCreateCaseSchema().safeParse({
    case_title: formData.get('case_title'),
    description: formData.get('description'),
    specific_instructions: formData.get('specific_instructions'),
    timeline: formData.get('timeline') || 'NORMAL',
    estimate_required: formData.get('estimate_required') === 'true',
    services,
  })

  if (!validatedFields.success) {
    return { success: false, error: validatedFields.error.issues[0]?.message || 'Invalid input' }
  }

  const { case_title, description, specific_instructions, timeline, estimate_required, services: selectedServices } = validatedFields.data

  try {
    // Generate unique case ID
    const caseId = await caseIdGeneratorService.generateCaseId(user.organization_id)

    // Create case using Supabase
    const newCase: any = await SupabaseDB.createCase({
      case_number: caseId,
      title: case_title,
      description: description || null,
      client_name: `${user.first_name} ${user.last_name}`,
      client_email: session.user.email || '',
      status: 'PENDING',
      priority: timeline === 'SUPER_RUSH' ? 'SUPER_RUSH' : timeline === 'EXPEDITE' ? 'EXPEDITE' : 'NORMAL',
      organization_id: user.organization_id,
      owner_id: session.user.id,
      special_instructions: specific_instructions || null,
      estimate_required: estimate_required,
    })

    // Create case services relationships
    console.log('[CREATE_CASE] Processing services:', selectedServices)
    if (selectedServices.length > 0) {
      try {
        // Look up the actual service IDs from the slugs
        console.log('[CREATE_CASE] Looking up services with Supabase...')
        const services: any[] = await SupabaseDB.getServicesBySlugs(selectedServices)
        console.log('[CREATE_CASE] Supabase service lookup successful:', services)

        console.log(`[CREATE_CASE] Found ${services.length} services for slugs:`, selectedServices)

        // Only create relationships for services that exist
        if (services.length > 0) {
          const caseServiceData = services.map(service => ({
            id: randomUUID(),
            case_id: newCase.id,
            service_id: service.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }))
          console.log('[CREATE_CASE] Creating case service relationships:', caseServiceData)

          await SupabaseDB.createCaseServices(caseServiceData)
          console.log('[CREATE_CASE] Supabase case services creation successful')
          console.log(`[CREATE_CASE] Successfully created ${services.length} case service relationships`)
        } else {
          console.log('[CREATE_CASE] No matching services found in database, skipping service relationships')
        }
      } catch (serviceError) {
        console.error('[CREATE_CASE] Error creating case services:', serviceError)
        // Don't fail the entire case creation if services fail
      }
    } else {
      console.log('[CREATE_CASE] No services selected, skipping service relationships')
    }

    // Handle file uploads
    const fileCount = parseInt(formData.get('file_count') as string || '0')
    console.log(`[CREATE_CASE] Processing ${fileCount} files for upload`)
    
    if (fileCount > 0) {
      const uploadPromises = []
      
      for (let i = 0; i < fileCount; i++) {
        const file = formData.get(`file_${i}`) as File
        if (file && file.size > 0) {
          console.log(`[CREATE_CASE] Processing file ${i}: ${file.name} (${file.size} bytes)`)
          uploadPromises.push(
            (async () => {
              try {
                // Generate unique filename for S3 with case NUMBER (not UUID) in cases folder structure
                // This creates: cases/{caseNumber}/input/{timestamp}-{random}-{filename}
                const s3Key = S3Service.generateFileKey(file.name, caseId, 'cases')
                
                console.log(`[CREATE_CASE] Uploading file to S3 with key: ${s3Key}`)
                
                // Upload to S3
                const { url: s3Url } = await S3Service.uploadFile(s3Key, file)

                console.log('[CREATE_CASE] File uploaded to S3 successfully:', {
                  filename: file.name,
                  s3Key,
                  s3Url,
                  size: file.size
                })

                // Extract file extension
                const fileExtension = file.name.split('.').pop()
                
                // Save file record to database
                const fileRecord = {
                  id: randomUUID(),
                  filename: file.name,
                  original_filename: file.name,
                  file_extension: fileExtension ? `.${fileExtension}` : null,
                  mime_type: file.type,
                  file_size: file.size,
                  s3_bucket: process.env.AWS_S3_BUCKET_NAME!,
                  s3_key: s3Key,
                  s3_region: process.env.AWS_REGION!,
                  source: 'CASE_UPLOAD' as const,
                  category: 'OTHER' as const,
                  case_id: newCase.id,
                  uploaded_by_id: session.user.id,
                }

                console.log('[CREATE_CASE] Saving file record with Supabase...')
                await SupabaseDB.createFile(fileRecord)
                console.log('[CREATE_CASE] Supabase file record creation successful')
              } catch (error) {
                console.error(`[CREATE_CASE] Error uploading file ${file.name}:`, error)
                // Continue with other files even if one fails
              }
            })()
          )
        } else {
          console.log(`[CREATE_CASE] Skipping empty file at index ${i}`)
        }
      }

      // Wait for all uploads to complete
      console.log(`[CREATE_CASE] Waiting for ${uploadPromises.length} file uploads to complete...`)
      await Promise.all(uploadPromises)
      console.log('[CREATE_CASE] All file uploads completed')
    } else {
      console.log('[CREATE_CASE] No files to upload')
    }

    // Log the action
    try {
      await SupabaseDB.createAuditLog({
        action: 'CREATE',
        entity_type: 'Case',
        entity_id: newCase.id,
        user_id: session.user.id,
        organization_id: user.organization_id,
        new_values: {
          case_number: caseId,
          title: case_title,
          services: selectedServices,
          file_count: fileCount
        }
      })
    } catch (auditError) {
      console.error('Failed to create audit log:', auditError)
      // Don't fail the operation if audit log fails
    }

    // Send case creation notification email to info@quantyxg.com
    try {
      await supabaseEmailService.sendCaseCreatedNotification(
        newCase.id,
        `${user.first_name} ${user.last_name}` || session.user.email
      )
    } catch (emailError) {
      console.error('Failed to send case creation notification:', emailError)
      // Don't fail the operation if email fails
    }

    revalidatePath('/dashboard')
    return { success: true, caseId: newCase.id, generatedCaseId: caseId }
  } catch (error) {
    console.error('Error creating case:', error)
    return { success: false, error: 'Failed to create case' }
  }
}