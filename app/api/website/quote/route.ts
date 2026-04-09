import { websiteSubmissionService } from '@/lib/website-submission-service'
import { postmarkEmailService } from '@/lib/postmark-email-service'
import { z } from 'zod'
import { getCorsHeaders } from '@/lib/cors'

export const dynamic = 'force-dynamic'

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

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin')
  return new Response(null, {
    status: 200,
    headers: {
      ...getCorsHeaders(origin)
    }
  })
}

export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)
    
    const body = await req.json()
    
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
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to submit quote request' }),
        { 
          status: 500, 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    // Send email notifications
    try {
      console.log('[QUOTE API] Sending email notifications...')
      
      // Build file list with download links
      const fileListHtml = validatedData.uploadedFiles.map(file => `
        <li style="margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 4px;">
          <strong>${file.originalName}</strong> (${(file.size / 1024 / 1024).toFixed(2)} MB)
          <br>
          <small style="color: #666;">Type: ${file.mimeType}</small>
          <br>
          <a href="${file.downloadUrl}" style="color: #262083; text-decoration: none;">📥 Download File</a>
          <br>
          <small style="color: #666;">Download link expires in 7 days</small>
        </li>
      `).join('')
      
      const fileListText = validatedData.uploadedFiles.map(file => 
        `- ${file.originalName} (${(file.size / 1024 / 1024).toFixed(2)} MB)\n  Download: ${file.downloadUrl}`
      ).join('\n')
      
      // Email to admin/support team
      const adminEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #262083;">New Quote Request Received</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>From:</strong> ${validatedData.fullName}</p>
            <p><strong>Email:</strong> ${validatedData.email}</p>
            <p><strong>Phone:</strong> ${validatedData.phone}</p>
            <p><strong>Firm:</strong> ${validatedData.firmName || 'Not provided'}</p>
            <p><strong>Services Requested:</strong> ${validatedData.services.join(', ')}</p>
          </div>
          ${validatedData.caseDetails ? `
            <h3>Case Details:</h3>
            <div style="background: #ffffff; padding: 15px; border-left: 4px solid #262083; margin: 10px 0;">
              ${validatedData.caseDetails.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
          <h3>Uploaded Documents (${validatedData.uploadedFiles.length} files):</h3>
          <ul style="list-style: none; padding: 0;">
            ${fileListHtml}
          </ul>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Quote Request ID: ${result.id}<br>
            Submitted at: ${new Date().toLocaleString()}
          </p>
        </div>
      `
      
      const adminEmailText = `
New Quote Request Received

From: ${validatedData.fullName}
Email: ${validatedData.email}
Phone: ${validatedData.phone}
Firm: ${validatedData.firmName || 'Not provided'}
Services: ${validatedData.services.join(', ')}
${validatedData.caseDetails ? `\nCase Details:\n${validatedData.caseDetails}\n` : ''}
Uploaded Files (${validatedData.uploadedFiles.length}):
${fileListText}

Quote Request ID: ${result.id}
Submitted at: ${new Date().toLocaleString()}
      `
      
      await postmarkEmailService.sendEmail({
        to: process.env.POSTMARK_CONTACT_EMAIL || 'contact@quantyxg.com',
        subject: `New Quote Request from ${validatedData.fullName}`,
        htmlBody: adminEmailHtml,
        textBody: adminEmailText,
        emailType: 'support',
        replyTo: validatedData.email
      })
      
      // Confirmation email to user
      const userEmailHtml = `
        <h2>Quote Request Received</h2>
        <p>Dear ${validatedData.fullName},</p>
        <p>Thank you for your quote request. We have received your documents and will review them carefully.</p>
        <h3>What happens next?</h3>
        <ul>
          <li>Our medical-legal experts will review your documents at the earliest</li>
          <li>We will prepare a detailed quotation based on your specific requirements</li>
          <li>You will receive the quote via email along with project timeline information</li>
        </ul>
        <p><strong>Your submission summary:</strong></p>
        <ul>
          <li>Services Requested: ${validatedData.services.join(', ')}</li>
          <li>Documents Uploaded: ${validatedData.uploadedFiles.length} files</li>
        </ul>
        <p>If you have any questions, please contact us at contact@quantyxg.com</p>
        <p>Best regards,<br>The Quantyx Global Team</p>
      `
      
      const userEmailText = `
Quote Request Received

Dear ${validatedData.fullName},

Thank you for your quote request. We have received your documents and will review them carefully.

What happens next:
- Our medical-legal experts will review your documents at the earliest
- We will prepare a detailed quotation based on your specific requirements
- You will receive the quote via email along with project timeline information

Your submission summary:
- Services Requested: ${validatedData.services.join(', ')}
- Documents Uploaded: ${validatedData.uploadedFiles.length} files

If you have any questions, please contact us at contact@quantyxg.com

Best regards,
The Quantyx Global Team
      `
      
      await postmarkEmailService.sendEmail({
        to: validatedData.email,
        subject: 'Quote Request Received - Quantyx Global',
        htmlBody: userEmailHtml,
        textBody: userEmailText,
        emailType: 'contact'
      })
      
      console.log('[QUOTE API] Email notifications sent successfully')
    } catch (emailError) {
      console.error('[QUOTE API] Email sending failed:', emailError)
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote request submitted successfully',
        quoteRequestId: result.id,
        filesUploaded: validatedData.uploadedFiles.length
      }),
      { 
        status: 200, 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )

  } catch (error) {
    const origin = req.headers.get('origin')
    const corsHeaders = getCorsHeaders(origin)
    
    console.error('Quote form API error:', error)
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ error: 'Invalid form data', details: error.errors }),
        { 
          status: 400, 
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    )
  }
}