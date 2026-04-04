import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateBillPDF } from '@/lib/pdf-generator'
import { S3Service } from '@/lib/s3-service'
import { SupabaseDB } from '@/lib/supabase-db'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and super admins can generate bills
    if (session.user.role !== 'admin' && session.user.role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const billData = await request.json()

    // Generate DOCX from template
    const docxBuffer = await generateBillPDF(billData)

    // Upload to S3 in the output folder
    const fileName = `${billData.billNumber}.docx`
    const s3Key = `cases/${billData.caseNumber}/output/${fileName}`

    const { url, key } = await S3Service.uploadFile(
      s3Key,
      docxBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )

    // Create file record in database
    const fileRecord = await SupabaseDB.createFile({
      id: crypto.randomUUID(),
      filename: fileName,
      original_filename: fileName,
      file_size: docxBuffer.length,
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      s3_bucket: process.env.AWS_S3_BUCKET_NAME || 'quantyx-global',
      s3_key: s3Key,
      s3_region: process.env.AWS_REGION || 'ap-south-2',
      source: 'GENERATED_OUTPUT',
      category: 'OTHER',
      case_id: billData.caseId,
      uploaded_by_id: session.user.id
    })

    // Create audit log
    await SupabaseDB.createAuditLog({
      action: 'UPLOAD',
      entity_type: 'file',
      entity_id: fileRecord.id,
      user_id: session.user.id,
      organization_id: session.user.organizationId || '',
      new_values: {
        file_name: fileName,
        case_id: billData.caseId,
        type: 'bill',
        bill_number: billData.billNumber,
        total_amount: billData.total
      }
    })

    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
      s3Key: s3Key,
      downloadUrl: url
    })
  } catch (error) {
    console.error('Error generating and uploading bill:', error)
    return NextResponse.json(
      { error: 'Failed to generate and upload bill' },
      { status: 500 }
    )
  }
}
