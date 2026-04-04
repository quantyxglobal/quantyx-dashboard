import { PrismaClient } from '@prisma/client'
import { prisma } from './prisma'
import { logAuditAction } from './audit-log'

/**
 * Email Notification Service
 * 
 * Handles automated email notifications for case events with template system,
 * retry logic for failed deliveries, and comprehensive audit logging.
 * 
 * Features:
 * - Template-based email system
 * - Event-driven notifications (case creation, additional files, additional requests)
 * - Retry mechanism for failed deliveries (up to 3 attempts)
 * - Audit logging for all email events
 * - Support for both client users and admin users
 */

export interface EmailTemplate {
  subject: string
  htmlBody: string
  textBody: string
}

export interface EmailRecipient {
  email: string
  name: string
  role: 'client' | 'admin'
}

export interface EmailNotificationData {
  caseId: string
  caseTitle: string
  firmName: string
  eventType: 'case_created' | 'additional_files' | 'additional_request' | 'case_status_updated' | 'password_changed' | 'user_created' | 'firm_created' | 'user_assigned' | 'password_reset'
  eventDetails?: string
  actionUrl?: string
  temporaryPassword?: string
  updatedBy?: string
}

export interface EmailDeliveryResult {
  success: boolean
  messageId?: string
  error?: string
  attemptCount: number
}

export interface EmailNotificationResult {
  success: boolean
  deliveredCount: number
  failedCount: number
  errors: string[]
}

// Email service configuration
export interface EmailServiceConfig {
  provider: 'console' | 'sendgrid' | 'ses' | 'smtp' | 'aws-ses'
  apiKey?: string
  fromEmail: string
  fromName: string
  replyToEmail?: string
  // AWS SES configuration
  awsRegion?: string
  awsAccessKeyId?: string
  awsSecretAccessKey?: string
  supportEmail?: string
  smtpConfig?: {
    host: string
    port: number
    secure: boolean
    auth: {
      user: string
      pass: string
    }
  }
}

export class EmailNotificationService {
  private prisma: PrismaClient
  private config: EmailServiceConfig
  private maxRetries: number = 3

  constructor(
    config: EmailServiceConfig,
    prismaClient: PrismaClient = prisma
  ) {
    this.prisma = prismaClient
    this.config = config
  }

  /**
   * Sends notification when a new case is created
   * @param caseId - The ID of the created case
   * @param recipients - Array of email recipients
   * @returns Promise<EmailNotificationResult>
   */
  async sendCaseCreatedNotification(
    caseId: string,
    recipients?: EmailRecipient[]
  ): Promise<EmailNotificationResult> {
    try {
      // Get case details with firm and user information
      const caseData = await this.getCaseWithDetails(caseId)
      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      // Get recipients if not provided
      const emailRecipients = recipients || await this.getCaseRecipients(caseId)

      const notificationData: EmailNotificationData = {
        caseId: caseData.case_id,
        caseTitle: caseData.case_title,
        firmName: caseData.firm.name,
        eventType: 'case_created',
        eventDetails: `New case "${caseData.case_title}" has been created`,
        actionUrl: `${process.env.NEXTAUTH_URL}/dashboard/cases/${caseData.id}`
      }

      // Generate email template
      const template = this.generateCaseCreatedTemplate(notificationData)

      // Send emails to all recipients
      const results = await this.sendEmailsWithRetry(emailRecipients, template, notificationData)

      // Log audit event
      await this.logEmailEvent(
        'case_created_notification',
        caseId,
        emailRecipients,
        results.success,
        results.errors.length > 0 ? results.errors.join('; ') : undefined
      )

      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Log failed notification attempt
      await this.logEmailEvent(
        'case_created_notification_failed',
        caseId,
        recipients || [],
        false,
        errorMessage
      )

      return {
        success: false,
        deliveredCount: 0,
        failedCount: recipients?.length || 0,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Sends notification when additional files are uploaded to a case
   * @param caseId - The ID of the case
   * @param recipients - Array of email recipients
   * @returns Promise<EmailNotificationResult>
   */
  async sendAdditionalFilesNotification(
    caseId: string,
    recipients?: EmailRecipient[]
  ): Promise<EmailNotificationResult> {
    try {
      // Get case details
      const caseData = await this.getCaseWithDetails(caseId)
      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      // Get recipients if not provided
      const emailRecipients = recipients || await this.getCaseRecipients(caseId)

      const notificationData: EmailNotificationData = {
        caseId: caseData.case_id,
        caseTitle: caseData.case_title,
        firmName: caseData.firm.name,
        eventType: 'additional_files',
        eventDetails: `Additional files have been uploaded to case "${caseData.case_title}"`,
        actionUrl: `${process.env.NEXTAUTH_URL}/dashboard/cases/${caseData.id}`
      }

      // Generate email template
      const template = this.generateAdditionalFilesTemplate(notificationData)

      // Send emails to all recipients
      const results = await this.sendEmailsWithRetry(emailRecipients, template, notificationData)

      // Log audit event
      await this.logEmailEvent(
        'additional_files_notification',
        caseId,
        emailRecipients,
        results.success,
        results.errors.length > 0 ? results.errors.join('; ') : undefined
      )

      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Log failed notification attempt
      await this.logEmailEvent(
        'additional_files_notification_failed',
        caseId,
        recipients || [],
        false,
        errorMessage
      )

      return {
        success: false,
        deliveredCount: 0,
        failedCount: recipients?.length || 0,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Sends notification when an additional request is submitted
   * @param caseId - The ID of the case
   * @param recipients - Array of email recipients
   * @returns Promise<EmailNotificationResult>
   */
  async sendAdditionalRequestNotification(
    caseId: string,
    recipients?: EmailRecipient[]
  ): Promise<EmailNotificationResult> {
    try {
      // Get case details
      const caseData = await this.getCaseWithDetails(caseId)
      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      // Get recipients if not provided
      const emailRecipients = recipients || await this.getCaseRecipients(caseId)

      const notificationData: EmailNotificationData = {
        caseId: caseData.case_id,
        caseTitle: caseData.case_title,
        firmName: caseData.firm.name,
        eventType: 'additional_request',
        eventDetails: `An additional service request has been submitted for case "${caseData.case_title}"`,
        actionUrl: `${process.env.NEXTAUTH_URL}/dashboard/cases/${caseData.id}`
      }

      // Generate email template
      const template = this.generateAdditionalRequestTemplate(notificationData)

      // Send emails to all recipients
      const results = await this.sendEmailsWithRetry(emailRecipients, template, notificationData)

      // Log audit event
      await this.logEmailEvent(
        'additional_request_notification',
        caseId,
        emailRecipients,
        results.success,
        results.errors.length > 0 ? results.errors.join('; ') : undefined
      )

      return results
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Log failed notification attempt
      await this.logEmailEvent(
        'additional_request_notification_failed',
        caseId,
        recipients || [],
        false,
        errorMessage
      )

      return {
        success: false,
        deliveredCount: 0,
        failedCount: recipients?.length || 0,
        errors: [errorMessage]
      }
    }
  }

  /**
   * Sends user invitation email
   * @param email - Recipient email address
   * @param invitationToken - Invitation token for registration
   * @param firmName - Name of the law firm
   * @param inviterName - Name of the person sending the invitation
   * @returns Promise<EmailDeliveryResult>
   */
  async sendUserInvitation(
    email: string,
    invitationToken: string,
    firmName: string,
    inviterName: string
  ): Promise<EmailDeliveryResult> {
    try {
      const recipient: EmailRecipient = {
        email,
        name: email, // Use email as name since we don't have the actual name yet
        role: 'client'
      }

      const registrationUrl = `${process.env.NEXTAUTH_URL}/register?token=${invitationToken}`
      
      const template: EmailTemplate = {
        subject: `Invitation to join ${firmName} on Quantyx Global Case Management`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">You're Invited to Join ${firmName}</h2>
            <p>Hello,</p>
            <p>${inviterName} has invited you to join <strong>${firmName}</strong> on the Quantyx Global Case Management platform.</p>
            <p>Click the link below to accept the invitation and create your account:</p>
            <p style="margin: 20px 0;">
              <a href="${registrationUrl}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Accept Invitation</a>
            </p>
            <p>This invitation will expire in 7 days.</p>
            <p>If you have any questions, please contact ${inviterName} or reply to this email.</p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 12px;">
              Quantyx Global Case Management<br>
              This is an automated message. Please do not reply directly to this email.
            </p>
          </div>
        `,
        textBody: `
You're Invited to Join ${firmName}

Hello,

${inviterName} has invited you to join ${firmName} on the Quantyx Global Case Management platform.

To accept the invitation and create your account, visit:
${registrationUrl}

This invitation will expire in 7 days.

If you have any questions, please contact ${inviterName}.

---
Quantyx Global Case Management
This is an automated message.
        `.trim()
      }

      const result = await this.sendEmailWithRetry(recipient, template)

      // Log audit event
      await this.logEmailEvent(
        'user_invitation_sent',
        null,
        [recipient],
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Log failed invitation attempt
      await this.logEmailEvent(
        'user_invitation_failed',
        null,
        [{ email, name: email, role: 'client' }],
        false,
        errorMessage
      )

      return {
        success: false,
        error: errorMessage,
        attemptCount: 1
      }
    }
  }

  /**
   * Sends email with new account credentials
   * @param email - User email address
   * @param userName - User's full name
   * @param temporaryPassword - Temporary password
   * @param firmName - Name of the law firm
   * @param creatorName - Name of the person who created the account
   * @param firmNumber - Firm number
   * @returns Promise<EmailDeliveryResult>
   */
  async sendEmail(emailData: {
    to: string
    subject: string
    text: string
    html: string
  }): Promise<EmailDeliveryResult> {
    try {
      const recipient: EmailRecipient = {
        email: emailData.to,
        name: emailData.to,
        role: 'admin' // Support email is admin role
      }

      const template: EmailTemplate = {
        subject: emailData.subject,
        htmlBody: emailData.html,
        textBody: emailData.text
      }

      const result = await this.sendEmailWithRetry(recipient, template)

      // Log audit event
      await this.logEmailEvent(
        'support_email_sent',
        null,
        [recipient],
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      // Log failed email attempt
      await this.logEmailEvent(
        'support_email_failed',
        null,
        [{ email: emailData.to, name: emailData.to, role: 'admin' }],
        false,
        errorMessage
      )

      return {
        success: false,
        error: errorMessage,
        attemptCount: 1
      }
    }
  }

  /**
   * Gets case details with firm and user information
   * @param caseId - The ID of the case
   * @returns Promise with case details or null
   */
  private async getCaseWithDetails(caseId: string) {
    return await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        firm: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true
              }
            }
          }
        }
      }
    })
  }

  /**
   * Gets email recipients for a case (firm users + admin users)
   * @param caseId - The ID of the case
   * @returns Promise<EmailRecipient[]>
   */
  private async getCaseRecipients(caseId: string): Promise<EmailRecipient[]> {
    const caseData = await this.getCaseWithDetails(caseId)
    if (!caseData) {
      return []
    }

    const recipients: EmailRecipient[] = []

    // Add firm users
    for (const user of caseData.firm.users) {
      recipients.push({
        email: user.email,
        name: user.name,
        role: user.role === 'admin' ? 'admin' : 'client'
      })
    }

    // Add admin users from other firms (if any)
    const adminUsers = await this.prisma.user.findMany({
      where: {
        role: 'admin',
        NOT: {
          firm_id: caseData.firm_id
        }
      },
      select: {
        email: true,
        name: true,
        role: true
      }
    })

    for (const admin of adminUsers) {
      recipients.push({
        email: admin.email,
        name: admin.name,
        role: 'admin'
      })
    }

    return recipients
  }

  /**
   * Sends emails to multiple recipients with retry logic
   * @param recipients - Array of email recipients
   * @param template - Email template
   * @param notificationData - Notification data for logging
   * @returns Promise<EmailNotificationResult>
   */
  private async sendEmailsWithRetry(
    recipients: EmailRecipient[],
    template: EmailTemplate,
    notificationData: EmailNotificationData
  ): Promise<EmailNotificationResult> {
    const results: EmailDeliveryResult[] = []
    const errors: string[] = []

    for (const recipient of recipients) {
      const result = await this.sendEmailWithRetry(recipient, template)
      results.push(result)
      
      if (!result.success && result.error) {
        errors.push(`${recipient.email}: ${result.error}`)
      }
    }

    const deliveredCount = results.filter(r => r.success).length
    const failedCount = results.filter(r => !r.success).length

    return {
      success: failedCount === 0,
      deliveredCount,
      failedCount,
      errors
    }
  }

  /**
   * Sends a single email with retry logic
   * @param recipient - Email recipient
   * @param template - Email template
   * @returns Promise<EmailDeliveryResult>
   */
  private async sendEmailWithRetry(
    recipient: EmailRecipient,
    template: EmailTemplate
  ): Promise<EmailDeliveryResult> {
    let lastError: string | undefined
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const messageId = await this.sendEmail(recipient, template)
        return {
          success: true,
          messageId,
          attemptCount: attempt
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        
        // Log retry attempt
        if (attempt < this.maxRetries) {
          console.warn(`Email delivery attempt ${attempt} failed for ${recipient.email}: ${lastError}. Retrying...`)
          
          // Wait before retry (exponential backoff)
          await this.delay(Math.pow(2, attempt) * 1000)
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attemptCount: this.maxRetries
    }
  }

  /**
   * Sends a single email using the configured email service
   * @param recipient - Email recipient
   * @param template - Email template
   * @returns Promise<string> - Message ID
   */
  private async sendEmail(
    recipient: EmailRecipient,
    template: EmailTemplate
  ): Promise<string> {
    switch (this.config.provider) {
      case 'console':
        return this.sendEmailViaConsole(recipient, template)
      case 'sendgrid':
        return this.sendEmailViaSendGrid(recipient, template)
      case 'ses':
        return this.sendEmailViaSES(recipient, template)
      case 'smtp':
        return this.sendEmailViaSMTP(recipient, template)
      default:
        throw new Error(`Unsupported email provider: ${this.config.provider}`)
    }
  }

  /**
   * Console email provider (for development/testing)
   */
  private async sendEmailViaConsole(
    recipient: EmailRecipient,
    template: EmailTemplate
  ): Promise<string> {
    console.log('=== EMAIL NOTIFICATION ===')
    console.log(`To: ${recipient.name} <${recipient.email}>`)
    console.log(`From: ${this.config.fromName} <${this.config.fromEmail}>`)
    console.log(`Subject: ${template.subject}`)
    console.log('--- TEXT BODY ---')
    console.log(template.textBody)
    console.log('--- HTML BODY ---')
    console.log(template.htmlBody)
    console.log('=========================')
    
    return `console-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * SendGrid email provider (placeholder - requires SendGrid SDK)
   */
  private async sendEmailViaSendGrid(
    recipient: EmailRecipient,
    template: EmailTemplate
  ): Promise<string> {
    // This would require @sendgrid/mail package
    throw new Error('SendGrid provider not implemented. Install @sendgrid/mail and implement.')
  }

  /**
   * AWS SES email provider (placeholder - requires AWS SES SDK)
   */
  private async sendEmailViaSES(
    recipient: EmailRecipient,
    template: EmailTemplate
  ): Promise<string> {
    // This would require @aws-sdk/client-ses package
    throw new Error('AWS SES provider not implemented. Install @aws-sdk/client-ses and implement.')
  }

  /**
   * SMTP email provider (placeholder - requires nodemailer)
   */
  private async sendEmailViaSMTP(
    recipient: EmailRecipient,
    template: EmailTemplate
  ): Promise<string> {
    // This would require nodemailer package
    throw new Error('SMTP provider not implemented. Install nodemailer and implement.')
  }

  /**
   * Generates email template for case creation notification
   */
  private generateCaseCreatedTemplate(data: EmailNotificationData): EmailTemplate {
    return {
      subject: `New Case Created: ${data.caseId} - ${data.caseTitle}`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #262083;">New Case Created</h2>
          <p><strong>Case ID:</strong> ${data.caseId}</p>
          <p><strong>Case Title:</strong> ${data.caseTitle}</p>
          <p><strong>Law Firm:</strong> ${data.firmName}</p>
          <p>${data.eventDetails}</p>
          ${data.actionUrl ? `
            <p style="margin: 20px 0;">
              <a href="${data.actionUrl}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Case</a>
            </p>
          ` : ''}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Quantyx Global Case Management<br>
            This is an automated notification. Please do not reply directly to this email.
          </p>
        </div>
      `,
      textBody: `
New Case Created

Case ID: ${data.caseId}
Case Title: ${data.caseTitle}
Law Firm: ${data.firmName}

${data.eventDetails}

${data.actionUrl ? `View Case: ${data.actionUrl}` : ''}

---
Quantyx Global Case Management
This is an automated notification.
      `.trim()
    }
  }

  /**
   * Generates email template for additional files notification
   */
  private generateAdditionalFilesTemplate(data: EmailNotificationData): EmailTemplate {
    return {
      subject: `Additional Files Uploaded: ${data.caseId} - ${data.caseTitle}`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #262083;">Additional Files Uploaded</h2>
          <p><strong>Case ID:</strong> ${data.caseId}</p>
          <p><strong>Case Title:</strong> ${data.caseTitle}</p>
          <p><strong>Law Firm:</strong> ${data.firmName}</p>
          <p>${data.eventDetails}</p>
          ${data.actionUrl ? `
            <p style="margin: 20px 0;">
              <a href="${data.actionUrl}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Case</a>
            </p>
          ` : ''}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Quantyx Global Case Management<br>
            This is an automated notification. Please do not reply directly to this email.
          </p>
        </div>
      `,
      textBody: `
Additional Files Uploaded

Case ID: ${data.caseId}
Case Title: ${data.caseTitle}
Law Firm: ${data.firmName}

${data.eventDetails}

${data.actionUrl ? `View Case: ${data.actionUrl}` : ''}

---
Quantyx Global Case Management
This is an automated notification.
      `.trim()
    }
  }

  /**
   * Generates email template for additional request notification
   */
  private generateAdditionalRequestTemplate(data: EmailNotificationData): EmailTemplate {
    return {
      subject: `Additional Service Request: ${data.caseId} - ${data.caseTitle}`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #262083;">Additional Service Request</h2>
          <p><strong>Case ID:</strong> ${data.caseId}</p>
          <p><strong>Case Title:</strong> ${data.caseTitle}</p>
          <p><strong>Law Firm:</strong> ${data.firmName}</p>
          <p>${data.eventDetails}</p>
          ${data.actionUrl ? `
            <p style="margin: 20px 0;">
              <a href="${data.actionUrl}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Case</a>
            </p>
          ` : ''}
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          <p style="color: #666; font-size: 12px;">
            Quantyx Global Case Management<br>
            This is an automated notification. Please do not reply directly to this email.
          </p>
        </div>
      `,
      textBody: `
Additional Service Request

Case ID: ${data.caseId}
Case Title: ${data.caseTitle}
Law Firm: ${data.firmName}

${data.eventDetails}

${data.actionUrl ? `View Case: ${data.actionUrl}` : ''}

---
Quantyx Global Case Management
This is an automated notification.
      `.trim()
    }
  }

  /**
   * Logs email events for audit purposes
   */
  private async logEmailEvent(
    action: string,
    caseId: string | null,
    recipients: EmailRecipient[],
    success: boolean,
    error?: string
  ): Promise<void> {
    try {
      const details = JSON.stringify({
        recipients: recipients.map(r => ({ email: r.email, role: r.role })),
        success,
        error,
        timestamp: new Date().toISOString()
      })

      // Skip database logging in test environment
      if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
        console.log(`Email audit log (test mode): ${action}`, {
          caseId,
          recipientCount: recipients.length,
          success,
          error
        })
        return
      }

      // Log to audit system - use first recipient's email as user context if available
      if (recipients.length > 0) {
        // Try to find a user ID for the first recipient
        const user = await this.prisma.user.findFirst({
          where: { email: recipients[0].email },
          select: { id: true }
        })

        if (user) {
          await logAuditAction({
            userId: user.id,
            action,
            details: `${caseId ? `Case: ${caseId}, ` : ''}${details}`
          })
        }
      }

      // Also log to console for debugging
      console.log(`Email audit log: ${action}`, {
        caseId,
        recipientCount: recipients.length,
        success,
        error
      })
    } catch (auditError) {
      // Don't fail the email operation if audit logging fails
      console.error('Failed to log email event:', auditError)
    }
  }

  /**
   * Utility function to add delay for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// Default configuration factory (lazy-loaded to avoid build-time errors)
const getDefaultConfig = (): EmailServiceConfig => ({
  provider: 'console',
  fromEmail: process.env.EMAIL_FROM || 'noreply@quantyxglobal.com',
  fromName: 'Quantyx Global Case Management',
  replyToEmail: process.env.EMAIL_REPLY_TO || 'support@quantyxglobal.com'
})

// Lazy-loaded singleton instance
let _emailNotificationServiceInstance: EmailNotificationService | null = null

// Export a default instance getter for convenience
export const getEmailNotificationService = (): EmailNotificationService => {
  if (!_emailNotificationServiceInstance) {
    _emailNotificationServiceInstance = new EmailNotificationService(getDefaultConfig())
  }
  return _emailNotificationServiceInstance
}

// For backward compatibility - lazy getter
export const emailNotificationService = new Proxy({} as EmailNotificationService, {
  get(target, prop) {
    return getEmailNotificationService()[prop as keyof EmailNotificationService]
  }
})