# Operations

The production runbook for the hosted app, and how desktop releases are cut.

## Hosted app

Live at https://hibiapp.vercel.app (Vercel project `hibi`, region `fra1`,
auto-deploys from `main`; PR previews are skipped by `vercel.json`).
Supabase project `sovcaiebdyrdxxcflets`, eu-central-1.

### Environment

Set in Vercel, Production only (never locally or in CI):

| Variable | Value |
|---|---|
| `APP_ENV` | `production`, which turns on the checks in `src/env-schema.ts` |
| `NEXT_PUBLIC_APP_URL` | the public `https://` URL (email links point here) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the production project |

With `APP_ENV=production` the build fails if the app URL is missing,
local or not https, or if Supabase is local.

### Tasks

- **Migrations:** `ALLOW_REMOTE_DB=1 DATABASE_URL=$PROD_DATABASE_URL npx drizzle-kit migrate`
  (`PROD_DATABASE_URL` lives in the gitignored `.env.production.local`).
- **Auth settings:** `supabase config push --project-ref sovcaiebdyrdxxcflets`
  applies `config.toml` with its `[remotes.production]` overrides. Read the
  diff before answering yes.
- **Accounts:** sign-up is closed. Visitors leave their email at `/signup`,
  which lands in the `access_requests` table (Supabase dashboard → Table
  Editor). To let someone in: Authentication → Users → Add user → **Send
  invitation**. The email link lands on `/invite`, where they choose their
  own password. (Or Create new user with a password + Auto Confirm: no email.)
  A custom invite email (`supabase/templates/invite.html`, commented out in
  `config.toml`) needs your own SMTP: Supabase blocks custom templates on
  the built-in sender.
- **Email:** the built-in mailer (a few per hour) only sends magic links.
  Add SMTP before relying on email.

### Security notes

- **CSP:** built per request in `src/lib/csp.ts` and sent by `src/proxy.hosted.ts`:
  scripts by nonce only (`'strict-dynamic'`), connect-src limited to Supabase
  and its realtime websocket. A new third-party script or API origin needs an
  entry there. zod runs `jitless` (`src/lib/zod.ts`) so it never probes `eval`.
- **Access requests** are capped at 30 an hour by a trigger (migration 0012).
  The form says "try again in an hour" when the cap is full.
- **Links between rows stay within one owner:** composite `(id, user_id)` FKs
  (migration 0013), mirrored in `desktop/syncsvc/store.go`.
- **Auth:** 12-character passwords, password changes need a recent sign-in,
  TOTP off until the app has a 2FA screen (`supabase/config.toml`).
- **Accepted advisories (dev-only):** drizzle-kit's old esbuild (affects
  esbuild's dev server, which drizzle-kit never starts) and the shadcn CLI's
  deepmerge. `npm audit --omit=dev` must stay at 0.
- **Not done:** Apple notarization of the Mac app (needs a Developer ID).

## Desktop releases

Push a tag `desktop-v<x.y.z>`. `.github/workflows/desktop-release.yml` then:

1. **build** (macOS, no key): `scripts/release-desktop.sh build <v>` runs npm
   and Wails and produces `hibi.dmg` plus the unsigned `hibi-<v>.app.zip`.
2. **release** (fresh Ubuntu runner, no npm): `scripts/release-desktop.sh sign <v>`
   signs the zip with the stdlib-only `hibi-sign`, verifies it against
   `desktop/update/pubkey.txt`, writes `latest.json` and publishes the
   GitHub Release.

So npm code never runs next to the signing key. Run both stages locally
for a dry run (they write `dist/`).

- **Signing key:** the `HIBI_UPDATE_PRIVATE_KEY` repo secret, which must
  match `desktop/update/pubkey.txt`. A copy lives in
  `~/.config/hibi/update.key` (never in the repo). Back it up: if it's
  lost, installed apps can't take updates again.
- **Download link:** the dmg is unversioned on purpose, so
  `releases/latest/download/hibi.dmg` always serves the newest build
  (the landing page links there).
- **Updater feed:** `releases/latest/download/latest.json`.
