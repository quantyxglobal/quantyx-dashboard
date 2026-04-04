# Multi-Factor Authentication (MFA) - Complete Documentation

## Overview

The Quantix Global dashboard implements TOTP-based (Time-based One-Time Password) Multi-Factor Authentication with **weekly verification frequency**.

## Key Features

- ✅ Free, open-source TOTP implementation (speakeasy + qrcode)
- ✅ Weekly MFA verification (once every 7 days)
- ✅ 24-hour session duration
- ✅ Backup codes for account recovery
- ✅ Mandatory MFA setup for new users
- ✅ Superadmin MFA management controls
- ✅ Audit logging for all MFA events

## How It Works

### Authentication Frequency

**MFA Verification**: Once every 7 days
**Session Duration**: 24 hours
**MFA Memory**: 7 days from last successful verification

### User Experience

```
Week 1, Monday:
- Login with password → MFA required → Enter 6-digit code → Logged in

Week 1, Tuesday-Sunday:
- Login with password → No MFA required → Logged in immediately

Week 2, Monday (7+ days later):
- Login with password → MFA required again → Enter code → New 7-day cycle
```

## Setup for Users

### Enabling MFA

1. Go to Settings → Security → Two-Factor Authentication
2. Click "Enable Two-Factor Authentication"
3. Scan QR code with authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)
4. Enter 6-digit verification code
5. Save backup codes in a secure location
6. Done! MFA is now enabled

### Disabling MFA

1. Go to Settings → Security → Two-Factor Authentication
2. Enter your password
3. Click "Disable Two-Factor Authentication"
4. **Warning**: If you re-enable MFA later, you'll need to scan a NEW QR code

### Re-Enabling MFA

**Important**: When you re-enable MFA after disabling it:
- A NEW secret is generated for security
- You must scan the NEW QR code
- Your old authenticator entry will NOT work
- You'll receive NEW backup codes

## Login Flow

### With MFA Enabled (First Time or After 7 Days)

1. Enter email + password
2. Click "Sign In"
3. See MFA verification screen
4. Enter 6-digit code from authenticator app
5. Click "Verify and Sign In"
6. Logged in successfully

### With MFA Enabled (Within 7-Day Window)

1. Enter email + password
2. Click "Sign In"
3. Logged in immediately (no MFA screen)

### Using Backup Codes

1. At MFA verification screen, click "Use backup code instead"
2. Enter one of your 8-character backup codes
3. Backup code is consumed (single-use)
4. Logged in successfully
5. Warning shown: "X codes remaining"

## Technical Implementation

### Database Schema

```sql
-- Users table columns
mfa_enabled BOOLEAN DEFAULT FALSE
mfa_secret TEXT
mfa_backup_codes TEXT[]
mfa_enrolled_at TIMESTAMPTZ
mfa_last_verified_at TIMESTAMPTZ  -- Tracks weekly verification
```

### Key Functions

**`checkMFARequired(userId)`**
- Checks if 7+ days have passed since last verification
- Returns true if MFA verification is needed

**`verifyMFAToken(userId, token)`**
- Verifies TOTP code or backup code
- Updates `mfa_last_verified_at` timestamp
- Logs verification in audit logs

**`checkUserMFAStatus(email)`**
- Determines if MFA is enabled and required
- Called during login to show/hide MFA screen

**`loginWithMFA(email, password, mfaToken)`**
- Handles two-step authentication
- Verifies password, then MFA code
- Completes login process

### Files Modified

- `app/actions/mfa-verify.ts` - Weekly verification logic
- `app/actions/mfa-setup.ts` - MFA enable/disable
- `app/actions/login.ts` - Login with MFA checking
- `components/login/LoginFormOptimized.tsx` - MFA UI
- `components/settings/MFASettingsClient.tsx` - MFA settings
- `lib/mfa-service.ts` - Core MFA functionality

## Superadmin Controls

Superadmins can manage MFA for all users:

### Individual User Management
- Enable MFA for specific user
- Disable MFA for specific user
- View MFA status for each user

### Bulk Operations
- Enable MFA for all Clients
- Enable MFA for all Employees
- Enable MFA for all Admins
- Disable MFA for all users in a role

### Location
Settings → User Management → MFA Management Controls

## Security Considerations

### Strengths
- ✅ TOTP is industry standard (RFC 6238)
- ✅ Works offline after setup
- ✅ No SMS costs or third-party dependencies
- ✅ Backup codes are hashed with bcrypt
- ✅ Server-side timestamp tracking (can't be manipulated)
- ✅ Audit logging for all MFA events

### Weekly Verification Trade-offs
- ✅ Better user experience than daily MFA
- ✅ Still provides strong security
- ⚠️ 7-day window if session is compromised
- ⚠️ Less secure than daily verification

### Mitigations
- 24-hour session timeout limits exposure
- Audit logging tracks all MFA events
- Backup codes for account recovery
- Mandatory MFA for new users

## Configuration

### Changing MFA Frequency

Edit `app/actions/mfa-verify.ts` (line ~25):

```typescript
// Current: Weekly (7 days)
return daysSinceVerification >= 7

// Options:
return daysSinceVerification >= 1   // Daily
return daysSinceVerification >= 3   // Every 3 days
return daysSinceVerification >= 14  // Every 2 weeks
return daysSinceVerification >= 30  // Monthly
```

## Monitoring

### Check MFA Status

```sql
SELECT 
  email,
  mfa_enabled,
  mfa_last_verified_at,
  CASE 
    WHEN mfa_last_verified_at IS NULL THEN 'Never'
    WHEN mfa_last_verified_at < NOW() - INTERVAL '7 days' THEN 'Expired'
    ELSE 'Valid'
  END as mfa_status
FROM users
WHERE mfa_enabled = TRUE;
```

### Check MFA Verifications

```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as verifications
FROM audit_logs
WHERE action = 'LOGIN'
  AND new_values->>'action' LIKE '%MFA%verified%'
  AND created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Failed MFA Attempts

```sql
SELECT user_id, COUNT(*) as failed_attempts
FROM audit_logs
WHERE action = 'LOGIN'
  AND new_values->>'action' = 'MFA verification failed'
  AND created_at >= NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 3;
```

## Troubleshooting

### Issue: MFA Required Every Login
**Problem**: User has to enter MFA code every time

**Solution**: Check if `mfa_last_verified_at` is being updated:
```sql
SELECT id, email, mfa_last_verified_at 
FROM users 
WHERE email = 'user@example.com';
```

### Issue: MFA Never Required
**Problem**: User never sees MFA screen

**Solution**: Check if MFA is enabled:
```sql
SELECT id, email, mfa_enabled, mfa_secret 
FROM users 
WHERE email = 'user@example.com';
```

### Issue: Invalid Verification Code
**Problem**: User enters correct code but gets error

**Possible Causes**:
1. Phone time not synchronized (TOTP requires accurate time)
2. Using old authenticator entry after re-enabling MFA
3. Scanning old QR code screenshot

**Solutions**:
1. Enable "Automatic date & time" on phone
2. Scan the NEW QR code shown on screen
3. Add as NEW account in authenticator app

### Issue: Backup Codes Not Working
**Problem**: Backup codes show "invalid"

**Solution**: Verify backup codes exist:
```sql
SELECT id, email, array_length(mfa_backup_codes, 1) as code_count
FROM users 
WHERE email = 'user@example.com';
```

## Support

### For Users
- Email: support@quantyxg.com
- Lost authenticator: Use backup codes
- Lost backup codes: Contact support for MFA reset

### For Developers
- See `MFA_IMPLEMENTATION_GUIDE.md` for detailed technical docs
- See `WEEKLY_MFA_IMPLEMENTATION.md` for weekly verification details
- Check audit logs for MFA events

## FAQ

**Q: How often do I need to enter my MFA code?**
A: Once per week. Within the 7-day window, only your password is needed.

**Q: What if I lose my phone?**
A: Use one of your backup codes to log in, then set up MFA on a new device.

**Q: Can I use the same QR code after disabling and re-enabling MFA?**
A: No, a NEW QR code is generated each time for security. You must scan the new one.

**Q: What authenticator apps are supported?**
A: Any TOTP-compatible app: Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.

**Q: Does MFA affect the 24-hour session?**
A: No, sessions still expire after 24 hours. MFA verification is separate and lasts 7 days.

**Q: Can superadmins bypass MFA?**
A: No, superadmins must also use MFA for security.

**Q: What happens if I run out of backup codes?**
A: Contact support for an MFA reset. You'll need to set up MFA again with a new QR code.

## Summary

MFA is configured for weekly verification, providing strong security with minimal user friction. Users authenticate with their 6-digit code once per week, with password-only logins in between.

**Status**: ✅ Fully implemented and operational
**Database**: ✅ Migration applied
**Testing**: Ready for production use
