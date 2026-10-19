# Dark Syndicate Gaming World

Next.js 16 application for the venue website, customer bookings, staff operations, and administration. The backend runs in Next.js route handlers and stores data in MySQL through Prisma. Hostinger's managed Node.js app can run the web app; the database is a separate Hostinger MySQL service.

## Local development

Use Node.js 22. Copy `.env.example` to `.env` and set your own database URL and JWT secret. Keep real environment files outside Git. Then run:

```bash
npm ci
npm run db:deploy
npm run dev
```

`db:deploy` is for an **empty database** or one already tracked by Prisma migrations. If you are importing existing production data, follow [DEPLOYMENT.md](DEPLOYMENT.md) to compare the schema and baseline the migration first. Never run `db:push`, `db:migrate`, or the demo seed on imported customer data.

For an empty database, create the initial administrator with `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 16 characters, then run `npm run db:bootstrap-admin`. Remove those variables afterward. The optional demo seed requires `ALLOW_DEMO_SEED=true` and is blocked in production.

## Production

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full GitHub to Hostinger setup, database preservation and import, environment variables, health checks, and Razorpay activation. Build with `npm run build` and start with `npm run start`. The app uses Hostinger's assigned `PORT`.

Until Razorpay credentials and webhook are configured, online booking checkout is disabled and customers can reserve for payment at reception. Membership passes are sold at reception. Gateway refunds require review and processing in Razorpay; the admin panel does not issue them.

## Main commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local development server |
| `npm run build` | Generate Prisma client and production build |
| `npm run start` | Production server |
| `npm run db:deploy` | Apply reviewed migrations to an empty or tracked database |
| `npm run db:bootstrap-admin` | Create first administrator on an empty database |
| `npm run test:payment-security` | Check payment configuration and signature validation |

The source database and its backups must never be committed. This repository is private software.
