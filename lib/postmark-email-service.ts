import * as postmark from 'postmark'

/**
 * Postmark Email Service for Quantyx Global
 * Handles all email communications with proper sender configuration
 */
export class PostmarkEmailService {
  private client: postmark.ServerClient
  
  // Email addresses configuration
  private readonly emailConfig = {
    admin: {
      email: process.env.POSTMARK_ADMIN_EMAIL || 'admin@quantyxg.com',
      name: process.env.POSTMARK_ADMIN_NAME || 'Quantix Global Admin'
    },
    support: {
      email: process.env.POSTMARK_SUPPORT_EMAIL || 'support@quantyxg.com',
      name: process.env.POSTMARK_SUPPORT_NAME || 'Quantix Global Support'
    },
    noreply: {
      email: process.env.POSTMARK_NOREPLY_EMAIL || 'noreply@quantyxg.com',
      name: process.env.POSTMARK_NOREPLY_NAME || 'Quantix Global System'
    }
  }

  constructor() {
    const serverToken = process.env.POSTMARK_SERVER_TOKEN
    
    if (!serverToken) {
      throw new Error('POSTMARK_SERVER_TOKEN is not configured')
    }

    this.client = new postmark.ServerClient(serverToken)
  }

  /**
   * Get sender configuration based on email type
   */
  private getSenderConfig(emailType: EmailType): { email: string; name: string } {
    switch (emailType) {
      case 'admin':
        return this.emailConfig.admin
      case 'support':
      case 'case_notification':
      case 'case_update':
        return this.emailConfig.support
      case 'system':
      case 'security':
      case 'noreply':
        return this.emailConfig.noreply
      default:
        return this.emailConfig.support
    }
  }

  /**
   * Send email using Postmark
   */
  async sendEmail(params: {
    to: string | string[]
    subject: string
    htmlBody: string
    textBody: string
    emailType: EmailType
    replyTo?: string
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const sender = this.getSenderConfig(params.emailType)
      const recipients = Array.isArray(params.to) ? params.to.join(',') : params.to

      console.log('[POSTMARK] Sending email:', {
        from: `${sender.name} <${sender.email}>`,
        to: recipients,
        subject: params.subject,
        emailType: params.emailType
      })

      const result = await this.client.sendEmail({
        From: `${sender.name} <${sender.email}>`,
        To: recipients,
        Subject: params.subject,
        HtmlBody: params.htmlBody,
        TextBody: params.textBody,
        ReplyTo: params.replyTo || sender.email,
        MessageStream: 'outbound'
      })

      console.log('[POSTMARK] Email sent successfully:', {
        messageId: result.MessageID,
        to: recipients
      })

      return {
        success: true,
        messageId: result.MessageID,
      }
    } catch (error) {
      console.error('[POSTMARK] Send error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send bulk emails (for notifications to multiple recipients)
   */
  async sendBulkEmail(params: {
    recipients: string[]
    subject: string
    htmlBody: string
    textBody: string
    emailType: EmailType
    replyTo?: string
  }): Promise<{ success: boolean; results: Array<{ email: string; success: boolean; messageId?: string; error?: string }> }> {
    const results = await Promise.all(
      params.recipients.map(async (email) => {
        const result = await this.sendEmail({
          to: email,
          subject: params.subject,
          htmlBody: params.htmlBody,
          textBody: params.textBody,
          emailType: params.emailType,
          replyTo: params.replyTo,
        })
        
        return {
          email,
          ...result,
        }
      })
    )

    const successCount = results.filter(r => r.success).length
    
    return {
      success: successCount > 0,
      results,
    }
  }
}

/**
 * Email types for proper sender configuration
 */
export type EmailType = 
  | 'admin'           // Administrative emails (admin@quantyxg.com)
  | 'support'         // General support emails (support@quantyxg.com)
  | 'case_notification' // Case-related emails (support@quantyxg.com)
  | 'case_update'     // Case status updates (support@quantyxg.com)
  | 'system'          // System notifications (noreply@quantyxg.com)
  | 'security'        // Security alerts (noreply@quantyxg.com)
  | 'noreply'         // No-reply emails (noreply@quantyxg.com)

// Export singleton instance
export const postmarkEmailService = new PostmarkEmailService()
