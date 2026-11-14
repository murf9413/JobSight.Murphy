# Supabase deployment setup

## Database

Apply `supabase/migrations/20261114050413_jobsight_auth_and_workspaces.sql` to the selected JobSight project through an authorized migration operation. The migration creates private company, membership, schedule, backup, shared vendor, invitation, vendor update, audit and bootstrap tables, plus one exposed RPC wrapper.

Provision the initial Admin email privately in the database, after confirming it with the project owner:

```sql
insert into jobsight_private.bootstrap_admins(email)
values (lower('REPLACE_WITH_VERIFIED_OWNER_EMAIL'))
on conflict(email) do nothing;
```

Do not put the actual email in a committed migration. The matching user must sign up, verify that address, sign in and create the first company. There is no default password, public first-user claim, or automatic Admin access for unrelated accounts.

## Auth configuration

In Supabase Authentication:

1. Enable email/password sign-in and require email confirmation.
2. Set the Site URL to `https://jobsight.build` when that domain is deployed.
3. Add the exact deployment's `/auth/callback` and `/auth/confirm` URLs to Redirect URLs, plus `http://localhost:3000/auth/callback` for local testing. Add the exact preview URLs needed for testing; avoid broad shared-domain wildcards.
4. Configure a production SMTP provider before onboarding PJMs or Vendors. Supabase's default email service is limited and is not a production mail delivery setup.
5. For cross-device verification, the app supports `/auth/confirm?token_hash=...&type=signup&next=...`. Configure the confirmation template to use a token-hash link following the official SSR guide. The default PKCE `/auth/callback` route expects the browser that started signup.
6. Verify password-reset delivery and redirect behavior with a real test account.

References:
- https://supabase.com/docs/guides/auth/server-side/nextjs
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/auth-smtp

## Vercel

Connect the GitHub repository and set the two values from `.env.example` for Preview and Production. Use the selected project's publishable key; do not add the service-role key. Framework: Next.js. Install: `npm ci`. Build: `npm run build`. Region: `iad1`.

First deploy a preview. Verify signup/confirmation, login, logout, password reset, initial workspace creation, Admin invitation links, PJM edits, Vendor acceptance/notes/nudges, template import/export, and a second company's isolation. Confirm the security advisor after applying the migration.

Do not promote to production or change DNS until those live checks pass. Completing a step does not trigger an external payment. Documents/storage are outside this migration.
