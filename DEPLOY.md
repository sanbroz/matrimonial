# Going live: Bureau CRM on a cloud server

This puts the CRM on the internet at your own address (e.g. `https://crm.yourbureau.in`), with HTTPS,
nightly encrypted backups, and simple update/restore commands. Plan about an hour the first time.

Everything runs in Docker on one small server:

| Container | What it does |
|---|---|
| `caddy` | Web server. Gets and renews the free HTTPS certificate automatically |
| `app` | The CRM |
| `db` | PostgreSQL database. Not reachable from the internet |
| `backup` | Encrypted backup of database + photos every night |

---

## 1. What you need

1. **A Linux server (VPS) in India.** Ubuntu 24.04, **2 GB RAM minimum (4 GB better), 2 vCPU, 50 GB+ disk**.
   Any provider with a Mumbai/Bangalore/Delhi region works, e.g. DigitalOcean (Bangalore), AWS Lightsail
   (Mumbai), Linode/Akamai (Mumbai), Hostinger VPS (India). Roughly ₹600–1,500 per month. Check current prices.
   Keeping data in India is simplest under the DPDP Act.
2. **A domain**, e.g. `yourbureau.in` (~₹500–1,000/year), from any registrar. You'll use a sub-domain like `crm.`.
3. **(Recommended) Off-site backup storage.** Cloudflare R2 or Backblaze B2. The free tiers are enough for years
   of backups. If the server is lost, these copies are what you restore from.
4. A password manager to store the secrets you generate below.

## 2. Prepare the server

Connect with SSH (your provider shows the command, e.g. `ssh root@203.0.113.10`), then:

```bash
# Updates + firewall: only SSH and web traffic allowed
apt update && apt -y upgrade
apt -y install ufw git unattended-upgrades
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Docker (official install script)
curl -fsSL https://get.docker.com | sh
```

Use SSH keys rather than a root password if your provider offers it.

## 3. Get the code onto the server

The code is in a **private** GitHub repository, so give the server a read-only **deploy key**:

```bash
ssh-keygen -t ed25519 -C "crm-server" -f ~/.ssh/github_deploy -N ""
cat ~/.ssh/github_deploy.pub      # copy this line
```

On GitHub: repository → **Settings → Deploy keys → Add deploy key**, paste it, leave
"Allow write access" **unticked**. Then on the server:

```bash
cat >> ~/.ssh/config <<'EOF'
Host github.com
  IdentityFile ~/.ssh/github_deploy
EOF
git clone git@github.com:sanbroz/matrimonial.git /opt/bureau-crm
cd /opt/bureau-crm
```

`git pull` for updates then works without any password.

(Or copy the project folder with `scp`/WinSCP, leaving out `node_modules`, `.next`, `storage` and `.env*`.)

## 4. Configure

```bash
cp .env.production.example .env.production
openssl rand -hex 24   # → POSTGRES_PASSWORD
openssl rand -hex 32   # → AUTH_SECRET
openssl rand -hex 24   # → BACKUP_PASSPHRASE
nano .env.production
```

Fill in `SITE_ADDRESS` (e.g. `crm.yourbureau.in`), the three secrets, and `OWNER_EMAIL` / `OWNER_PASSWORD`.

> **Save `BACKUP_PASSPHRASE` in your password manager now.** Backups are encrypted with it. Without it they
> cannot be restored, not even by us.

## 5. Point the domain at the server

At your domain registrar (or Cloudflare DNS) add an **A record**: name `crm`, value = the server's IP address.
If you use Cloudflare, set it to **DNS only** (grey cloud) so Caddy can get the certificate.
Check with `ping crm.yourbureau.in`. It should show the server's IP (can take a few minutes).

## 6. Start it

```bash
chmod +x ops/*.sh
./ops/deploy.sh
```

This builds everything, creates the database tables and your owner account, and starts the containers.
Open `https://crm.yourbureau.in`, sign in, then go to **Settings → Staff** to change your password and add staff.
Then fill in **Settings** (bureau details, logo, plans, fees) before using it for real.

To bring existing records: use **Import** (Excel/CSV) in the app.

## 7. Backups

- Every night at `BACKUP_TIME` (default 02:30 India time) one encrypted file is written:
  database + all photos/kundli files. The last `BACKUP_KEEP_DAYS` (14) days are kept on the server.
- Take one now / list them: `./ops/backup-now.sh`
- **Off-site copies** (strongly recommended). With Cloudflare R2:
  1. Cloudflare dashboard → R2 → create bucket `bureau-backups`.
  2. R2 → Manage API tokens → create a token with *Object Read & Write* on that bucket.
  3. In `.env.production` set `BACKUP_REMOTE=offsite:bureau-backups`, the access key, secret key and the
     endpoint `https://<account-id>.r2.cloudflarestorage.com`.
  4. `./ops/deploy.sh`, then `./ops/backup-now.sh`. The log should end with "copied to offsite:bureau-backups".
  For Backblaze B2 set `RCLONE_CONFIG_OFFSITE_PROVIDER=Other` and the B2 S3 endpoint.
- **Test a restore every few months.** A backup you have never restored is only a hope.

### Restore

```bash
./ops/backup-now.sh                                   # lists backups
./ops/restore.sh backup_2026-11-22_0230.tar.enc       # asks you to type RESTORE
```

This stops the app, replaces the database and files with the backup, and starts the app again.
For a file from off-site storage, download it and copy it in first:
`docker compose --env-file .env.production -f docker-compose.prod.yml cp backup_....tar.enc backup:/backups/`

**Whole server lost?** Set up a new server (steps 2–6 with the same `BACKUP_PASSPHRASE`), copy the latest
off-site backup in, and run the restore.

## 8. Updating to a new version

```bash
cd /opt/bureau-crm
./ops/backup-now.sh        # safety copy first
git pull
./ops/deploy.sh            # rebuilds, applies database changes, restarts (about a minute of downtime)
```

## 9. Keeping an eye on it

- **Uptime alert:** a free monitor such as UptimeRobot on `https://crm.yourbureau.in/api/health`
  (returns `{"ok":true}` when the app and database are fine). Get an SMS/email if it goes down.
- **Logs:** `docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail 100 app`
  (use `backup` or `caddy` instead of `app` for those).
- **Disk space:** `df -h`. Photos and backups grow over time.

## 10. Security checklist

- [ ] Owner password changed from the one in `.env.production`; every staff member has their own account
- [ ] Staff who leave: **Settings → Staff → Deactivate** (takes effect immediately)
- [ ] SSH with keys; firewall only allows 22/80/443 (step 2)
- [ ] `BACKUP_PASSPHRASE` stored off the server; off-site backups configured and a restore tested
- [ ] `.env.production` never shared or committed to git

Built in: HTTPS with HSTS, database not exposed to the internet, login lockout after 5 wrong passwords per
email (20 per network address) for 15 minutes, private photo/file access only after sign-in, security headers,
and search engines told not to index the site.

## Trying the production setup on your own computer

`ops/deploy.sh` also works locally (Git Bash on Windows) with a test `.env.production` containing
`SITE_ADDRESS=:80` and `HTTP_PORT=8080`. The app is then at http://localhost:8080. This is how the setup
was tested before release.
