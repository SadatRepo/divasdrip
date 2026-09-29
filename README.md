# My Store

Divasdrip fashion commerce starter: React + Vite storefront, Hono Cloudflare Worker API, D1/Drizzle catalogue and commerce data, protected admin workspace, and R2 media storage.

## Local setup

```powershell
Set-Location "C:\Users\lifeo\OneDrive\Desktop\Divasdrip\my-store"
npm install
Copy-Item .dev.vars.example .dev.vars -Force
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

Open `/` for the storefront and `/admin` for the admin workspace. Local token access uses `ADMIN_TOKEN` from `.dev.vars`; production staff accounts use an HttpOnly session cookie with role and permission checks. Staff changes, order corrections, catalogue changes, category edits, content publication, and media changes are written to the audit log. The admin workspace includes versioned policy pages under /admin/content; public pages are available at /page/delivery, /page/returns, /page/privacy, /page/terms, /page/faq, /page/contact, and /page/size-guide.

## Checks

```powershell
npm run typecheck
npm test
npm run build
```

## Cloudflare setup

Create the remote resources, replace the placeholder D1 ID in `wrangler.jsonc`, then apply migrations:

```powershell
npx wrangler login
npx wrangler d1 create my-store-db
npx wrangler r2 bucket create my-store-images
npm run db:migrate:remote
npm run deploy
```

Product image bytes go to R2. D1 stores media metadata, object keys, alt text, and product ordering. Uploads strip JPEG/PNG/WebP metadata before storage, and orphan cleanup protects product, category, collection, and homepage-content references. For responsive Cloudflare image transformations, set the optional `MEDIA_PUBLIC_BASE_URL` variable to a public media origin; when it is blank, the Worker serves the sanitized original. The payment gateway remains intentionally unconfigured; launch checkout is cash on delivery. Catalogue CSV import is available at /admin/products/import with validation preview; owner/admin exports are available from the Products and Orders screens and are audited. Authorized order staff can create manual COD orders at /admin/orders/new, including accepted preorder inquiries; the Worker snapshots the item price, applies stock policy, and records the audit trail. Collections support manual membership, tag rules, and configurable new-arrival windows.
## First staff account

With `ADMIN_TOKEN` configured, bootstrap the first owner account once against the local Worker:

```powershell
$payload = @{ email = "owner@example.com"; displayName = "Store Owner"; password = "replace-with-a-strong-password" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:5173/api/auth/bootstrap" -Headers @{ Authorization = "Bearer $env:ADMIN_TOKEN" } -ContentType "application/json" -Body $payload
```

The production setup should use a secret manager or Cloudflare secret for the bootstrap token; do not commit credentials. Owners and admins can then manage staff roles from `/admin/staff`. Roles include owner, admin, editor, operations, support, and viewer; server-side permissions remain authoritative even if a user navigates directly to a restricted route.

## Backup and restore

D1 backups are SQL exports. Run a remote backup at least daily, retain encrypted copies outside the repository, and create an additional backup before migrations or deployments:

```powershell
./scripts/backup-d1.ps1 -Remote
```

A restore should be rehearsed weekly against a disposable D1 database. The script requires an explicit confirmation because ingesting a SQL export can overwrite or conflict with existing tables:

```powershell
./scripts/restore-d1.ps1 -File "./backups/my-store-db-YYYYMMDD-HHMMSS.sql" -Remote -ConfirmRestore
```


R2 media backups can be captured from the ready media keys recorded in D1. Run this after the D1 export and retain both artifacts together:

PowerShell: ./scripts/backup-r2.ps1 -Remote

The generated manifest is required for a guarded restore. Restore the D1 export first, verify the target bucket, then run:

PowerShell: ./scripts/restore-r2.ps1 -Manifest "./backups/r2/my-store-images-YYYYMMDD-HHMMSS/manifest.json" -Remote -ConfirmRestore

The scripts only read or write the explicitly named bucket, require remote flags, and refuse unsafe object paths.

A D1 export does not contain R2 image objects. Configure R2 object retention/versioning or a separate bucket replication/export policy, and keep the D1 SQL backup and corresponding R2 image backup from the same point in time.

## Pending-order expiry

Pending confirmation orders default to expiry after 48 hours. The owner can change the timeout and choose whether expiry releases reserved stock in Admin > Settings. A Worker cron runs every 15 minutes; the protected `POST /api/admin/orders/expire` action can also be used for a controlled manual run.

## Performance monitoring

The storefront reports privacy-safe, route-only Web Vitals (TTFB, LCP, CLS, and INP) when a visitor leaves a page. The Worker validates and rate-limits the payload, stores a 30-day sample, and exposes seven-day per-route p95 values in Admin > Diagnostics. No customer identifiers, query strings, or form values are sent.

## Cloudflare usage monitoring

Run the usage check with an Analytics API token that has read access to Workers, D1, and R2 analytics:

```powershell
.\scripts\check-cloudflare-usage.ps1 -AccountTag "<account-id>" -ApiToken "<token>" -DatabaseId "<d1-database-id>" -WorkerScriptName "my-store" -BucketName "my-store-images"
```

The command reports authoritative Workers and D1 daily usage plus R2 month-to-date operations and storage against the current free-tier thresholds. Cloudflare retains these analytics for a limited period, so schedule the command daily if you need a historical record.



## Sample catalogue and supplied photographs

`npm run db:seed:local` adds 25 sample products, 75 S/M/L variants, 30 photos and three curated collections to **local D1 only**. Run migrations first. Sample prices, sizes, descriptions, availability and stock are illustrative and need review before launch. No customer data or staff credentials are seeded. Rerunning the seed preserves existing product edits, stock and configured homepage settings.

- Original photos remain in `public/images` under their original filenames.
- Optimized, metadata-free WebP copies live in `public/images/catalog` with descriptive names. Alternate photos of the same outfit are grouped into galleries.
- `db/demo-catalogue.json` maps every original photo to its product and optimized file.
- `db/demo-seed.sql` holds editable D1 records, image associations, initial inventory events and collection memberships. It is deliberately separate from production migrations.
- Bundled catalogue media is served through `/api/media/catalog%2F...webp`; new admin uploads use R2 as before.
- To regenerate the optimized assets and SQL, run `python scripts/prepare-demo.py` with Pillow installed. Normal local setup does not require Python.

The storefront now uses the API as its catalogue source. Empty databases display an empty collection, and API failures display a retry action; neither situation substitutes fictional purchasable products.

## Adding and maintaining products

1. Open `/admin`, choose **Local token** for local development, and use `ADMIN_TOKEN` from your private `.dev.vars`. The token is validated before opening the workspace. Production staff should use their existing staff account/MFA flow.
2. Open **Products**. Enter a title, slug, category, description and one or more variants with unique SKUs. Enter prices in BDT and opening stock as whole units. Upload a primary image with alt text, then save the draft.
3. The product editor opens after creation. Add material, care, tags, SEO, shipping notes and size details. **Media** opens the existing gallery manager for additional uploads, ordering and cover selection; **Inventory** records subsequent stock changes with reasons.
4. Preview the draft, select **Published**, and save product details. Use **View live product** to verify the result. A cover image is required. Use **Archived** to remove the product from shopping without deleting its history.

`/cart`, `/search`, `/category/:slug`, `/pre-order` and `/track` now have working storefront routes. The bag drawer supports keyboard focus and Escape; unavailable cart lines remain visible for correction. Delivery options come from the API, and checkout retains its idempotency key on a failed response so a network retry cannot submit a new order accidentally.

## Regression and browser checks

Use Node 24+ for the SQLite-backed integration tests. `npm test` covers product creation, draft visibility, publication, nullable SEO/tags/slug edits, duplicate SKUs, uploads, demo-seed reruns, server-priced COD retries, cart recovery, currency precision and link rendering, alongside the existing auth/media/checkout tests.

For browser checks, run a local Vite server and set `SMOKE_BASE_URL` if it is not `http://127.0.0.1:5177`. Google Chrome must be installed.

```powershell
$env:SMOKE_BASE_URL = "http://127.0.0.1:5177"
npm run test:browser
npm run test:admin
npm run test:workspace
```

The admin test creates a local QA product, uploads a photo, publishes it, verifies its public page, and archives it in cleanup. It never contacts a production host. Screenshots are written to the ignored `test-artifacts` directory. The workspace test visits all 15 admin screens without changing business records.

Production deployment remains separate: the Cloudflare D1 ID is still a placeholder. Configure production D1/R2, staff access, actual stock/prices, policies, delivery charges and the pre-order contact destination before launch. Local functional checks do not establish production performance or full SRS conformance.
