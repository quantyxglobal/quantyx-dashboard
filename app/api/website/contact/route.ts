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
      
      // Email to admin/support team
      const adminEmailHtml = `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${validatedData.firstName} ${validatedData.lastName}</p>
        <p><strong>Email:</strong> ${validatedData.email}</p>
        <p><strong>Phone:</strong> ${validatedData.phone}</p>
        <p><strong>Company:</strong> ${validatedData.company || 'Not provided'}</p>
        <p><strong>Services Interested:</strong> ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'None specified'}</p>
        ${validatedData.message ? `<p><strong>Message:</strong><br>${validatedData.message.replace(/\n/g, '<br>')}</p>` : ''}
        <p>Contact Inquiry ID: ${result.id}</p>
      `
      
      const adminEmailText = `
New Contact Form Submission

Name: ${validatedData.firstName} ${validatedData.lastName}
Email: ${validatedData.email}
Phone: ${validatedData.phone}
Company: ${validatedData.company || 'Not provided'}
Services Interested: ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'None specified'}
${validatedData.message ? `Message:\n${validatedData.message}\n` : ''}
Contact Inquiry ID: ${result.id}
      `
      
      await postmarkEmailService.sendEmail({
        to: process.env.POSTMARK_SUPPORT_EMAIL || 'support@quantyxg.com',
        subject: `New Contact Form Submission from ${validatedData.firstName} ${validatedData.lastName}`,
        htmlBody: adminEmailHtml,
        textBody: adminEmailText,
        emailType: 'support',
        replyTo: validatedData.email
      })
      
      // Confirmation email to user
      const userEmailHtml = `
        <h2>Thank you for contacting Quantix Global!</h2>
        <p>Dear ${validatedData.firstName},</p>
        <p>We have received your message and will get back to you within 24 hours.</p>
        <p>Our team of medical-legal experts will review your inquiry and provide you with the information you need.</p>
        <p><strong>Your submission details:</strong></p>
        <ul>
          <li>Services of Interest: ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'General inquiry'}</li>
        </ul>
        <p>If you have any urgent questions, please don't hesitate to call us at +91 70751 84488.</p>
        <p>Best regards,<br>The Quantix Global Team</p>
      `
      
      const userEmailText = `
Thank you for contacting Quantix Global!

Dear ${validatedData.firstName},

We have received your message and will get back to you within 24 hours.

Your submission details:
- Services of Interest: ${validatedData.services.length > 0 ? validatedData.services.join(', ') : 'General inquiry'}

If you have any urgent questions, please call us at +91 70751 84488.

Best regards,
The Quantix Global Team
      `
      
      await postmarkEmailService.sendEmail({
        to: validatedData.email,
        subject: 'Thank you for contacting Quantix Global',
        htmlBody: userEmailHtml,
        textBody: userEmailText,
        emailType: 'support'
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