import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses'

/**
 * AWS SES Email Service for Quantyx Global
 * Handles all email communications with proper sender configuration
 */
export class AWSSESService {
  private sesClient: SESClient
  
  // Email addresses configuration
  private readonly emailConfig = {
    admin: {
      email: process.env.SES_ADMIN_EMAIL || 'admin@quantyxg.com',
      name: process.env.SES_ADMIN_NAME || 'Quantyx Global Admin'
    },
    support: {
      email: process.env.SES_SUPPORT_EMAIL || 'support@quantyxg.com',
      name: process.env.SES_SUPPORT_NAME || 'Quantyx Global Support'
    },
    noreply: {
      email: process.env.SES_NOREPLY_EMAIL || 'noreply@quantyxglobal.com',
      name: process.env.SES_NOREPLY_NAME || 'Quantyx Global System'
    }
  }

  constructor() {
    this.sesClient = new SESClient({
      region: process.env.SES_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      }
    })
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
   * Send email using AWS SES
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
      const recipients = Array.isArray(params.to) ? params.to : [params.to]

      console.log('[AWS_SES] Sending email:', {
        from: `${sender.name} <${sender.email}>`,
        to: recipients,
        subject: params.subject,
        emailType: params.emailType
      })

      const emailParams: SendEmailCommandInput = {
        Source: `${sender.name} <${sender.email}>`,
        Destination: {
          ToAddresses: recipients,
        },
        Message: {
          Subject: {
            Data: params.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: params.htmlBody,
              Charset: 'UTF-8',
            },
            Text: {
              Data: params.textBody,
              Charset: 'UTF-8',
            },
          },
        },
        ReplyToAddresses: params.replyTo ? [params.replyTo] : [sender.email],
      }

      const command = new SendEmailCommand(emailParams)
      const result = await this.sesClient.send(command)

      console.log('[AWS_SES] Email sent successfully:', {
        messageId: result.MessageId,
        to: recipients
      })

      return {
        success: true,
        messageId: result.MessageId,
      }
    } catch (error) {
      console.error('[AWS_SES] Send error:', error)
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
  | 'system'          // System notifications (noreply@quantyxglobal.com)
  | 'security'        // Security alerts (noreply@quantyxglobal.com)
  | 'noreply'         // No-reply emails (noreply@quantyxglobal.com)

// Lazy-loaded singleton instance
let _awsSESServiceInstance: AWSSESService | null = null

export const getAWSSESService = (): AWSSESService => {
  if (!_awsSESServiceInstance) {
    _awsSESServiceInstance = new AWSSESService()
  }
  return _awsSESServiceInstance
}

export const awsSESService = new Proxy({} as AWSSESService, {
  get(target, prop) {
    return getAWSSESService()[prop as keyof AWSSESService]
  }
})