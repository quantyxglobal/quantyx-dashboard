import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { S3Service } from '@/lib/s3-service'
import { createClient } from '@supabase/supabase-js'

// Supabase fallback client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get file information from database
    let file
    try {
      file = await prisma.file.findUnique({
        where: { id },
        include: {
          case: {
            select: {
              id: true,
              organization_id: true,
              owner_id: true
            }
          }
        }
      })
    } catch (prismaError) {
      console.log('[FILE_DOWNLOAD] Prisma failed, using Supabase fallback:', prismaError)
      
      const { data: fileData, error: fileError } = await supabase
        .from('files')
        .select(`
          *,
          cases!inner(id, organization_id, owner_id)
        `)
        .eq('id', id)
        .single()

      if (fileError || !fileData) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }

      file = {
        ...fileData,
        case: fileData.cases
      }
    }

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Check authorization
    const userCanAccess = 
      session.user.role === 'admin' || 
      file.case.owner_id === session.user.id ||
      file.uploaded_by_id === session.user.id

    if (!userCanAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Generate presigned URL for download
    const downloadUrl = await S3Service.getDownloadUrl(file.s3_key, 3600) // 1 hour expiry

    return NextResponse.json({
      downloadUrl,
      filename: file.original_filename,
      contentType: file.mime_type,
      size: file.file_size
    })

  } catch (error) {
    console.error('[FILE_DOWNLOAD] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}