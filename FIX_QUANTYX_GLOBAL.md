# Fix Quantyx Global Organization

## Problem
"Quantyx Global" organization is being treated as a client firm (`is_firm = true`), causing ADMIN and EMPLOYEE accounts in this organization to get client dashboard views instead of admin views.

## Solution
Run the SQL script to mark "Quantyx Global" as an internal organization (not a client firm).

## Steps to Fix

### 1. Run the SQL Fix Script

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Fix Quantyx Global organization to be marked as internal (not a firm)
UPDATE organizations
SET 
  is_firm = false,
  firm_number = NULL
WHERE name ILIKE '%quantyx%' AND name ILIKE '%global%';

-- Verify the update
SELECT 
  id,
  name,
  is_firm,
  firm_number,
  created_at
FROM organizations
WHERE name ILIKE '%quantyx%' AND name ILIKE '%global%';
```

### 2. Verify User Roles

Check that all users in Quantyx Global have the correct roles:

```sql
SELECT 
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,
  o.name as organization_name,
  o.is_firm
FROM users u
LEFT JOIN organizations o ON u.organization_id = o.id
WHERE o.name ILIKE '%quantyx%' AND o.name ILIKE '%global%';
```

Expected results:
- SUPER_ADMIN users: Should have role = 'SUPER_ADMIN'
- ADMIN users: Should have role = 'ADMIN'  
- EMPLOYEE users: Should have role = 'EMPLOYEE'
- Organization should have is_firm = false

### 3. Have Users Log Out and Log Back In

After running the SQL fix, all affected users need to:
1. Log out of the dashboard
2. Log back in

This will refresh their session with the correct organization settings.

## How It Works

The system uses two factors to determine dashboard access:

1. **User Role** (PRIMARY): 
   - SUPER_ADMIN → /superadmin dashboard
   - ADMIN → /admin dashboard
   - EMPLOYEE → /admin dashboard (with restrictions)
   - CLIENT → /dashboard (client view)

2. **Organization Type** (SECONDARY):
   - `is_firm = false`: Internal organization (Quantyx Global)
   - `is_firm = true`: Client firm

When `is_firm = true` for "Quantyx Global", the system incorrectly treats it as a client firm, which can cause confusion in the UI even though routing is based on role.

## Prevention

When creating new ADMIN or EMPLOYEE accounts:
1. Either don't assign them to any organization (organization_id = NULL)
2. Or assign them to "Quantyx Global" which should have `is_firm = false`

When creating CLIENT accounts:
1. Always assign them to a client firm (organization with `is_firm = true`)
2. Never assign CLIENT accounts to "Quantyx Global"

## Verification

After the fix, verify:
1. SUPER_ADMIN users can access /superadmin
2. ADMIN users can access /admin
3. EMPLOYEE users can access /admin
4. CLIENT users can only access /dashboard
5. "Quantyx Global" organization shows `is_firm = false` in database
