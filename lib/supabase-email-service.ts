import { SupabaseDB } from './supabase-db'
import { postmarkEmailService, EmailType } from './postmark-email-service'

/**
 * Supabase-based Email Service for Case and Account Notifications
 * Replaces Prisma-based email service with Supabase queries
 */
export class SupabaseEmailService {
  // Notification recipients configuration - accessed at runtime
  private getNotificationEmails() {
    return {
      caseNotifications: process.env.CASE_NOTIFICATION_EMAIL || 'info@quantyxg.com',
      accountNotifications: process.env.ACCOUNT_NOTIFICATION_EMAIL || 'support@quantyxg.com',
    }
  }

  /**
   * Send case creation notification to info@quantyxg.com
   */
  async sendCaseCreatedNotification(
    caseId: string,
    createdBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Fetch case data from Supabase
      const caseData = await SupabaseDB.getCaseById(caseId) as any
      
      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      // Get organization details
      const organization = caseData.organization as any

      // Get services for this case
      const services = caseData.case_services?.map((cs: any) => cs.service?.name).filter(Boolean) || []
      const serviceNames = services.join(', ') || 'No services selected'

      const template = {
        subject: `New Case Created: ${caseData.case_number} - ${caseData.title}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">New Case Created</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case Number:</strong> ${caseData.case_number}</p>
              <p><strong>Case Title:</strong> ${caseData.title}</p>
              <p><strong>Organization:</strong> ${organization?.name || 'N/A'}</p>
              <p><strong>Client:</strong> ${caseData.client_name} (${caseData.client_email})</p>
              <p><strong>Services:</strong> ${serviceNames}</p>
              <p><strong>Priority:</strong> ${caseData.priority || 'NORMAL'}</p>
              <p><strong>Status:</strong> <span style="background: #ffc107; color: #212529; padding: 4px 8px; border-radius: 4px;">${caseData.status}</span></p>
              <p><strong>Created By:</strong> ${createdBy}</p>
              <p><strong>Created At:</strong> ${new Date(caseData.created_at).toLocaleString()}</p>
              ${caseData.estimate_required ? '<p><strong>⚠️ Estimate Required:</strong> Yes</p>' : ''}
            </div>
            ${caseData.description ? `
              <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #1565c0; margin-top: 0;">Description</h3>
                <p style="margin: 0;">${caseData.description}</p>
              </div>
            ` : ''}
            ${caseData.special_instructions ? `
              <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <h3 style="color: #856404; margin-top: 0;">Specific Instructions</h3>
                <p style="margin: 0;">${caseData.special_instructions}</p>
              </div>
            ` : ''}
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case Details</a>
            </p>
          </div>
        `,
        textBody: `
New Case Created

Case Number: ${caseData.case_number}
Case Title: ${caseData.title}
Organization: ${organization?.name || 'N/A'}
Client: ${caseData.client_name} (${caseData.client_email})
Services: ${serviceNames}
Priority: ${caseData.priority || 'NORMAL'}
Status: ${caseData.status}
Created By: ${createdBy}
Created At: ${new Date(caseData.created_at).toLocaleString()}
${caseData.estimate_required ? 'Estimate Required: Yes\n' : ''}

${caseData.description ? `Description:\n${caseData.description}\n\n` : ''}
${caseData.special_instructions ? `Specific Instructions:\n${caseData.special_instructions}\n\n` : ''}

View case: ${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}
        `.trim(),
      }

      const result = await postmarkEmailService.sendEmail({
        to: this.getNotificationEmails().caseNotifications,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        emailType: 'case_notification',
      })

      return result
    } catch (error) {
      console.error('Error sending case creation notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send case status update notification to info@quantyxg.com
   */
  async sendCaseStatusUpdateNotification(
    caseId: string,
    oldStatus: string,
    newStatus: string,
    updatedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const caseData = await SupabaseDB.getCaseById(caseId) as any
      
      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      const organization = caseData.organization as any

      // Admin notification template
      const adminTemplate = {
        subject: `Case Status Updated: ${caseData.case_number} - ${oldStatus} → ${newStatus}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Case Status Updated</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case Number:</strong> ${caseData.case_number}</p>
              <p><strong>Case Title:</strong> ${caseData.title}</p>
              <p><strong>Organization:</strong> ${organization?.name || 'N/A'}</p>
              <p><strong>Client:</strong> ${caseData.client_name}</p>
              <p><strong>Status Change:</strong> 
                <span style="background: #ffc107; color: #212529; padding: 4px 8px; border-radius: 4px;">${oldStatus}</span>
                →
                <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px;">${newStatus}</span>
              </p>
              <p><strong>Updated By:</strong> ${updatedBy}</p>
              <p><strong>Updated At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case Details</a>
            </p>
          </div>
        `,
        textBody: `
Case Status Updated

Case Number: ${caseData.case_number}
Case Title: ${caseData.title}
Organization: ${organization?.name || 'N/A'}
Client: ${caseData.client_name}
Status Change: ${oldStatus} → ${newStatus}
Updated By: ${updatedBy}
Updated At: ${new Date().toLocaleString()}

View case: ${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}
        `.trim(),
      }

      // Send to admin/support
      const adminResult = await postmarkEmailService.sendEmail({
        to: this.getNotificationEmails().caseNotifications,
        subject: adminTemplate.subject,
        htmlBody: adminTemplate.htmlBody,
        textBody: adminTemplate.textBody,
        emailType: 'case_update',
      })

      // Client notification template (more user-friendly)
      if (caseData.client_email) {
        const clientTemplate = {
          subject: `Case Update: ${caseData.case_number} - Status Changed to ${newStatus}`,
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #262083;">Your Case Status Has Been Updated</h2>
              <p>Dear ${caseData.client_name},</p>
              <p>We wanted to inform you that your case status has been updated.</p>
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p><strong>Case Number:</strong> ${caseData.case_number}</p>
                <p><strong>Case Title:</strong> ${caseData.title}</p>
                <p><strong>New Status:</strong> 
                  <span style="background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;">${newStatus}</span>
                </p>
                <p><strong>Updated:</strong> ${new Date().toLocaleString()}</p>
              </div>
              <p>You can view your case details by logging into your dashboard.</p>
              <p style="margin: 20px 0;">
                <a href="${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Case</a>
              </p>
              <p>If you have any questions, please don't hesitate to contact us.</p>
              <p>Best regards,<br>The quantyx Global Team</p>
            </div>
          `,
          textBody: `
Your Case Status Has Been Updated

Dear ${caseData.client_name},

We wanted to inform you that your case status has been updated.

Case Number: ${caseData.case_number}
Case Title: ${caseData.title}
New Status: ${newStatus}
Updated: ${new Date().toLocaleString()}

You can view your case details by logging into your dashboard:
${process.env.NEXTAUTH_URL}/dashboard/case/${caseData.id}

If you have any questions, please don't hesitate to contact us.

Best regards,
The quantyx Global Team
          `.trim(),
        }

        // Send to client
        await postmarkEmailService.sendEmail({
          to: caseData.client_email,
          subject: clientTemplate.subject,
          htmlBody: clientTemplate.htmlBody,
          textBody: clientTemplate.textBody,
          emailType: 'case_update',
        })
      }

      return adminResult
    } catch (error) {
      console.error('Error sending case status update notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send additional files notification to info@quantyxg.com
   */
  async sendAdditionalFilesNotification(
    caseId: string,
    fileCount: number,
    uploadedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const caseData = await SupabaseDB.getCaseById(caseId) as any
      
      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      const organization = caseData.organization as any

      const template = {
        subject: `Additional Files Uploaded: ${caseData.case_number} - ${fileCount} file(s)`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Additional Files Uploaded</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case Number:</strong> ${caseData.case_number}</p>
              <p><strong>Case Title:</strong> ${caseData.title}</p>
              <p><strong>Organization:</strong> ${organization?.name || 'N/A'}</p>
              <p><strong>Client:</strong> ${caseData.client_name}</p>
              <p><strong>Files Uploaded:</strong> ${fileCount} file(s)</p>
              <p><strong>Uploaded By:</strong> ${uploadedBy}</p>
              <p><strong>Uploaded At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case & Files</a>
            </p>
          </div>
        `,
        textBody: `
Additional Files Uploaded

Case Number: ${caseData.case_number}
Case Title: ${caseData.title}
Organization: ${organization?.name || 'N/A'}
Client: ${caseData.client_name}
Files Uploaded: ${fileCount} file(s)
Uploaded By: ${uploadedBy}
Uploaded At: ${new Date().toLocaleString()}

View case: ${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}
        `.trim(),
      }

      const result = await postmarkEmailService.sendEmail({
        to: this.getNotificationEmails().caseNotifications,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        emailType: 'case_notification',
      })

      return result
    } catch (error) {
      console.error('Error sending additional files notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send additional services request notification to info@quantyxg.com
   */
  async sendAdditionalServicesNotification(
    caseId: string,
    serviceNames: string[],
    requestedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const caseData = await SupabaseDB.getCaseById(caseId) as any
      
      if (!caseData) {
        throw new Error(`Case with ID ${caseId} not found`)
      }

      const organization = caseData.organization as any
      const servicesText = serviceNames.join(', ')

      const template = {
        subject: `Additional Services Requested: ${caseData.case_number}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Additional Services Requested</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Case Number:</strong> ${caseData.case_number}</p>
              <p><strong>Case Title:</strong> ${caseData.title}</p>
              <p><strong>Organization:</strong> ${organization?.name || 'N/A'}</p>
              <p><strong>Client:</strong> ${caseData.client_name}</p>
              <p><strong>Requested Services:</strong> ${servicesText}</p>
              <p><strong>Requested By:</strong> ${requestedBy}</p>
              <p><strong>Requested At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="margin: 20px 0;">
              <a href="${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Case Details</a>
            </p>
          </div>
        `,
        textBody: `
Additional Services Requested

Case Number: ${caseData.case_number}
Case Title: ${caseData.title}
Organization: ${organization?.name || 'N/A'}
Client: ${caseData.client_name}
Requested Services: ${servicesText}
Requested By: ${requestedBy}
Requested At: ${new Date().toLocaleString()}

View case: ${process.env.NEXTAUTH_URL}/admin/case/${caseData.id}
        `.trim(),
      }

      const result = await postmarkEmailService.sendEmail({
        to: this.getNotificationEmails().caseNotifications,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        emailType: 'case_notification',
      })

      return result
    } catch (error) {
      console.error('Error sending additional services notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send account creation notification to support@quantyxg.com
   * Includes login credentials for new admin/client/employee accounts
   */
  async sendAccountCreatedNotification(
    userId: string,
    email: string,
    password: string,
    accountType: 'ADMIN' | 'CLIENT' | 'EMPLOYEE',
    createdBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await SupabaseDB.getUserById(userId) as any
      
      if (!user) {
        throw new Error(`User with ID ${userId} not found`)
      }

      const organization = user.organization as any

      const template = {
        subject: `New ${accountType} Account Created - ${user.first_name} ${user.last_name}`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">New ${accountType} Account Created</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Account Type:</strong> ${accountType}</p>
              <p><strong>Name:</strong> ${user.first_name} ${user.last_name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Organization:</strong> ${organization?.name || 'N/A'}</p>
              <p><strong>Created By:</strong> ${createdBy}</p>
              <p><strong>Created At:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">🔐 Login Credentials</h3>
              <p><strong>Email:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${email}</code></p>
              <p><strong>Password:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
              <p style="color: #856404; font-size: 14px; margin-top: 15px;">
                <strong>⚠️ Security Note:</strong> User must change password after first login.
              </p>
            </div>
            <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #155724; margin-top: 0;">✅ Next Steps</h3>
              <ol style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li>Provide credentials to user securely</li>
                <li>Ensure user logs in and changes password</li>
                <li>Verify user can access their dashboard</li>
              </ol>
            </div>
          </div>
        `,
        textBody: `
New ${accountType} Account Created

Account Type: ${accountType}
Name: ${user.first_name} ${user.last_name}
Email: ${email}
Organization: ${organization?.name || 'N/A'}
Created By: ${createdBy}
Created At: ${new Date().toLocaleString()}

LOGIN CREDENTIALS:
Email: ${email}
Password: ${password}

SECURITY NOTE: User must change password after first login.

NEXT STEPS:
1. Provide credentials to user securely
2. Ensure user logs in and changes password
3. Verify user can access their dashboard
        `.trim(),
      }

      const result = await postmarkEmailService.sendEmail({
        to: this.getNotificationEmails().accountNotifications,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        emailType: 'admin',
      })

      return result
    } catch (error) {
      console.error('Error sending account creation notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Send welcome email with credentials to the new user
   */
  async sendWelcomeEmailToUser(
    email: string,
    password: string,
    firstName: string,
    accountType: 'ADMIN' | 'CLIENT' | 'EMPLOYEE'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const dashboardUrl = accountType === 'ADMIN' || accountType === 'EMPLOYEE' 
        ? `${process.env.NEXTAUTH_URL}/admin` 
        : `${process.env.NEXTAUTH_URL}/dashboard`

      const template = {
        subject: `Welcome to Quantyx Global - Your Account is Ready`,
        htmlBody: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #262083;">Welcome to Quantyx Global!</h2>
            <p>Hi ${firstName},</p>
            <p>Your ${accountType.toLowerCase()} account has been created successfully. You can now access the Quantyx Global platform.</p>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #856404; margin-top: 0;">🔐 Your Login Credentials</h3>
              <p><strong>Email:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${email}</code></p>
              <p><strong>Temporary Password:</strong> <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; font-family: monospace;">${password}</code></p>
            </div>

            <div style="background: #e3f2fd; border: 1px solid #90caf9; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #1565c0; margin-top: 0;">🔒 Important Security Information</h3>
              <ul style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
                <li>This is a temporary password</li>
                <li>You must change your password after first login</li>
                <li>Keep your credentials secure and do not share them</li>
                <li>If you didn't request this account, please contact support immediately</li>
              </ul>
            </div>

            <p style="margin: 30px 0;">
              <a href="${dashboardUrl}" style="background-color: #262083; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Login to Your Account</a>
            </p>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              If you have any questions or need assistance, please contact our support team at support@quantyxg.com
            </p>

            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">
              © ${new Date().getFullYear()} Quantyx Global. All rights reserved.
            </p>
          </div>
        `,
        textBody: `
Welcome to Quantyx Global!

Hi ${firstName},

Your ${accountType.toLowerCase()} account has been created successfully. You can now access the Quantyx Global platform.

YOUR LOGIN CREDENTIALS:
Email: ${email}
Temporary Password: ${password}

IMPORTANT SECURITY INFORMATION:
- This is a temporary password
- You must change your password after first login
- Keep your credentials secure and do not share them
- If you didn't request this account, please contact support immediately

Login URL: ${dashboardUrl}

If you have any questions or need assistance, please contact our support team at support@quantyxg.com

© ${new Date().getFullYear()} Quantyx Global. All rights reserved.
        `.trim(),
      }

      const result = await postmarkEmailService.sendEmail({
        to: email,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        emailType: 'support',
      })

      return result
    } catch (error) {
      console.error('Error sending welcome email to user:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Create user with auto-generated password and send emails to both info@quantyxg.com and the user
   */
  async createUserWithPassword(
    email: string,
    name: string,
    organizationId: string,
    role: 'client' | 'admin' | 'employee',
    createdBy: string
  ): Promise<{ success: boolean; error?: string; temporaryPassword?: string; userId?: string }> {
    try {
      const bcrypt = await import('bcryptjs')
      
      // Check if user already exists
      const existingUser = await SupabaseDB.getUserByEmail(email.toLowerCase())
      
      if (existingUser) {
        return { success: false, error: 'User with this email already exists' }
      }

      // Generate secure temporary password (12 characters with mix of upper, lower, numbers, symbols)
      const generatePassword = () => {
        const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
        const lower = 'abcdefghjkmnpqrstuvwxyz'
        const numbers = '23456789'
        const symbols = '!@#$%^&*'
        const all = upper + lower + numbers + symbols
        
        let password = ''
        password += upper[Math.floor(Math.random() * upper.length)]
        password += lower[Math.floor(Math.random() * lower.length)]
        password += numbers[Math.floor(Math.random() * numbers.length)]
        password += symbols[Math.floor(Math.random() * symbols.length)]
        
        for (let i = 4; i < 12; i++) {
          password += all[Math.floor(Math.random() * all.length)]
        }
        
        return password.split('').sort(() => Math.random() - 0.5).join('')
      }

      const temporaryPassword = generatePassword()
      const hashedPassword = await bcrypt.hash(temporaryPassword, 10)

      // Split name into first and last
      const nameParts = name.trim().split(' ')
      const firstName = nameParts[0] || name
      const lastName = nameParts.slice(1).join(' ') || ''

      // Create user account with MFA setup required
      const newUser = await SupabaseDB.createUser({
        first_name: firstName,
        last_name: lastName,
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        role: role.toUpperCase() as 'CLIENT' | 'ADMIN' | 'EMPLOYEE',
        organization_id: organizationId,
        mfa_setup_required: true // Require MFA setup on first login
      })

      // Send email to info@quantyxg.com with credentials
      await this.sendAccountCreatedNotification(
        (newUser as any).id,
        email,
        temporaryPassword,
        role.toUpperCase() as 'ADMIN' | 'CLIENT' | 'EMPLOYEE',
        createdBy
      )

      // Send welcome email to the user with credentials
      await this.sendWelcomeEmailToUser(
        email,
        temporaryPassword,
        firstName,
        role.toUpperCase() as 'ADMIN' | 'CLIENT' | 'EMPLOYEE'
      )

      // Create audit log
      await SupabaseDB.createAuditLog({
        action: 'CREATE',
        entity_type: 'user',
        entity_id: (newUser as any).id,
        user_id: (newUser as any).id,
        organization_id: organizationId,
        new_values: {
          email: email.toLowerCase(),
          name: name,
          role: role.toUpperCase(),
          created_by: createdBy
        }
      })

      return {
        success: true,
        temporaryPassword,
        userId: (newUser as any).id
      }
    } catch (error) {
      console.error('Error creating user with password:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create user account'
      }
    }
  }
}

// Lazy-loaded singleton instance
let _supabaseEmailServiceInstance: SupabaseEmailService | null = null

export const getSupabaseEmailService = (): SupabaseEmailService => {
  if (!_supabaseEmailServiceInstance) {
    _supabaseEmailServiceInstance = new SupabaseEmailService()
  }
  return _supabaseEmailServiceInstance
}

export const supabaseEmailService = new Proxy({} as SupabaseEmailService, {
  get(target, prop) {
    return getSupabaseEmailService()[prop as keyof SupabaseEmailService]
  }
})

// Deprecated: Use getSupabaseEmailService() instead
export function createEmailService(): SupabaseEmailService {
  return getSupabaseEmailService()
}
