# Conflic Bouy Full Overhaul Plan

## Current State (What's Wrong)
- Ships are **flat colored rectangles** — no ship art at all
- Grid is a plain solid-color grid with thin lines — no water, no atmosphere
- Hit/miss/sink feedback is just colored squares — no explosion art, no splashes
- No wave animation, no water movement
- Fleet status panels are tiny text lists — no ship silhouettes
- Result screen is just text on the final board — no victory/defeat overlay
- Themes only change colors — no unique visual identity per theme
- Agent has a **duplicate scheduleAgentTurn()** bug on hit (line 871) — gets 2 turns per hit
- No sound/visual feedback hierarchy — hit and sink feel same

## What We're Building

### 1. Canvas-Drawn Ship Silhouettes
Replace flat colored rectangles with actual ship shapes drawn via canvas paths:
- **Carrier (5 cells)**: Flat-top flight deck with angled bow, runway lines
- **Battleship (4 cells)**: Heavy hull with turret bumps on deck
- **Cruiser (3 cells)**: Sleek pointed bow, narrow beam
- **Submarine (3 cells)**: Rounded cigar shape with conning tower nub
- **Destroyer (2 cells)**: Small fast-looking hull

Ships drawn as rounded-rect paths with:
- Fill from theme `shipColors[type].main`
- 1px darker stroke from `shipColors[type].dark`
- Inner detail lines (deck markings, turret dots)
- Hit sections get red overlay; sunk ships get dark + fire glow
- Ghost ships during setup placement (translucent outline)

### 2. Animated Water Background
Replace flat `gridBg` with animated ocean:
- Base color gradient (lighter at top, darker at bottom) per theme
- 3-4 sine wave lines scrolling horizontally (different speeds/phases)
- Tiny sparkle/dot particles drifting upward (foam/bubbles)
- Theme-specific: Charter=gold water, Abyssal=dark teal with glow dots, Odyssey=neon grid lines, Corsair=warm amber, Voidwalker=purple matrix rain

### 3. Explosion & Splash Art
- **Hit**: Expanding fireball (concentric circles: white→yellow→orange→red, fading) + 8-12 spark particles + screen shake
- **Miss**: Water splash column (upward arc of blue dots that fall back) + ripple ring expanding on water
- **Sink**: Ship breaks apart (each cell flashes bow-to-stern, then debris particles erupt) + large smoke column + dramatic screen shake + hitPause freeze frame
- **Combo hit**: Cascading explosion effect — multiple overlapping fireballs

### 4. End-Game Victory/Defeat Overlay
- Full-screen semi-transparent dark overlay fades in
- Large "VICTORY" or "DEFEAT" text with animated scale-in
- Ship graveyard: show all 5 ships drawn as silhouettes, sunk ones with ✕ marks
- Animated stat counters (hits, accuracy%, turns)
- Sparrow personality quote in gold
- Rewards display with glow effect
- "Play Again" / "Change Mode" / "Back to Tavern" buttons

### 5. Board & UI Polish
- Grid coordinates styled with theme accent color
- Turn indicator: pulsing glow border on active board (not just arrow)
- Setup: ghost ship silhouette follows cursor with validity coloring
- Fleet status: mini ship silhouettes instead of colored squares, segmented health bars (individual cells)
- Ability cooldown indicators: small circular progress rings on fleet panel
- Footer: contextual hints with theme-colored text

### 6. Theme-Specific Visual Identity
Each theme gets unique:
- **Water color palette** (base, wave, sparkle)
- **Ship outline style** (sharp for Odyssey, organic for Abyssal, ornate for Corsair)
- **Explosion color** (standard for Charter, neon for Odyssey, green for Abyssal, orange for Corsair, purple for Voidwalker)
- **Grid pattern** (plain for Charter, hex for Voidwalker, sonar rings for Abyssal, star map for Odyssey, compass for Corsair)

## Bug Fixes
1. Remove duplicate `scheduleAgentTurn()` on line 871 (agent hit gives 2 turns)
2. Fix fleet status panel positioning so it doesn't overlap board on narrow screens
3. Ensure message bubble doesn't overlap fleet status panels

## Files to Modify
- `src/minigames/conflicBouy.ts` — Main game class, draw methods (~800 lines rewritten)
- `src/minigames/conflicBouyThemes.ts` — Add water/explosion/style properties to themes
- `src/css/conflicBouy.css` — Result overlay styles, button animations

## Execution Order
1. Fix bugs first (duplicate scheduleAgentTurn)
2. Add ship drawing helper functions
3. Rewrite `drawBoard()` with ship silhouettes + water
4. Rewrite hit/miss/sink visual effects
5. Add water animation system
6. Add end-game overlay
7. Update theme definitions with new visual properties
8. Polish fleet status panels
9. Test at 1366×738, 1536×864, 1920×1080
10. tsc + build + smoke tests
