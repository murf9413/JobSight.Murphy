# JobSight

Residential construction scheduling with Supabase Auth/Postgres and a standard Next.js runtime for Vercel. The existing calendar, templates, cascade logic, exports, and job dashboard are retained.

## Run

Use Node.js 22.13+ (Node 24 supported).

```sh
npm ci
cp .env.example .env.local
# Set the Supabase URL and publishable key in .env.local.
npm test
npm run build
npm run dev
```

Only the publishable key belongs in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. The application does not need a service-role key. Never commit `.env.local`, credentials, dependency folders, or generated output.

## Accounts and permissions

- **Admin:** company schedules, team access, invitations and vendor assignment.
- **PJM:** company schedules, shared vendor directories, vendor notes/nudges. Cannot manage membership.
- **Vendor:** only assigned, confirmed steps; may accept dates, post notes and request completion review. Cannot complete steps or change schedules.

Accounts must verify their email. Signing up alone grants no company access. Initial workspace creation requires an email allowlist entry provisioned by the project operator. Admins generate email-bound, single-use invitation links with a seven-day expiry. Invitation links are copied and shared manually; the app does not send invitation messages.

## Database and release

See [docs/SUPABASE-SETUP.md](docs/SUPABASE-SETUP.md). Apply the versioned migration before deploying this branch. No existing schedule data is migrated.

Application tables live in `jobsight_private`, have RLS enabled, and have no direct `anon` or `authenticated` table grants. `public.jobsight_api` is a security-invoker wrapper over a private authorization gateway. The gateway verifies `auth.uid()`, email verification, current company membership and action permissions on every request. Never replace it with a service-role client or expose the private schema through the Data API.

The database tests run the actual migration in a disposable PostgreSQL engine (PGlite), using isolated Auth fixtures. They cover cross-company access, role escalation, direct-table access, Vendor visibility/actions, invitation use, schedule revisions, shared vendor reassignment and access revocation. They do not replace a live email/login test before launch.

The original v26 source remains in Git history. `docs/v26-source-manifest.json` records the original export checksums, not this modified release. Legacy `server/cloud.js` and its tests remain as regression reference; the live route uses `server/supabase-cloud.js` exclusively.
