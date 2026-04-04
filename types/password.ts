import { z } from 'zod'

// Password validation schema with complexity rules
// Requirements: 2.1, 2.2, 2.3, 2.4
export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

// Change password form schema
// Requirements: 2.6
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})

// Reset password form schema
// Requirements: 2.6
export const resetPasswordSchema = z.object({
  targetUserId: z.string().uuid('Invalid user ID'),
  newPassword: passwordSchema,
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword']
})

// Audit log action types
export type PasswordChangeAction = 
  | 'self_change_success' 
  | 'self_change_failed'
  | 'admin_reset_success'
  | 'admin_reset_failed'

// Password strength levels
export type PasswordStrength = 'weak' | 'medium' | 'strong'
