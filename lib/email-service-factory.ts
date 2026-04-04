import { EnhancedEmailService } from './enhanced-email-service'
import { EmailServiceConfig } from './email-notification-service'

/**
 * Email Service Factory for Medilegal Schema Redesign
 * 
 * Creates email service instances with AWS SES integration for sending
 * new account credentials and other notifications as specified in requirements.
 * 
 * Requirements: 10.2, 10.3, 10.4
 */

/**
 * Default email service configuration with AWS SES support
 */
const defaultEmailConfig: EmailServiceConfig = {
  provider: process.env.NODE_ENV === 'production' ? 'aws-ses' : 'console',
  fromEmail: process.env.EMAIL_FROM || 'noreply@quantyxglobal.com',
  fromName: 'Quantyx Global Case Management',
  replyToEmail: process.env.EMAIL_REPLY_TO || 'support@quantyxg.com',
  // AWS SES configuration
  awsRegion: process.env.SES_REGION || 'us-east-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // Support email for account credentials (Requirement 6.5)
  supportEmail: process.env.SUPPORT_EMAIL || 'support@quantyxg.com'
}

/**
 * Factory function to create EnhancedEmailService with AWS SES configuration
 * 
 * @param config Optional configuration overrides
 * @returns Configured EnhancedEmailService instance
 */
export function createEmailService(config?: Partial<EmailServiceConfig>): EnhancedEmailService {
  const finalConfig = { ...defaultEmailConfig, ...config }
  
  // Force console provider in test environment
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    finalConfig.provider = 'console'
  }
  
  // Validate AWS SES configuration in production
  if (finalConfig.provider === 'aws-ses') {
    if (!finalConfig.awsAccessKeyId || !finalConfig.awsSecretAccessKey) {
      console.warn('AWS SES credentials not configured, falling back to console provider')
      finalConfig.provider = 'console'
    }
  }
  
  return new EnhancedEmailService(finalConfig)
}

/**
 * Create email service specifically configured for account credential notifications
 * Requirements: 6.5, 10.1, 10.2, 10.3, 10.4, 10.5
 */
export function createAccountCredentialEmailService(): EnhancedEmailService {
  return createEmailService({
    provider: 'aws-ses',
    fromEmail: process.env.SES_ADMIN_EMAIL || 'admin@quantyxg.com',
    fromName: 'Quantyx Global Account Management',
    replyToEmail: process.env.SES_SUPPORT_EMAIL || 'support@quantyxg.com'
  })
}

/**
 * Email template configurations for different notification types
 * Requirements: 10.2, 10.3, 10.4
 */
export const EMAIL_TEMPLATES = {
  NEW_ACCOUNT_CREDENTIALS: {
    subject: 'New Client Account Created - {{firmName}}',
    supportRecipient: process.env.SUPPORT_EMAIL || 'support@quantyxg.com',
    includeCredentials: true,
    includeTimestamp: true,
    includeCreatorInfo: true,
    standardizedFormat: true
  },
  ACCOUNT_CREATION_NOTIFICATION: {
    subject: 'Account Created Successfully - {{firmName}}',
    includeCredentials: true,
    includeNextSteps: true,
    standardizedFormat: true
  },
  FIRM_CREATION_NOTIFICATION: {
    subject: 'Firm Created Successfully - {{firmName}}',
    includeNextSteps: true,
    standardizedFormat: true
  },
  EMAIL_DELIVERY_RETRY: {
    subject: 'Email Delivery Retry - {{attemptNumber}}/{{maxAttempts}}',
    includeErrorDetails: true,
    standardizedFormat: true
  }
} as const

export type EmailTemplateType = keyof typeof EMAIL_TEMPLATES

/**
 * Email template renderer with standardized format
 * Requirements: 10.4 - standardized format for easy processing
 */
export interface EmailTemplateData {
  firmName: string
  clientName: string
  clientEmail: string
  temporaryPassword?: string
  createdByName: string
  createdAt: Date
  firmNumber?: string
  additionalData?: Record<string, any>
}

/**
 * Renders email template with standardized format
 * Requirements: 10.2, 10.3, 10.4
 */
export function renderEmailTemplate(
  templateType: EmailTemplateType,
  data: EmailTemplateData
): { subject: string; htmlBody: string; textBody: string } {
  const template = EMAIL_TEMPLATES[templateType]
  
  // Replace template variables in subject
  const subject = template.subject.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return (data as any)[key] || match
  })

  // Generate standardized email content based on template type
  switch (templateType) {
    case 'NEW_ACCOUNT_CREDENTIALS':
      return renderNewAccountCredentialsTemplate(data, subject)
    case 'ACCOUNT_CREATION_NOTIFICATION':
      return renderAccountCreationTemplate(data, subject)
    case 'FIRM_CREATION_NOTIFICATION':
      return renderFirmCreationTemplate(data, subject)
    default:
      throw new Error(`Unknown template type: ${templateType}`)
  }
}

/**
 * Renders new account credentials template with standardized format
 * Requirements: 10.2, 10.3, 10.4
 */
function renderNewAccountCredentialsTemplate(
  data: EmailTemplateData,
  subject: string
): { subject: string; htmlBody: string; textBody: string } {
  // HTML escape function for security
  const escapeHtml = (text: string): string => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }

  // Generate unique message ID with consistent format
  const messageId = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const generatedTimestamp = new Date().toISOString()

  // Escape all user-provided data
  const safeData = {
    clientName: escapeHtml(data.clientName),
    clientEmail: escapeHtml(data.clientEmail),
    firmName: escapeHtml(data.firmName),
    createdByName: escapeHtml(data.createdByName),
    temporaryPassword: data.temporaryPassword ? escapeHtml(data.temporaryPassword) : undefined,
    firmNumber: data.firmNumber ? escapeHtml(data.firmNumber) : undefined
  }

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <!-- Header Section -->
      <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #262083; padding-bottom: 20px;">
        <h1 style="color: #262083; margin-bottom: 10px;">New Client Account Created</h1>
        <h2 style="color: #666; font-weight: normal;">Quantyx Global Case Management</h2>
      </div>
      
      <!-- Account Details Section (Requirement 10.2) -->
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="color: #262083; margin-top: 0;">📋 Account Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold;">Client Name:</td><td style="padding: 8px 0;">${safeData.clientName}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Client Email:</td><td style="padding: 8px 0;">${safeData.clientEmail}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Firm:</td><td style="padding: 8px 0;">${safeData.firmName}</td></tr>
          ${safeData.firmNumber ? `<tr><td style="padding: 8px 0; font-weight: bold;">Firm Number:</td><td style="padding: 8px 0;">${safeData.firmNumber}</td></tr>` : ''}
        </table>
      </div>

      <!-- Creator Information Section (Requirement 10.3) -->
      <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="color: #1565c0; margin-top: 0;">👤 Creation Information</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold;">Created By:</td><td style="padding: 8px 0;">${safeData.createdByName}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Created At:</td><td style="padding: 8px 0;">${data.createdAt.toLocaleString()}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Timestamp (ISO):</td><td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${data.createdAt.toISOString()}</td></tr>
        </table>
      </div>

      <!-- Credentials Section (Requirement 10.2) -->
      ${safeData.temporaryPassword && safeData.temporaryPassword.trim() ? `
        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
          <h3 style="color: #856404; margin-top: 0;">🔐 Temporary Credentials</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td style="padding: 8px 0; font-family: monospace;">${safeData.clientEmail}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Temporary Password:</td><td style="padding: 8px 0; font-family: monospace; background: #f1f3f4; padding: 4px 8px; border-radius: 4px;">${safeData.temporaryPassword}</td></tr>
          </table>
          <p style="color: #856404; font-size: 14px; margin-top: 15px;">
            <strong>⚠️ Security Note:</strong> Client must change password immediately after first login.
          </p>
        </div>
      ` : ''}

      <!-- Action Items Section -->
      <div style="background: #d4edda; border: 1px solid #c3e6cb; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="color: #155724; margin-top: 0;">✅ Next Steps</h3>
        <ol style="color: #333; line-height: 1.6; margin: 0; padding-left: 20px;">
          <li>Provide credentials to client securely</li>
          <li>Ensure client logs in and changes password</li>
          <li>Verify client can access firm's cases</li>
          <li>Provide necessary training or documentation</li>
        </ol>
      </div>

      <!-- Footer Section (Requirement 10.4 - Standardized Format) -->
      <div style="border-top: 2px solid #eee; padding-top: 20px; color: #666; font-size: 12px;">
        <p><strong>📧 Account Creation Notification</strong></p>
        <p>This is an automated notification from the Quantyx Global Case Management Platform.</p>
        <p><strong>Message ID:</strong> ${messageId}</p>
        <p><strong>Generated:</strong> ${generatedTimestamp}</p>
        ${data.additionalData ? `<p><strong>Additional Data:</strong> ${escapeHtml(JSON.stringify(data.additionalData))}</p>` : ''}
      </div>
    </div>
  `

  const textBody = `
NEW CLIENT ACCOUNT CREATED - QUANTYX GLOBAL CASE MANAGEMENT

ACCOUNT DETAILS:
Client Name: ${data.clientName}
Client Email: ${data.clientEmail}
Firm: ${data.firmName}
${data.firmNumber ? `Firm Number: ${data.firmNumber}` : ''}

CREATION INFORMATION:
Created By: ${data.createdByName}
Created At: ${data.createdAt.toLocaleString()}
Timestamp (ISO): ${data.createdAt.toISOString()}

${safeData.temporaryPassword && safeData.temporaryPassword.trim() ? `
TEMPORARY CREDENTIALS:
Email: ${data.clientEmail}
Temporary Password: ${data.temporaryPassword}

SECURITY NOTE: Client must change password immediately after first login.
` : ''}

NEXT STEPS:
1. Provide credentials to client securely
2. Ensure client logs in and changes password
3. Verify client can access firm's cases
4. Provide necessary training or documentation

---
Account Creation Notification
Quantyx Global Case Management Platform
Message ID: ${messageId}
Generated: ${generatedTimestamp}
${data.additionalData ? `Additional Data: ${JSON.stringify(data.additionalData)}` : ''}
  `.trim()

  return { subject, htmlBody, textBody }
}

/**
 * Renders account creation notification template
 */
function renderAccountCreationTemplate(
  data: EmailTemplateData,
  subject: string
): { subject: string; htmlBody: string; textBody: string } {
  // Implementation for account creation notification
  return {
    subject,
    htmlBody: `<p>Account created for ${data.clientName}</p>`,
    textBody: `Account created for ${data.clientName}`
  }
}

/**
 * Renders firm creation notification template
 */
function renderFirmCreationTemplate(
  data: EmailTemplateData,
  subject: string
): { subject: string; htmlBody: string; textBody: string } {
  // Implementation for firm creation notification
  return {
    subject,
    htmlBody: `<p>Firm created: ${data.firmName}</p>`,
    textBody: `Firm created: ${data.firmName}`
  }
}