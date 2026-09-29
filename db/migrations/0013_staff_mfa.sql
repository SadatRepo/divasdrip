ALTER TABLE staff_users ADD COLUMN mfa_secret text;
ALTER TABLE staff_users ADD COLUMN mfa_pending_secret text;
ALTER TABLE staff_users ADD COLUMN mfa_enabled integer NOT NULL DEFAULT 0;

CREATE TABLE staff_mfa_challenges (
  id text PRIMARY KEY NOT NULL,
  staff_user_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX staff_mfa_challenges_user_idx ON staff_mfa_challenges (staff_user_id, expires_at);
