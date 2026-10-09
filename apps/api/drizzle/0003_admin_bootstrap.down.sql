DROP TABLE IF EXISTS staff_invites;
DROP TABLE IF EXISTS admin_bootstrap;
ALTER TABLE admin_audit_log ALTER COLUMN staff_id SET NOT NULL;
