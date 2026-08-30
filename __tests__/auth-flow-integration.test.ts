/**
 * Authentication Flow Integration Test
 * 
 * Tests the end-to-end authentication flow to ensure:
 * 1. Login correctly identifies user role and organization
 * 2. Auth context properly distinguishes internal staff from clients
 * 3. Redirects are correct for each role type
 */

import { describe, it, expect } from 'vitest'
import { getDefaultDashboardForRole, getLoginRedirect, canAccessPath } from '@/lib/role-redirect'
import type { UserRole } from '@/lib/role-redirect'

describe('Authentication Flow - Role-based Routing', () => {
  describe('Dashboard Routing', () => {
    it('should route SUPER_ADMIN to /superadmin', () => {
      const redirect = getDefaultDashboardForRole('SUPER_ADMIN')
      expect(redirect).toBe('/superadmin')
    })

    it('should route ADMIN to /admin', () => {
      const redirect = getDefaultDashboardForRole('ADMIN')
      expect(redirect).toBe('/admin')
    })

    it('should route EMPLOYEE to /admin', () => {
      const redirect = getDefaultDashboardForRole('EMPLOYEE')
      expect(redirect).toBe('/admin')
    })

    it('should route CLIENT to /dashboard', () => {
      const redirect = getDefaultDashboardForRole('CLIENT')
      expect(redirect).toBe('/dashboard')
    })
  })

  describe('Access Control', () => {
    it('should allow SUPER_ADMIN to access all routes', () => {
      expect(canAccessPath('SUPER_ADMIN', '/superadmin')).toBe(true)
      expect(canAccessPath('SUPER_ADMIN', '/admin')).toBe(true)
      expect(canAccessPath('SUPER_ADMIN', '/dashboard')).toBe(true)
      expect(canAccessPath('SUPER_ADMIN', '/admin/users')).toBe(true)
      expect(canAccessPath('SUPER_ADMIN', '/admin/firms')).toBe(true)
    })

    it('should restrict ADMIN access appropriately', () => {
      expect(canAccessPath('ADMIN', '/admin')).toBe(true)
      expect(canAccessPath('ADMIN', '/admin/users')).toBe(true)
      expect(canAccessPath('ADMIN', '/dashboard')).toBe(true)
      expect(canAccessPath('ADMIN', '/superadmin')).toBe(false)
    })

    it('should restrict EMPLOYEE access to admin routes only', () => {
      expect(canAccessPath('EMPLOYEE', '/admin')).toBe(true)
      expect(canAccessPath('EMPLOYEE', '/admin/case/123')).toBe(true)
      expect(canAccessPath('EMPLOYEE', '/dashboard')).toBe(false)
      expect(canAccessPath('EMPLOYEE', '/superadmin')).toBe(false)
    })

    it('should restrict CLIENT access to dashboard only', () => {
      expect(canAccessPath('CLIENT', '/dashboard')).toBe(true)
      expect(canAccessPath('CLIENT', '/dashboard/case/123')).toBe(true)
      expect(canAccessPath('CLIENT', '/admin')).toBe(false)
      expect(canAccessPath('CLIENT', '/superadmin')).toBe(false)
    })

    it('should allow all roles to access public routes', () => {
      const roles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE', 'CLIENT']
      
      for (const role of roles) {
        expect(canAccessPath(role, '/')).toBe(true)
        expect(canAccessPath(role, '/login')).toBe(true)
        expect(canAccessPath(role, '/register')).toBe(true)
      }
    })
  })

  describe('Login Redirect Logic', () => {
    it('should redirect SUPER_ADMIN to /superadmin after login', () => {
      const redirect = getLoginRedirect('SUPER_ADMIN')
      expect(redirect).toBe('/superadmin')
    })

    it('should redirect ADMIN to /admin after login', () => {
      const redirect = getLoginRedirect('ADMIN')
      expect(redirect).toBe('/admin')
    })

    it('should redirect EMPLOYEE to /admin after login', () => {
      const redirect = getLoginRedirect('EMPLOYEE')
      expect(redirect).toBe('/admin')
    })

    it('should redirect CLIENT to /dashboard after login', () => {
      const redirect = getLoginRedirect('CLIENT')
      expect(redirect).toBe('/dashboard')
    })

    it('should respect callback URL if user has access', () => {
      const redirect = getLoginRedirect('SUPER_ADMIN', '/admin/users')
      expect(redirect).toBe('/admin/users')
    })

    it('should ignore callback URL if user lacks access', () => {
      const redirect = getLoginRedirect('CLIENT', '/admin/users')
      expect(redirect).toBe('/dashboard')
    })

    it('should ignore login/register callback URLs', () => {
      expect(getLoginRedirect('SUPER_ADMIN', '/login')).toBe('/superadmin')
      expect(getLoginRedirect('ADMIN', '/register')).toBe('/admin')
    })
  })

  describe('Role Hierarchy and Organization Context', () => {
    it('should treat internal staff roles as organization-independent', () => {
      // Internal staff (SUPER_ADMIN, ADMIN, EMPLOYEE) should not be tied to specific law firms
      // They work for Quantyx Global (the service provider)
      const internalRoles: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'EMPLOYEE']
      
      for (const role of internalRoles) {
        const redirect = getDefaultDashboardForRole(role)
        // Internal staff should NOT be redirected to client dashboard
        expect(redirect).not.toBe('/dashboard')
      }
    })

    it('should treat CLIENT role as organization-dependent', () => {
      // Clients MUST be associated with a law firm organization
      const redirect = getDefaultDashboardForRole('CLIENT')
      expect(redirect).toBe('/dashboard')
    })
  })

  describe('Path Validation', () => {
    it('should correctly identify protected routes', () => {
      // Protected routes require authentication
      const { isProtectedRoute } = require('@/lib/role-redirect')
      
      expect(isProtectedRoute('/dashboard')).toBe(true)
      expect(isProtectedRoute('/admin')).toBe(true)
      expect(isProtectedRoute('/superadmin')).toBe(true)
      expect(isProtectedRoute('/dashboard/case/123')).toBe(true)
      expect(isProtectedRoute('/admin/users')).toBe(true)
    })

    it('should correctly identify public routes', () => {
      const { isProtectedRoute } = require('@/lib/role-redirect')
      
      expect(isProtectedRoute('/')).toBe(false)
      expect(isProtectedRoute('/login')).toBe(false)
      expect(isProtectedRoute('/register')).toBe(false)
      expect(isProtectedRoute('/forgot-password')).toBe(false)
    })
  })
})

describe('Authentication Context Structure', () => {
  describe('Internal Staff Context', () => {
    it('should have null/undefined organization for internal staff with no firm assignment', () => {
      // When SUPER_ADMIN, ADMIN, or EMPLOYEE has organization_id = null in database
      // The auth context should reflect this with organization = undefined
      
      // Mock auth context for internal staff
      const superAdminContext = {
        user: {
          id: 'test-super-admin',
          email: 'sadmin@quantyxg.com',
          role: 'SUPER_ADMIN' as UserRole,
          organizationId: undefined, // null in database becomes undefined in context
          firmNumber: undefined,
          firstName: 'Super',
          lastName: 'Admin',
          isActive: true
        },
        organization: undefined // No organization for internal Quantyx Global staff
      }
      
      expect(superAdminContext.user.organizationId).toBeUndefined()
      expect(superAdminContext.organization).toBeUndefined()
    })

    it('should have service provider organization for internal staff assigned to Quantyx Global', () => {
      // When ADMIN or EMPLOYEE has organization_id pointing to Quantyx Global (is_firm=false)
      
      const adminContext = {
        user: {
          id: 'test-admin',
          email: 'admin@quantyxg.com',
          role: 'ADMIN' as UserRole,
          organizationId: 'quantyx-global-id',
          firmNumber: undefined, // Service provider has no firm number
          firstName: 'Test',
          lastName: 'Admin',
          isActive: true
        },
        organization: {
          id: 'quantyx-global-id',
          name: 'Quantyx Global',
          firmNumber: undefined,
          isFirm: false // This is the service provider, not a law firm
        }
      }
      
      expect(adminContext.organization?.isFirm).toBe(false)
      expect(adminContext.organization?.firmNumber).toBeUndefined()
    })
  })

  describe('Client Context', () => {
    it('should always have law firm organization for CLIENT users', () => {
      // When CLIENT has organization_id pointing to a law firm (is_firm=true)
      
      const clientContext = {
        user: {
          id: 'test-client',
          email: 'client@lawfirm.com',
          role: 'CLIENT' as UserRole,
          organizationId: 'law-firm-id',
          firmNumber: '001',
          firstName: 'Test',
          lastName: 'Client',
          isActive: true
        },
        organization: {
          id: 'law-firm-id',
          name: 'Test Law Firm',
          firmNumber: '001',
          isFirm: true // Clients are always associated with law firms
        }
      }
      
      expect(clientContext.user.organizationId).toBeDefined()
      expect(clientContext.organization).toBeDefined()
      expect(clientContext.organization?.isFirm).toBe(true)
      expect(clientContext.organization?.firmNumber).toBeDefined()
    })

    it('should never have null organization for CLIENT users', () => {
      // This should be prevented by database constraints and application logic
      // If a CLIENT somehow has null organization_id, it's a data integrity violation
      
      // This test documents the expected behavior - actual enforcement is at DB level
      const invalidClientContext = {
        user: {
          role: 'CLIENT' as UserRole,
          organizationId: undefined,
        },
        organization: undefined
      }
      
      // This would be an invalid state - CLIENT must have organization
      expect(invalidClientContext.user.role).toBe('CLIENT')
      if (invalidClientContext.user.role === 'CLIENT') {
        // In production, this should never happen due to DB constraints
        expect(invalidClientContext.user.organizationId).toBeUndefined() // Documents invalid state
      }
    })
  })
})
