CREATE TABLE pages (
  id text PRIMARY KEY NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  draft_content text NOT NULL DEFAULT '',
  published_version_id text,
  updated_by text,
  created_at text NOT NULL DEFAULT (datetime('now')),
  updated_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE page_versions (
  id text PRIMARY KEY NOT NULL,
  page_id text NOT NULL,
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  published_at text,
  created_by text,
  created_at text NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX page_versions_page_version_idx ON page_versions (page_id, version);
CREATE INDEX page_versions_page_idx ON page_versions (page_id, created_at);

INSERT OR IGNORE INTO pages (id, slug, title, draft_content, published_version_id) VALUES
  ('page-delivery', 'delivery', 'Delivery', 'We deliver across Bangladesh. Delivery charges and coverage are shown at checkout and may vary by zone.', 'page-delivery-v1'),
  ('page-returns', 'returns', 'Returns', 'Please contact us before returning an item. Return eligibility and timing are confirmed according to the current store policy.', 'page-returns-v1'),
  ('page-privacy', 'privacy', 'Privacy', 'We use the information you submit to process orders, answer inquiries and provide customer support. We do not sell customer information.', 'page-privacy-v1'),
  ('page-terms', 'terms', 'Terms', 'Prices, stock and delivery charges are confirmed at checkout. Cash on delivery orders remain subject to confirmation by the store.', 'page-terms-v1'),
  ('page-faq', 'faq', 'FAQ', 'How do I order? Add an in-stock piece to your bag and complete the cash-on-delivery checkout. Pre-order pieces use the inquiry form.', 'page-faq-v1'),
  ('page-contact', 'contact', 'Contact', 'For order help or a pre-order request, use the contact channel configured by the store owner.', 'page-contact-v1'),
  ('page-size-guide', 'size-guide', 'Size guide', 'Size information is provided on each product when available. Contact the store if you need help choosing a fit.', 'page-size-guide-v1');

INSERT OR IGNORE INTO page_versions (id, page_id, version, title, content, status, published_at) VALUES
  ('page-delivery-v1', 'page-delivery', 1, 'Delivery', 'We deliver across Bangladesh. Delivery charges and coverage are shown at checkout and may vary by zone.', 'published', datetime('now')),
  ('page-returns-v1', 'page-returns', 1, 'Returns', 'Please contact us before returning an item. Return eligibility and timing are confirmed according to the current store policy.', 'published', datetime('now')),
  ('page-privacy-v1', 'page-privacy', 1, 'Privacy', 'We use the information you submit to process orders, answer inquiries and provide customer support. We do not sell customer information.', 'published', datetime('now')),
  ('page-terms-v1', 'page-terms', 1, 'Terms', 'Prices, stock and delivery charges are confirmed at checkout. Cash on delivery orders remain subject to confirmation by the store.', 'published', datetime('now')),
  ('page-faq-v1', 'page-faq', 1, 'FAQ', 'How do I order? Add an in-stock piece to your bag and complete the cash-on-delivery checkout. Pre-order pieces use the inquiry form.', 'published', datetime('now')),
  ('page-contact-v1', 'page-contact', 1, 'Contact', 'For order help or a pre-order request, use the contact channel configured by the store owner.', 'published', datetime('now')),
  ('page-size-guide-v1', 'page-size-guide', 1, 'Size guide', 'Size information is provided on each product when available. Contact the store if you need help choosing a fit.', 'published', datetime('now'));