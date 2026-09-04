# Teams RLS Policy Fix

## Problem
Team creation was failing with error:
```
code: '42501'
message: 'permission denied for table teams'
```

## Root Cause
The `teams` table had RLS (Row Level Security) enabled but no policies were created to allow inserts. Even the service role was being blocked.

## Solution
Add RLS policies that allow authenticated users (including service role) to perform all operations on the `teams` and `case_assignment_history` tables.

## How to Apply the Fix

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**:
   - Navigate to: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
   
2. **Copy the SQL script**:
   - Open: `scripts/apply-teams-rls-fix.sql`
   - Copy the entire contents
   
3. **Execute the script**:
   - Paste into the SQL editor
   - Click "Run"
   - Wait for success message
   
4. **Verify**:
   - The query should return a list of policies
   - You should see policies for both `teams` and `case_assignment_history` tables

### Option 2: Using Supabase CLI

If you have Supabase CLI installed:

```bash
cd medilegal-dashboard
supabase db push
```

This will apply all pending migrations including `add_teams_rls_policies.sql`.

## What the Fix Does

### For `teams` table:
- ✅ Allows INSERT operations (create teams)
- ✅ Allows SELECT operations (view teams)
- ✅ Allows UPDATE operations (edit teams)
- ✅ Allows DELETE operations (remove teams)

### For `case_assignment_history` table:
- ✅ Allows INSERT operations (log assignments)
- ✅ Allows SELECT operations (view history)
- ✅ Allows UPDATE operations (edit history)
- ✅ Allows DELETE operations (remove history)

## Testing

After applying the fix, test team creation:

1. Log in as SUPER_ADMIN or ADMIN
2. Go to Teams Management (`/admin/teams`)
3. Click "Create New Team"
4. Select a manager
5. Enter team name (optional)
6. Click "Create Team"

**Expected Result**: Team should be created successfully without permission errors.

## Verification Query

Run this in Supabase SQL editor to verify policies exist:

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('teams', 'case_assignment_history')
ORDER BY tablename, policyname;
```

You should see 8 policies (4 for each table).

## Files Modified

- `supabase/migrations/add_teams_rls_policies.sql` - Migration file
- `scripts/apply-teams-rls-fix.sql` - Standalone script for manual execution
- `TEAMS_RLS_FIX.md` - This documentation

## Notes

- The policies use `TO authenticated` which covers all authenticated roles including service role
- `WITH CHECK (true)` and `USING (true)` allow all operations without restrictions
- This is appropriate for internal operations via service role
- Future enhancement: Add more granular policies based on user roles if needed

