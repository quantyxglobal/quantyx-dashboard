# Row Level Security (RLS) Implementation Guide

## 🚨 Critical Security Vulnerabilities Fixed

This migration addresses **5 critical security vulnerabilities** identified in the Supabase database linter:

### Vulnerabilities Identified

| Table | Issue | Severity | Impact |
|-------|-------|----------|--------|
| `password_reset_tokens` | RLS disabled + Sensitive data exposed | **CRITICAL** | Token column exposed via API |
| `case_assignments` | RLS disabled | **HIGH** | Unauthorized access to case assignments |
| `additional_file_uploads` | RLS disabled | **HIGH** | Unauthorized file access |
| `_prisma_migrations` | RLS disabled | **MEDIUM** | System table exposed |

## 📋 What This Migration Does

### 1. Enables RLS on All Tables
- ✅ `password_reset_tokens` (CRITICAL)
- ✅ `case_assignments`
- ✅ `additional_file_uploads`
- ✅ `_prisma_migrations`
- ✅ All other database tables for comprehensive security

### 2. Creates Secure RLS Policies

#### Password Reset Tokens (Most Critical)
- **DENIES ALL PUBLIC ACCESS** - Only service role can access
- Prevents token exposure via API
- Protects against unauthorized password resets

#### Case Assignments
- Users can only view assignments for their own cases
- Admins can view assignments in their organization
- Only admins can create/modify/delete assignments

#### Additional File Uploads
- Users can only access files for their own cases
- Admins have full access within their organization
- File uploader has update permissions

#### Prisma Migrations
- **DENIES ALL PUBLIC ACCESS** - System use only
- Prevents schema manipulation

### 3. Implements Role-Based Access Control (RBAC)

**Roles:**
- `SUPER_ADMIN` - Full system access
- `ADMIN` - Organization-level management
- `CLIENT` - Access to own cases and data
- `STAFF` - Internal staff access

**Helper Functions Created:**
- `current_user_id()` - Get current authenticated user ID
- `current_user_role()` - Get current user's role
- `current_user_organization_id()` - Get user's organization
- `is_super_admin()` - Check if user is super admin
- `is_admin_or_super()` - Check if user is admin or super admin

## 🚀 How to Apply This Migration

### Option 1: Via Supabase Dashboard (Recommended for Production)

1. **Login to Supabase Dashboard**
   ```
   https://app.supabase.com/project/YOUR_PROJECT_ID
   ```

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Copy and Execute Migration**
   - Open `supabase/migrations/enable_rls_security.sql`
   - Copy the entire contents
   - Paste into the SQL Editor
   - Click "Run" or press `Ctrl+Enter`

4. **Verify Success**
   - Check for "Success. No rows returned" message
   - Run verification query:
   ```sql
   SELECT schemaname, tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND rowsecurity = true
   ORDER BY tablename;
   ```

### Option 2: Via Supabase CLI (Recommended for Development)

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Link to Your Project**
   ```bash
   cd medilegal-dashboard
   supabase link --project-ref YOUR_PROJECT_REF
   ```

3. **Apply Migration**
   ```bash
   supabase db push
   ```

4. **Verify**
   ```bash
   supabase db diff
   ```

### Option 3: Via Direct Connection (Advanced)

1. **Connect via psql**
   ```bash
   psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   ```

2. **Execute Migration**
   ```sql
   \i supabase/migrations/enable_rls_security.sql
   ```

## ⚠️ Important Considerations

### Before Migration

1. **Backup Your Database**
   ```bash
   supabase db dump -f backup_before_rls.sql
   ```

2. **Test in Development First**
   - Apply migration to staging/development environment
   - Test all application functionality
   - Verify users can access their data

3. **Update Application Code**
   - Ensure your application uses Supabase auth properly
   - Verify JWT tokens contain required claims (`sub`, `role`, `user_id`)
   - Test with different user roles

### After Migration

1. **Verify RLS is Active**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```
   All tables should show `rowsecurity = true`

2. **Test User Access**
   - Login as CLIENT user - verify they can only see their data
   - Login as ADMIN user - verify they can see organization data
   - Login as SUPER_ADMIN - verify full access

3. **Monitor Application Logs**
   - Watch for "permission denied" errors
   - Check Supabase logs for RLS policy violations

4. **Run Supabase Linter**
   ```bash
   # In Supabase Dashboard: Database -> Linter
   # All RLS warnings should be resolved
   ```

## 🔄 Rollback Instructions

If something goes wrong, you can rollback the changes:

### Option 1: Restore from Backup
```bash
psql "YOUR_DATABASE_URL" < backup_before_rls.sql
```

### Option 2: Run Rollback Migration
```bash
# Via Supabase SQL Editor
# Execute: supabase/migrations/rollback_rls_security.sql
```

**⚠️ WARNING:** Rollback will re-expose the security vulnerabilities!

## 📊 Verification Checklist

After applying the migration, verify:

- [ ] RLS is enabled on all tables
- [ ] Password reset tokens are NOT accessible via API
- [ ] Clients can only access their own cases
- [ ] Admins can access organization data
- [ ] Super admins have full access
- [ ] Public forms (contact, quote) still work
- [ ] File uploads work correctly
- [ ] Case assignments work correctly
- [ ] Supabase linter shows no RLS warnings

## 🔒 Security Best Practices

1. **Never Disable RLS** on tables with sensitive data
2. **Use Service Role** only in trusted server-side code
3. **Test Policies** with different user roles
4. **Audit Access** regularly via audit_logs table
5. **Keep Policies Updated** as application evolves

## 🆘 Troubleshooting

### "Permission Denied" Errors

**Problem:** Users getting permission denied errors

**Solution:**
1. Check if user is authenticated
2. Verify JWT token contains required claims
3. Check RLS policies match your use case
4. Test with `is_super_admin()` temporarily to isolate issue

### Public Forms Not Working

**Problem:** Quote requests or contact forms failing

**Solution:**
- These tables have `INSERT WITH CHECK (true)` for anonymous access
- Verify `anon` role has INSERT permission
- Check if form is sending authenticated requests when it shouldn't

### Application Can't Read Data

**Problem:** Application can't retrieve data after migration

**Solution:**
1. Verify you're using authenticated Supabase client:
   ```typescript
   const supabase = createClient(url, key, {
     auth: { persistSession: true }
   })
   ```
2. Check if service role is needed for admin operations
3. Verify user role is set correctly in database

## 📞 Support

If you encounter issues:

1. Check Supabase logs in Dashboard
2. Review RLS policies with:
   ```sql
   SELECT * FROM pg_policies WHERE schemaname = 'public';
   ```
3. Test policies with EXPLAIN:
   ```sql
   EXPLAIN SELECT * FROM cases;
   ```

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa/for-professionals/security/index.html)

## ✅ Compliance

This implementation helps achieve:
- ✅ **HIPAA Compliance** - PHI protection via RLS
- ✅ **GDPR Compliance** - Data access controls
- ✅ **SOC 2** - Access control requirements
- ✅ **Security Best Practices** - Least privilege principle

---

**Migration Created:** June 18, 2026
**Version:** 1.0.0
**Status:** Ready for Production
