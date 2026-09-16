# Deployment Guide: BrewPoint on a VPS

This is a teaching document, not just a checklist. `TODO.md` Part 4 tracks *what* to check off; this document explains *why* each piece exists and *how* it actually works, so that by the end you understand the deployment, not just completed it. Read it in order — each phase assumes the previous one is done and working.

**Audience:** you already know how to build the app; you're new to Docker, Linux servers, and CI/CD. Every step explains the concept behind it, not just the command.

---

## Why not just use Vercel?

Vercel (or Railway, Fly.io, etc.) would run all of this *for* you — build, TLS, zero-downtime deploys, all invisible. That's great for shipping fast, and bad for learning, because none of the mechanics are visible when something breaks. Self-hosting on a VPS means every layer below is something **you** set up, which is also every layer you can now actually debug. That trade — more setup work, but real understanding — is the whole point of doing it this way.

---

## Architecture at a glance

Once everything in this guide is done, one small VPS runs three things side by side, each in its own Docker container, talking to each other over a private Docker network:

```
                        Internet
                            │
                     (ports 80, 443)
                            │
                            ▼
                     ┌─────────────┐
                     │    Caddy    │   reverse proxy + automatic HTTPS
                     │ (container) │
                     └──────┬──────┘
                            │ plain HTTP, internal Docker network
                            ▼
                     ┌─────────────┐
                     │  Next.js    │   the BrewPoint app itself
                     │ "app"       │   (Route Handlers + rendered pages)
                     │ (container) │
                     └──────┬──────┘
                            │ Postgres wire protocol, internal Docker network
                            ▼
                     ┌─────────────┐
                     │  Postgres   │
                     │  "db"       │
                     │ (container) │
                     └─────────────┘
```

Only Caddy is reachable from the outside world (ports 80/443). The app and database are only reachable from *inside* the Docker network — nobody on the internet can hit port 5432 or the app's raw port 3000 directly, even if they tried. This is a real security property, not a formality: a misconfigured app-level auth check is a much smaller problem if the database is unreachable from outside in the first place.

A fourth piece, GitHub Actions, isn't a container — it's a workflow that runs *outside* the VPS (on GitHub's servers) every time you push to `main`, and its last step SSHs into the VPS to redeploy.

---

## Prerequisites

- A VPS running Ubuntu 22.04 or 24.04 LTS. Any provider works — DigitalOcean, Hetzner, AWS Lightsail, Contabo, etc. Nothing below is provider-specific past the initial signup/provisioning screen. 1 vCPU / 1-2GB RAM is enough for BrewPoint's scale.
- A domain name, with access to its DNS settings.
- The BrewPoint repo, pushed to GitHub.
- Your own machine has `ssh` available (macOS/Linux have it built in).

---

## Phase 1 — Provision & Harden the VPS

**Concept:** a fresh VPS is a bare Ubuntu machine with nothing installed and, by default, a `root` user reachable by password over SSH from anywhere on the internet. Every step in this phase closes a door that's open by default.

### 1.1 First login

Your VPS provider gives you an IP address and a root password (or lets you upload an SSH key at creation — if so, skip straight to using it). First connection:

```bash
ssh root@YOUR_VPS_IP
```

### 1.2 Create a non-root user

Never operate as `root` day-to-day — one typo in a `root`-run command has no safety net. Create a user with `sudo` privileges instead:

```bash
adduser brewpoint          # will prompt for a password — set a strong one
usermod -aG sudo brewpoint # grant sudo (administrator) rights
```

### 1.3 Set up SSH key authentication, then disable passwords entirely

From **your own machine** (not the server), if you don't already have an SSH key pair:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Copy your public key to the server:

```bash
ssh-copy-id brewpoint@YOUR_VPS_IP
```

Confirm you can log in with the key (`ssh brewpoint@YOUR_VPS_IP` should no longer ask for a password). Once confirmed, edit the SSH server config on the VPS to lock things down:

```bash
sudo nano /etc/ssh/sshd_config
```

Set (or uncomment and change) these lines:

```
PermitRootLogin no
PasswordAuthentication no
```

Then restart SSH: `sudo systemctl restart sshd`.

**Why this matters:** a freshly provisioned VPS gets scanned and password-guessed by automated bots within minutes of being reachable on the internet — this isn't a hypothetical. Key-only auth makes that entire class of attack (password brute-forcing) impossible regardless of how weak a guessed password might have been.

### 1.4 Firewall

Allow only the ports actually needed — SSH, and the two ports Caddy will use later:

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (also needed for Let's Encrypt's certificate verification)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 1.5 Install Docker

Use Docker's official convenience script, not Ubuntu's own outdated `apt` package for Docker:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker brewpoint   # lets you run docker without sudo — log out & back in after this
```

Verify: `docker --version` and `docker compose version` should both print something.

**Checkpoint for Phase 1:** you can `ssh brewpoint@yourdomain-or-ip` using only your key, `sudo ufw status` shows only 22/80/443 open, and `docker run hello-world` succeeds.

---

## Phase 2 — Get the App Running on the Server (HTTP only, for now)

**Concept:** we deliberately get the app running over plain HTTP on the server *before* adding HTTPS, so that if something breaks, you know it's either "the app" or "the proxy," never both tangled together.

### 2.1 Clone the repo and set up secrets

```bash
git clone https://github.com/YOUR_USERNAME/brewpoint.git
cd brewpoint
```

Create a production `.env` **on the server** (never commit this file — it should already be gitignored):

```bash
DATABASE_URL=postgresql://brewpoint:REPLACE_WITH_A_REAL_RANDOM_PASSWORD@db:5432/brewpoint_db
JWT_SECRET=REPLACE_WITH_A_REAL_RANDOM_SECRET
JWT_EXPIRY_HOURS=8
DB_PASSWORD=REPLACE_WITH_A_REAL_RANDOM_PASSWORD
```

Generate real random values instead of the placeholders (e.g. `openssl rand -base64 32`). **Do not reuse the password from your local `docker-compose.yml`** (`123456990`) — that one is fine for a throwaway local container, not for anything reachable from the internet.

Note the hostname in `DATABASE_URL`: it's `db`, not `localhost`. Inside a Docker network, containers reach each other by **service name**, not `localhost` — `localhost` inside the `app` container would mean "the app container itself," which has no Postgres running in it.

### 2.2 Make Next.js build a Docker-friendly output

By default, `next build` produces an app that expects the *entire* `node_modules` tree at runtime — often hundreds of megabytes, most of it dev-only tooling you'll never need in production. Add this to `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
};
```

This makes `next build` also emit a `.next/standalone/` folder — a minimal, self-contained server (just the files actually needed, with only production dependencies traced in) that you can run with a single `node server.js`, no `npm install` step required at runtime at all.

### 2.3 The Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
# ---- deps: install dependencies only ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the app ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runtime: the actual image that ships ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

**Why three stages, not one:** `deps` and `build` both need dev dependencies (TypeScript, ESLint, build tooling) and the full source tree — none of that should exist in what actually ships. `runtime` copies over *only* the standalone output from `build`, so the final image is a fraction of the size and has a much smaller attack surface (no compilers, no source maps of your source code, no build tools sitting in production).

### 2.4 Extend `docker-compose.yml`

Your current `docker-compose.yml` only runs `db`. Extend it to also build and run the app, wired to read the secrets from `.env`:

```yaml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: brewpoint
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: brewpoint_db
    volumes:
      - brewpoint_data:/var/lib/postgresql/data
    # no "ports:" here anymore — the db doesn't need to be reachable
    # from outside the Docker network at all, only from "app"

  app:
    build: .
    restart: unless-stopped
    depends_on:
      - db
    env_file:
      - .env
    expose:
      - "3000"   # reachable from other containers (Caddy), not from the internet

volumes:
  brewpoint_data:
```

Two changes worth noticing versus the dev version: `db` no longer publishes `5432` to the host at all (nothing outside Docker needs to reach it directly), and the password now comes from `${DB_PASSWORD}` in `.env` instead of being hardcoded in a file that's checked into git.

### 2.5 `.dockerignore`

Create `.dockerignore` so the build doesn't waste time/space copying things it doesn't need:

```
node_modules
.next
.git
.env*
tests
test-results
playwright-report
```

### 2.6 Build & run

```bash
docker compose up -d --build
```

`-d` runs it in the background; `--build` forces Docker to (re)build the `app` image from your `Dockerfile` rather than reusing a stale one.

### 2.7 Run migrations & seed the database

The database container starts empty — no tables exist yet. Run your existing migration/seed scripts, but targeting this container:

```bash
docker compose exec app npx drizzle-kit migrate
docker compose exec app npm run db:seed
```

`docker compose exec app <command>` runs `<command>` *inside* the already-running `app` container — this is how you run one-off commands against a containerized app instead of SSHing in separately.

### 2.8 Verify

```bash
curl http://localhost:3000/api/v1/products
```

You should get back a `401` (unauthenticated) JSON response — proof the app is actually running and answering, not a connection error. From your own machine, `curl http://YOUR_VPS_IP:3000` will currently fail — and that's correct, since `expose` (not `ports`) deliberately keeps port 3000 internal to Docker. Phase 3 is what makes the app reachable from outside, through Caddy instead of directly.

**Checkpoint for Phase 2:** `docker compose ps` shows both `db` and `app` as `Up`, and the `curl` above returns a `401` JSON body, not a connection error.

---

## Phase 3 — Expose It with HTTPS

**Concept:** a reverse proxy sits between the internet and your app. It's the only thing with a public-facing port; it terminates HTTPS (decrypts incoming traffic, so browsers see a valid certificate) and forwards plain HTTP to the app container internally.

### 3.1 Point your domain at the server

In your domain registrar's DNS settings, add an **A record**:

```
Type: A
Name: @ (or a subdomain like "app")
Value: YOUR_VPS_IP
```

DNS changes can take anywhere from a few minutes to a few hours to propagate. You can check with `dig yourdomain.com` or `nslookup yourdomain.com` — once it resolves to your VPS IP, move on.

### 3.2 Reverse proxy with Caddy

**Why Caddy over nginx for this first deployment:** nginx is more common in job listings, but getting HTTPS working with nginx means also installing `certbot`, running it to issue a certificate, and setting up a cron job to renew it before it expires — three extra moving parts. Caddy does all of that automatically from a config file a few lines long. For a *first* reverse proxy, understanding what a reverse proxy actually does matters more than which specific one — Caddy gets you there without fighting certificate renewal at the same time. (nginx is worth learning later, once this concept is solid.)

Create `Caddyfile` in the project root:

```
yourdomain.com {
    reverse_proxy app:3000
}
```

That's the entire config. Add a `caddy` service to `docker-compose.yml`:

```yaml
  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    depends_on:
      - app
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddyfile
      - caddy_data:/data
      - caddy_config:/config
    command: caddy run --config /etc/caddyfile
```

And add `caddy_data`/`caddy_config` to the `volumes:` block at the bottom (alongside `brewpoint_data`) — these persist Caddy's issued certificates across container restarts, so it doesn't re-request a new one from Let's Encrypt every time you redeploy.

Bring it up:

```bash
docker compose up -d --build
```

### 3.3 Verify HTTPS

Open `https://yourdomain.com` in a browser. Caddy requests and installs a Let's Encrypt certificate automatically on first request — this can take a few seconds the very first time. You should see BrewPoint's login page over a valid HTTPS connection (padlock icon, no warnings).

**Checkpoint for Phase 3:** `https://yourdomain.com` loads BrewPoint with a valid certificate, and `http://yourdomain.com` (no `s`) redirects to HTTPS automatically — Caddy does this redirect by default, no extra config needed.

---

## Phase 4 — CI/CD with GitHub Actions

**Concept:** this replaces the manual `git pull && docker compose up -d --build` you'd otherwise run by hand on every change. On every push to `main`, GitHub runs your checks, and only if they pass, logs into your VPS and redeploys — automatically, with no manual server access needed for routine updates.

### 4.1 Generate a dedicated deploy key

Don't reuse your personal SSH key for this. Generate one specifically for GitHub Actions to use:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/brewpoint_deploy_key -N ""
```

Add the **public** key to the VPS's authorized keys (as the `brewpoint` user):

```bash
cat ~/.ssh/brewpoint_deploy_key.pub | ssh brewpoint@YOUR_VPS_IP "cat >> ~/.ssh/authorized_keys"
```

### 4.2 Add GitHub Actions secrets

In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Add three:

| Secret name | Value |
|---|---|
| `VPS_HOST` | your VPS's IP or domain |
| `VPS_USER` | `brewpoint` |
| `VPS_SSH_KEY` | the **private** key content (`cat ~/.ssh/brewpoint_deploy_key`) |

Never put these values directly in the workflow file — secrets are the only place they belong.

### 4.3 The workflow file

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd ~/brewpoint
            git pull
            docker compose up -d --build
```

**Why two jobs, not one:** `deploy` declares `needs: test` — if any step in `test` fails (a type error, a lint violation, a broken build), the `deploy` job never runs at all. This is the actual mechanism behind "a broken commit can't reach production" — it's not a suggestion or a manual step someone might skip, it's structurally impossible for the workflow to proceed past a failed check.

### 4.4 Test it for real

Make a trivial, visible change (a copy tweak is fine), commit, and push to `main`. Watch it run under your repo's **Actions** tab on GitHub. Once it goes green, refresh `https://yourdomain.com` and confirm the change is live — without you having touched the VPS by hand.

### 4.5 What's next: registry-based deploys (a good v2, not needed now)

The pipeline above rebuilds the Docker image *on the VPS itself* every deploy — simple to understand, but it means the VPS needs enough CPU/memory to run a build, and every deploy pays the full build time. The more advanced version builds the image *in* GitHub Actions, pushes it to a registry (GitHub Container Registry, GHCR, is free and needs no extra account), and has the VPS just `docker pull` a ready-made image and restart — faster deploys, and the VPS never needs build tools at all. Worth doing once the simpler version above is fully understood — skipping straight to it means debugging registry authentication and the deploy mechanics at the same time, which is harder to learn from.

**Checkpoint for Phase 4:** pushing to `main` visibly runs both jobs in the Actions tab, and a failing `tsc`/lint/build check actually blocks the deploy job from running (try breaking something on purpose once, just to see it block).

---

## Phase 5 — Things That Matter Once You're Live

These aren't in `TODO.md` Part 4 as required checkboxes, but they're the difference between "it's deployed" and "it's operated responsibly." Worth doing before treating this as more than a demo.

### 5.1 Back up the database

A single VPS with no backup means one bad `docker volume rm` or a dead disk erases every transaction BrewPoint has ever recorded. A simple daily cron job is enough for this scale:

```bash
# crontab -e, as the brewpoint user
0 3 * * * docker compose -f ~/brewpoint/docker-compose.yml exec -T db pg_dump -U brewpoint brewpoint_db > ~/backups/brewpoint_$(date +\%F).sql
```

Periodically copy `~/backups/` somewhere off the VPS too (e.g. `scp` to your own machine, or a cheap object storage bucket) — a backup that lives only on the same disk as the thing it's backing up doesn't protect against disk failure.

### 5.2 Logs & basic monitoring

`docker compose logs -f app` tails the app's logs live — your first stop when something's misbehaving. For anything beyond ad-hoc debugging, `docker compose logs` output isn't persisted anywhere once a container is removed; that's a real gap this guide doesn't close (structured logging + a log shipper is `ROADMAP.md` v1.3 territory, not v1.0).

### 5.3 Zero-downtime deploys — an honest limitation

`docker compose up -d --build` stops the old `app` container and starts the new one — there's a brief window (typically a few seconds) where requests fail while the swap happens. For BrewPoint's scale (a single coffee shop counter) this is a non-issue in practice, but it's worth knowing this setup is **not** zero-downtime, and why: a true zero-downtime setup needs either multiple app replicas with a load balancer draining traffic from the old one before it stops, or a blue-green deploy — both meaningfully more infrastructure than this guide covers. Good to know as a limitation, not worth solving prematurely.

### 5.4 Rotate secrets if they're ever exposed

If `.env` or your SSH deploy key is ever accidentally committed, pasted somewhere, or otherwise exposed, treat it as compromised immediately: generate a new `JWT_SECRET` (this invalidates all existing login sessions — expected and correct), a new `DB_PASSWORD` (update both `.env` and restart `db`), and a new SSH key pair (remove the old public key from `authorized_keys`).

---

## Troubleshooting Cheat Sheet

| Symptom | Likely cause |
|---|---|
| `docker compose up` fails with a port conflict | Something else on the VPS is already using port 80/443/5432 — check with `sudo lsof -i :PORT` |
| App container can't reach the database | Check `DATABASE_URL` uses `db` as the hostname, not `localhost` — `localhost` inside a container means the container itself |
| `https://yourdomain.com` doesn't load, but `curl localhost:3000` on the VPS works | DNS hasn't propagated yet, or the A record points at the wrong IP — check with `dig yourdomain.com` |
| Caddy won't get a certificate | Port 80 must be reachable from the internet for Let's Encrypt's verification — check `sudo ufw status` and that nothing else is bound to port 80 |
| GitHub Actions deploy step fails with a permission/auth error | The public key half of the deploy key pair wasn't actually added to the VPS's `authorized_keys`, or the wrong user/host secret was used |
| A push to `main` deployed even though `tsc` should have failed | Check the workflow's `deploy` job actually has `needs: test` — without it, the jobs run independently regardless of outcome |

---

## Glossary (for when a term above is unfamiliar)

- **VPS (Virtual Private Server):** a slice of a physical server rented as your own isolated machine — you get root access and install everything yourself, unlike a PaaS (Vercel, Railway) which manages the OS/runtime for you.
- **Container vs. VM:** a container shares the host machine's OS kernel and only packages the app + its dependencies (fast to start, small); a VM virtualizes an entire separate OS (heavier). Docker containers are not VMs.
- **Reverse proxy:** a server that sits in front of your actual application, forwarding incoming requests to it — used here for HTTPS termination and to keep the app's raw port off the public internet.
- **Docker network:** by default, `docker compose` puts all services defined in one `docker-compose.yml` on a shared private network, where each is reachable by the others using its service name as a hostname.
- **CI (Continuous Integration):** automatically running checks (tests, linting, build) on every code change, so problems are caught immediately rather than discovered later.
- **CD (Continuous Deployment):** automatically shipping a change to production once it passes CI, with no manual deploy step.
- **Let's Encrypt:** a free, automated certificate authority that issues the TLS certificates HTTPS depends on — Caddy talks to it automatically, which is most of why Caddy needs so little config here.
