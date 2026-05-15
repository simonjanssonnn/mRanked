# Deploying Math Ranked to Heroku

`mRanked` is wired for a single-dyno Heroku deploy: one Fastify process serves
both the `/api/*` endpoints, the Socket.IO gateway, and the built React client
from the same origin. No Vercel/Netlify split needed.

## Cost on the GitHub Student Pack

- **Basic dyno**: $7/month (no sleeping, no cold starts)
- **Heroku Postgres Mini**: $5/month
- **Total**: $12/month — covered by your $13/month Student credit

## One-time setup

```bash
# 1. Log in
heroku login

# 2. Create the app
heroku create math-ranked

# 3. Attach Postgres
heroku addons:create heroku-postgresql:mini

# 4. Switch from default Eco to Basic (no sleep)
heroku ps:type web=basic

# 5. Required config vars
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
# Keep devDependencies (tsc, prisma CLI) installed so build + release work.
heroku config:set NPM_CONFIG_PRODUCTION=false

# 6. First deploy
git push heroku main

# 7. Seed the database (one-time)
heroku run "cd server && npm run seed"

# 8. Open it
heroku open
```

That's it.

## What happens on every `git push heroku main`

1. Heroku detects Node, runs `npm install` at the repo root.
2. `heroku-postbuild` runs `npm run build` → installs `client/`, builds the
   React app to `client/dist/`, installs `server/`, compiles TypeScript to
   `server/dist/`, generates the Prisma client.
3. **Release phase** (`scripts/heroku-release.mjs`) runs
   `prisma migrate deploy` against your Heroku Postgres, normalising the URL
   to include `sslmode=require` first.
4. The web dyno starts: `node server/dist/index.js`.
5. Fastify reads `process.env.PORT` (Heroku sets this) and binds to `0.0.0.0`.

## Required env vars

| Name | Set by | Notes |
|------|--------|-------|
| `DATABASE_URL` | Postgres add-on | Auto-set. Don't override. |
| `JWT_SECRET` | you | Long random string. Rotate to force-logout everyone. |
| `NODE_ENV` | you | `production`. Toggles Fastify's CORS off and cookie `secure: true`. |
| `NPM_CONFIG_PRODUCTION` | you | `false`. Keeps `tsc` + `prisma` CLI available. |
| `PORT` | Heroku | Auto-set per dyno. Don't override. |

## Ongoing operations

```bash
# Tail live logs
heroku logs --tail

# Open a one-off shell
heroku run bash

# Run a manual migration (rarely — release phase does this automatically)
heroku run "cd server && npx prisma migrate deploy"

# Re-seed (wipes problem catalogue & re-imports — won't touch users/matches)
heroku run "cd server && npm run seed"

# psql into the database
heroku pg:psql

# Schedule daily backups (free with Mini)
heroku pg:backups:schedule DATABASE_URL --at "03:00 UTC"

# Manual backup
heroku pg:backups:capture

# Download latest backup
heroku pg:backups:download

# Rotate the session secret (logs everyone out)
heroku config:set JWT_SECRET=$(openssl rand -hex 32)

# Restart
heroku restart
```

## Heroku-specific code (in case you wonder where the magic is)

- `Procfile` — `web` and `release` commands.
- `app.json` — declarative app config for the Deploy button.
- `package.json` (root) — `heroku-postbuild` build orchestration + `engines`.
- `scripts/heroku-release.mjs` — Prisma migrations with SSL URL normalisation.
- `server/src/index.ts` — `trustProxy: true` so cookies work behind Heroku's
  router (it forwards `X-Forwarded-Proto: https` to a plain-HTTP dyno).
- `server/src/lib/db.ts` — appends `?sslmode=require` to `DATABASE_URL` at
  runtime if the URL doesn't already specify SSL.

## Troubleshooting

**`auth/me` returns 401 right after login.**
The browser dropped your cookie because Fastify thought the request was HTTP
without `trustProxy`. Already fixed in `server/src/index.ts`. Confirm
`NODE_ENV=production` is set.

**Socket.IO won't connect, falls back to polling forever.**
Heroku supports WebSockets natively on every plan — make sure your origin in
the browser is HTTPS, not HTTP, and that you only have one dyno (Socket.IO
needs sticky sessions across multiple dynos).

**`prisma migrate deploy` fails with `Error opening a TLS connection`.**
DATABASE_URL is missing `sslmode=require`. The release script appends it
automatically, but if you ran the CLI manually, prefix the command:
`DATABASE_URL="$(heroku config:get DATABASE_URL)?sslmode=require" npx prisma migrate deploy`.

**Build runs out of memory.**
Heroku's build slug has 2.5 GB available. The React build is small enough,
but if you ever add heavy build steps, set `NODE_OPTIONS=--max-old-space-size=2048`
as a config var.

**Row-count warning from Postgres Mini.**
Mini caps at 10 M rows. Your hot table is `EloHistory` — one row per player
per match. Add a cleanup job at year 3 that keeps only the last 200 per user.

## When you outgrow Heroku

Migration takes ~1 hour:

1. `heroku pg:backups:capture` → `heroku pg:backups:download`.
2. Spin up new infra (Railway / Fly.io / DigitalOcean + CapRover).
3. Import the dump (`pg_restore`).
4. Set the same env vars, push the same code.
5. Update DNS.

Nothing in the codebase is Heroku-locked.
