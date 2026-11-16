# JobSight handoff

The application now uses Next.js and Supabase SSR. Read README.md and docs/SUPABASE-SETUP.md before deploying. The original scheduling UI and engine remain; do not rebuild them.

Production paths:
- app/page.tsx and app/api/cloud/route.ts validate Supabase users server-side.
- proxy.ts refreshes cookies and disables response caching.
- server/supabase-cloud.js validates HTTP requests and uses the caller's session for RPC.
- supabase/migrations contains the authorization gateway and private, RLS-protected tables.
- src/TeamAccess.jsx, LiveVendorWorkspace.jsx and LiveVendorInbox.jsx replace the sample role workflow.

Never trust caller-supplied identity headers or client-editable role claims. Never use service-role credentials in the browser or to bypass the gateway. Roles are checked against current membership for every action. Keep user authentication and the private database permission checks intact. Supabase config and real account/login tests are release prerequisites.

Tests: npm test; npm run build. The PostgreSQL tests use PGlite and temporary fixtures, not production user accounts. Legacy server/cloud.js tests document the original storage contract, but that handler is no longer routed. Original sample Vendor components are retained as design references and are not used by CloudShell.

Preserve working-day dates, locks, task pairing, cascade/cancel, autosave/revision conflicts, backups, and readiness vs acceptance vs completion. Vendor notes turn steps red until reviewed in the live inbox. Acceptance is tied to the current schedule signature. Completing work does not send payment.

Prior UI audit items (DUC convention, list initial position, add-step defaults, drag feedback, light-theme selection contrast, long Details form, PSR consistency) remain separate from this infrastructure change. Documents storage is not implemented here. Existing job data is not migrated; templates can be imported after launch.
