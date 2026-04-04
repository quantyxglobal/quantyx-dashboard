import { describe, it, beforeEach, afterEach } from 'vitest'
import fc from 'fast-check'
import { prisma } from '@/lib/prisma'
import { 
  logAuditAction, 
  logSecurityViolation, 
  logDatabaseAccess, 
  logAuthenticationEvent 
} from '@/lib/audit-log'

/**
 * Property 15: Comprehensive Audit Logging
 * **Validates: Requirements 7.5**
 * 
 * For all system operations and access attempts, the system should log the action, 
 * user context, and any policy violations for security monitoring.
 */

// Test data generators
const auditActionGenerator = fc.constantFrom(
  'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'UPLOAD', 'DOWNLOAD',
  'STATUS_CHANGE', 'ASSIGNMENT', 'QUOTE_SENT', 'CASE_CONVERTED'
)

const securityActionGenerator = fc.constantFrom(
  'RLS_POLICY_VIOLATION', 'UNAUTHORIZED_ACCESS_ATTEMPT', 'PRIVILEGE_ESCALATION_ATTEMPT',
  'SQL_INJECTION_ATTEMPT', 'RATE_LIMIT_EXCEEDED', 'INVALID_INPUT_DETECTED',
  'AUTHENTICATION_FAILURE', 'SESSION_HIJACK_ATTEMPT'
)

const databaseOperationGenerator = fc.constantFrom('SELECT', 'INSERT', 'UPDATE', 'DELETE')

const authActionGenerator = fc.constantFrom('LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'ACCOUNT_LOCKED')

const userContextGenerator = fc.record({
  userId: fc.uuid(),
  email: fc.emailAddress(),
  ipAddress: fc.ipV4(),
  userAgent: fc.string({ minLength: 10, maxLength: 100 }),
  organizationId: fc.option(fc.uuid())
})

const entityTypeGenerator = fc.constantFrom(
  'user', 'case', 'file', 'organization', 'authentication', 'database', 'rate_limit'
)

describe('Property 15: Comprehensive Audit Logging', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany()
  })

  afterEach(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany()
  })

  it('should log all system operations with complete user context', async () => {
    // Feature: medilegal-schema-redesign, Property 15: Comprehensive Audit Logging
    await fc.assert(fc.asyncProperty(
      fc.array(auditActionGenerator, { minLength: 5, maxLength: 20 }),
      fc.array(userContextGenerator, { minLength: 3, maxLength: 10 }),
      fc.array(entityTypeGenerator, { minLength: 1, maxLength: 5 }),
      async (actions, userContexts, entityTypes) => {
        const logPromises: Promise<void>[] = []

        // Test: Log various system operations
        for (let i = 0; i < actions.length; i++) {
          const action = actions[i]
          const userContext = userContexts[i % userContexts.length]
          const entityType = entityTypes[i % entityTypes.length]
          const entityId = fc.sample(fc.uuid(), 1)[0]

          const logPromise = logAuditAction({
            userId: userContext.userId,
            action,
            details: `Test operation: ${action} on ${entityType}`,
            entityType,
            entityId,
            organizationId: userContext.organizationId || undefined,
            ipAddress: userContext.ipAddress,
            userAgent: userContext.userAgent,
            oldValues: i % 2 === 0 ? { status: 'old_value' } : undefined,
            newValues: i % 2 === 0 ? { status: 'new_value' } : undefined
          })

          logPromises.push(logPromise)
        }

        // Wait for all logs to be created
        await Promise.all(logPromises)

        // Verify: All operations were logged
        const auditLogs = await prisma.auditLog.findMany({
          orderBy: { created_at: 'asc' }
        })

        // Should have one log entry for each operation
        if (auditLogs.length !== actions.length) {
          return false
        }

        // Verify each log has complete context
        for (let i = 0; i < auditLogs.length; i++) {
          const log = auditLogs[i]
          const expectedUserContext = userContexts[i % userContexts.length]
          const expectedAction = actions[i]
          const expectedEntityType = entityTypes[i % entityTypes.length]

          // Check required fields
          if (log.user_id !== expectedUserContext.userId) return false
          if (log.action !== expectedAction) return false
          if (log.entity_type !== expectedEntityType) return false
          if (log.ip_address !== expectedUserContext.ipAddress) return false
          if (log.user_agent !== expectedUserContext.userAgent) return false
          if (log.organization_id !== expectedUserContext.organizationId) return false
          if (!log.created_at) return false

          // Check optional fields when present
          if (i % 2 === 0) {
            if (!log.old_values || !log.new_values) return false
          }
        }

        return true
      }
    ), { numRuns: 10 })
  })

  it('should log all security violations with detailed context', async () => {
    // Feature: medilegal-schema-redesign, Property 15: Comprehensive Audit Logging
    await fc.assert(fc.asyncProperty(
      fc.array(securityActionGenerator, { minLength: 3, maxLength: 15 }),
      fc.array(userContextGenerator, { minLength: 2, maxLength: 8 }),
      async (securityActions, userContexts) => {
        const logPromises: Promise<void>[] = []

        // Test: Log various security violations
        for (let i = 0; i < securityActions.length; i++) {
          const action = securityActions[i]
          const userContext = userContexts[i % userContexts.length]
          const entityId = fc.sample(fc.uuid(), 1)[0]

          const logPromise = logSecurityViolation({
            userId: userContext.userId,
            action,
            details: `Security violation: ${action} detected from ${userContext.ipAddress}`,
            entityType: 'security',
            entityId,
            organizationId: userContext.organizationId || undefined,
            ipAddress: userContext.ipAddress,
            userAgent: userContext.userAgent,
            attemptedOperation: `test_operation_${i}`
          })

          logPromises.push(logPromise)
        }

        // Wait for all security logs to be created
        await Promise.all(logPromises)

        // Verify: All security violations were logged
        const securityLogs = await prisma.auditLog.findMany({
          where: {
            action: {
              in: securityActions
            }
          },
          orderBy: { created_at: 'asc' }
        })

        // Should have one log entry for each security violation
        if (securityLogs.length !== securityActions.length) {
          return false
        }

        // Verify each security log has detailed context
        for (let i = 0; i < securityLogs.length; i++) {
          const log = securityLogs[i]
          const expectedUserContext = userContexts[i % userContexts.length]
          const expectedAction = securityActions[i]

          // Check security-specific fields
          if (log.user_id !== expectedUserContext.userId) return false
          if (log.action !== expectedAction) return false
          if (log.entity_type !== 'security') return false
          if (log.ip_address !== expectedUserContext.ipAddress) return false
          if (log.user_agent !== expectedUserContext.userAgent) return false
          if (!log.details) return false
          if (!log.created_at) return false

          // Verify details contain security context
          const details = JSON.parse(log.details)
          if (!details.violation_type) return false
          if (!details.attempted_operation) return false
          if (!details.security_context) return false
          if (!details.timestamp) return false
        }

        return true
      }
    ), { numRuns: 8 })
  })

  it('should log all database access attempts with operation details', async () => {
    // Feature: medilegal-schema-redesign, Property 15: Comprehensive Audit Logging
    await fc.assert(fc.asyncProperty(
      fc.array(databaseOperationGenerator, { minLength: 4, maxLength: 12 }),
      fc.array(userContextGenerator, { minLength: 2, maxLength: 6 }),
      fc.array(fc.constantFrom('users', 'cases', 'files', 'organizations'), { minLength: 1, maxLength: 4 }),
      async (operations, userContexts, tableNames) => {
        const logPromises: Promise<void>[] = []

        // Test: Log various database operations
        for (let i = 0; i < operations.length; i++) {
          const operation = operations[i]
          const userContext = userContexts[i % userContexts.length]
          const tableName = tableNames[i % tableNames.length]
          const recordId = fc.sample(fc.uuid(), 1)[0]
          const success = i % 3 !== 0 // Most operations succeed, some fail

          const logPromise = logDatabaseAccess({
            userId: userContext.userId,
            operation,
            tableName,
            recordId,
            organizationId: userContext.organizationId || undefined,
            success,
            errorMessage: success ? undefined : `Access denied to ${tableName}`,
            ipAddress: userContext.ipAddress,
            userAgent: userContext.userAgent
          })

          logPromises.push(logPromise)
        }

        // Wait for all database access logs to be created
        await Promise.all(logPromises)

        // Verify: All database operations were logged
        const dbLogs = await prisma.auditLog.findMany({
          where: {
            action: {
              in: ['DATABASE_ACCESS_SUCCESS', 'DATABASE_ACCESS_FAILURE']
            }
          },
          orderBy: { created_at: 'asc' }
        })

        // Should have one log entry for each database operation
        if (dbLogs.length !== operations.length) {
          return false
        }

        // Verify each database log has operation details
        for (let i = 0; i < dbLogs.length; i++) {
          const log = dbLogs[i]
          const expectedUserContext = userContexts[i % userContexts.length]
          const expectedOperation = operations[i]
          const expectedTableName = tableNames[i % tableNames.length]
          const expectedSuccess = i % 3 !== 0

          // Check database-specific fields
          if (log.user_id !== expectedUserContext.userId) return false
          if (log.entity_type !== 'database') return false
          if (log.ip_address !== expectedUserContext.ipAddress) return false
          if (log.user_agent !== expectedUserContext.userAgent) return false
          if (!log.details) return false
          if (!log.created_at) return false

          // Verify action matches success/failure
          const expectedAction = expectedSuccess ? 'DATABASE_ACCESS_SUCCESS' : 'DATABASE_ACCESS_FAILURE'
          if (log.action !== expectedAction) return false

          // Verify details contain operation context
          const details = JSON.parse(log.details)
          if (details.operation !== expectedOperation) return false
          if (details.table_name !== expectedTableName) return false
          if (details.success !== expectedSuccess) return false
          if (!details.timestamp) return false

          // Check error message for failed operations
          if (!expectedSuccess && !details.error_message) return false
        }

        return true
      }
    ), { numRuns: 6 })
  })

  it('should log all authentication events with complete session context', async () => {
    // Feature: medilegal-schema-redesign, Property 15: Comprehensive Audit Logging
    await fc.assert(fc.asyncProperty(
      fc.array(authActionGenerator, { minLength: 3, maxLength: 10 }),
      fc.array(userContextGenerator, { minLength: 2, maxLength: 5 }),
      async (authActions, userContexts) => {
        const logPromises: Promise<void>[] = []

        // Test: Log various authentication events
        for (let i = 0; i < authActions.length; i++) {
          const action = authActions[i]
          const userContext = userContexts[i % userContexts.length]
          const success = i % 4 !== 0 // Most auth events succeed, some fail

          const logPromise = logAuthenticationEvent({
            userId: success ? userContext.userId : undefined,
            email: userContext.email,
            action,
            success,
            failureReason: success ? undefined : `Invalid credentials for ${action.toLowerCase()}`,
            ipAddress: userContext.ipAddress,
            userAgent: userContext.userAgent,
            organizationId: userContext.organizationId || undefined
          })

          logPromises.push(logPromise)
        }

        // Wait for all authentication logs to be created
        await Promise.all(logPromises)

        // Verify: All authentication events were logged
        const authLogs = await prisma.auditLog.findMany({
          where: {
            entity_type: 'authentication'
          },
          orderBy: { created_at: 'asc' }
        })

        // Should have one log entry for each authentication event
        if (authLogs.length !== authActions.length) {
          return false
        }

        // Verify each authentication log has session context
        for (let i = 0; i < authLogs.length; i++) {
          const log = authLogs[i]
          const expectedUserContext = userContexts[i % userContexts.length]
          const expectedAction = authActions[i]
          const expectedSuccess = i % 4 !== 0

          // Check authentication-specific fields
          if (log.entity_type !== 'authentication') return false
          if (log.ip_address !== expectedUserContext.ipAddress) return false
          if (log.user_agent !== expectedUserContext.userAgent) return false
          if (!log.details) return false
          if (!log.created_at) return false

          // Verify action matches success/failure
          const expectedActionSuffix = expectedSuccess ? '_SUCCESS' : '_FAILURE'
          if (!log.action.endsWith(expectedActionSuffix)) return false

          // Verify user ID for successful events
          if (expectedSuccess && log.user_id !== expectedUserContext.userId) return false

          // Verify details contain authentication context
          const details = JSON.parse(log.details)
          if (details.email !== expectedUserContext.email) return false
          if (details.success !== expectedSuccess) return false
          if (!details.timestamp) return false

          // Check failure reason for failed events
          if (!expectedSuccess && !details.failure_reason) return false
        }

        return true
      }
    ), { numRuns: 5 })
  })

  it('should maintain audit log integrity under concurrent operations', async () => {
    // Feature: medilegal-schema-redesign, Property 15: Comprehensive Audit Logging
    await fc.assert(fc.asyncProperty(
      fc.array(userContextGenerator, { minLength: 5, maxLength: 15 }),
      async (userContexts) => {
        // Test: Concurrent audit logging from multiple users
        const concurrentLogPromises = userContexts.map(async (userContext, index) => {
          const operations = [
            // Regular audit action
            logAuditAction({
              userId: userContext.userId,
              action: 'CREATE',
              details: `Concurrent operation ${index}`,
              entityType: 'test',
              entityId: fc.sample(fc.uuid(), 1)[0],
              organizationId: userContext.organizationId || undefined,
              ipAddress: userContext.ipAddress,
              userAgent: userContext.userAgent
            }),
            
            // Security violation
            logSecurityViolation({
              userId: userContext.userId,
              action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
              details: `Concurrent security test ${index}`,
              entityType: 'security',
              ipAddress: userContext.ipAddress,
              userAgent: userContext.userAgent,
              attemptedOperation: `concurrent_test_${index}`
            }),
            
            // Database access
            logDatabaseAccess({
              userId: userContext.userId,
              operation: 'SELECT',
              tableName: 'test_table',
              organizationId: userContext.organizationId || undefined,
              success: true,
              ipAddress: userContext.ipAddress,
              userAgent: userContext.userAgent
            }),
            
            // Authentication event
            logAuthenticationEvent({
              userId: userContext.userId,
              email: userContext.email,
              action: 'LOGIN',
              success: true,
              ipAddress: userContext.ipAddress,
              userAgent: userContext.userAgent,
              organizationId: userContext.organizationId || undefined
            })
          ]

          return Promise.all(operations)
        })

        // Execute all concurrent operations
        await Promise.all(concurrentLogPromises)

        // Verify: All logs were created without corruption
        const allLogs = await prisma.auditLog.findMany({
          orderBy: { created_at: 'asc' }
        })

        // Should have 4 logs per user context (4 operations each)
        const expectedLogCount = userContexts.length * 4
        if (allLogs.length !== expectedLogCount) {
          return false
        }

        // Verify log integrity - each log should have required fields
        for (const log of allLogs) {
          if (!log.id) return false
          if (!log.action) return false
          if (!log.entity_type) return false
          if (!log.created_at) return false
          if (!log.ip_address) return false
          if (!log.user_agent) return false
          
          // User ID should be present for most logs
          if (!log.user_id && log.entity_type !== 'security') return false
        }

        // Verify no duplicate IDs (database integrity)
        const logIds = allLogs.map(log => log.id)
        const uniqueIds = new Set(logIds)
        if (uniqueIds.size !== logIds.length) return false

        return true
      }
    ), { numRuns: 3 })
  })

  it('should preserve audit logs even when primary operations fail', async () => {
    // Feature: medilegal-schema-redesign, Property 15: Comprehensive Audit Logging
    await fc.assert(fc.asyncProperty(
      fc.array(userContextGenerator, { minLength: 2, maxLength: 8 }),
      async (userContexts) => {
        const logPromises: Promise<void>[] = []

        // Test: Log operations that simulate failures
        for (let i = 0; i < userContexts.length; i++) {
          const userContext = userContexts[i]

          // Simulate failed operations that should still be logged
          const failedOperations = [
            logSecurityViolation({
              userId: userContext.userId,
              action: 'SQL_INJECTION_ATTEMPT',
              details: 'Simulated SQL injection attempt that was blocked',
              entityType: 'security',
              ipAddress: userContext.ipAddress,
              userAgent: userContext.userAgent,
              attemptedOperation: 'malicious_query'
            }),
            
            logDatabaseAccess({
              userId: userContext.userId,
              operation: 'DELETE',
              tableName: 'sensitive_table',
              organizationId: userContext.organizationId || undefined,
              success: false,
              errorMessage: 'Access denied by RLS policy',
              ipAddress: userContext.ipAddress,
              userAgent: userContext.userAgent
            }),
            
            logAuthenticationEvent({
              userId: undefined, // Failed auth has no user ID
              email: userContext.email,
              action: 'LOGIN',
              success: false,
              failureReason: 'Invalid password',
              ipAddress: userContext.ipAddress,
              userAgent: userContext.userAgent
            })
          ]

          logPromises.push(...failedOperations)
        }

        // Execute all logging operations
        await Promise.all(logPromises)

        // Verify: All failure logs were preserved
        const failureLogs = await prisma.auditLog.findMany({
          where: {
            OR: [
              { action: 'SQL_INJECTION_ATTEMPT' },
              { action: 'DATABASE_ACCESS_FAILURE' },
              { action: 'LOGIN_FAILURE' }
            ]
          }
        })

        // Should have 3 failure logs per user context
        const expectedFailureLogCount = userContexts.length * 3
        if (failureLogs.length !== expectedFailureLogCount) {
          return false
        }

        // Verify failure logs contain appropriate error information
        for (const log of failureLogs) {
          if (!log.details) return false
          
          const details = JSON.parse(log.details)
          
          if (log.action === 'SQL_INJECTION_ATTEMPT') {
            if (!details.violation_type) return false
            if (!details.attempted_operation) return false
          } else if (log.action === 'DATABASE_ACCESS_FAILURE') {
            if (details.success !== false) return false
            if (!details.error_message) return false
          } else if (log.action === 'LOGIN_FAILURE') {
            if (details.success !== false) return false
            if (!details.failure_reason) return false
          }
        }

        return true
      }
    ), { numRuns: 4 })
  })
})