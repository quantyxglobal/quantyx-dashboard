import { NextRequest, NextResponse } from 'next/server'
import { websiteSubmissionService } from '@/lib/website-submission-service'
import { z } from 'zod'
import { corsHeaders, handleOptions, corsResponse } from '../cors'

// Validation schema for quote form
const quoteFormSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  firmName: z.string().optional(),
  caseDetails: z.string().optional(),
  services: z.array(z.string()).min(1, 'At least one service is required'),
  uploadedFiles: z.array(z.object({
    s3Key: z.string(),
    downloadUrl: z.string(),
    originalName: z.string(),
    size: z.number(),
    mimeType: z.string(),
  })).min(1, 'At least one file is required'),
})

export async function OPTIONS(request: NextRequest) {
  return handleOptions()
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate input
    const validatedData = quoteFormSchema.parse(body)
    
    // Prepare file data for database
    const fileData = validatedData.uploadedFiles.map(file => ({
      filename: file.s3Key.split('/').pop() || file.originalName,
      originalName: file.originalName,
      s3Key: file.s3Key,
      fileSize: file.size,
      mimeType: file.mimeType,
      downloadUrl: file.downloadUrl,
      downloadExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    }))
    
    // Create quote request in database
    const result = await websiteSubmissionService.createQuoteRequest(
      {
        fullName: validatedData.fullName,
        email: validatedData.email,
        phone: validatedData.phone,
        firmName: validatedData.firmName,
        caseDetails: validatedData.caseDetails,
        services: validatedData.services,
      },
      fileData
    )
    
    if (!result.success) {
      return corsResponse(
        { error: result.error || 'Failed to submit quote request' },
        500
      )
    }

    return corsResponse({
      success: true,
      message: 'Quote request submitted successfully',
      quoteRequestId: result.id,
      filesUploaded: validatedData.uploadedFiles.length
    })

  } catch (error) {
    console.error('Quote form API error:', error)
    
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