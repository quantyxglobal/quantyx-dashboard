import { NextRequest, NextResponse } from 'next/server'
import { websiteSubmissionService } from '@/lib/website-submission-service'
import { z } from 'zod'
import { getCorsHeaders } from '../cors'

// Validation schema for contact form
const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  company: z.string().min(1, 'Law firm/organization is required'),
  services: z.array(z.string()).default([]),
  message: z.string().optional(),
  uploadedFiles: z.array(z.object({
    s3Key: z.string(),
    downloadUrl: z.string(),
    originalName: z.string(),
    size: z.number(),
    mimeType: z.string()
  })).optional().default([])
})

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin')
  const headers = getCorsHeaders(origin)
  return new NextResponse(null, { status: 204, headers })
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get('origin')
    const dynamicCorsHeaders = getCorsHeaders(origin)
    
    const body = await request.json()
    
    // Validate input
    const validatedData = contactFormSchema.parse(body)
    
    // Create contact inquiry in database
    const result = await websiteSubmissionService.createContactInquiry(validatedData)
    
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to submit contact form' },
        { status: 500, headers: dynamicCorsHeaders }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Contact form submitted successfully',
      inquiryId: result.id
    }, { status: 200, headers: dynamicCorsHeaders })

  } catch (error) {
    const origin = request.headers.get('origin')
    const dynamicCorsHeaders = getCorsHeaders(origin)
    
    console.error('Contact form API error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid form data', details: error.errors },
        { status: 400, headers: dynamicCorsHeaders }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: dynamicCorsHeaders }
    )
  }
}