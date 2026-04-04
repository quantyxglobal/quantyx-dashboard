import { z } from 'zod'
import { logSecurityViolation } from './audit-log'

/**
 * Comprehensive input validation schemas for security attack prevention
 * Validates: Requirements 7.3
 */

// Base security validation patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
  /(--|\/\*|\*\/|;|'|"|`)/,
  /(\bOR\b|\bAND\b).*[=<>]/i,
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bEXEC\b|\bEXECUTE\b)/i
]

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/i,
  /on\w+\s*=/i,
  /<iframe\b[^>]*>/i,
  /<object\b[^>]*>/i,
  /<embed\b[^>]*>/i
]

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /%2e%2e%2f/i,
  /%2e%2e%5c/i,
  /\.\.%2f/i,
  /\.\.%5c/i
]

/**
 * Security validation function to detect malicious input
 */
export function validateSecurityInput(
  input: string, 
  fieldName: string,
  userId?: string,
  ipAddress?: string,
  userAgent?: string
): { isValid: boolean; violations: string[] } {
  const violations: string[] = []

  // Check for SQL injection patterns
  for (const pattern of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      violations.push('SQL_INJECTION_ATTEMPT')
      logSecurityViolation({
        userId,
        action: 'SQL_INJECTION_ATTEMPT',
        details: `SQL injection pattern detected in field: ${fieldName}`,
        entityType: 'input_validation',
        ipAddress,
        userAgent,
        attemptedOperation: `Field: ${fieldName}, Input: ${input.substring(0, 100)}`
      })
      break
    }
  }

  // Check for XSS patterns
  for (const pattern of XSS_PATTERNS) {
    if (pattern.test(input)) {
      violations.push('XSS_ATTEMPT')
      logSecurityViolation({
        userId,
        action: 'INVALID_INPUT_DETECTED',
        details: `XSS pattern detected in field: ${fieldName}`,
        entityType: 'input_validation',
        ipAddress,
        userAgent,
        attemptedOperation: `Field: ${fieldName}, Input: ${input.substring(0, 100)}`
      })
      break
    }
  }

  // Check for path traversal patterns
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(input)) {
      violations.push('PATH_TRAVERSAL_ATTEMPT')
      logSecurityViolation({
        userId,
        action: 'INVALID_INPUT_DETECTED',
        details: `Path traversal pattern detected in field: ${fieldName}`,
        entityType: 'input_validation',
        ipAddress,
        userAgent,
        attemptedOperation: `Field: ${fieldName}, Input: ${input.substring(0, 100)}`
      })
      break
    }
  }

  return {
    isValid: violations.length === 0,
    violations
  }
}

/**
 * Enhanced Zod string schema with security validation
 */
export const secureString = (fieldName: string, options?: {
  minLength?: number
  maxLength?: number
  userId?: string
  ipAddress?: string
  userAgent?: string
}) => {
  return z.string()
    .min(options?.minLength || 1, `${fieldName} is required`)
    .max(options?.maxLength || 1000, `${fieldName} is too long`)
    .refine((value) => {
      const validation = validateSecurityInput(
        value, 
        fieldName, 
        options?.userId, 
        options?.ipAddress, 
        options?.userAgent
      )
      return validation.isValid
    }, {
      message: `Invalid input detected in ${fieldName}`
    })
}

/**
 * User input validation schemas
 */
export const userValidationSchemas = {
  // User registration/creation
  createUser: z.object({
    email: z.string().email('Invalid email format').max(255),
    firstName: secureString('firstName', { maxLength: 100 }),
    lastName: secureString('lastName', { maxLength: 100 }),
    password: z.string()
      .min(8, 'Password must be at least 8 characters')
      .max(128, 'Password is too long')
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
        'Password must contain uppercase, lowercase, number, and special character'),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'CLIENT']),
    organizationId: z.string().uuid().optional()
  }),

  // User login
  login: z.object({
    email: z.string().email('Invalid email format').max(255),
    password: z.string().min(1, 'Password is required').max(128)
  }),

  // Case creation
  createCase: z.object({
    title: secureString('title', { maxLength: 200 }),
    description: secureString('description', { maxLength: 2000 }).optional(),
    clientName: secureString('clientName', { maxLength: 100 }),
    clientEmail: z.string().email('Invalid email format').max(255),
    clientPhone: secureString('clientPhone', { maxLength: 20 }).optional(),
    priority: z.enum(['SUPER_RUSH', 'EXPEDITE', 'NORMAL', 'LOW']),
    specialInstructions: secureString('specialInstructions', { maxLength: 1000 }).optional()
  }),

  // File upload
  fileUpload: z.object({
    filename: secureString('filename', { maxLength: 255 }),
    mimeType: z.string().max(100),
    fileSize: z.number().positive().max(100 * 1024 * 1024), // 100MB max
    category: z.enum(['MEDICAL_RECORD', 'LEGAL_DOCUMENT', 'CORRESPONDENCE', 'REPORT', 'CHRONOLOGY', 'OPINION', 'HYPERLINK', 'DEMAND_LETTER', 'OTHER'])
  }),

  // Organization/Firm creation
  createOrganization: z.object({
    name: secureString('name', { maxLength: 100 }),
    displayName: secureString('displayName', { maxLength: 100 }),
    email: z.string().email('Invalid email format').max(255).optional(),
    phone: secureString('phone', { maxLength: 20 }).optional(),
    address: secureString('address', { maxLength: 500 }).optional()
  }),

  // Quote request
  quoteRequest: z.object({
    fullName: secureString('fullName', { maxLength: 100 }),
    email: z.string().email('Invalid email format').max(255),
    phone: secureString('phone', { maxLength: 20 }),
    organizationName: secureString('organizationName', { maxLength: 100 }).optional(),
    caseDescription: secureString('caseDescription', { maxLength: 2000 }).optional(),
    specialRequirements: secureString('specialRequirements', { maxLength: 1000 }).optional()
  }),

  // Contact inquiry
  contactInquiry: z.object({
    firstName: secureString('firstName', { maxLength: 50 }),
    lastName: secureString('lastName', { maxLength: 50 }),
    email: z.string().email('Invalid email format').max(255),
    phone: secureString('phone', { maxLength: 20 }).optional(),
    subject: secureString('subject', { maxLength: 200 }).optional(),
    message: secureString('message', { maxLength: 2000 })
  })
}

/**
 * Validate request body against schema with security logging
 */
export async function validateRequestBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>,
  context: {
    userId?: string
    ipAddress?: string
    userAgent?: string
    operation: string
  }
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = schema.parse(body)
    return { success: true, data }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      
      // Log validation failure for security monitoring
      await logSecurityViolation({
        userId: context.userId,
        action: 'INVALID_INPUT_DETECTED',
        details: `Input validation failed for ${context.operation}: ${errorMessage}`,
        entityType: 'input_validation',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        attemptedOperation: context.operation
      })

      return { success: false, error: errorMessage }
    }
    
    return { success: false, error: 'Invalid input format' }
  }
}

/**
 * Sanitize string input to prevent XSS and other attacks
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Validate file upload security
 */
export function validateFileUpload(file: {
  filename: string
  mimeType: string
  size: number
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check file extension
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.zip', '.rar']
  const fileExtension = file.filename.toLowerCase().substring(file.filename.lastIndexOf('.'))
  
  if (!allowedExtensions.includes(fileExtension)) {
    errors.push(`File type ${fileExtension} is not allowed`)
  }

  // Check MIME type
  const allowedMimeTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/zip',
    'application/x-rar-compressed'
  ]

  if (!allowedMimeTypes.includes(file.mimeType)) {
    errors.push(`MIME type ${file.mimeType} is not allowed`)
  }

  // Check file size (100MB max)
  if (file.size > 100 * 1024 * 1024) {
    errors.push('File size exceeds 100MB limit')
  }

  // Check for suspicious filenames
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|scr|pif|com|vbs|js|jar|app)$/i,
    /\.\w+\.(exe|bat|cmd|scr|pif|com|vbs|js|jar|app)$/i // Double extension
  ]

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(file.filename)) {
      errors.push('Suspicious file extension detected')
      break
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}