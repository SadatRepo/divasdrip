CREATE TABLE inquiry_contact_attempts (
  id text PRIMARY KEY NOT NULL,
  inquiry_id text NOT NULL,
  channel text NOT NULL,
  outcome text NOT NULL,
  notes text NOT NULL DEFAULT '',
  attempted_at text NOT NULL DEFAULT (datetime('now')),
  actor_id text,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX inquiry_contact_attempts_inquiry_idx ON inquiry_contact_attempts (inquiry_id, attempted_at DESC);
