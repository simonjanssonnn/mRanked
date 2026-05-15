# Deploy Math Ranked to Replit (zero local install)

Everything below happens in a browser. You don't need Node, git, or anything installed on your machine.

## Step 1 — Get the code onto GitHub (10 min)

GitHub stores the project so Replit can clone it. The web UI works fine — no `git` install needed.

1. Sign up at https://github.com (if you don't have an account).
2. Top-right → **+** → **New repository**.
   - Name: `math-ranked`
   - Public or Private both work
   - **Don't** add a README/license (the project has one)
   - Click **Create repository**.
3. On the empty repo page, click **uploading an existing file**.
4. **Open `C:\Users\Simon\math-ranked` in File Explorer** and drag *the contents of the folder* (not the folder itself) into the GitHub browser window. It supports folders — drop the whole tree at once.
   - Make sure these get uploaded: `client/`, `server/`, `package.json`, `.replit`, `replit.nix`, `.gitignore`, `README.md`, `REPLIT_DEPLOY.md`.
   - The `.env` files are git-ignored, so they won't upload. That's fine — Replit will use Secrets instead.
5. Scroll down, write a short commit message ("initial scaffold"), click **Commit changes**.

You now have `https://github.com/YOUR_NAME/math-ranked`. Keep that tab open.

## Step 2 — Create the Repl from GitHub (3 min)

1. Sign up at https://replit.com (free tier is fine).
2. Top-right → **Create** → **Import from GitHub**.
3. Paste your repo URL. Click **Import**.
4. Replit clones the project. When it asks how to run, leave it as detected (it reads `.replit` automatically).

## Step 3 — Add your JWT secret (1 min)

The app signs login tokens with a secret. **Don't ship the default**.

1. In Replit, left sidebar → **Tools** → **Secrets** (a padlock icon).
2. Add a new secret:
   - Key: `JWT_SECRET`
   - Value: a long random string. Mash the keyboard, or paste a UUID. ~40 characters minimum.
3. Click **Add new secret**.

(You can also set `DATABASE_URL` to override the default SQLite path, but you don't need to.)

## Step 4 — Run it (first run takes 3–5 min)

1. Hit the big green **Run** button at the top.
2. Replit will:
   - install dependencies for `server/` and `client/`
   - create the SQLite database
   - seed problems
   - build the client (Vite production build)
   - start the server
3. Watch the console. You'll know it worked when you see `Math Ranked server up on http://0.0.0.0:...`
4. A preview pane appears with your live URL — something like `https://math-ranked.YOUR_NAME.repl.co`.

## Step 5 — Share + play

Open that URL in **two different browsers** (or one + one Incognito), register two accounts, click **Play**. Both should match against each other.

To share with friends, paste them the URL. They register, queue up, you play them live.

## When you change the code

Two ways:
- **Edit in Replit's web IDE.** Changes are saved instantly. Hit **Stop** then **Run** to restart.
- **Edit on GitHub web UI.** Then back in Replit, open the **Git** tab and **Pull** to get the new code.

## Going public (custom URL, always-on)

The free tier sleeps the Repl when nobody's visited for a while. First visitor wakes it (~30s cold start), and matchmaking breaks if no server is awake.

To fix:
- **Replit Deployments** ($5–7/month) — gives you a permanent URL like `math-ranked.replit.app`, never sleeps. From your Repl: **Deploy** button (top-right).
- **Custom domain** (any tier with Deployments) — point `mathranked.com` at it.

For early testing, the free tier is fine. Move to Deployments when you have actual users.

## Common issues

- **"Database error: relation does not exist"** — the first run didn't complete the `db push` step. Open the **Shell** in Replit and run `cd server && npx prisma db push && npm run seed`.
- **"Cannot find module" on first run** — installs got interrupted. Stop, then in the Shell: `npm run install:all`. Hit Run again.
- **Both browsers see "Finding opponent" forever** — both are in the same browser session, so they auth as the same user. Use two different browsers (or Incognito + regular).
- **Port already in use** — only happens if you ran a duplicate. Stop the Repl and start again.

## Cost summary

- GitHub: free
- Replit free tier: free, sleeps after inactivity, fine for testing
- Replit Deployments: ~$7/mo for always-on
- Custom domain (optional): ~$10–15/yr from any registrar

No costs unless you opt in to Deployments.
