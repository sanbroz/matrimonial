# Updating Bureau CRM

Production: **https://matrimonial.sanbroz.com**, server `sanbroz@192.168.2.149`, folder `~/projects/matrimonial`.

A release goes through two steps:

1. **Send the new code to the server** (from the development PC): `git push prod main`.
   This only copies the code; the running app is not touched.
2. **Install it**: either with the **Update** button in the app (owner only) or manually on the server.
   Both take a backup first, rebuild, apply database changes and restart (about a minute of downtime at the end).

The version (e.g. `v1.0.0 · 5182db3`) is shown at the bottom of the left menu, under *Sign out*.

---

## A. Releasing from the development PC

```bash
# 1. Raise the version number for a noticeable release (optional for small fixes)
npm version patch --no-git-tag-version      # 1.0.0 → 1.0.1   (minor: new features, major: big changes)

# 2. Commit
git add -A && git commit -m "Short description of what changed"

# 3. Push to GitHub (history) and to the server (release)
git push origin main
git push prod main
```

The commit messages are what the owner sees under *What's new* in the update dialog, so write them for people.

## B. Installing from the app (recommended)

1. Sign in to the **super admin console** (`bureau.<domain>`; since v2 bureau owners only see the version). Within 15 minutes (or after a page reload) **"Update available: vX.Y.Z"**
   appears under *Sign out*.
2. Click it to see what's new, then **Back up & update now**.
3. Keep the page open. It shows progress and reloads by itself when the new version is running.
4. Check the version under *Sign out*.

If it reports **Update failed**, the log is shown in the dialog; use the manual steps below to see the full output.

## C. Installing manually on the server

```bash
ssh sanbroz@192.168.2.149
cd ~/projects/matrimonial

git log --oneline -5          # the newest line is the code that will be installed
./ops/backup-now.sh           # 1. safety backup (lists the backups at the end)
./ops/deploy.sh               # 2. build, migrate, restart; ends with "App is healthy (commit …)"
```

Check: open https://matrimonial.sanbroz.com. The version under *Sign out* shows the new commit.

## D. If something goes wrong

**The app doesn't come back after an update**

```bash
cd ~/projects/matrimonial
DC="docker compose --env-file .env.production -f docker-compose.prod.yml"
$DC ps                              # what is running
$DC logs --tail 100 app             # why the app fails
```

**Go back to the previous version** (code only; the database stays as it is):

```bash
git log --oneline -10               # find the commit that worked
git checkout <commit> -- .          # put that version's files in place
./ops/deploy.sh
git checkout main -- .              # afterwards, return the files to the latest version
```

If a database change was the problem, restore the backup taken just before the update instead.
This replaces **all** data with that moment's copy, so anything entered since is lost:

```bash
./ops/backup-now.sh                 # lists backups; pick the one from just before the update
./ops/restore.sh backup_YYYY-MM-DD_HHMM.tar.enc
```

`ops/restore.sh` restores the **whole server**: every bureau and the platform, in one step that either completes
or changes nothing. A backup from before v2 (single bureau) works too: the bureau is moved into
`FIRST_TENANT_SLUG` again on the way back up. To restore **one** bureau only, use the console (Bureaus → bureau →
Backups) or that bureau's Settings → Backups.

**Going back from v2 to v1.2.1 completely** (only if v2 can't be fixed forward). v1.2.1 reads its data from
schema `public` and its WhatsApp login from `/data/auth`:

```bash
git checkout d6220dc -- . && ./ops/deploy.sh                    # the v1.2.1 code (and its restore script)
./ops/restore.sh backup_YYYY-MM-DD_HHMM.tar.enc                 # the full backup taken just before v2
docker run --rm -v bureau-crm_whatsapp_auth:/data alpine sh -c 'mv /data/sessions/matrimonial /data/auth'
docker compose --env-file .env.production -f docker-compose.prod.yml restart whatsapp
```

The v2 schemas (`platform`, `t_*`) stay in the database unused. Before moving to v2 again, remove them
(`DROP SCHEMA platform, t_matrimonial CASCADE;`) so the move runs fresh.

## WhatsApp library (Baileys) updates

WhatsApp changes its app regularly. New releases of the Baileys library keep the connection working. This is
separate from app releases:

- The WhatsApp container checks npm every 6 hours. When a newer release exists the super admin sees
  **"WhatsApp update: x"** under *Sign out* in the console.
- **Console → Updates → Update to x** installs it: only the WhatsApp container is rebuilt and restarted
  (a few minutes without WhatsApp). Every bureau's linked number stays linked.
- **Safety:** after installing, the updater waits up to 3 minutes for every bureau that was connected to reconnect. If it doesn't (or the
  install fails), the previous version is restored automatically and the reason is shown.
  **Roll back to …** returns to the previous version by hand.
- **Automatic updates** (off by default): tick *Install new versions automatically* and choose an hour. At most one
  try per day; a version that failed isn't tried automatically again. Super admins get an email with the result (platform email in console Settings).
- The chosen version is stored in `.env.production` (`BAILEYS_VERSION`, `BAILEYS_PREVIOUS_VERSION`), not in the
  code, so `git push prod main` keeps working. An app release that ships a newer Baileys always wins over an
  older stored version.

## E. Good to know

- **Back up before updating**: both update methods do this automatically.
- **Update when nobody is working**: the last minute of an update restarts the app.
- **Settings and data are kept**: updates never touch `.env.production`, the database, photos or backups
  (only the restore command replaces data).
- **The updater** (`bureau-crm-updater` container) can only run `ops/backup-now.sh` and `ops/deploy.sh`.
  It has no open port and every request needs `UPDATER_TOKEN` from `.env.production`. It uses the Docker
  socket to rebuild the other containers. To turn in-app updates off: `docker stop bureau-crm-updater-1`
  (the menu then shows only the version); `./ops/deploy.sh` starts it again.
- **Changing `.env.production`** (e.g. off-site backups): edit it, then run `./ops/deploy.sh`.
