CREATE TABLE performance_samples (
  id text PRIMARY KEY NOT NULL,
  path text NOT NULL,
  ttfb_ms integer NOT NULL,
  lcp_ms integer,
  cls real,
  inp_ms integer,
  connection text,
  created_at text NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX performance_samples_created_idx ON performance_samples (created_at);
CREATE INDEX performance_samples_path_idx ON performance_samples (path, created_at);