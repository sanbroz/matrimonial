# Bureau CRM

Staff-only web tool for running an assisted matrimonial bureau (Punjab, all faiths, NRI). Families never log in. Staff
register clients, find matches and share biodata that shows only a profile code.

## Run it locally

You need Node.js 20+ and Docker Desktop.

```powershell
docker compose up -d        # starts PostgreSQL on port 5433
npm install
npx prisma migrate dev      # creates the tables (first time / after schema changes)
npm run db:seed             # owner login, default settings, dropdown lists
npm run dev                 # http://localhost:3000
```

The first owner login is `OWNER_EMAIL` / `OWNER_PASSWORD` in `.env`. After signing in, change your email and password
on your own card under Settings → Staff. `.env` is private and is not committed.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Unit tests (date/height/phone parsing, import column matching) |
| `npm run typecheck` | TypeScript check |
| `npm run db:studio` | Browse the database in a web UI |
| `npx prisma migrate reset` | **Wipes all data**, recreates tables and re-seeds (useful after testing) |

## What's built (phase 1–2)

- **Login & roles**: Owner (everything) and Staff (no settings, no permanent deletes). Every page and server action
  checks the session on the server; deactivated staff lose access immediately.
- **Leads**: phone/WhatsApp/walk-in enquiries, notes, follow-ups, one-click conversion to a profile (notes move across).
- **Profiles**: full Punjab/NRI field set (gotra ×3, Sikh status, manglik, visa status, second marriage, family, land),
  partner preferences, photos, kundli file, call/visit notes, follow-ups, duplicate-phone warning, permanent delete
  (owner, type the code to confirm).
- **Search**: by code, name, phone, city, plus religion, caste, age, marital status, country, education and flags.
- **Import**: Excel (.xlsx) or CSV → automatic column matching → preview with per-row problems → import. Dates are read
  day-first, and heights like `5'6"`, `5.6` or `168 cm` are understood. Rows whose phone number already exists are skipped.
- **Settings (owner)**: bureau name/logo/contacts, profile-code prefix and numbering, registration fee, default success
  fee, membership plans (price, duration, intro limit, per-plan success fee), biodata look & sections, staff accounts,
  and every dropdown list (castes, gotras, education, visa status…).

Photos and files are stored in `storage/uploads/` (outside `public/`) and are only served to signed-in staff.

## Phase 3: matching

- **Suggested matches** (profile → "Suggested matches"): opposite-gender active profiles, ranked 0–100 with reasons.
  - Ruled out: partner-preference must-haves (age, height, religion, excluded castes, marital status; preferred
    castes/countries optionally), checked **both ways** by default; the **gotra rule** (all recorded gotras, own
    gotra only, or off; only when both sides have gotras); anyone already shared with this family.
  - Score: age gap, height, same religion/caste, manglik compatibility, education/income vs. preference (by the
    order of those dropdown lists), diet, country, district/city, photo present.
  - Missing data never rules anyone out; it is flagged instead. The "Ruled out" list explains each exclusion.
- **Mark as shared**: records that a biodata was shown to a family and hides it from future suggestions. The
  profile page lists everything shared in both directions with a status (shared → interested → meeting → matched).
- **Matching rules** (Settings, owner): gotra rule, two-way check, strict castes/countries, include on-hold.
- **Saved searches** on the Profiles list, shared by all staff.
- `npm run db:seed-demo` adds 40 demo profiles (tagged "Demo data") to try it out.

## Phase 4: biodata & pipeline

- **Biodata** (profile → "Biodata"): branded A4 sheet in **English or Punjabi (Gurmukhi)**, styled by Settings →
  Biodata (colour, header line such as ੴ, sections, bureau contact). It shows the **profile code only**; the name,
  parents' names, phones, email, address, employer and native village are never included (enforced by a unit test).
  - Export in the browser: **Download image (JPG)** for WhatsApp, **Download PDF** (one A4 page), **Print**, and on
    phones **Share** (opens WhatsApp etc. with the image attached).
  - The Noto Sans Gurmukhi font is bundled, so Punjabi renders the same on every device and in exported images.
  - Opened from a suggestion ("Biodata" on a match card) it offers "Mark as shared"; otherwise type the receiving
    family's code to record the share.
- **Timeline**: each shared biodata on a profile expands to show every stage change with notes. Meeting scheduled
  stores the date and adds a follow-up for the next day; Declined stores the reason; Matched can mark both profiles
  as Matched.
- **Pipeline** page: all proposals by stage, with "Needs follow-up" for ones gone quiet (Shared/Interested 5 days,
  Met 7 days, meeting date passed). The dashboard shows these counts and this week's meetings.

## Phase 5: payments

- **Profile → Payments & membership**: start or renew a membership (price defaults to the plan, editable for
  discounts; optional payment now), charge the registration fee or any other amount, receive full or part
  payments, change a due's amount, waive (owner).
- Everything owed is a **due**; payments settle dues. A due's balance = amount − non-voided payments.
- **Success fee**: marking a proposal Matched adds a success-fee due for both families (membership's fee → plan's
  fee → bureau default). Amounts can be changed afterwards.
- **Receipts**: numbered (prefix in Settings), printable, amount in words (lakh/crore). Never deleted: the owner
  can **void** one with a reason (shown as VOID; the amount becomes due again). Receipts keep a snapshot of the
  payer, so they survive if a profile is deleted.
- **Payments page**: outstanding dues and memberships to renew (ending within 14 days / expired in the last 30) for
  all staff; **Collections** (owner): monthly totals by mode and type, receipt list, CSV download.
- Dashboard: outstanding dues, renewals, and this month's collection (owner).

## Phase 6: going live

See **[DEPLOY.md](DEPLOY.md)** for the step-by-step guide and **[UPDATE.md](UPDATE.md)** for releasing and
installing updates (in-app *Update* button or manual). In short: one Linux server in India running
Docker (`docker-compose.prod.yml`): Caddy (automatic HTTPS), the app, PostgreSQL (not exposed), and a backup
container that writes an **encrypted** backup (database + photos) every night, with optional off-site copies to
Cloudflare R2 / Backblaze B2. `ops/deploy.sh` installs and updates, `ops/backup-now.sh` backs up,
`ops/restore.sh` restores. Login is locked for 15 minutes after 5 wrong passwords per email (20 per address),
and `/api/health` is there for uptime monitoring.

## Email & WhatsApp (v1.1)

- **Email** through the bureau's Gmail (App Password, stored encrypted): biodata as PDF, receipts,
  *Forgot password* links (1 hour, single use; signs the account out elsewhere), and a **daily summary** to owners.
- **WhatsApp** through an internal Baileys container (`ops/whatsapp`), linked to a bureau number by QR code:
  biodata image, payment / renewal / meeting reminders and receipts. One message at a time, always previewed by staff.
- Message texts are editable in Settings → Message templates. Every message is logged on the profile.
- Setup steps: DEPLOY.md, "Email and WhatsApp".

## Later ideas

- Public self-registration app / website for families (the data model already allows it)
- WhatsApp Business API to send biodata directly from the app
- GST on receipts, refunds
- Automatic kundli (Guna Milan) scoring

## Code map

- `prisma/schema.prisma`: data model (includes tables for later phases)
- `src/lib/profile-fields.ts`: one definition of every profile field, used by the form, validation and import
- `src/lib/parse.ts`: lenient parsers (dates, heights, phones, gender, marital status), with tests
- `src/lib/matching.ts`: match rules and scoring (pure functions, with tests); `src/lib/services/matching.ts` loads data
- `src/lib/services/profiles.ts`: profile creation, code numbering, duplicate lookup
- `src/lib/storage.ts`: file storage (swap for S3/R2 when hosting)
- `src/lib/auth/*`: signed session cookie, `requireUser()` / `requireOwner()`
- `src/app/(staff)/*`: the staff screens
