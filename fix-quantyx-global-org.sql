-- Fix Quantyx Global organization to be marked as internal (not a firm)
-- This ensures ADMIN and EMPLOYEE accounts in this organization get admin views

-- Update Quantyx Global to be an internal organization (not a client firm)
UPDATE organizations
SET 
  is_firm = false,
  firm_number = NULL
WHERE name ILIKE '%quantyx%global%' OR name ILIKE '%quantyx global%';

-- Verify the update
SELECT 
  id,
  name,
  is_firm,
  firm_number,
  created_at
FROM organizations
WHERE name ILIKE '%quantyx%global%' OR name ILIKE '%quantyx global%';

-- Show all users in Quantyx Global organization
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
WHERE o.name ILIKE '%quantyx%global%' OR o.name ILIKE '%quantyx global%';
