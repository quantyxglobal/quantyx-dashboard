import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { PDFDocument } from 'pdf-lib'

// Configure route for dynamic rendering and longer timeout
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for PDF processing

/**
 * POST /api/convert/merge-pdf
 * Merge multiple PDF files in the exact order they are uploaded
 * Only accessible by internal staff (ADMIN, MANAGER, EMPLOYEE)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { role } = session.user as any

    // Only internal staff can access PDF merger
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER' && role !== 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'Forbidden: Only internal staff can merge PDFs' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    if (files.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 PDF files are required for merging' },
        { status: 400 }
      )
    }

    console.log('[PDF MERGE] Merging', files.length, 'PDFs in order:', files.map(f => f.name).join(', '))

    // Validate all files are PDFs
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        return NextResponse.json(
          { error: `Invalid file type: ${file.name}. Only PDF files are supported.` },
          { status: 400 }
        )
      }
    }

    // Create a new PDF document
    const mergedPdf = await PDFDocument.create()

    // Process each PDF in the exact order uploaded
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      console.log(`[PDF MERGE] Processing file ${i + 1}/${files.length}: ${file.name}`)
      
      try {
        // Convert file to array buffer
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        
        // Load the PDF
        const pdf = await PDFDocument.load(uint8Array, { 
          ignoreEncryption: true,
          updateMetadata: false 
        })
        
        // Get all page indices
        const pageCount = pdf.getPageCount()
        console.log(`[PDF MERGE] ${file.name}: ${pageCount} pages`)
        
        // Copy all pages from this PDF to merged PDF (in order)
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())
        
        // Add each copied page to the merged document
        for (const page of copiedPages) {
          mergedPdf.addPage(page)
        }
        
        console.log(`[PDF MERGE] Added ${pageCount} pages from ${file.name}`)
      } catch (error) {
        console.error(`[PDF MERGE] Error processing ${file.name}:`, error)
        return NextResponse.json(
          { 
            error: `Failed to process ${file.name}. Make sure it's a valid PDF file.`,
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 400 }
        )
      }
    }

    const totalPages = mergedPdf.getPageCount()
    console.log(`[PDF MERGE] Merge complete. Total pages: ${totalPages}`)

    // Set metadata
    mergedPdf.setTitle('Merged Document')
    mergedPdf.setProducer('Quantyx Global Document Merger')
    mergedPdf.setCreator('Quantyx Global')
    mergedPdf.setCreationDate(new Date())

    // Generate merged PDF bytes
    const mergedPdfBytes = await mergedPdf.save()

    console.log('[PDF MERGE] Merged PDF size:', mergedPdfBytes.length, 'bytes')

    // Return as downloadable file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const outputFileName = `merged-document-${timestamp}.pdf`
    
    return new NextResponse(mergedPdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        'Content-Length': mergedPdfBytes.length.toString()
      }
    })
  } catch (error) {
    console.error('[PDF MERGE] Unexpected error:', error)
    console.error('[PDF MERGE] Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        error: 'Failed to merge PDFs', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
