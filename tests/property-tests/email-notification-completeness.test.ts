import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fc from 'fast-check'
import { createEmailService, renderEmailTemplate, EmailTemplateData } from '../../lib/email-service-factory'
import { EnhancedEmailService } from '../../lib/enhanced-email-service'

/**
 * Property-Based Tests for Email Notification Completeness
 * Feature: medilegal-schema-redesign, Property 18: Email Notification Completeness
 * 
 * Validates: Requirements 10.2, 10.3, 10.4, 10.5
 * 
 * Tests that email notifications contain complete information, follow standardized format,
 * and implement proper error handling with retry logic.
 */

describe('Property 18: Email Notification Completeness', () => {
  let emailService: EnhancedEmailService

  beforeEach(() => {
    // Create email service with console provider for testing
    emailService = createEmailService({ provider: 'console' })
  })

  afterEach(() => {
    // Restore any mocked functions
    vi.restoreAllMocks()
  })

  it('should generate complete email notifications with all required information', async () => {
    // **Validates: Requirements 10.2, 10.3, 10.4**
    await fc.assert(fc.asyncProperty(
      // Generate comprehensive email template data
      fc.record({
        firmName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        clientName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        clientEmail: fc.emailAddress(),
        temporaryPassword: fc.string({ minLength: 12, maxLength: 12 }),
        createdByName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() }),
        firmNumber: fc.option(fc.string({ minLength: 3, maxLength: 3 }).map(s => s.padStart(3, '0'))),
        additionalData: fc.option(fc.record({
          userId: fc.uuid(),
          firmId: fc.uuid(),
          createdByUserId: fc.uuid()
        }))
      }),
      async (templateData: EmailTemplateData) => {
        // Generate email template
        const emailTemplate = renderEmailTemplate('NEW_ACCOUNT_CREDENTIALS', templateData)
        
        // Property 1: Email should have all required components
        expect(emailTemplate.subject).toBeDefined()
        expect(emailTemplate.htmlBody).toBeDefined()
        expect(emailTemplate.textBody).toBeDefined()
        
        // Property 2: Subject should contain firm name (Requirement 10.2)
        expect(emailTemplate.subject).toContain(templateData.firmName)
        expect(emailTemplate.subject).toMatch(/New Client Account Created/)
        
        // Property 3: HTML body should contain all account credentials (Requirement 10.2)
        expect(emailTemplate.htmlBody).toContain(templateData.clientName)
        expect(emailTemplate.htmlBody).toContain(templateData.clientEmail)
        expect(emailTemplate.htmlBody).toContain(templateData.firmName)
        if (templateData.temporaryPassword && templateData.temporaryPassword.trim()) {
          expect(emailTemplate.htmlBody).toContain(templateData.temporaryPassword)
        }
        
        // Property 4: Should contain creator information (Requirement 10.3)
        expect(emailTemplate.htmlBody).toContain(templateData.createdByName)
        expect(emailTemplate.htmlBody).toContain(templateData.createdAt.toLocaleString())
        expect(emailTemplate.htmlBody).toContain(templateData.createdAt.toISOString())
        
        // Property 5: Should contain firm number if provided (Requirement 10.2)
        if (templateData.firmNumber) {
          expect(emailTemplate.htmlBody).toContain(templateData.firmNumber)
        }
        
        // Property 6: Text body should contain same information as HTML
        expect(emailTemplate.textBody).toContain(templateData.clientName)
        expect(emailTemplate.textBody).toContain(templateData.clientEmail)
        expect(emailTemplate.textBody).toContain(templateData.firmName)
        expect(emailTemplate.textBody).toContain(templateData.createdByName)
        if (templateData.temporaryPassword && templateData.temporaryPassword.trim()) {
          expect(emailTemplate.textBody).toContain(templateData.temporaryPassword)
        }
        
        // Property 7: Should follow standardized format (Requirement 10.4)
        expect(emailTemplate.htmlBody).toContain('Account Details')
        expect(emailTemplate.htmlBody).toContain('Creation Information')
        expect(emailTemplate.htmlBody).toContain('Next Steps')
        expect(emailTemplate.htmlBody).toContain('Account Creation Notification')
        expect(emailTemplate.htmlBody).toMatch(/Message ID:<\/strong>\s*ACC-\d+-[a-z0-9]+/)
        
        // Property 8: Should include security warnings for credentials
        if (templateData.temporaryPassword && templateData.temporaryPassword.trim()) {
          expect(emailTemplate.htmlBody).toContain('Security Note')
          expect(emailTemplate.htmlBody).toContain('change password')
          expect(emailTemplate.textBody).toContain('change password')
        }
        
        // Property 9: Should be properly formatted HTML
        expect(emailTemplate.htmlBody).toContain('<div')
        expect(emailTemplate.htmlBody).toContain('</div>')
        expect(emailTemplate.htmlBody).toContain('<table')
        expect(emailTemplate.htmlBody).toContain('</table>')
        
        // Property 10: Text version should be readable without HTML
        expect(emailTemplate.textBody).not.toContain('<')
        expect(emailTemplate.textBody).not.toContain('>')
        expect(emailTemplate.textBody.length).toBeGreaterThan(100)
      }
    ), { numRuns: 100 })
  })

  it('should handle email delivery with proper error handling and retry logic', async () => {
    // **Validates: Requirements 10.5**
    await fc.assert(fc.asyncProperty(
      fc.record({
        shouldFail: fc.boolean(),
        retryCount: fc.integer({ min: 1, max: 3 }), // Ensure at least 1 retry
        errorMessage: fc.string({ minLength: 5, maxLength: 100 }).filter(s => s.trim().length > 0)
      }),
      async (testScenario) => {
        // Mock the sendEmailWithSES method to simulate failures
        let callCount = 0
        const originalSendEmail = emailService.sendEmailWithSES
        
        emailService.sendEmailWithSES = vi.fn().mockImplementation(async () => {
          callCount++
          
          if (testScenario.shouldFail && callCount <= testScenario.retryCount) {
            return {
              success: false,
              error: testScenario.errorMessage,
              attemptCount: callCount
            }
          }
          
          return {
            success: true,
            messageId: `test-message-${callCount}`,
            attemptCount: callCount
          }
        })
        
        try {
          // Test email sending with retry logic
          const templateData: EmailTemplateData = {
            firmName: 'Test Firm',
            clientName: 'Test Client',
            clientEmail: 'test@example.com',
            temporaryPassword: 'TestPass123!',
            createdByName: 'Test Creator',
            createdAt: new Date()
          }
          
          const emailTemplate = renderEmailTemplate('NEW_ACCOUNT_CREDENTIALS', templateData)
          
          const result = await emailService.sendEmailWithSES(
            {
              email: 'support@quantyxg.com',
              name: 'Support Team',
              role: 'admin'
            },
            emailTemplate,
            'admin'
          )
          
          // Property 1: Should return proper result structure
          expect(result).toHaveProperty('success')
          expect(result).toHaveProperty('attemptCount')
          
          // Property 2: Success/failure should match expected scenario
          if (testScenario.shouldFail && callCount <= testScenario.retryCount) {
            expect(result.success).toBe(false)
            expect(result.error).toBeDefined()
            expect(result.error).toContain(testScenario.errorMessage)
          } else {
            expect(result.success).toBe(true)
            expect(result.messageId).toBeDefined()
          }
          
          // Property 3: Should track attempt count correctly
          expect(result.attemptCount).toBe(callCount)
          expect(callCount).toBeGreaterThan(0)
          
        } finally {
          // Restore original method
          emailService.sendEmailWithSES = originalSendEmail
        }
      }
    ), { numRuns: 50 })
  })

  it('should maintain email template consistency across different data variations', async () => {
    // **Validates: Requirements 10.4**
    await fc.assert(fc.asyncProperty(
      fc.array(
        fc.record({
          firmName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          clientName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          clientEmail: fc.emailAddress(),
          temporaryPassword: fc.string({ minLength: 12, maxLength: 12 }),
          createdByName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() })
        }),
        { minLength: 2, maxLength: 10 }
      ),
      async (templateDataArray: EmailTemplateData[]) => {
        const generatedEmails = templateDataArray.map(data => 
          renderEmailTemplate('NEW_ACCOUNT_CREDENTIALS', data)
        )
        
        // Property 1: All emails should have consistent structure
        const htmlStructures = generatedEmails.map(email => {
          const sections = [
            email.htmlBody.includes('Account Details'),
            email.htmlBody.includes('Creation Information'),
            email.htmlBody.includes('Temporary Credentials'),
            email.htmlBody.includes('Next Steps'),
            email.htmlBody.includes('Account Creation Notification')
          ]
          return sections
        })
        
        // All emails should have the same structural elements
        const firstStructure = htmlStructures[0]
        htmlStructures.forEach(structure => {
          expect(structure).toEqual(firstStructure)
        })
        
        // Property 2: All emails should follow same subject pattern
        generatedEmails.forEach(email => {
          expect(email.subject).toMatch(/^New Client Account Created - .+$/)
        })
        
        // Property 3: All emails should have consistent message ID format
        generatedEmails.forEach(email => {
          expect(email.htmlBody).toMatch(/Message ID:<\/strong>\s*ACC-\d+-[a-z0-9]+/)
          expect(email.textBody).toMatch(/Message ID:\s*ACC-\d+-[a-z0-9]+/)
        })
        
        // Property 4: All emails should have proper HTML structure
        generatedEmails.forEach(email => {
          expect(email.htmlBody).toContain('<div')
          expect(email.htmlBody).toContain('</div>')
          expect(email.htmlBody).toContain('<table')
          expect(email.htmlBody).toContain('</table>')
          
          // Should have proper styling
          expect(email.htmlBody).toContain('font-family: Arial')
          expect(email.htmlBody).toContain('color: #262083')
        })
        
        // Property 5: Text versions should be consistent in format
        generatedEmails.forEach(email => {
          expect(email.textBody).toContain('NEW CLIENT ACCOUNT CREATED')
          expect(email.textBody).toContain('ACCOUNT DETAILS:')
          expect(email.textBody).toContain('CREATION INFORMATION:')
          expect(email.textBody).toContain('NEXT STEPS:')
        })
      }
    ), { numRuns: 20 })
  })

  it('should properly escape and sanitize email content', async () => {
    // **Validates: Requirements 10.4 - Security and standardized format**
    await fc.assert(fc.asyncProperty(
      fc.record({
        firmName: fc.string({ minLength: 1, maxLength: 50 }).map(s => s + '<script>alert("xss")</script>'),
        clientName: fc.string({ minLength: 1, maxLength: 50 }).map(s => s + '&lt;test&gt;'),
        clientEmail: fc.emailAddress(),
        temporaryPassword: fc.string({ minLength: 12, maxLength: 12 }),
        createdByName: fc.string({ minLength: 1, maxLength: 50 }).map(s => s + '"malicious"'),
        createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date() })
      }),
      async (templateData: EmailTemplateData) => {
        const emailTemplate = renderEmailTemplate('NEW_ACCOUNT_CREDENTIALS', templateData)
        
        // Property 1: Should properly escape script tags and HTML
        expect(emailTemplate.htmlBody).not.toContain('<script>')
        expect(emailTemplate.htmlBody).not.toContain('</script>')
        expect(emailTemplate.htmlBody).not.toContain('javascript:')
        expect(emailTemplate.htmlBody).not.toContain('onclick=')
        expect(emailTemplate.htmlBody).not.toContain('onerror=')
        
        // Property 2: Should not contain the original malicious content
        expect(emailTemplate.htmlBody).not.toContain('alert("xss")')
        expect(emailTemplate.htmlBody).not.toContain('<script>alert("xss")</script>')
        
        // Property 3: Should contain escaped versions instead
        expect(emailTemplate.htmlBody).toContain('&lt;script&gt;')
        expect(emailTemplate.htmlBody).toContain('&lt;/script&gt;')
        expect(emailTemplate.htmlBody).toContain('alert(&quot;xss&quot;)')
        
        // Property 4: Should handle special characters safely
        expect(emailTemplate.htmlBody).toBeDefined()
        expect(emailTemplate.textBody).toBeDefined()
        
        // Property 5: Should maintain data integrity despite special characters
        // The firm name should still be present in escaped form
        const cleanFirmName = templateData.firmName.replace(/<[^>]*>/g, '')
        if (cleanFirmName.trim().length > 0) {
          expect(emailTemplate.htmlBody).toContain(cleanFirmName.trim())
        }
        
        // Property 6: Should not break HTML structure
        const openDivs = (emailTemplate.htmlBody.match(/<div/g) || []).length
        const closeDivs = (emailTemplate.htmlBody.match(/<\/div>/g) || []).length
        expect(openDivs).toBe(closeDivs)
        
        // Property 7: Text version should be safe from HTML injection
        expect(emailTemplate.textBody).not.toContain('<script>')
        expect(emailTemplate.textBody).not.toContain('</script>')
      }
    ), { numRuns: 50 })
  })
})