import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import * as XLSX from 'xlsx'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'

// Configure route for dynamic rendering and longer timeout
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds for file processing

/**
 * POST /api/convert/excel-to-word
 * Convert Excel file to Word document
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

    // Only internal staff can access file conversion
    if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'MANAGER' && role !== 'EMPLOYEE') {
      return NextResponse.json(
        { error: 'Forbidden: Only internal staff can convert files' },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv']
    const fileName = file.name.toLowerCase()
    const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))
    
    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Only Excel (.xlsx, .xls) and CSV files are supported.' },
        { status: 400 }
      )
    }

    console.log('[FILE CONVERT] Processing file:', file.name, 'Size:', file.size)

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: 'Excel file has no sheets' },
        { status: 400 }
      )
    }

    console.log('[FILE CONVERT] Workbook sheets:', workbook.SheetNames)

    // Create Word document
    const doc = new Document({
      sections: []
    })

    // Process each sheet
    const sections = []
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      
      // Convert sheet to 2D array
      const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
      
      if (data.length === 0) {
        console.log('[FILE CONVERT] Sheet is empty:', sheetName)
        continue
      }

      console.log('[FILE CONVERT] Processing sheet:', sheetName, 'Rows:', data.length)

      // Add sheet title
      const paragraphs: Paragraph[] = [
        new Paragraph({
          text: sheetName,
          heading: 'Heading1',
          spacing: { before: 400, after: 200 }
        })
      ]

      // Create table from data
      const tableRows: TableRow[] = []
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        const cells: TableCell[] = []
        
        // Get maximum number of columns
        const maxCols = Math.max(...data.map(r => r.length))
        
        for (let j = 0; j < maxCols; j++) {
          const cellValue = row[j] !== undefined && row[j] !== null ? String(row[j]) : ''
          
          cells.push(
            new TableCell({
              children: [new Paragraph(cellValue)],
              width: { size: 100 / maxCols, type: WidthType.PERCENTAGE },
              margins: {
                top: 100,
                bottom: 100,
                left: 100,
                right: 100
              }
            })
          )
        }
        
        tableRows.push(
          new TableRow({
            children: cells,
            // First row is header
            tableHeader: i === 0
          })
        )
      }

      const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1 },
          bottom: { style: BorderStyle.SINGLE, size: 1 },
          left: { style: BorderStyle.SINGLE, size: 1 },
          right: { style: BorderStyle.SINGLE, size: 1 },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1 },
          insideVertical: { style: BorderStyle.SINGLE, size: 1 }
        }
      })

      sections.push({
        children: [...paragraphs, table, new Paragraph({ text: '' })]
      })
    }

    // Create document with all sections
    const finalDoc = new Document({ sections })

    // Generate Word document buffer
    const docBuffer = await Packer.toBuffer(finalDoc)

    console.log('[FILE CONVERT] Word document created, size:', docBuffer.length)

    // Return as downloadable file
    const outputFileName = file.name.replace(/\.(xlsx|xls|csv)$/i, '.docx')
    
    return new NextResponse(docBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${outputFileName}"`,
        'Content-Length': docBuffer.length.toString()
      }
    })
  } catch (error) {
    console.error('[FILE CONVERT] Unexpected error:', error)
    console.error('[FILE CONVERT] Error stack:', error instanceof Error ? error.stack : 'No stack')
    
    return NextResponse.json(
      { 
        error: 'Failed to convert file', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
