import { notFound } from 'next/navigation'
import { auth } from '@/auth'
import { getCaseById } from '@/lib/db/queries'
import { SupabaseDB } from '@/lib/supabase-db'
import { CaseHeader } from '@/components/case-header'
import { CaseDetailsSection } from '@/components/case-details-section'
import { CaseServicesSection } from '@/components/case-services-section'
import { CaseFilesSection } from '@/components/case-files-section'

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()

  if (!session?.user) {
    return notFound()
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

  // Filter files by source
  // Client uploads: CASE_UPLOAD, WEBSITE_QUOTE
  // Admin/Output files: GENERATED_OUTPUT, ADDITIONAL_UPLOAD (admin uploads to output folder)
  // Additional client uploads: ADDITIONAL_UPLOAD (client uploads to additional files-dd-mm-yy folder)
  const rawFiles = caseData.files.filter((file) => 
    file.source === 'CASE_UPLOAD' || file.source === 'WEBSITE_QUOTE'
  )
  const outputFiles = caseData.files.filter((file) => 
    file.source === 'GENERATED_OUTPUT' || (file.source === 'ADDITIONAL_UPLOAD' && file.s3_key.includes('/output/'))
  )
  const additionalFiles = caseData.files.filter((file) =>
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
    console.error('[CASE_DETAIL] Error fetching additional uploads:', error)
    // Continue without additional uploads data - will fall back to date grouping
  }
  
  const existingServices = caseData.services.map(s => s.service?.slug || s.service_id)
  const selectedServices = caseData.services.map(s => s.service)
  const isClient = session.user.role === 'client'

  return (
    <div className="space-y-8">
      {/* Case Header */}
      <CaseHeader caseData={caseData} />
      
      {/* Case Description */}
      {caseData.description && (
        <CaseDetailsSection description={caseData.description} />
      )}

      {/* Services Section */}
      <CaseServicesSection 
        caseId={caseData.id}
        existingServices={existingServices}
        selectedServices={selectedServices}
        isClient={isClient}
      />

      {/* Specific Instructions */}
      {caseData.special_instructions && (
        <div className="bg-card rounded-lg border border-border p-6 shadow-card">
          <h2 className="text-xl font-semibold text-foreground mb-4">Specific Instructions</h2>
          <div className="prose prose-sm max-w-none">
            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {caseData.special_instructions}
            </p>
          </div>
        </div>
      )}

      {/* Files Section */}
      <CaseFilesSection 
        caseId={caseData.id}
        rawFiles={rawFiles}
        outputFiles={outputFiles}
        additionalFiles={additionalFiles}
        existingServices={existingServices}
        isClient={isClient}
        caseServices={caseData.services}
        additionalUploads={additionalUploads}
      />
    </div>
  )
}
