import { websiteSubmissionService } from '@/lib/website-submission-service'
import { postmarkEmailService } from '@/lib/postmark-email-service'
import { z } from 'zod'
import { getCorsHeaders } from '@/lib/cors'

export const dynamic = 'force-dynamic'

// Validation schema for contact form
const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  company: z.string().min(1, 'Law firm/organization is required'),
  country: z.string().min(1, 'Country is required'),
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
    const validatedData = contactFormSchema.parse(body)
    
    // Create contact inquiry in database
    const result = await websiteSubmissionService.createContactInquiry(validatedData)
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ error: result.error || 'Failed to submit contact form' }),
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
      console.log('[CONTACT API] Sending email notifications...')
      
      // Build file list with download links (if any files were uploaded)
      const fileListHtml = validatedData.uploadedFiles && validatedData.uploadedFiles.length > 0 
        ? validatedData.uploadedFiles.map(file => `
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
        : ''
      
      const fileListText = validatedData.uploadedFiles && validatedData.uploadedFiles.length > 0
        ? validatedData.uploadedFiles.map(file => 
            `- ${file.originalName} (${(file.size / 1024 / 1024).toFixed(2)} MB)\n  Download: ${file.downloadUrl}`
          ).join('\n')
        : ''
      
      // Email to admin/support team
      const adminEmailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #262083;">New Contact Form Submission</h2>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Name:</strong> ${validatedData.firstName} ${validatedData.lastName}</p>
            <p><strong>Email:</strong> ${validatedData.email}</p>
            <p><strong>Phone:</strong> ${validatedData.phone}</p>
            <p><strong>Company:</strong> ${validatedData.company || 'Not provided'}</p>
            <p><strong>Country:</strong> ${validatedData.country}</p>
            <p><strong>Services Interested:</strong> ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'None specified'}</p>
          </div>
          ${validatedData.message ? `
            <h3>Message:</h3>
            <div style="background: #ffffff; padding: 15px; border-left: 4px solid #262083; margin: 10px 0;">
              ${validatedData.message.replace(/\n/g, '<br>')}
            </div>
          ` : ''}
          ${fileListHtml ? `
            <h3>Uploaded Documents (${validatedData.uploadedFiles.length} files):</h3>
            <ul style="list-style: none; padding: 0;">
              ${fileListHtml}
            </ul>
          ` : ''}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Contact Inquiry ID: ${result.id}<br>
            Submitted at: ${new Date().toLocaleString()}
          </p>
        </div>
      `
      
      const adminEmailText = `
New Contact Form Submission

Name: ${validatedData.firstName} ${validatedData.lastName}
Email: ${validatedData.email}
Phone: ${validatedData.phone}
Company: ${validatedData.company || 'Not provided'}
Country: ${validatedData.country}
Services Interested: ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'None specified'}
${validatedData.message ? `\nMessage:\n${validatedData.message}\n` : ''}
${fileListText ? `\nUploaded Files (${validatedData.uploadedFiles.length}):\n${fileListText}\n` : ''}
Contact Inquiry ID: ${result.id}
Submitted at: ${new Date().toLocaleString()}
      `
      
      await postmarkEmailService.sendEmail({
        to: process.env.POSTMARK_CONTACT_EMAIL || 'contact@quantyxg.com',
        subject: `New Contact Form Submission from ${validatedData.firstName} ${validatedData.lastName}`,
        htmlBody: adminEmailHtml,
        textBody: adminEmailText,
        emailType: 'support',
        replyTo: validatedData.email
      })
      
      // Confirmation email to user - phone numbers based on country
      let phoneNumbers = '+91 70751 84488 (India)';
      const country = validatedData.country.toLowerCase();
      
      if (country.includes('united states') || country.includes('usa') || country.includes('us')) {
        phoneNumbers = '+91 70751 84488 (India), +1 816-266-2122 (USA)';
      } else if (country.includes('australia')) {
        phoneNumbers = '+91 70751 84488 (India), +61 452 257 129 (Australia)';
      }
      
      const userEmailHtml = `
        <h2>Thank you for contacting Quantyx Global!</h2>
        <p>Dear ${validatedData.firstName},</p>
        <p>We have received your message and will get back to you at the earliest.</p>
        <p>Our team of medical-legal experts will review your inquiry and provide you with the information you need.</p>
        <p><strong>Your submission details:</strong></p>
        <ul>
          <li>Services of Interest: ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'General inquiry'}</li>
        </ul>
        <p>If you have any urgent questions, please don't hesitate to call us at ${phoneNumbers}.</p>
        <p>Best regards,<br>The Quantyx Global Team</p>
      `
      
      const userEmailText = `
Thank you for contacting Quantyx Global!

Dear ${validatedData.firstName},

We have received your message and will get back to you at the earliest.

Your submission details:
- Services of Interest: ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'General inquiry'}

If you have any urgent questions, please call us at ${phoneNumbers}.

Best regards,
The Quantyx Global Team
      `
      
      await postmarkEmailService.sendEmail({
        to: validatedData.email,
        subject: 'Thank you for contacting Quantyx Global',
        htmlBody: userEmailHtml,
        textBody: userEmailText,
        emailType: 'contact'
      })
      
      console.log('[CONTACT API] Email notifications sent successfully')
    } catch (emailError) {
      console.error('[CONTACT API] Email sending failed:', emailError)
      // Don't fail the request if email fails
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Contact form submitted successfully',
        inquiryId: result.id
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
    
    console.error('Contact form API error:', error)
    
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