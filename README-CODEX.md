# JobSight — complete source export, version 26

Start here in Codex. This is the full tracked application source from commit d4a7495c9df2654ab03858ee533af3a9e6f00dd0, not a screenshot or static mockup. Source files are unchanged.

## Open and run
1. Extract the ZIP and open the JobSight folder as a Codex workspace (or commit its contents to your own Git repository).
2. Read CODEX_HANDOFF.md before making changes.
3. Use Node.js >=22.13.0 and npm. Run `npm run install:ci`, then `npm test`, then `npm run dev`. Use the local URL printed by the server (portable default port 5173).
4. `npm run build` builds the application; `npm start` uses the generated Cloudflare worker configuration. Fresh-machine dependency installation and browser startup have not been verified by this export.

## Included
- src/: scheduling engine, calendar, Admin/PJM views, vendor demo, exports, styling and tests.
- app/ and server/: application routes, authentication adapter, cloud API, permissions and validation.
- db/ and drizzle/: database schema and SQL migrations.
- public/: brand assets.
- build/, scripts/, configuration, package.json and exact dependency lockfile.
- SOURCE_MANIFEST.json: SHA-256 of every exported tracked file.

## Infrastructure and data
This implementation uses React, FullCalendar, Vinext/Vite and Cloudflare Workers/D1. It is NOT a plain static website or an already-converted Vercel/Supabase app.
The existing ChatGPT Sites project ID in .openai/hosting.json is provenance/configuration, not an access credential. Do not publish to that project without authorization.
Live jobs, workspace memberships, invitations, saved versions, browser-local schedules and vendor demo session data are NOT in this ZIP. Database migrations define structure; they do not contain a production database backup. Export job backups separately before moving hosting. CSV alone is not a complete migration backup.
ChatGPT sign-in currently depends on trusted platform-injected identity headers and platform-owned sign-in routes. Outside that trusted hosting boundary, replace this adapter with verified server-side authentication; do not accept spoofable public request headers as identity. Local mock authentication is for development only.
The D1 database ID in vite.config.ts is a local placeholder. A new deployment requires an actual database binding and migrations, or an explicit database-porting effort. Preserve server-side membership/role checks.
Node modules, compiled output, .git history, local databases, logs and secrets are intentionally excluded. Dependencies can be restored from the lockfile.
