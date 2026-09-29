CREATE TABLE saved_views (
  id text PRIMARY KEY NOT NULL,
  actor_id text NOT NULL,
  view_type text NOT NULL,
  name text NOT NULL,
  filters_json text NOT NULL DEFAULT '{}',
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX saved_views_actor_type_name_idx ON saved_views (actor_id, view_type, name);
CREATE INDEX saved_views_actor_type_idx ON saved_views (actor_id, view_type);
