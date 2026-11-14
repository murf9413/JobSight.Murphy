# Codex handoff

Continue this existing application rather than rebuilding its interface from scratch. First read README-CODEX.md, package.json, vite.config.ts, app/chatgpt-auth.ts, server/cloud.js and server/validation.js. Run the test suite before editing. Preserve working-day calculations, locked dates, pairing rules, cascade previews/cancel behavior, auto-save, and separate readiness/acceptance/completion states.

The owner can switch Admin/PJM/Vendor views. PJM intentionally shares Admin capabilities for now; the role preview is not a new server-side authorization role. Vendor interaction is sample/session data, not authenticated production vendor collaboration. Completion does not issue payments. Documents/storage tiles discussed elsewhere are not an implemented production file store.

Version 26 includes configurable job columns, Details with callouts, header collapsing, status icons, list drag/cascade and multi-select. The audit findings were NOT implemented. Verify current behavior before claiming a fix.

Pending audit findings: DUC sign/color requirements need one consistent arithmetic definition; current UI shows allowed minus actual with negative red. List starts at historical completed work. Add-step button defaults to base date. Drag feedback can move rows during the first drag. Light-theme multi-select text lacks contrast. Job details is a long all-step form. Job PSR metadata can differ from the scheduled PSR milestone. Cascade prompt should show old/new dates and impacted milestones. Live vendor accounts, acceptance, unread notes/nudges and payment integration remain separate production work.

First requested task for Codex: restore dependencies, run tests, bring up the existing app locally and report any infrastructure dependencies. Do not automatically migrate hosting, change permissions, or deploy. Keep live records backed up before any later migration.
