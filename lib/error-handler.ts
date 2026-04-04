/**
 * Comprehensive Error Handling System
 * 
 * Provides centralized error handling for file uploads, authentication,
 * email services, and general system errors with user-friendly messages
 * and system logging.
 * 
 * Validates: Requirements 1.4, 1.5, 14.1, 14.2, 7.6, 14.8
 */

import { toast } from 'sonner'

// Error types for categorization
export type ErrorType = 
  | 'file_upload'
  | 'authentication' 
  | 'authorization'
  | 'email_service'
  | 'network'
  | 'validation'
  | 'server_error'
  | 'rate_limit'
  | 'not_found'

// Error severity levels
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

// Structured error interface
export interface SystemError {
  type: ErrorType
  message: string
  userMessage: string
  severity: ErrorSeverity
  code?: string
  field?: string
  context?: Record<string, any>
  timestamp: Date
  userId?: string
  requestId?: string
  retryable?: boolean
}

// File upload specific errors
export interface FileUploadError extends SystemError {
  type: 'file_upload'
  fileName?: string
  fileSize?: number
  fileType?: string
}

// Authentication/Authorization specific errors
export interface AuthError extends SystemError {
  type: 'authentication' | 'authorization'
  action?: string
  resource?: string
}

// Email service specific errors
export interface EmailError extends SystemError {
  type: 'email_service'
  recipient?: string
  template?: string
  retryCount?: number
}

/**
 * File Upload Error Handler
 * Handles file size limits, type validation, and network failures
 */
export class FileUploadErrorHandler {
  static handleFileSizeError(fileName: string, fileSize: number, maxSize: number): FileUploadError {
    const error: FileUploadError = {
      type: 'file_upload',
      message: `File "${fileName}" exceeds maximum size limit of ${this.formatFileSize(maxSize)}`,
      userMessage: `File "${fileName}" is too large. Maximum file size is ${this.formatFileSize(maxSize)}.`,
      severity: 'medium',
      code: 'FILE_SIZE_EXCEEDED',
      fileName,
      fileSize,
      timestamp: new Date(),
      retryable: false,
      context: { fileName, fileSize, maxSize }
    }
    
    this.logError(error)
    return error
  }

  static handleFileTypeError(fileName: string, fileType: string, allowedTypes: string[]): FileUploadError {
    const error: FileUploadError = {
      type: 'file_upload',
      message: `File "${fileName}" has unsupported type "${fileType}"`,
      userMessage: `File "${fileName}" is not supported. Please upload files in these formats: ${allowedTypes.join(', ')}.`,
      severity: 'medium',
      code: 'INVALID_FILE_TYPE',
      fileName,
      fileType,
      timestamp: new Date(),
      retryable: false,
      context: { fileName, fileType, allowedTypes }
    }
    
    this.logError(error)
    return error
  }

  static handleUploadNetworkError(fileName: string, originalError: Error): FileUploadError {
    const error: FileUploadError = {
      type: 'file_upload',
      message: `Network error during upload of "${fileName}": ${originalError.message}`,
      userMessage: `Failed to upload "${fileName}" due to network issues. Please check your connection and try again.`,
      severity: 'high',
      code: 'UPLOAD_NETWORK_ERROR',
      fileName,
      timestamp: new Date(),
      retryable: true,
      context: { fileName, originalError: originalError.message }
    }
    
    this.logError(error)
    return error
  }

  static handleChunkedUploadError(fileName: string, chunkIndex: number, totalChunks: number): FileUploadError {
    const error: FileUploadError = {
      type: 'file_upload',
      message: `Chunked upload failed for "${fileName}" at chunk ${chunkIndex + 1}/${totalChunks}`,
      userMessage: `Upload of "${fileName}" was interrupted. Resuming from ${Math.round((chunkIndex / totalChunks) * 100)}%...`,
      severity: 'medium',
      code: 'CHUNKED_UPLOAD_FAILED',
      fileName,
      timestamp: new Date(),
      retryable: true,
      context: { fileName, chunkIndex, totalChunks, progress: (chunkIndex / totalChunks) * 100 }
    }
    
    this.logError(error)
    return error
  }

  private static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  }

  private static logError(error: FileUploadError) {
    console.error('[FileUpload Error]', {
      type: error.type,
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp
    })
  }
}

/**
 * Authentication and Authorization Error Handler
 */
export class AuthErrorHandler {
  static handleAuthenticationError(action: string, originalError?: Error): AuthError {
    const error: AuthError = {
      type: 'authentication',
      message: `Authentication failed for action: ${action}`,
      userMessage: 'Your session has expired. Please log in again.',
      severity: 'high',
      code: 'AUTH_FAILED',
      action,
      timestamp: new Date(),
      retryable: false,
      context: { action, originalError: originalError?.message }
    }
    
    this.logError(error)
    return error
  }

  static handleAuthorizationError(action: string, resource: string, userId?: string): AuthError {
    const error: AuthError = {
      type: 'authorization',
      message: `User ${userId || 'unknown'} not authorized for action "${action}" on resource "${resource}"`,
      userMessage: 'You do not have permission to perform this action.',
      severity: 'medium',
      code: 'UNAUTHORIZED',
      action,
      resource,
      userId,
      timestamp: new Date(),
      retryable: false,
      context: { action, resource, userId }
    }
    
    this.logError(error)
    return error
  }

  static handleSessionExpiredError(): AuthError {
    const error: AuthError = {
      type: 'authentication',
      message: 'User session has expired',
      userMessage: 'Your session has expired. Please log in again.',
      severity: 'medium',
      code: 'SESSION_EXPIRED',
      timestamp: new Date(),
      retryable: false
    }
    
    this.logError(error)
    return error
  }

  static handleInvalidCredentialsError(): AuthError {
    const error: AuthError = {
      type: 'authentication',
      message: 'Invalid login credentials provided',
      userMessage: 'Invalid email or password. Please try again.',
      severity: 'low',
      code: 'INVALID_CREDENTIALS',
      timestamp: new Date(),
      retryable: true
    }
    
    this.logError(error)
    return error
  }

  private static logError(error: AuthError) {
    console.error('[Auth Error]', {
      type: error.type,
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp
    })
  }
}

/**
 * Email Service Error Handler
 * Handles email delivery failures with retry logic
 */
export class EmailErrorHandler {
  static handleEmailDeliveryError(
    recipient: string, 
    template: string, 
    retryCount: number = 0,
    originalError?: Error
  ): EmailError {
    const error: EmailError = {
      type: 'email_service',
      message: `Email delivery failed to ${recipient} using template ${template} (attempt ${retryCount + 1})`,
      userMessage: retryCount < 3 
        ? 'Email notification is being sent. You may experience a slight delay.'
        : 'Email notification could not be sent. Please check your email settings.',
      severity: retryCount < 3 ? 'medium' : 'high',
      code: 'EMAIL_DELIVERY_FAILED',
      recipient,
      template,
      retryCount,
      timestamp: new Date(),
      retryable: retryCount < 3,
      context: { recipient, template, retryCount, originalError: originalError?.message }
    }
    
    this.logError(error)
    return error
  }

  static handleEmailTemplateError(template: string, context: Record<string, any>): EmailError {
    const error: EmailError = {
      type: 'email_service',
      message: `Email template "${template}" rendering failed`,
      userMessage: 'There was an issue preparing your email notification. Our team has been notified.',
      severity: 'high',
      code: 'EMAIL_TEMPLATE_ERROR',
      template,
      timestamp: new Date(),
      retryable: false,
      context: { template, templateContext: context }
    }
    
    this.logError(error)
    return error
  }

  static handleEmailServiceUnavailable(): EmailError {
    const error: EmailError = {
      type: 'email_service',
      message: 'Email service is currently unavailable',
      userMessage: 'Email notifications are temporarily unavailable. We are working to restore service.',
      severity: 'critical',
      code: 'EMAIL_SERVICE_DOWN',
      timestamp: new Date(),
      retryable: true
    }
    
    this.logError(error)
    return error
  }

  private static logError(error: EmailError) {
    console.error('[Email Error]', {
      type: error.type,
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp
    })
  }
}

/**
 * General System Error Handler
 */
export class SystemErrorHandler {
  static handleValidationError(field: string, message: string, value?: any): SystemError {
    const error: SystemError = {
      type: 'validation',
      message: `Validation failed for field "${field}": ${message}`,
      userMessage: message,
      severity: 'low',
      code: 'VALIDATION_ERROR',
      field,
      timestamp: new Date(),
      retryable: true,
      context: { field, value }
    }
    
    this.logError(error)
    return error
  }

  static handleNetworkError(action: string, originalError: Error): SystemError {
    const error: SystemError = {
      type: 'network',
      message: `Network error during ${action}: ${originalError.message}`,
      userMessage: 'Network connection issue. Please check your internet connection and try again.',
      severity: 'high',
      code: 'NETWORK_ERROR',
      timestamp: new Date(),
      retryable: true,
      context: { action, originalError: originalError.message }
    }
    
    this.logError(error)
    return error
  }

  static handleServerError(action: string, statusCode?: number, originalError?: Error): SystemError {
    const error: SystemError = {
      type: 'server_error',
      message: `Server error during ${action}: ${originalError?.message || 'Unknown server error'}`,
      userMessage: 'A server error occurred. Our team has been notified and is working on a fix.',
      severity: 'critical',
      code: `SERVER_ERROR_${statusCode || 500}`,
      timestamp: new Date(),
      retryable: statusCode ? statusCode >= 500 : true,
      context: { action, statusCode, originalError: originalError?.message }
    }
    
    this.logError(error)
    return error
  }

  static handleRateLimitError(action: string, retryAfter?: number): SystemError {
    const error: SystemError = {
      type: 'rate_limit',
      message: `Rate limit exceeded for action: ${action}`,
      userMessage: `Too many requests. Please wait ${retryAfter ? `${retryAfter} seconds` : 'a moment'} before trying again.`,
      severity: 'medium',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date(),
      retryable: true,
      context: { action, retryAfter }
    }
    
    this.logError(error)
    return error
  }

  private static logError(error: SystemError) {
    console.error('[System Error]', {
      type: error.type,
      code: error.code,
      message: error.message,
      severity: error.severity,
      context: error.context,
      timestamp: error.timestamp
    })
  }
}

/**
 * Toast Notification Helper
 * Displays user-friendly error messages with appropriate actions
 */
export class ErrorToastHandler {
  static showError(error: SystemError, customAction?: { label: string; onClick: () => void }) {
    const action = customAction || (error.retryable ? {
      label: 'Retry',
      onClick: () => {
        // Default retry action - can be overridden
        window.location.reload()
      }
    } : undefined)

    toast.error(error.userMessage, {
      description: error.code ? `Error Code: ${error.code}` : undefined,
      action: action ? {
        label: action.label,
        onClick: action.onClick
      } : undefined,
      duration: error.severity === 'critical' ? 10000 : 5000
    })
  }

  static showFileUploadError(error: FileUploadError, onRetry?: () => void) {
    this.showError(error, onRetry ? {
      label: 'Retry Upload',
      onClick: onRetry
    } : undefined)
  }

  static showAuthError(error: AuthError, onLogin?: () => void) {
    this.showError(error, error.type === 'authentication' && onLogin ? {
      label: 'Log In',
      onClick: onLogin
    } : undefined)
  }

  static showEmailError(error: EmailError) {
    // Email errors are usually background processes, show less intrusive notifications
    if (error.retryable) {
      toast.info(error.userMessage, {
        description: 'Retrying automatically...',
        duration: 3000
      })
    } else {
      toast.warning(error.userMessage, {
        description: error.code ? `Error Code: ${error.code}` : undefined,
        duration: 5000
      })
    }
  }
}

/**
 * Error Recovery Utilities
 */
export class ErrorRecoveryHandler {
  static async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxRetries) {
          throw lastError
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError!
  }

  static isRetryableError(error: SystemError): boolean {
    return error.retryable === true
  }

  static shouldRetryHttpError(statusCode: number): boolean {
    // Retry on server errors (5xx) and some client errors
    return statusCode >= 500 || statusCode === 408 || statusCode === 429
  }
}