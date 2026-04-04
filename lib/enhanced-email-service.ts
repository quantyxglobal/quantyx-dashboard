import { EmailNotificationService, EmailRecipient, EmailDeliveryResult, EmailNotificationResult } from './email-notification-service'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
 'crypto'
import { awsSESService, EmailType } from './aws-ses-service'

/**
 * Enhanced Email Service with comprehensive notification triggers
 * Extends the base EmailNotificationService with additional notification types
 */
export class EnhancedEmailService extends EmailNotificationService {
  
  /**
   * Enhanced email sending with AWS SES
   */
  async sendEmailWithSES(
    recipient: EmailRecipient,
    template: { subject: string; htmlBody: string; textBody: string },
    emailType: EmailType = 'support'
  ): Promise<EmailDeliveryResult> {
    try {
      const result = await awsSESService.sendEmail({
        to: recipient.email,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        emailType,
      })

      return {
        success: result.success,
        error: result.error,
        attemptCount: 1,
        messageId: result.messageId,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        attemptCount: 1,
      }
    }
  }

  /**
   * Send emails to multiple recipients with AWS SES
   */
  async sendEmailsWithSES(
    recipients: EmailRecipient[],
    template: { subject: string; htmlBody: string; textBody: string },
    emailType: EmailType = 'support'
  ): Promise<EmailNotificationResult> {
    try {
      const emailAddresses = recipients.map(r => r.email)
      
      const result = await awsSESService.sendBulkEmail({
        recipients: emailAddresses,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        emailType,
      })

      const deliveryResults: EmailDeliveryResult[] = result.results.map(r => ({
        success: r.success,
        error: r.error,
        attemptCount: 1,
        messageId: r.messageId,
      }))

      return {
        success: result.success,
        results: deliveryResults,
        error: result.success ? undefined : 'Some emails failed to send',
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        results: [],
      }
    }
  }
  private generateSecurePassword(length: number = 12): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    let password = ''
    
    // Ensure at least one character from each category
    const categories = [
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      'abcdefghijklmnopqrstuvwxyz', 
      '0123456789',
      '!@#$%^&*'
    ]
    
    // Add one character from each category
    categories.forEach(category => {
      password += category.charAt(Math.floor(Math.random() * category.length))
    })
    
    // Fill the rest randomly
    for (let i = password.length; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length))
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  /**
   * Creates a new user account with auto-generated password and sends welcome email
   */
  async createUserWithPassword(
    email: string,
    name: string,
    firmId: string,
    role: 'client' = 'client',
    createdBy: string
  ): Promise<{ success: boolean; error?: string; temporaryPassword?: string; userId?: string }> {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      })

      if (existingUser) {
        return { success: false, error: 'User with this email already exists' }
      }

      // Generate secure temporary password
      const temporaryPassword = this.generateSecurePassword()
      const hashedPassword = await bcrypt.hash(temporaryPassword, 12)

      // Get firm details
      const firm = await prisma.firm.findUnique({
        where: { id: firmId }
      })

      if (!firm) {
        return { success: false, error: 'Firm not found' }
      }

      // Create user account
      const newUser = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name,
          password_hash: hashedPassword,
          role,
          firm_id: firmId
        }
      })

      // Send welcome email with temporary password
      const emailResult = await this.sendUserCreatedWithPasswordEmail(
        email,
        name,
        firm.name,
        temporaryPassword,
        createdBy
      )

      if (!emailResult.success) {
        // If email fails, delete the created user
        await prisma.user.delete({ where: { id: newUser.id } })
        return { success: false, error: 'Failed to send welcome email' }
      }

      // Log audit action
      await prisma.auditLog.create({
        data: {
          user_id: newUser.id,
          action: 'USER_CREATED_WITH_PASSWORD',
          details: `User account created for ${name} (${email}) by ${createdBy} with temporary password`
        }
      })

      return { 
        success: true, 
        temporaryPassword,
        userId: newUser.id 
      }
    } catch (error) {
      console.error('Error creating user with password:', error)
      return { success: false, error: 'Failed to create user account' }
    }
  }

  /**
   * Sends welcome email with temporary password
   */
  async sendUserCreatedWithPasswordEmail(
    email: string,
    name: string,
    firmName: string,
    temporaryPassword: string,
    createdBy: string
  ): Promise<EmailDeliveryResult> {
    try {
      const recipient: EmailRecipient = {
        email,
        name,
        role: 'client'
      }

      const loginUrl = `${process.env.NEXTAUTH_URL}/login`
      
      const template = {
        subject: `Welcome to ${firmName} - Your Account Details`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #262083; margin-bottom: 10px;">Welcome to Quantyx Global</h1>
              <h2 style="color: #666; font-weight: normal;">Case Management Platform</h2>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #262083; margin-top: 0;">Account Created Successfully</h3>
              <p>Hello <strong>${name}</strong>,</p>
              <p>Your account has been created for <strong>${firmName}</strong> by ${createdBy}. You can now access the Quantyx Global Case Management platform.</p>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #856404; margin-top: 0;">🔐 Your Login Credentials</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Temporary Password:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${temporaryPassword}</code></p>
              <p style="color: #856404; font-size: 14px; margin-top: 15px;">
                <strong>⚠️ Important:</strong> Please change your password immediately after logging in for security purposes.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" style="background-color: #262083; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                Login to Your Account
              </a>
            </div>

            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1565c0; margin-top: 0;">Getting Started</h3>
              <ol style="color: #333; line-height: 1.6;">
                <li>Click the login button above</li>
                <li>Enter your email and temporary password</li>
                <li>Change your password in the settings</li>
                <li>Start managing your cases efficiently</li>
              </ol>
            </div>

            <div style="border-top: 1px solid #eee; padding-top: 20px; color: #666; font-size: 12px;">
              <p><strong>Need Help?</strong> Contact ${createdBy} or your firm administrator.</p>
              <p>This is an automated message from Quantyx Global Case Management Platform.</p>
            </div>
          </div>
        `,
        textBody: `
Welcome to Quantyx Global Case Management Platform

Hello ${name},

Your account has been created for ${firmName} by ${createdBy}.

LOGIN CREDENTIALS:
Email: ${email}
Temporary Password: ${temporaryPassword}

IMPORTANT: Please change your password immediately after logging in.

Login at: ${loginUrl}

Getting Started:
1. Click the login link above
2. Enter your email and temporary password
3. Change your password in settings
4. Start managing your cases

Need help? Contact ${createdBy} or your firm administrator.

---
Quantyx Global Case Management Platform
        `.trim()
      }

      const result = await this.sendEmailWithSES(recipient, template, 'admin')

      // Log email event
      await this.logEmailEvent(
        'user_created_with_password',
        null,
        [recipient],
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        attemptCount: 1
      }
    }
  }

  /**
   * Sends case status update notification
   */
  async sendCaseStatusUpdateNotification(
    caseId: string,
    newStatus: string,
    updatedBy: string,
    recipients?: EmailRecipient[]
  ): Promise<EmailNotificationResult> {
    try {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          firm: true,
          services: {
            include: {
              service: true
            }
          }
        }
      })

      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      const emailRecipients = recipients || await this.getCaseRecipients(caseId)

      const template = {
        subject: `Case Status Update: ${caseData.case_id} - ${caseData.case_title}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Case Status Updated</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case ID:</strong> ${caseData.case_id}</p>
              <p><strong>Case Title:</strong> ${caseData.case_title}</p>
              <p><strong>Firm:</strong> ${caseData.firm.name}</p>
              <p><strong>New Status:</strong> <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px;">${newStatus}</span></p>
              <p><strong>Updated By:</strong> ${updatedBy}</p>
              <p><strong>Updated At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case Details</a>
            </p>
          </div>
        `,
        textBody: `
Case Status Updated

Case ID: ${caseData.case_id}
Case Title: ${caseData.case_title}
Firm: ${caseData.firm.name}
New Status: ${newStatus}
Updated By: ${updatedBy}
Updated At: ${new Date().toLocaleString()}

View case: ${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}
        `.trim()
      }

      const result = await this.sendEmailsWithSES(emailRecipients, template, 'support')

      await this.logEmailEvent(
        'case_status_update',
        caseId,
        emailRecipients,
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        results: []
      }
    }
  }

  /**
   * Sends password change confirmation
   */
  async sendPasswordChangeNotification(
    userId: string,
    userEmail: string,
    userName: string,
    changedBy: string
  ): Promise<EmailDeliveryResult> {
    try {
      const recipient: EmailRecipient = {
        email: userEmail,
        name: userName,
        role: 'client'
      }

      const template = {
        subject: 'Password Changed - Quantyx Global',
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Password Changed</h2>
            <p>Hello ${userName},</p>
            <p>Your password has been successfully changed by ${changedBy} on ${new Date().toLocaleString()}.</p>
            <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>Security Notice:</strong> If you did not request this change, please contact your administrator immediately.</p>
            </div>
            <p>If you have any concerns, please contact your firm administrator.</p>
          </div>
        `,
        textBody: `
Password Changed

Hello ${userName},

Your password has been successfully changed by ${changedBy} on ${new Date().toLocaleString()}.

Security Notice: If you did not request this change, please contact your administrator immediately.
        `.trim()
      }

      const result = await this.sendEmailWithRetry(recipient, template)

      await this.logEmailEvent(
        'password_change_notification',
        userId,
        [recipient],
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        attemptCount: 1
      }
    }
  }

  /**
   * Sends additional files notification
   */
  async sendAdditionalFilesNotification(
    caseId: string,
    fileCount: number,
    serviceIds: string[],
    specificInstructions: string | null,
    uploadedBy: string,
    recipients?: EmailRecipient[]
  ): Promise<EmailNotificationResult> {
    try {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          firm: true
        }
      })

      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      const emailRecipients = recipients || await this.getCaseRecipients(caseId)
      
      let serviceNames = ''
      if (serviceIds.length > 0) {
        const services = await prisma.service.findMany({
          where: { id: { in: serviceIds } }
        })
        serviceNames = services.map(s => s.name).join(', ')
      }

      const template = {
        subject: `Additional Files Uploaded: ${caseData.case_id} - ${caseData.case_title}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Additional Files Uploaded</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case ID:</strong> ${caseData.case_id}</p>
              <p><strong>Case Title:</strong> ${caseData.case_title}</p>
              <p><strong>Firm:</strong> ${caseData.firm.name}</p>
              <p><strong>Files Uploaded:</strong> ${fileCount} file${fileCount !== 1 ? 's' : ''}</p>
              ${serviceIds.length > 0 ? `<p><strong>Additional Services:</strong> ${serviceNames}</p>` : ''}
              <p><strong>Uploaded By:</strong> ${uploadedBy}</p>
              <p><strong>Uploaded At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            ${specificInstructions ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #1565c0; margin-top: 0;">Specific Instructions</h3>
                <p style="margin: 0;">${specificInstructions}</p>
              </div>
            ` : ''}
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case Details</a>
            </p>
          </div>
        `,
        textBody: `
Additional Files Uploaded

Case ID: ${caseData.case_id}
Case Title: ${caseData.case_title}
Firm: ${caseData.firm.name}
Files Uploaded: ${fileCount} file${fileCount !== 1 ? 's' : ''}
${serviceIds.length > 0 ? `Additional Services: ${serviceNames}` : ''}
Uploaded By: ${uploadedBy}
Uploaded At: ${new Date().toLocaleString()}

${specificInstructions ? `Specific Instructions: ${specificInstructions}` : ''}

View case: ${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}
        `.trim()
      }

      const result = await this.sendEmailsWithRetry(emailRecipients, template)

      await this.logEmailEvent(
        'additional_files_uploaded',
        caseId,
        emailRecipients,
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        results: []
      }
    }
  }

  /**
   * Sends additional services request notification
   */
  async sendAdditionalServicesRequestNotification(
    caseId: string,
    serviceIds: string[],
    specificInstructions: string | null,
    requestedBy: string,
    recipients?: EmailRecipient[]
  ): Promise<EmailNotificationResult> {
    try {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          firm: true
        }
      })

      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      // Get service details
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds } }
      })

      const emailRecipients = recipients || await this.getCaseRecipients(caseId)
      const serviceNames = services.map(s => s.name).join(', ')

      const template = {
        subject: `Additional Services Requested: ${caseData.case_id} - ${caseData.case_title}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Additional Services Requested</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case ID:</strong> ${caseData.case_id}</p>
              <p><strong>Case Title:</strong> ${caseData.case_title}</p>
              <p><strong>Firm:</strong> ${caseData.firm.name}</p>
              <p><strong>Additional Services:</strong> ${serviceNames}</p>
              <p><strong>Requested By:</strong> ${requestedBy}</p>
              <p><strong>Requested At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            ${specificInstructions ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #1565c0; margin-top: 0;">Specific Instructions</h3>
                <p style="margin: 0;">${specificInstructions}</p>
              </div>
            ` : ''}
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case Details</a>
            </p>
          </div>
        `,
        textBody: `
Additional Services Requested

Case ID: ${caseData.case_id}
Case Title: ${caseData.case_title}
Firm: ${caseData.firm.name}
Additional Services: ${serviceNames}
Requested By: ${requestedBy}
Requested At: ${new Date().toLocaleString()}

${specificInstructions ? `Specific Instructions: ${specificInstructions}` : ''}

View case: ${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}
        `.trim()
      }

      const result = await this.sendEmailsWithRetry(emailRecipients, template)

      await this.logEmailEvent(
        'additional_services_requested',
        caseId,
        emailRecipients,
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        results: []
      }
    }
  }

  /**
   * Sends case creation notification
   */
  async sendCaseCreatedNotification(
    caseId: string,
    createdBy: string,
    recipients?: EmailRecipient[]
  ): Promise<EmailNotificationResult> {
    try {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        include: {
          firm: true,
          services: {
            include: {
              service: true
            }
          }
        }
      })

      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      const emailRecipients = recipients || await this.getCaseRecipients(caseId)
      const serviceNames = caseData.services.map(cs => cs.service.name).join(', ')

      const template = {
        subject: `New Case Created: ${caseData.case_id} - ${caseData.case_title}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">New Case Created</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case ID:</strong> ${caseData.case_id}</p>
              <p><strong>Case Title:</strong> ${caseData.case_title}</p>
              <p><strong>Firm:</strong> ${caseData.firm.name}</p>
              <p><strong>Services:</strong> ${serviceNames}</p>
              <p><strong>Timeline:</strong> ${caseData.timeline}</p>
              <p><strong>Status:</strong> <span style="background: #ffc107; color: #212529; padding: 4px 8px; border-radius: 4px;">${caseData.status}</span></p>
              <p><strong>Created By:</strong> ${createdBy}</p>
              <p><strong>Created At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            ${caseData.description ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #1565c0; margin-top: 0;">Description</h3>
                <p style="margin: 0;">${caseData.description}</p>
              </div>
            ` : ''}
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case Details</a>
            </p>
          </div>
        `,
        textBody: `
New Case Created

Case ID: ${caseData.case_id}
Case Title: ${caseData.case_title}
Firm: ${caseData.firm.name}
Services: ${serviceNames}
Timeline: ${caseData.timeline}
Status: ${caseData.status}
Created By: ${createdBy}
Created At: ${new Date().toLocaleString()}

${caseData.description ? `Description: ${caseData.description}` : ''}

View case: ${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}
        `.trim()
      }

      const result = await this.sendEmailsWithRetry(emailRecipients, template)

      await this.logEmailEvent(
        'case_created',
        caseId,
        emailRecipients,
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        results: []
      }
    }
  }

  /**
   * Sends new account credentials to support email
   * Requirements: 6.4, 6.5, 10.2, 10.3, 10.4, 10.5
   */
  async sendNewAccountCredentials(input: {
    recipientEmail: string
    clientEmail: string
    clientName: string
    temporaryPassword: string
    firmName: string
    createdByName: string
    createdAt: Date
  }): Promise<EmailDeliveryResult> {
    try {
      const recipient: EmailRecipient = {
        email: input.recipientEmail,
        name: 'Support Team',
        role: 'admin'
      }

      const template = {
        subject: `New Client Account Created - ${input.firmName}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #262083; margin-bottom: 10px;">New Client Account Created</h1>
              <h2 style="color: #666; font-weight: normal;">Quantyx Global Case Management</h2>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #262083; margin-top: 0;">Account Details</h3>
              <p><strong>Client Name:</strong> ${input.clientName}</p>
              <p><strong>Client Email:</strong> ${input.clientEmail}</p>
              <p><strong>Firm:</strong> ${input.firmName}</p>
              <p><strong>Created By:</strong> ${input.createdByName}</p>
              <p><strong>Created At:</strong> ${input.createdAt.toLocaleString()}</p>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #856404; margin-top: 0;">🔐 Temporary Credentials</h3>
              <p><strong>Email:</strong> ${input.clientEmail}</p>
              <p><strong>Temporary Password:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 14px;">${input.temporaryPassword}</code></p>
              <p style="color: #856404; font-size: 14px; margin-top: 15px;">
                <strong>⚠️ Security Note:</strong> The client should change this password immediately after first login.
              </p>
            </div>

            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
              <h3 style="color: #1565c0; margin-top: 0;">Next Steps</h3>
              <ol style="color: #333; line-height: 1.6;">
                <li>Provide the credentials to the client securely</li>
                <li>Ensure the client logs in and changes their password</li>
                <li>Verify the client can access their firm's cases</li>
                <li>Provide any necessary training or documentation</li>
              </ol>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.NEXTAUTH_URL}/admin/users" style="background-color: #262083; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                View User Management
              </a>
            </div>

            <div style="border-top: 1px solid #eee; padding-top: 20px; color: #666; font-size: 12px;">
              <p><strong>Account Creation Notification</strong></p>
              <p>This is an automated notification from the Quantyx Global Case Management Platform.</p>
              <p>Timestamp: ${input.createdAt.toISOString()}</p>
            </div>
          </div>
        `,
        textBody: `
New Client Account Created - Quantyx Global Case Management

ACCOUNT DETAILS:
Client Name: ${input.clientName}
Client Email: ${input.clientEmail}
Firm: ${input.firmName}
Created By: ${input.createdByName}
Created At: ${input.createdAt.toLocaleString()}

TEMPORARY CREDENTIALS:
Email: ${input.clientEmail}
Temporary Password: ${input.temporaryPassword}

SECURITY NOTE: The client should change this password immediately after first login.

NEXT STEPS:
1. Provide the credentials to the client securely
2. Ensure the client logs in and changes their password
3. Verify the client can access their firm's cases
4. Provide any necessary training or documentation

View User Management: ${process.env.NEXTAUTH_URL}/admin/users

---
Account Creation Notification
Quantyx Global Case Management Platform
Timestamp: ${input.createdAt.toISOString()}
        `.trim()
      }

      const result = await this.sendEmailWithRetry(recipient, template)

      // Log email event
      await this.logEmailEvent(
        'new_account_credentials',
        null,
        [recipient],
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        attemptCount: 1
      }
    }
  }

  /**
   * Sends firm creation notification
   */
  async sendFirmCreatedNotification(
    firmName: string,
    adminEmail: string,
    adminName: string,
    createdBy: string
  ): Promise<EmailDeliveryResult> {
    try {
      const recipient: EmailRecipient = {
        email: adminEmail,
        name: adminName,
        role: 'client'
      }

      const template = {
        subject: `Firm Created: ${firmName} - Quantyx Global`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Firm Successfully Created</h2>
            <p>Hello ${adminName},</p>
            <p>Your firm "<strong>${firmName}</strong>" has been successfully created on the Quantyx Global Case Management platform by ${createdBy}.</p>
            <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1565c0; margin-top: 0;">Next Steps:</h3>
              <ul>
                <li>Access your dashboard to start managing cases</li>
                <li>Invite team members to join your firm</li>
                <li>Configure your firm settings</li>
                <li>Create your first case</li>
              </ul>
            </div>
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/dashboard" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Access Dashboard</a>
            </p>
          </div>
        `,
        textBody: `
Firm Successfully Created

Hello ${adminName},

Your firm "${firmName}" has been successfully created on the Quantyx Global Case Management platform by ${createdBy}.

Next Steps:
- Access your dashboard to start managing cases
- Invite team members to join your firm
- Configure your firm settings
- Create your first case

Access your dashboard: ${process.env.NEXTAUTH_URL}/dashboard
        `.trim()
      }

      const result = await this.sendEmailWithRetry(recipient, template)

      await this.logEmailEvent(
        'firm_created_notification',
        null,
        [recipient],
        result.success,
        result.error
      )

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: errorMessage,
        attemptCount: 1
      }
    }
  }
}

// Config factory to avoid accessing process.env at module level
const getDefaultEnhancedEmailConfig = () => ({
  provider: process.env.EMAIL_PROVIDER || 'console',
  fromEmail: process.env.EMAIL_FROM || 'noreply@quantyxglobal.com',
  fromName: process.env.EMAIL_FROM_NAME || 'Quantyx Global Case Management',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@quantyxg.com'
})

// Lazy-loaded singleton instance
let _enhancedEmailServiceInstance: EnhancedEmailService | null = null

export const getEnhancedEmailService = (): EnhancedEmailService => {
  if (!_enhancedEmailServiceInstance) {
    _enhancedEmailServiceInstance = new EnhancedEmailService(getDefaultEnhancedEmailConfig())
  }
  return _enhancedEmailServiceInstance
}

export const enhancedEmailService = new Proxy({} as EnhancedEmailService, {
  get(target, prop) {
    return getEnhancedEmailService()[prop as keyof EnhancedEmailService]
  }
})