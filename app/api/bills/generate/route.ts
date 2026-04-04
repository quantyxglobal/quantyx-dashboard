import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { generateBillPDF } from '@/lib/pdf-generator'

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

    // Return DOCX as response
    return new NextResponse(docxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${billData.billNumber}.docx"`
      }
    })
  } catch (error) {
    console.error('Error generating bill:', error)
    return NextResponse.json(
      { error: 'Failed to generate bill' },
      { status: 500 }
    )
  }
}
