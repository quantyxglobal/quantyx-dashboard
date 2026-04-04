# Database Migration Scripts

This directory contains SQL migration scripts for the medilegal schema redesign project.

## Migration Structure

- `forward/` - Contains forward migration scripts
- `rollback/` - Contains rollback procedures for each migration
- `validation/` - Contains data validation and integrity check scripts

## Usage

1. Review the migration scripts before execution
2. Run pre-migration validation checks
3. Execute forward migrations in order
4. Run post-migration integrity verification
5. Keep rollback scripts ready for emergency use

## Migration Order

1. `001_enhance_organizations_table.sql` - Add firm-specific fields
2. `002_enhance_users_table.sql` - Add role constraints
3. `003_enhance_cases_table.sql` - Update case number format
4. `004_create_rls_policies.sql` - Implement Row Level Security
5. `005_create_audit_system.sql` - Add audit logging
6. `006_update_existing_data.sql` - Migrate existing data to new format

## Validation Scripts

- `pre_migration_validation.sql` - Check data integrity before migration
- `post_migration_validation.sql` - Verify data integrity after migration
- `rls_policy_validation.sql` - Test RLS policy enforcement