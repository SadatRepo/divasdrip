import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import app, { type Env } from '../worker';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  for (const file of readdirSync('db/migrations').filter((file) => file.endsWith('.sql')).sort()) sqlite.exec(readFileSync('db/migrations/' + file, 'utf8'));
  function prepare(sql: string) {
    let values: any[] = [];
    return {
      bind(...args: any[]) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...values), success: true, meta: {} }; },
      async run() { const result = sqlite.prepare(sql).run(...values); return { success: true, meta: { changes: Number(result.changes) }, results: [] }; },
    };
  }
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) { sqlite.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sqlite.exec('COMMIT'); return results; } catch (error) { sqlite.exec('ROLLBACK'); throw error; } } } as unknown as D1Database;
  return { sqlite, db };
}
let fixture: ReturnType<typeof database>;
let env: Env['Bindings'];
beforeEach(() => { fixture = database(); env = { DB: fixture.db, ADMIN_TOKEN: 'integration-test-token', ENVIRONMENT: 'development', IMAGES: { put: async () => ({}) } as unknown as R2Bucket, ASSETS: { fetch: async () => new Response('asset') } as unknown as Fetcher }; });
afterEach(() => fixture.sqlite.close());
const product = { name: 'Test Dress', slug: 'test-dress', categoryId: 'cat-full-length', variants: [{ sku: 'TEST-S', size: 'S', color: 'Rose', priceInCents: 245050, stockOnHand: 3 }] };
function request(path: string, body?: unknown, method = 'POST') { return app.request('http://localhost/api' + path, { method, headers: { Authorization: 'Bearer integration-test-token', 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }, env); }

describe('catalogue lifecycle with real SQLite migrations', () => {
  it('creates a draft with correct price, currency, stock and audit record', async () => {
    const response = await request('/admin/products', product);
    expect(response.status, await response.clone().text()).toBe(201);
    const row = fixture.sqlite.prepare('SELECT * FROM products WHERE slug = ?').get('test-dress');
    expect(row).toMatchObject({ price_in_cents: 245050, currency: 'BDT', stock: 3, publication_state: 'draft' });
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM audit_events').get()).toMatchObject({ n: 1 });
    expect(await (await app.request('http://localhost/api/products', {}, env)).json()).toEqual([]);
  });
  it('edits tags, slug, nullable SEO and booleans, then publishes a gallery', async () => {
    const created = await (await request('/admin/products', product)).json() as { id: string };
    fixture.sqlite.exec("INSERT INTO media (id,object_key,mime_type) VALUES ('image','catalog/test.webp','image/webp')");
    expect((await request('/admin/products/' + created.id + '/images', { images: [{ mediaId: 'image', isCover: true }] }, 'PUT')).status).toBe(200);
    const response = await request('/admin/products/' + created.id, { slug: 'updated-dress', tags: ['occasion'], seoTitle: null, seoDescription: null, preorder: false, isActive: true, publicationState: 'published' }, 'PATCH');
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await response.json()).toMatchObject({ tags_json: '["occasion"]', slug: 'updated-dress', preorder: 0, is_active: 1 });
    const visible = await app.request('http://localhost/api/products/updated-dress', {}, env);
    expect(visible.status).toBe(200);
    expect(await visible.json()).toMatchObject({ variants: [expect.objectContaining({ sku: 'TEST-S' })], images: [expect.objectContaining({ object_key: 'catalog/test.webp' })] });
  });
  it('rejects duplicate variant SKUs without partial products', async () => {
    expect((await request('/admin/products', { ...product, variants: [product.variants[0], product.variants[0]] })).status).toBe(422);
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM products').get()).toMatchObject({ n: 0 });
  });
  it('requires authentication and a cover to publish', async () => {
    expect((await app.request('http://localhost/api/admin/products', {}, env)).status).toBe(401);
    expect((await request('/admin/products', { ...product, publicationState: 'published' })).status).toBe(422);
  });
  it('seeds all photos idempotently without resetting edited stock', () => {
    const seed = readFileSync('db/demo-seed.sql', 'utf8'); fixture.sqlite.exec(seed);
    fixture.sqlite.exec("UPDATE product_variants SET stock_on_hand=1 WHERE id='sample-blue-bloom-maxi-s'"); fixture.sqlite.exec(seed);
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM products').get()).toMatchObject({ n: 25 });
    expect(fixture.sqlite.prepare('SELECT COUNT(*) AS n FROM media').get()).toMatchObject({ n: 30 });
    expect(fixture.sqlite.prepare("SELECT stock_on_hand FROM product_variants WHERE id='sample-blue-bloom-maxi-s'").get()).toMatchObject({ stock_on_hand: 1 });
  });
  it('accepts an uploaded photo and records ready media', async () => {
    const form = new FormData(); form.append('file', new File([readFileSync('public/images/catalog/blue-bloom-maxi-1.webp')], 'dress.webp', { type: 'image/webp' })); form.append('altText', 'Blue floral dress');
    const response = await app.request('http://localhost/api/uploads', { method: 'POST', headers: { Authorization: 'Bearer integration-test-token' }, body: form }, env);
    expect(response.status, await response.clone().text()).toBe(201);
    expect(fixture.sqlite.prepare('SELECT status, alt_text FROM media').get()).toMatchObject({ status: 'ready', alt_text: 'Blue floral dress' });
  });
  it('uses server prices for COD and replays a retry without allocating twice', async () => {
    fixture.sqlite.exec(readFileSync('db/demo-seed.sql','utf8'));
    const input = { customerName: 'Test Buyer', phone: '01712345678', address: 'Test address in Dhaka', deliveryZone: 'dhaka', items: [{ productId: 'sample-blue-bloom-maxi', variantId: 'sample-blue-bloom-maxi-s', quantity: 1, priceInCents: 1 }] };
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'integration-order-0001' }, body: JSON.stringify(input) };
    const response = await app.request('http://localhost/api/orders',init,env);
    expect(response.status, await response.clone().text()).toBe(201);
    const placed = await response.json() as { reference: string; totalInCents: number };
    expect(placed.totalInCents).toBe(333000);
    const replay = await app.request('http://localhost/api/orders',init,env);
    expect(await replay.json()).toMatchObject({ reference: placed.reference, replayed: true });
    expect(fixture.sqlite.prepare("SELECT stock_reserved FROM product_variants WHERE id='sample-blue-bloom-maxi-s'").get()).toMatchObject({ stock_reserved: 1 });
  });
});
