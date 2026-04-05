# The Moonwell Anglers (`thetavern`)

Repo: [github.com/goldennftplatform-svg/thetavern](https://github.com/goldennftplatform-svg/thetavern)

Vite + TypeScript client, Express + Socket.IO trail server, Vercel-ready static output. Fantasy tavern ritual centered on the **Moonwell** fishing loop; **Demplar** appears in lore, notices, and an optional charter modal ([Demplar on X](https://x.com/DemplarOfficial)).

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
- `npm run dev` / `npm run preview` — client only

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
