# Hostinger deployment and data migration

This app runs as one Next.js Node.js web app plus one MySQL database. It is prepared for Hostinger's managed Node.js hosting, deployed from GitHub. Use Node.js 22, `npm run build`, and `npm run start`. The app listens on Hostinger's `PORT` automatically. Do not configure PM2 or a separate PHP backend for this deployment.

## 1. Protect the current database

The current `.env` points to an external TiDB/MySQL-compatible database. Preserve it until the new site has passed the checks below. Do not run `prisma db push`, `prisma migrate dev`, or the demo seed against it. The source database was unreachable from the development sandbox during this migration, so its live schema and row counts must be checked from a machine that can connect to it.

1. Put the site in maintenance mode or stop new bookings for the final export window. A dump made while customers can still book may miss later writes.
2. Export the **entire source database**, schema and data, using the source provider's export tool or `mysqldump`. Keep the dump outside Git. If using `mysqldump`, use `--single-transaction --skip-lock-tables --set-gtid-purged=OFF --no-tablespaces --column-statistics=0` and export the named source database without `--databases`, so the dump can be imported into a differently named Hostinger database.
3. Record counts for `users`, `bookings`, `payments`, `memberships`, `gaming_sessions`, `gaming_stations`, and `website_settings`. Also record the latest `created_at` for bookings and payments. The SQL below can be run in the source database and, after import, in Hostinger phpMyAdmin:

```sql
SELECT 'users' AS table_name, COUNT(*) AS rows_count FROM users
UNION ALL SELECT 'bookings', COUNT(*) FROM bookings
UNION ALL SELECT 'payments', COUNT(*) FROM payments
UNION ALL SELECT 'memberships', COUNT(*) FROM memberships
UNION ALL SELECT 'gaming_sessions', COUNT(*) FROM gaming_sessions
UNION ALL SELECT 'gaming_stations', COUNT(*) FROM gaming_stations
UNION ALL SELECT 'website_settings', COUNT(*) FROM website_settings;
SELECT MAX(created_at) AS latest_booking FROM bookings;
SELECT MAX(created_at) AS latest_payment FROM payments;
```

4. In Hostinger: **Websites → Dashboard → Databases → Management**, create an empty MySQL database and user. Open its phpMyAdmin and import the dump. If the file exceeds phpMyAdmin's upload limit, use Hostinger's database import tool or SSH MySQL client. Compare counts and latest timestamps with the source before changing DNS. Keep the source backup.
5. The repository includes a Prisma baseline migration. The imported database already contains those tables, so **do not run `prisma migrate deploy` before baselining it**. With `DATABASE_URL` pointing to the Hostinger database, run the following from the app directory over Hostinger SSH (or another permitted connection):

```bash
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
npx prisma migrate resolve --applied 20261019_baseline
npx prisma migrate status
```

The diff command must exit **0**. Exit **2** means the imported schema differs from the app: stop and inspect the diff before resolving. If the imported dump already contains `_prisma_migrations`, inspect that history before baselining. Once the baseline is marked, future reviewed migrations use `npm run db:deploy`. The baseline SQL is for an **empty** database and must never be applied to the imported database.

## 2. Push the app to GitHub

Use a private GitHub repository. `.env`, database dumps, build output, and logs are ignored. Check `git status` and `git ls-files` before pushing. Never add passwords, API keys, or the SQL dump to GitHub. The repository must contain `package.json`, `package-lock.json`, `prisma/schema.prisma`, and `prisma/migrations`.

## 3. Connect Hostinger to GitHub

In Hostinger: **Websites → Add Website → Deploy Web App → Import Git Repository**. Authorize the `quadcoremanagementllp/darksyndicate` repository and select the production branch. Set framework to **Next.js**, project root to the repository root, Node.js to **22.x**, build command to `npm run build`, and start command to `npm run start`. Hostinger installs dependencies from `package-lock.json` and builds on pushes. Add the domain and SSL in hPanel. Do not copy `node_modules` or `.next` into GitHub.

### Environment variables in Hostinger

Add these in the Hostinger Node.js app's **Environment variables** panel, before the build:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `mysql://USER:URL_ENCODED_PASSWORD@HOST:3306/DATABASE_NAME` using Hostinger's exact database details; host is commonly `localhost` |
| `JWT_SECRET` | New random secret, at least 64 characters; keep private |
| `NEXT_PUBLIC_APP_URL` | Final HTTPS site URL, e.g. `https://darksyndicate.in` |
| `APP_URL` | Same HTTPS URL, used for password reset links |
| `DB_POOL_LIMIT` | `3` for the managed app |
| `DB_SSL` | `false` for local Hostinger MySQL; use `true` and a CA only for an external TLS database |
| `PAYMENT_MODE` | `disabled` until Razorpay is ready and tested |

URL-encode special characters in the database password (`@`, `#`, `:`, `/`, `%`) before inserting it in `DATABASE_URL`. The variables must be set in **Hostinger**, not only in your local `.env`; Hostinger does not read your ignored local file from GitHub. If the app URL changes after the first build, update the variables and redeploy because `NEXT_PUBLIC_` values are built into client assets.

### When Razorpay is ready

Set `PAYMENT_MODE=live`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in Hostinger. In the Razorpay dashboard, enable automatic capture and add `https://YOUR_DOMAIN/api/payments/webhook` for the `payment.captured` event. Redeploy, first with Razorpay **test** keys, and verify a full booking, captured payment, webhook retry, and rejected invalid signature. Only then switch to live keys. Checkout is disabled if any required value is missing. Membership passes remain available for purchase at reception; this deployment does not claim to sell them online.

The app records late captured payments and eligible cancellations as **pending refunds**. Review them on the admin Payments page. A Razorpay refund must be issued in the Razorpay dashboard and verified there; the app does not issue gateway refunds or automatically mark them completed. Reconcile the local payment/refund ledger with Razorpay after processing, before relying on net revenue reports. Never use the admin cash/UPI refund button for a Razorpay payment.

### Optional email

For password reset email, verify a sending domain with Resend and set `RESEND_API_KEY` plus `EMAIL_FROM` (for example `Dark Syndicate <mail@your-domain>`). Optionally set `CONTACT_EMAIL` to receive contact inquiry notifications. Contact inquiries are always stored in the admin audit log as `contact_inquiry`, even when email is unconfigured. Without email configuration the password reset form reports that email service is unavailable.

## 4. Validate the deployed app

1. Open `/api/health`. It must return HTTP 200 and `database.status=healthy`; database failure returns HTTP 503.
2. Test customer registration/login, a pay-at-reception booking, its confirmation link and QR lookup, staff check-in and session management, admin settings, and contact inquiry persistence.
3. Check Hostinger build and runtime logs if any flow fails. Compare database row counts again after testing.
4. Change passwords on any imported demo accounts, especially admin and staff. The demo seed is blocked in production.
5. Confirm SSL, backups, and a database restore procedure. Point production DNS at Hostinger only after the new app passes these checks. Keep the old database backup for rollback.

For a **fresh empty database only**, run `npm run db:deploy`, then set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 16 characters and run `npm run db:bootstrap-admin`. Remove those temporary variables afterward. Never run the demo seed in production.
