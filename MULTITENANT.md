# Multiple bureaus (v2)

One installation runs many matrimonial bureaus. Each bureau has:

- its own address: `<subdomain>.sanbroz.com` (e.g. `matrimonial.sanbroz.com`)
- its own data (a separate PostgreSQL schema `t_<subdomain>`), files (`uploads/<subdomain>/`), staff logins,
  Gmail and WhatsApp number. A login from one bureau never works on another.
- its own backups

You manage the bureaus as **super admin** in the console at **`bureau.sanbroz.com`**.

## Cloudflare (one-time)

The tunnel must send every subdomain to the server:

1. **DNS** (sanbroz.com → DNS): add `CNAME *` → `<tunnel-id>.cfargotunnel.com` (proxied). Existing records such as
   `matrimonial` keep working, because exact records win over the wildcard.
2. **Tunnel** (Zero Trust → Networks → Tunnels → your tunnel → Public hostname): add `*.sanbroz.com` →
   service **HTTP** `localhost:8090`. Keep the existing `matrimonial.sanbroz.com` entry.

   Not ready for a wildcard yet? Add `bureau.sanbroz.com` → `localhost:8090` for the console, and one hostname per
   bureau as you create them.

Cloudflare's free certificate covers one level (`*.sanbroz.com`), so no extra cost.

## `.env.production` settings

```
PLATFORM_DOMAIN=sanbroz.com        # required
CONSOLE_SUBDOMAIN=bureau           # console at bureau.sanbroz.com
RESERVED_SLUGS=www,mail            # your other sites on sanbroz.com: bureaus can't take these names
FIRST_TENANT_SLUG=matrimonial      # the existing bureau keeps this subdomain
SUPERADMIN_EMAIL=                  # first super admin (defaults to OWNER_EMAIL / OWNER_PASSWORD)
SUPERADMIN_PASSWORD=
```

`ops/deploy.sh` creates `BACKUP_TOKEN` by itself. `APP_URL` is no longer used: links in emails use each bureau's own
address.

## The console

- **Bureaus:** create a bureau, which sets up its database, default lists, the owner login and its folder in a few
  seconds. You can also suspend or resume it, delete it (a final backup is taken first, and you type the subdomain to
  confirm), see its usage, and record custom domains (saved inactive for now).
- **Billing** per bureau:
  - plan name, fee, cycle and next due date
  - *Record payment* moves the due date forward by the cycles paid
  - overdue and due-soon counts on the dashboard
  - optional automatic suspension N days after the due date (paying resumes the bureau)
  - optional daily billing email (Settings)
- **Backups:**
  - the whole server: nightly, plus a *Back up now* button
  - each bureau: nightly, *Back up now*, *Restore*, and *Download* (a password-protected `.7z`)
- **Updates:**
  - the app update (*Back up & update* under Sign out) is shown only to super admins now
  - WhatsApp library updates and auto-update are here too
  - a list of every bureau's WhatsApp connection
- **Settings:** platform Gmail (for your own emails), super admin logins, your password.

## Demo data

New bureaus can start with Indian / Punjabi **demo data**, so owners can try everything before entering real
clients:
- 40 profiles (Sikh, Hindu, Christian and Muslim families; Punjab, Chandigarh, Delhi, Haryana, and NRIs in Canada,
  the UK, Australia, New Zealand and the USA; some second marriages)
- 8 leads, notes and follow-ups
- sample plans, memberships with receipts and open dues
- proposals at every pipeline stage

The data is safe to experiment with: phone numbers are `00000 0xxxx` and emails are `@example.com`, so nothing
reaches a real person.

- **Console:** the "Add demo data" checkbox when creating a bureau (on by default), and Add / Delete demo data on the
  bureau's page.
- **Bureau owner:** Settings → Demo data → *Delete demo data* (type DELETE DEMO).
  - Only sample records go, along with everything attached to sample profiles. The owner's own records stay.
  - If nothing else is left, profile codes and receipt numbers restart (e.g. PM1001, R1).
  - A notice on the dashboard reminds them while demo data is there.
- **Command line (development):** `npm run db:seed-demo -- <subdomain>`, or add `--delete`.

## Bureau owners

- **Settings → Backups:** *Back up now*, the list of backups, *Download* (they choose a password for the `.7z`), and
  *Restore* (they type RESTORE; a copy of the current data is taken first).
- **Settings → WhatsApp:** *Link a WhatsApp number*. Each bureau links its own number.
- A suspended bureau shows "This CRM is paused"; its data is kept.

## How it works (for developers)

- `src/middleware.ts` classifies the host (`src/lib/tenant/host.ts`):
  - console host → `/console/*`
  - `<slug>.<PLATFORM_DOMAIN>` → that bureau
  - any other host → custom domain lookup, otherwise 404

  It overwrites `x-mb-host` / `x-mb-area`, so these can't be faked.
- `prisma` from `@/lib/db` resolves the current bureau on every call: from the request host, or from
  `runAsTenant()` in the scheduler. Outside a bureau it returns 404. Use interactive `$transaction(async tx => …)`
  only. Platform data: `platform` from `@/lib/platform-db` (schema in `prisma/platform/schema.prisma`).
- **Migrations:**
  - bureau tables: `prisma/migrations`, as before
  - platform: `prisma/platform/migrations`
  - `ops/migrate-all.ts` (`npm run db:migrate-all`) applies both to every schema on each deploy, with the same
    bookkeeping as `prisma migrate deploy`
  - new bureau migrations are made as usual with `npx prisma migrate dev` against a development bureau schema
    (`DATABASE_URL=…?schema=t_matrimonial`)
- **Backup API:** the backup container (`ops/backup/server.mjs`) with `BACKUP_TOKEN`. The passphrase never leaves
  that container. Restores only use the server's own backup files, never an upload.
- **WhatsApp:** `ops/whatsapp/server.mjs` runs one Baileys session per bureau under `/data/sessions/<slug>`. The
  pre-v2 session in `/data/auth` moves to `FIRST_TENANT_SLUG` automatically, with no re-link.
- **Local development:** `PLATFORM_DOMAIN=localhost:3000`, then open `http://bureau.localhost:3000` (console) and
  `http://matrimonial.localhost:3000`.
