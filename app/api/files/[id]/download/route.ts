import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canAccessFile } from '@/lib/db/queries'
import { generatePresignedUrl } from '@/lib/s3'
import { getSupabaseClient } from '@/lib/supabase-db'

// Configure dynamic rendering for authentication
export const dynamic = 'force-dynamic'

/**
 * GET /api/files/[id]/download
 * 
 * Generates a pre-signed URL for downloading a file from S3.
 * Requires authentication and authorization to access the file.
 * 
 * @param request - The incoming request
 * @param params - Route parameters containing the file ID
 * @returns JSON response with the pre-signed URL or error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify session authentication
    const session = await auth()
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { id: fileId } = await params

    // Check file access authorization
    const hasAccess = await canAccessFile(
      fileId,
      session.user.id,
      session.user.role
    )

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Get file from database using Supabase
    const supabase = getSupabaseClient()
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('id, s3_key')
      .eq('id', fileId)
      .single()

    if (fileError || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Generate pre-signed URL
    const url = await generatePresignedUrl(file.s3_key)

    return NextResponse.json({ url })
  } catch (error) {
    // Log error server-side with context (no sensitive info)
    console.error('File download error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (await auth())?.user?.id,
      timestamp: new Date().toISOString()
    })
    
    // Handle specific error types
    if (error instanceof Error) {
      // S3 errors
      if (error.message.includes('S3') || error.message.includes('AWS')) {
        return NextResponse.json(
          { error: 'File storage temporarily unavailable. Please try again.' },
          { status: 503 }
        )
      }
      
      // Database errors (Prisma)
      if (error.message.includes('Prisma') || error.message.includes('database')) {
        return NextResponse.json(
          { error: 'Database temporarily unavailable. Please try again.' },
          { status: 503 }
        )
      }
    }
    
    // Generic error (no sensitive info exposed)
    return NextResponse.json(
      { error: 'Failed to generate download link. Please try again.' },
      { status: 500 }
    )
  }
}
