# MEdiaFiles — daily fishing decks

Drop art here; **`npm run media:scan`** (or any **`npm run build`**) copies assets into `public/media/` and refreshes **`manifest.json`**. The game picks a **platform by UTC calendar day** so the Moonwell “deck” can change daily without a code deploy.

## Folder layout (recommended)

Each **subfolder** = one fishing platform / level skin:

```text
MEdiaFiles/
  moon-dock/
    banner.jpg    — wide sign / header (shown top of the well canvas)
    crest.png     — square emblem (corner crest)
    sky.webp      — optional sky strip (top half, cover)
    deck.jpg      — optional planks / pier (bottom strip)
```

**Naming cheat sheet:** filenames containing `banner`, `crest`, `sky`, `deck`, `dock`, `logo`, etc. map to layers automatically. Otherwise the scanner guesses from **aspect ratio** (wide → banner, tall → crest, mid → deck).

## Loose files in `MEdiaFiles/` root

Images sitting **directly** in `MEdiaFiles/` (not in a subfolder) are bundled into a single platform **`thetavern-stash`** — good for quick tests and “daily scan” drops.

## After adding files

```bash
npm run media:scan
```

Commit `public/media/` when you want Vercel/production to ship those assets (or rely on `prebuild` during `npm run build`).

## Future automation

Point a cron job or CI step at this folder, run `media:scan`, then commit or artifact-upload — same manifest drives in-game rotation.
