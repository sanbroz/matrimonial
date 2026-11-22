# Plan: Multi-tenant Bureau CRM (v2.0)

## Goal
Run many matrimonial bureaus (tenants) on the one server. Each bureau gets:
- its own subdomain, e.g. `sharma.sanbroz.com`
- fully separate data, files, staff, WhatsApp number and Gmail
- its own backups

You, as **super admin**, get a console at `bureau.sanbroz.com` to create bureaus, track their billing, suspend them and manage backups. The current bureau becomes tenant #1 and keeps `matrimonial.sanbroz.com`, with no data loss and no WhatsApp re-link.

## Decisions (from your answers)
| Area | Decision |
|---|---|
| Onboarding | Super admin creates bureaus. Billing (fee, cycle, due date, payments) is tracked in the console |
| Subdomains | `<slug>.sanbroz.com`; one level, covered by Cloudflare's free certificate |
| Custom domains | Domain table and lookup built now; switched on later (Cloudflare for SaaS when needed) |
| Messaging | Each bureau links its own WhatsApp number and Gmail |

## How data is kept apart
- **One PostgreSQL schema per bureau** (`t_sharma`, `t_matrimonial`, …) plus a `platform` schema for super-admin data.
- Every bureau has the same tables it has today, so all existing features keep working unchanged inside a bureau.
- A per-bureau backup is a dump of one schema plus that bureau's upload folder. Restoring one bureau can never touch another.
- The code stops importing a global `prisma`. Every page and action calls `await db()`, which picks the bureau's database from the request's host. A lint rule blocks the old import.
- Bureau database connections are capped and closed when idle. That is fine for about 30 active bureaus as is; Postgres can be raised for more.

## Request routing and login
- The middleware reads the host:
  - `bureau.sanbroz.com` → super admin console
  - a known bureau host → that bureau
  - anything else → 404 (never a default bureau)
  - it overwrites any tenant header the browser sends
- Reserved slugs: `bureau`, `admin`, `www`, `api`, `mail`, and your other existing sanbroz.com subdomains.
- **Login:**
  - the session token carries the bureau id and is checked against the host, so a cookie from one bureau is useless on another
  - the super admin has a separate login and cookie
  - login rate limits are counted per bureau
- **Suspended bureau:** staff see a "Service paused, contact support" page; their data is kept.
- **Links:** emails and password-reset links use the bureau's own domain.

## Super admin console (`bureau.sanbroz.com`)
1. **Bureaus:**
   - list: name, subdomain, status (active / trial / suspended), staff and profile counts, storage used, next due date
   - create a bureau: name, slug, owner name, email and password. This creates its schema, runs migrations, adds the default dropdown lists and makes the upload folder.
   - edit, suspend or resume a bureau
   - delete a bureau: a final backup is taken first, and you must type the slug to confirm
2. **Billing per bureau:**
   - plan name, fee, cycle (monthly/quarterly/yearly) and next due date
   - record payments (amount, mode, date, note), which move the due date forward
   - overdue list, with an optional automatic suspension after N days overdue
   - due-soon and overdue items appear in your daily email
3. **Domains:** each bureau's subdomain, plus custom domain records. Custom domains are saved as "pending" until switched on later.
4. **Backups:**
   - full-server backup (today's nightly encrypted backup)
   - per-bureau backup now, list, download and restore
5. **Updates:**
   - the app update and WhatsApp-library update and auto-update move here from the bureau owner's sidebar
   - the WhatsApp check after an update looks at all linked bureaus
6. **Platform email:** the Gmail account used for your billing and summary mails.

## Backups
- **Nightly:** the encrypted full backup as today, plus a separate backup file per bureau. Old files are pruned by the existing keep-days setting.
- **Bureau owner, in Settings → Backups:**
  - Back up now
  - see their backups
  - download one, protected with a password they type at download time (it can't use the platform passphrase)
  - restore one of their own server-held backups. A safety backup is taken first.
- **Restore safety:**
  - restores are only from server-held backups, never from an uploaded file, so a bad file can't reach other bureaus
  - the super admin can restore any bureau or the whole server
- **Where it runs:** backups run inside the backup container through a small token-protected service. The app never holds the backup passphrase.

## Services that change
- **Provisioner** (part of the updater service): creates a bureau schema, runs `migrate deploy` on every schema at each deploy, and seeds new bureaus.
- **WhatsApp service:** one session per bureau, each with its own login folder, linked from that bureau's Settings → WhatsApp. Tenant #1's existing login is moved over, so there is no re-link.
- **Scheduler:** daily summaries, reminders and auto-update now loop over the bureaus.
- **Files:** uploads go to `uploads/<bureau>/…`, and file links check the bureau.
- **Caddy:** accepts any host from the tunnel; the app decides who it is.

## Moving the live bureau (one-time)
1. Take a full backup.
2. Rename the current schema to `t_matrimonial`.
3. Create the `platform` schema.
4. Register tenant #1 with `matrimonial.sanbroz.com`.
5. Move its uploads and its WhatsApp login.
6. Create your super admin login.

This is rehearsed first on the local production copy (localhost:8080), including restoring a pre-move backup.

## What you'll need to do in Cloudflare (when we deploy)
- **DNS:** add `*.sanbroz.com` as a CNAME to the tunnel. Existing records such as `matrimonial` keep working.
- **Tunnel:** add a public hostname `*.sanbroz.com` → `http://localhost:8090`.

## Testing
- Two bureaus locally on `a.localhost:3000` and `b.localhost:3000`, plus `admin.localhost:3000`.
- Checks:
  - bureau A's cookie fails on B
  - data and files are invisible across bureaus
  - restoring A leaves B untouched
  - a suspended bureau is blocked
  - billing due dates move forward when payments are recorded
  - per-bureau WhatsApp status
- Existing unit tests, plus new tests for host resolution, slug rules and billing dates.
- The work is done on a `multitenant` branch and only pushed to the server once it's ready, because a push shows up as an update for the live owner.

## Build order
1. Platform schema, `db()` accessor, host routing, tenant-aware login and files.
2. Provisioner, super admin console, bureau create/suspend, billing.
3. Backup service and per-bureau backup/restore for the super admin and bureau owners.
4. Multi-session WhatsApp, the scheduler loop, and moving the updates to the super admin.
5. Migration script for the live bureau, rehearsal on the local copy, then deploy.
