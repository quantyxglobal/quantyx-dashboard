-- Migration: Enforce data integrity for user-organization relationships
-- Purpose: Prevent internal staff (SUPER_ADMIN, ADMIN, EMPLOYEE) from being assigned to law firm organizations
--          and ensure CLIENT accounts must have a firm organization

-- Create a function to validate user-organization assignments
CREATE OR REPLACE FUNCTION validate_user_organization_assignment()
RETURNS TRIGGER AS $$
DECLARE
  org_is_firm BOOLEAN;
BEGIN
  -- If organization_id is NULL, only allow SUPER_ADMIN, ADMIN, EMPLOYEE
  IF NEW.organization_id IS NULL THEN
    IF NEW.role NOT IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE') THEN
      RAISE EXCEPTION 'CLIENT users must be assigned to an organization';
    END IF;
    RETURN NEW;
  END IF;

  -- If organization_id is provided, check if it's a firm
  SELECT is_firm INTO org_is_firm
  FROM organizations
  WHERE id = NEW.organization_id;

  -- If organization doesn't exist, reject
  IF org_is_firm IS NULL THEN
    RAISE EXCEPTION 'Organization does not exist';
  END IF;

  -- CLIENT users must be assigned to a firm (is_firm = true)
  IF NEW.role = 'CLIENT' THEN
    IF org_is_firm = false THEN
      RAISE EXCEPTION 'CLIENT users cannot be assigned to the service provider organization. They must be assigned to a law firm.';
    END IF;
  END IF;

  -- Internal staff (SUPER_ADMIN, ADMIN, EMPLOYEE) should not be assigned to law firms
  -- Allow assignment to service provider organization (is_firm = false) or NULL
  IF NEW.role IN ('SUPER_ADMIN', 'ADMIN', 'EMPLOYEE') THEN
    IF org_is_firm = true THEN
      RAISE EXCEPTION 'Internal staff (SUPER_ADMIN, ADMIN, EMPLOYEE) cannot be assigned to law firm organizations';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on INSERT
DROP TRIGGER IF EXISTS validate_user_org_on_insert ON users;
CREATE TRIGGER validate_user_org_on_insert
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_organization_assignment();

-- Create trigger on UPDATE
DROP TRIGGER IF EXISTS validate_user_org_on_update ON users;
CREATE TRIGGER validate_user_org_on_update
  BEFORE UPDATE OF role, organization_id ON users
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_organization_assignment();

-- Add comment explaining the constraint
COMMENT ON FUNCTION validate_user_organization_assignment() IS 
'Enforces data integrity rules:
1. CLIENT users MUST have organization_id pointing to a firm (is_firm=true)
2. Internal staff (SUPER_ADMIN, ADMIN, EMPLOYEE) CANNOT be assigned to law firms
3. Internal staff can have organization_id=NULL or point to service provider (is_firm=false)';
