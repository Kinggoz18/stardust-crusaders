-- Allow system/bootstrap audit rows without a staff actor yet.
ALTER TABLE admin_audit_log ALTER COLUMN staff_id DROP NOT NULL;

CREATE TABLE admin_bootstrap (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  master_key_used_at timestamptz,
  master_admin_id uuid REFERENCES staff_users(id) ON DELETE SET NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO admin_bootstrap (id) VALUES (1);

CREATE TABLE staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role staff_role NOT NULL,
  token_hash text NOT NULL,
  invited_by uuid NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX staff_invites_token_uidx ON staff_invites (token_hash);
CREATE INDEX staff_invites_email_idx ON staff_invites (email);
