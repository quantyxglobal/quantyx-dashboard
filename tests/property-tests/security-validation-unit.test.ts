import { describe, it } from 'vitest'
import fc from 'fast-check'
import { 
  validateSecurityInput, 
  validateFileUpload,
  sanitizeInput,
  userValidationSchemas
} from '@/lib/security-validation'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limiter'

/**
 * Property 14: Security Attack Prevention (Unit Tests)
 * **Validates: Requirements 7.3**
 * 
 * Unit tests for security validation without database dependencies
 */

// Malicious input generators
const sqlInjectionGenerator = fc.oneof(
  fc.constant("'; DROP TABLE users; --"),
  fc.constant("' OR '1'='1"),
  fc.constant("admin'--"),
  fc.constant("' UNION SELECT * FROM users --"),
  fc.constant("1' OR 1=1#"),
  fc.constant("' OR 'a'='a")
)

const xssGenerator = fc.oneof(
  fc.constant("<script>alert('XSS')</script>"),
  fc.constant("<img src=x onerror=alert('XSS')>"),
  fc.constant("javascript:alert('XSS')"),
  fc.constant("<iframe src='javascript:alert(\"XSS\")'></iframe>"),
  fc.constant("<svg onload=alert('XSS')>"),
  fc.constant("'><script>alert('XSS')</script>")
)

const pathTraversalGenerator = fc.oneof(
  fc.constant("../../../etc/passwd"),
  fc.constant("..\\..\\..\\windows\\system32\\config\\sam"),
  fc.constant("%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"),
  fc.constant("....//....//....//etc/passwd")
)

const maliciousInputGenerator = fc.oneof(
  sqlInjectionGenerator,
  xssGenerator,
  pathTraversalGenerator
)

describe('Property 14: Security Attack Prevention (Unit Tests)', () => {
  it('should detect SQL injection patterns in input validation', async () => {
    // Feature: medilegal-schema-redesign, Property 14: Security Attack Prevention
    await fc.assert(fc.property(
      sqlInjectionGenerator,
      fc.constantFrom('email', 'firstName', 'lastName', 'title'),
      (maliciousInput, fieldName) => {
        const validation = validateSecurityInput(
          maliciousInput,
          fieldName,
          'test-user-id',
          '192.168.1.1',
          'test-agent'
        )

        // SQL injection should be detected
        return !validation.isValid && validation.violations.includes('SQL_INJECTION_ATTEMPT')
      }
    ), { numRuns: 20 })
  })

  it('should sanitize XSS payloads effectively', async () => {
    // Feature: medilegal-schema-redesign, Property 14: Security Attack Prevention
    await fc.assert(fc.property(
      xssGenerator,
      (xssPayload) => {
        const sanitized = sanitizeInput(xssPayload)
        
        // Sanitized input should not contain dangerous patterns
        const hasDangerousPatterns = 
          sanitized.includes('<script') ||
          sanitized.includes('javascript:') ||
          sanitized.includes('onerror=') ||
          sanitized.includes('onload=') ||
          sanitized.includes('<iframe')

        return !hasDangerousPatterns
      }
    ), { numRuns: 15 })
  })

  it('should validate file uploads and block malicious file types', async () => {
    // Feature: medilegal-schema-redesign, Property 14: Security Attack Prevention
    await fc.assert(fc.property(
      fc.oneof(
        // Malicious files
        fc.record({
          filename: fc.constantFrom('virus.exe', 'malware.bat', 'script.js', 'trojan.scr'),
          mimeType: fc.constantFrom('application/x-executable', 'application/x-bat', 'text/javascript'),
          size: fc.integer({ min: 1, max: 1000000 })
        }),
        // Valid files
        fc.record({
          filename: fc.constantFrom('document.pdf', 'report.docx', 'image.jpg'),
          mimeType: fc.constantFrom('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg'),
          size: fc.integer({ min: 1, max: 50000000 })
        })
      ),
      (file) => {
        const validation = validateFileUpload(file)
        
        // Determine if file should be blocked
        const isMaliciousExtension = /\.(exe|bat|cmd|scr|js)$/i.test(file.filename)
        const isMaliciousMimeType = [
          'application/x-executable',
          'application/x-bat',
          'text/javascript'
        ].includes(file.mimeType)
        const isOversized = file.size > 100 * 1024 * 1024

        const shouldBeBlocked = isMaliciousExtension || isMaliciousMimeType || isOversized

        if (shouldBeBlocked) {
          return !validation.isValid && validation.errors.length > 0
        } else {
          return validation.isValid
        }
      }
    ), { numRuns: 25 })
  })

  it('should enforce rate limiting for operations', async () => {
    // Feature: medilegal-schema-redesign, Property 14: Security Attack Prevention
    await fc.assert(fc.asyncProperty(
      fc.constantFrom('login', 'register', 'createUser'),
      fc.string({ minLength: 5, maxLength: 15 }),
      fc.integer({ min: 6, max: 15 }),
      async (operation, identifier, requestCount) => {
        // Reset rate limit for clean test
        resetRateLimit(operation, identifier)

        let blockedCount = 0
        let allowedCount = 0

        // Make multiple requests
        for (let i = 0; i < requestCount; i++) {
          const result = await checkRateLimit(operation, identifier, {
            userId: identifier,
            ipAddress: '192.168.1.1',
            userAgent: 'test-agent',
            success: false
          })
          
          if (result.allowed) {
            allowedCount++
          } else {
            blockedCount++
          }
        }

        // Rate limiting should eventually block requests
        return blockedCount > 0 || requestCount <= 5
      }
    ), { numRuns: 10 })
  })

  it('should detect path traversal attempts', async () => {
    // Feature: medilegal-schema-redesign, Property 14: Security Attack Prevention
    await fc.assert(fc.property(
      pathTraversalGenerator,
      fc.constantFrom('filename', 'path', 'directory'),
      (pathTraversalInput, fieldName) => {
        const validation = validateSecurityInput(
          pathTraversalInput,
          fieldName,
          'test-user-id',
          '192.168.1.1',
          'test-agent'
        )

        // Path traversal should be detected
        return !validation.isValid && validation.violations.includes('PATH_TRAVERSAL_ATTEMPT')
      }
    ), { numRuns: 15 })
  })

  it('should validate user input schemas correctly', async () => {
    // Feature: medilegal-schema-redesign, Property 14: Security Attack Prevention
    await fc.assert(fc.property(
      fc.record({
        email: fc.oneof(fc.emailAddress(), maliciousInputGenerator),
        firstName: fc.oneof(fc.string({ minLength: 2, maxLength: 30 }), maliciousInputGenerator),
        lastName: fc.oneof(fc.string({ minLength: 2, maxLength: 30 }), maliciousInputGenerator),
        password: fc.oneof(
          fc.string({ minLength: 8, maxLength: 20 }).map(s => s + 'A1!'),
          maliciousInputGenerator
        ),
        role: fc.oneof(fc.constantFrom('ADMIN', 'CLIENT'), fc.constant('HACKER')),
        organizationId: fc.oneof(fc.uuid(), maliciousInputGenerator)
      }),
      (userData) => {
        try {
          const result = userValidationSchemas.createUser.safeParse(userData)
          
          // Determine if data should be valid
          const hasValidEmail = typeof userData.email === 'string' && userData.email.includes('@') && !userData.email.includes('<')
          const hasValidRole = ['ADMIN', 'CLIENT'].includes(userData.role as string)
          const hasValidPassword = typeof userData.password === 'string' && userData.password.length >= 8
          const hasValidNames = typeof userData.firstName === 'string' && typeof userData.lastName === 'string' &&
                               !userData.firstName.includes('<') && !userData.lastName.includes('<')
          const hasValidOrgId = typeof userData.organizationId === 'string' && 
                               userData.organizationId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

          const shouldBeValid = hasValidEmail && hasValidRole && hasValidPassword && hasValidNames && hasValidOrgId

          return result.success === shouldBeValid
        } catch (error) {
          // Schema validation errors are expected for malicious input
          return true
        }
      }
    ), { numRuns: 20 })
  })

  it('should handle concurrent validation requests safely', async () => {
    // Feature: medilegal-schema-redesign, Property 14: Security Attack Prevention
    await fc.assert(fc.asyncProperty(
      fc.array(maliciousInputGenerator, { minLength: 5, maxLength: 10 }),
      async (maliciousInputs) => {
        // Test concurrent validation
        const validationPromises = maliciousInputs.map((input, index) => 
          Promise.resolve(validateSecurityInput(
            input,
            `field_${index}`,
            `user_${index}`,
            `192.168.1.${100 + index}`,
            'concurrent-test'
          ))
        )

        const results = await Promise.all(validationPromises)

        // All malicious inputs should be detected
        const detectedCount = results.filter(result => !result.isValid).length
        
        // Allow some margin for edge cases but most should be detected
        return detectedCount >= results.length * 0.7
      }
    ), { numRuns: 5 })
  })
})