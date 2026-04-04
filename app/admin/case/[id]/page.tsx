import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getCaseById } from '@/lib/db/queries'
import { SupabaseDB } from '@/lib/supabase-db'
import { CaseHeader } from '@/components/case-header'
import { CaseFilesSection } from '@/components/case-files-section'
import { FileUploadModal } from '@/components/admin/file-upload-modal'
import { CaseStatusDropdown } from '@/components/admin/case-status-dropdown'
import { AssignCaseDropdown } from '@/components/admin/assign-case-dropdown'
import { SpecialInstructionsSection } from '@/components/admin/special-instructions-section'
import { BillGeneratorModal } from '@/components/admin/bill-generator-modal'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function AdminCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session?.user) {
    console.log('[ADMIN_CASE] No session found')
    return notFound()
  }

  console.log('[ADMIN_CASE] Session role:', session.user.role)

  // Verify admin or employee role
  if (session.user.role !== 'admin' && session.user.role !== 'employee') {
    console.log('[ADMIN_CASE] Role check failed - not admin or employee')
    return notFound()
  }

  console.log('[ADMIN_CASE] Role check passed')

  // Get actual user role from database to check for EMPLOYEE
  let isEmployee = false
  try {
    if (session.user?.id) {
      const currentUser = await SupabaseDB.getUserById(session.user.id) as any
      isEmployee = currentUser?.role === 'EMPLOYEE'
    }
  } catch (error) {
    console.error('Error fetching user role:', error)
    // Default to false if there's an error
  }

  // Await params in Next.js 15+
  const { id } = await params

  const caseData = await getCaseById(
    id,
    session.user.id,
    session.user.role
  )

  if (!caseData) {
    return notFound()
  }

  // Group files by source
  // Client uploads: CASE_UPLOAD, WEBSITE_QUOTE
  // Admin/Output files: GENERATED_OUTPUT, ADDITIONAL_UPLOAD (admin uploads to output folder)
  // Additional client uploads: ADDITIONAL_UPLOAD (client uploads to additional files-dd-mm-yy folder)
  const uploadedFiles = caseData.files.filter((file: any) => 
    file.source === 'CASE_UPLOAD' || file.source === 'WEBSITE_QUOTE'
  )
  
  const outputFiles = caseData.files.filter((file: any) => 
    file.source === 'GENERATED_OUTPUT' || (file.source === 'ADDITIONAL_UPLOAD' && file.s3_key.includes('/output/'))
  )
  
  const additionalFiles = caseData.files.filter((file: any) =>
    file.source === 'ADDITIONAL_UPLOAD' && file.s3_key.includes('/additional files-')
  )

  // Fetch additional uploads data with services and instructions
  let additionalUploads: any[] = []
  try {
    const additionalUploadsData = await SupabaseDB.getAdditionalFileUploadsByCase(id)
    additionalUploads = (additionalUploadsData || []).map((upload: any) => ({
      id: upload.id,
      upload_date: upload.upload_date,
      services: upload.services || [],
      specific_instructions: upload.specific_instructions,
      files: upload.files || []
    }))
  } catch (error) {
    console.error('[ADMIN_CASE] Error fetching additional uploads:', error)
    // Continue without additional uploads data - will fall back to date grouping
  }

  // Fetch case assignments (multiple employees)
  let assignedEmployeeIds: string[] = []
  try {
    const assignments = await SupabaseDB.getCaseAssignments(id)
    assignedEmployeeIds = assignments.map((a: any) => a.user_id)
  } catch (error) {
    console.error('[ADMIN_CASE] Error fetching case assignments:', error)
    // Continue without assignments
  }

  const existingServices = caseData.case_services?.map((s: any) => s.service?.slug || s.service_id) || []

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Admin Controls Card - Only show for non-employees */}
      {!isEmployee && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="default" className="bg-primary">
                Admin Controls
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <CaseStatusDropdown 
                  caseId={caseData.id} 
                  currentStatus={caseData.status} 
                />
              </div>
              
              <div className="space-y-2">
                <AssignCaseDropdown
                  caseId={caseData.id}
                  currentAssigneeIds={assignedEmployeeIds}
                  organizationId={caseData.organization_id}
                />
              </div>
            </div>
            
            <div className="mt-4">
              <FileUploadModal caseId={caseData.id} />
            </div>

            <div className="mt-4">
              <BillGeneratorModal
                caseId={caseData.id}
                caseNumber={caseData.case_number}
                caseTitle={caseData.title}
                clientName={caseData.client_name}
                clientEmail={caseData.client_email}
                firmName={caseData.organization?.name || 'N/A'}
                addressLine1={caseData.organization?.address_line1}
                addressLine2={caseData.organization?.address_line2}
                city={caseData.organization?.city}
                state={caseData.organization?.state}
                country={caseData.organization?.country}
                caseServices={caseData.services || []}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Case Header */}
      <CaseHeader caseData={caseData} />
      
      {/* Specific Instructions Section */}
      <div className="mt-6">
        <SpecialInstructionsSection specialInstructions={caseData.special_instructions} />
      </div>
      
      {/* File Sections */}
      <div className="mt-8">
        <CaseFilesSection 
          caseId={caseData.id}
          rawFiles={uploadedFiles}
          outputFiles={outputFiles}
          additionalFiles={additionalFiles}
          existingServices={existingServices}
          isClient={false}
          caseServices={caseData.case_services || []}
          additionalUploads={additionalUploads}
        />
      </div>
    </div>
  )
}
