import { NextRequest, NextResponse } from 'next/server'
import { websiteSubmissionService } from '@/lib/website-submission-service'
import { z } from 'zod'
import { corsHeaders, handleOptions, corsResponse } from '../cors'

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
  return handleOptions()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = contactFormSchema.parse(body)
    
    // Create contact inquiry in database
    const result = await websiteSubmissionService.createContactInquiry(validatedData)
    
    if (!result.success) {
      return corsResponse(
        { error: result.error || 'Failed to submit contact form' },
        500
      )
    }

    return corsResponse({
      success: true,
      message: 'Contact form submitted successfully',
      inquiryId: result.id
    })

  } catch (error) {
    console.error('Contact form API error:', error)
    
    if (error instanceof z.ZodError) {
      return corsResponse(
        { error: 'Invalid form data', details: error.errors },
        400
      )
    }

    return corsResponse(
      { error: 'Internal server error' },
      500
    )
  }
}