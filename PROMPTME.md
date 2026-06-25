# PROMPTME.md — The Moonwell Anglers (thetavern)

Machine-facing context for AI agents. Human docs: `README.md`.

## System role

Ship **The Moonwell Anglers** — a browser tavern hangout (fishing spine + chance + Warrior trials + live bigboard). **~99% of players are on phones.** Optimize for **tap, large readable type, minimal scroll**, not desktop-only canvas tricks.

**Leadership alignment (h wonder / PROMPTME philosophy — same bar as EzraMOTA):**

- Be **intentional** — encode tribal knowledge here; don't guess on mobile UX.
- **Mobile-first, easy-read** — VT323 / Pixelify at **≥26px** on canvas; Press Start 2P only for tiny HUD labels, never body copy.
- **No signup wall** — `localStorage` angler save; Guest works instantly.
- **Lore sources** — [Knights Demplar](https://knightsdemplar.com/), [Knights of Degen](https://knightsofdegen.netlify.app/), @DemplarOfficial X feed (`npm run x:sync`).
- **QA before push** — run `npm run smoke:all` after gameplay or UI changes.

## Technology stack

| Layer | Stack |
|-------|--------|
| Client | Vite 5, TypeScript, `src/main.ts` phase loop |
| Minigames | Canvas — fishing, Demplar Warrior, chance deck |
| Styles | `src/style.css`, `src/css/*`, `html.tavern-mobile` |
| Live hall | `server/index.ts` + Socket.IO; `bigboard.html` |
| Deploy | GitHub Pages (`npm run build`, workflow `pages.yml`) |

## Core product flows (mobile)

1. **Guest / Play** → herald → **well hub** (fish · warrior · cards · feast)
2. **Fish** — cast → strike → reel → resolve → renown → peril/trivia → hub
3. **Warrior** — readable brief intro → platform → race → asteroids → result
4. **Bigboard** — one viewport, no page scroll; demo patrons if trail offline

## QA checklist (run every time)

```bash
npm run live          # or rely on smoke auto-start
npm run smoke:all     # play + warrior + bigboard
npm run build         # production bundle
```

**Warrior brief must pass:** `minFontPx >= 26`, canvas height ≥ 280px, `warriorStage` reaches `platform`.

## Important constraints

- **`src/main.ts`** owns phases; **`DemplarWarrior`** owns trial logic.
- GitHub Pages base: `/thetavern/` when `GITHUB_PAGES=true` at build.
- Trail URL empty in `public/trail.json` for public deploy; localhost auto-uses `:3847`.
- Commits + push when user asks; never force-push `main`.

## Best practices for AI agents

1. Read this file before mobile or canvas UI work.
2. Touch targets ≥ **48px**; hub tiles and strike button already sized — don't shrink.
3. After canvas text changes, run **`npm run smoke:warrior`**.
4. Match existing lore voice (`arcaneLore.ts`, `demplarKnights.ts`) — original IP only.
5. Keep diffs minimal; build must stay green.
