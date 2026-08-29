# The Moonwell Anglers (`thetavern`)

Repo: [github.com/goldennftplatform-svg/thetavern](https://github.com/goldennftplatform-svg/thetavern)

**Live (GitHub Pages):** [Play](https://goldennftplatform-svg.github.io/thetavern/) · [Dashboard / Great Table](https://goldennftplatform-svg.github.io/thetavern/bigboard.html) · [Wall mode](https://goldennftplatform-svg.github.io/thetavern/bigboard.html?wall=1)

Vite + TypeScript client, Express + Socket.IO trail server, Vercel-ready static output. Fantasy tavern ritual centered on the **Moonwell** fishing loop; **Demplar** appears in lore, notices, and an optional charter modal ([Demplar on X](https://x.com/DemplarOfficial)).

## No login for players (Vercel wall?)

- **This game has no accounts.** If someone hits a **“Log in to Vercel”** (or SSO) screen, that is **Vercel Deployment Protection** on your project — not this repo’s code.
- **Fix (Vercel):** Project → **Settings → Deployment Protection** — turn off **Vercel Authentication** (and similar) for **Production** (and Previews if you want public previews). On **Hobby**, production is usually public by default; protected **Preview** URLs often look like `*.vercel.app` with auth.
- **Avoid Vercel entirely for the static site:** enable **GitHub Pages** (workflow below). Visitors only need the GitHub Pages URL — **no Vercel account**.

### GitHub Pages (public, no Vercel)

1. Repo → **Settings → Pages** → **Build and deployment**: source **GitHub Actions**.  
2. Push `main`; workflow **Deploy to GitHub Pages** builds `dist/` and publishes it.  
3. Site: `https://<org>.github.io/<repo>/` (e.g. `https://goldennftplatform-svg.github.io/thetavern/`).  
4. Forks: workflow sets `GITHUB_PAGES_BASE` from the repo name automatically; `vite` uses it so assets resolve under the subpath.

Trail server (Socket.IO) is still separate — use your tunnel URL + `TRAIL_CORS_ORIGIN` including the `github.io` origin if you use Pages. **Public builds ship an empty `trail.json`** so visitors never get localhost prompts; local `npm run live` auto-uses `127.0.0.1:3847` when you’re on localhost.

## GitHub (first push)

```bash
git init
git add .
git commit -m "Initial commit: Moonwell client + trail server + bigboard"
git branch -M main
git remote add origin https://github.com/goldennftplatform-svg/thetavern.git
git push -u origin main
```

If the remote already has commits, use `git pull origin main --rebase` before pushing.

## MEdiaFiles → daily fishing decks

- Drop images in **`MEdiaFiles/`** (root or subfolders). See **`MEdiaFiles/README.md`** for layer names (`banner`, `crest`, `sky`, `deck`).
- **`npm run media:scan`** copies assets to **`public/media/`** and writes **`manifest.json`**. Runs automatically as **`prebuild`** before **`npm run build`**.
- The game picks a platform by **UTC date** so the same “deck” shows for everyone that day; add more folders for rotation variety.

## Scripts

- `npm run media:scan` — sync `MEdiaFiles/` → `public/media/`
- `npm run build` — client + bigboard to `dist/` (runs `media:scan` first)
- `npm run server` — trail server (default port `3847`, override with `TRAIL_PORT`)
- `npm run live` — trail server + Vite dev (LAN-friendly `--host`)
- **`npm run dashboard`** — same as `live`, but prints the **dashboard URL** (`/bigboard.html`) in the terminal first
- `npm run dev` / `npm run preview` — client only (dashboard **won’t** be live without `npm run server` in another terminal)

### Why the “dashboard” isn’t as plug-and-play as some other stacks (e.g. zEMOTA-style)

Many apps ship **one** server or **one** Vercel project where the UI and realtime API share the same origin. **Thetavern** is intentionally split:

| Piece | What it is |
|--------|------------|
| **Vercel** | Static game files plus the turn-based `/api/conflic` function. It does not host the Node Socket.IO trail. |
| **Trail server** | Separate **Node** process (`npm run server`) for Socket.IO — must be running (or tunneled) for the dashboard feed + map to go live. |
| **Supabase** | Durable, server-only state for the five online Conflic Bouy tables. |
| **Port `3847`** | If you start the server twice, you get **`EADDRINUSE`** — kill the old process or change `TRAIL_PORT`. |

**Dashboard URLs:** after deploy, open **`/dashboard`** or **`/bigboard.html`** (rewrites in `vercel.json`). Locally: **`http://127.0.0.1:5174/bigboard.html`** while `npm run dashboard` (or `live`) is running.

## Online Conflic Bouy

1. Apply `supabase/migrations/20260829000000_conflic_state.sql` in the Supabase SQL editor.
2. Set `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. The service-role key must never be exposed through a `VITE_` variable.
3. Deploy the repository to Vercel. The client uses the same-origin `/api/conflic` endpoint.
4. For a GitHub Pages client, set `VITE_CONFLIC_API_URL` to the full Vercel endpoint URL before building.

The API uses optimistic revisions for atomic seat and turn updates. Private fleet coordinates remain in the server-only Supabase record and are projected only to their owning player. Waiting seats expire after five idle minutes; active matches allow thirty minutes for reconnection.

## Deploy (tunnel + env)

1. Build: `npm run build` and deploy `dist/` to Vercel (or any static host).  
2. Run the trail server on a reachable host (e.g. `npm run server` behind `cloudflared tunnel --url http://127.0.0.1:3847`).  
3. Point clients at that URL: set `VITE_TRAIL_SERVER_URL` **at build time**, or ship `public/trail.json` with `{ "trailUrl": "https://your-tunnel.example" }`, or open the game with `?trail=https://your-tunnel.example`.  
4. Allow browser origins on the server via `TRAIL_CORS_ORIGIN` (comma-separated).  
5. Tunnels often need **polling-first** Socket.IO — this client uses `polling` then `websocket` upgrade by default.

### Cloudflare Tunnel (trail server)

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), run the trail server locally (`npm run server`), then in another terminal:

```bash
cloudflared tunnel --url http://127.0.0.1:3847
```

Copy the printed `https://*.trycloudflare.com` URL and either:

- set `TRAIL_CORS_ORIGIN` to your **static site origin** (e.g. `https://your-app.vercel.app`) and rebuild the client with `VITE_TRAIL_SERVER_URL=<tunnel-url>`, or  
- put that URL in `public/trail.json` as `"trailUrl"` before `npm run build`, or  
- open the game once with `?trail=<tunnel-url>` so it sticks in `localStorage`.

**Websocket note:** Quick tunnels usually work with Socket.IO polling + upgrade; if a corporate network blocks WS, the client still starts on polling.

## Same-origin trail resolution

Order: `import.meta.env.VITE_TRAIL_SERVER_URL` → `?trail=` (also saved to `localStorage`) → `localStorage` → `GET /trail.json`.

## Projector

Open `bigboard.html` (Hall of the Angler) on a projector; it subscribes to the same trail feed and patron list.
