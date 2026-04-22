'use server'

import { SupabaseDB } from '@/lib/supabase-db'
import { awsSESService } from '@/lib/aws-ses-service'
import crypto from 'crypto'

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string; isSuperAdmin?: boolean }> {
  try {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email address' }
    }

    // Check if user exists
    const user = await SupabaseDB.getUserByEmail(email.toLowerCase())
    
    // For security, always return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (!user) {
      console.log(`[PASSWORD_RESET] User not found for email: ${email}`)
      return { success: true } // Return success to prevent email enumeration
    }

    // Check if user is SUPER_ADMIN
    if (user.role !== 'SUPER_ADMIN') {
      console.log(`[PASSWORD_RESET] Non-superadmin requested password reset: ${email} (role: ${user.role})`)
      
      // Send email to support team for non-superadmin password reset requests
      try {
        await awsSESService.sendEmail({
          to: 'support@quantyxg.com',
          subject: `Password Reset Request - ${user.first_name} ${user.last_name}`,
          htmlBody: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #262083; margin-bottom: 10px;">Password Reset Request</h1>
                <h2 style="color: #666; font-weight: normal;">quantyx Global Case Management</h2>
              </div>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="color: #262083; margin-top: 0;">User Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Name:</td>
                    <td style="padding: 8px 0;">${user.first_name} ${user.last_name}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Email:</td>
                    <td style="padding: 8px 0;">${email}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Role:</td>
                    <td style="padding: 8px 0;">${user.role}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">User ID:</td>
                    <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${user.id}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #666;">Request Time:</td>
                    <td style="padding: 8px 0;">${new Date().toLocaleString()}</td>
                  </tr>
                </table>
              </div>

              <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="color: #856404; margin-top: 0;">Action Required</h3>
                <p style="color: #856404; margin: 0;">
                  This user has requested a password reset. Please reset their password through the admin panel and provide them with the new credentials.
                </p>
              </div>

              <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
                <h3 style="color: #1565c0; margin-top: 0;">How to Reset Password</h3>
                <ol style="color: #333; line-height: 1.8; margin: 0; padding-left: 20px;">
                  <li>Log in to the admin panel</li>
                  <li>Go to User Management</li>
                  <li>Find the user: ${user.first_name} ${user.last_name} (${email})</li>
                  <li>Click "Reset Password"</li>
                  <li>Generate a new temporary password</li>
                  <li>Send the new password to the user securely</li>
                </ol>
              </div>

              <div style="border-top: 1px solid #eee; padding-top: 20px; color: #666; font-size: 12px;">
                <p>This is an automated notification from quantyx Global Case Management Platform.</p>
                <p>Do not reply to this email. Contact the user directly at ${email}</p>
              </div>
            </div>
          `,
          textBody: `
Password Reset Request - quantyx Global

USER DETAILS:
Name: ${user.first_name} ${user.last_name}
Email: ${email}
Role: ${user.role}
User ID: ${user.id}
Request Time: ${new Date().toLocaleString()}

ACTION REQUIRED:
This user has requested a password reset. Please reset their password through the admin panel and provide them with the new credentials.

HOW TO RESET PASSWORD:
1. Log in to the admin panel
2. Go to User Management
3. Find the user: ${user.first_name} ${user.last_name} (${email})
4. Click "Reset Password"
5. Generate a new temporary password
6. Send the new password to the user securely

---
This is an automated notification from quantyx Global Case Management Platform.
Do not reply to this email. Contact the user directly at ${email}
          `.trim(),
          emailType: 'admin'
        })
        
        console.log(`[PASSWORD_RESET] Support notification sent for non-superadmin: ${email}`)
      } catch (emailError) {
        console.error('[PASSWORD_RESET] Failed to send support notification:', emailError)
        // Don't fail the request if support email fails
      }
      
      return { 
        success: true, // Return success so user sees confirmation
        isSuperAdmin: false
      }
    }

    // For SUPER_ADMIN: Generate reset token and send reset email
    const resetToken = crypto.randomBytes(32).toString('hex')
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Store the reset token in the database
    try {
      await SupabaseDB.createPasswordResetToken({
        user_id: user.id,
        token: resetToken,
        expires_at: resetTokenExpiry
      })
    } catch (dbError: any) {
      console.error('[PASSWORD_RESET] Database error:', dbError)
      
      // Check if it's a table not found error
      if (dbError.code === 'PGRST205' || dbError.message?.includes('password_reset_tokens')) {
        return { 
          success: false, 
          error: 'Password reset system is not configured. Please contact technical support.' 
        }
      }
      
      throw dbError
    }

    // Generate reset URL
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`

    // Send password reset email to super admin
    const emailResult = await awsSESService.sendEmail({
      to: email,
      subject: 'Password Reset Request - quantyx Global',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #262083; margin-bottom: 10px;">Password Reset Request</h1>
            <h2 style="color: #666; font-weight: normal;">quantyx Global Case Management</h2>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <p>Hello ${user.first_name || 'Super Admin'},</p>
            <p>We received a request to reset your password for your quantyx Global super administrator account.</p>
            <p>If you didn't make this request, you can safely ignore this email.</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #262083; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Reset Your Password
            </a>
          </div>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <p style="color: #856404; margin: 0;">
              <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you need a new link, please request another password reset.
            </p>
          </div>

          <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin-bottom: 30px;">
            <p style="color: #1565c0; margin: 0; font-size: 14px;">
              <strong>Can't click the button?</strong> Copy and paste this link into your browser:<br/>
              <code style="background: #f1f3f4; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 8px; word-break: break-all;">${resetUrl}</code>
            </p>
          </div>

          <div style="border-top: 1px solid #eee; padding-top: 20px; color: #666; font-size: 12px;">
            <p><strong>Security Tips:</strong></p>
            <ul style="line-height: 1.6;">
              <li>Never share your password with anyone</li>
              <li>Use a strong, unique password</li>
              <li>If you didn't request this reset, contact support immediately</li>
            </ul>
            <p style="margin-top: 20px;">This is an automated message from quantyx Global Case Management Platform.</p>
          </div>
        </div>
      `,
      textBody: `
Password Reset Request - quantyx Global

Hello ${user.first_name || 'Super Admin'},

We received a request to reset your password for your quantyx Global super administrator account.

If you didn't make this request, you can safely ignore this email.

To reset your password, click the link below or copy and paste it into your browser:
${resetUrl}

SECURITY NOTICE: This link will expire in 1 hour. If you need a new link, please request another password reset.

Security Tips:
- Never share your password with anyone
- Use a strong, unique password
- If you didn't request this reset, contact support immediately

---
quantyx Global Case Management Platform
      `.trim(),
      emailType: 'admin'
    })

    if (!emailResult.success) {
      console.error('[PASSWORD_RESET] Failed to send email:', emailResult.error)
      return { success: false, error: 'Failed to send reset email. Please try again.' }
    }

    console.log(`[PASSWORD_RESET] Reset email sent to super admin: ${email}`)
    return { success: true, isSuperAdmin: true }

  } catch (error) {
    console.error('[PASSWORD_RESET] Error:', error)
    return { success: false, error: 'An unexpected error occurred. Please try again.' }
  }
}
