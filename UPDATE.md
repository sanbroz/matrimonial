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

1. Sign in as the **owner**. Within 15 minutes (or after a page reload) **"Update available: vX.Y.Z"**
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
