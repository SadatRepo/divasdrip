ALTER TABLE staff_users ADD COLUMN password_hash text;
ALTER TABLE staff_users ADD COLUMN password_salt text;

CREATE TABLE staff_sessions (
  id text PRIMARY KEY NOT NULL,
  staff_user_id text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at text NOT NULL,
  revoked_at text,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX staff_sessions_user_idx ON staff_sessions (staff_user_id, expires_at);
