# Tavern Audio

"ASCII-like music" is interpreted as retro, procedural Web Audio chiptune, not text-to-audio or an external generation service. `soundtrack.ts` owns one lazily created AudioContext, one master gain, and one short-lookahead music scheduler. Every existing game SFX and pirate speech element feeds that master gain.

## Themes

All eight original themes share a Dorian palette and changing harmonic roots. The tavern and fishing themes drift through sparse cells and register changes. Warrior uses driving square pulses, Tetris quick interlocking notes, Dr Mario a syncopated cell, HiLo rising/falling notes, and Red/Black a contrasting offbeat pattern. Conflic uses a swung triple pulse, low percussive notes, and a restrained sawtooth lead for nautical swashbuckling character. No game or film melodies were transcribed, and no new recordings are used.

`main.ts` routes game phases and warrior substages. Repeated phase/stage updates do not restart the music. Theme changes stop the previous scheduled voices before starting the next score. The old recorded catch song conflicted with continuous music, so `hallMusic.ts` now provides a short original synthesized catch punctuation alongside the existing rarity arpeggio. Existing pirate speech assets remain unchanged; they are not part of the new music.

## Controls And Lifecycle

The always-visible speaker button and mini range slider control music, effects, and speech together. Mute and volume are independent, saved as `{ muted, volume }` under `moonwell.audio.v1`. Default volume is 35%. Invalid or blocked storage falls back safely. Reduced-motion preference controls animation, not sound.

Audio starts on a pointer or keyboard gesture, never on initial page load. Backgrounding stops the score, pauses speech, and suspends the context. Returning starts the current theme without a queued music backlog; rejected resume attempts can be retried on the next gesture. Unsupported Web Audio leaves the game and controls usable but silent. Mute and zero volume suppress new effects and stop music/speech. The controls isolate their keyboard events from game actions and reserve a top rail even when the game hides its HUD.

## Verification

Run `node scripts/audio-regression.mjs` for isolated Playwright tests of startup, persistence, routing, a single scheduler/output, shared effects/media connections, gain changes, background lifecycle, live game transitions, responsive controls, corrupt/blocked storage, and unavailable Web Audio. It imports the real TypeScript modules through Vite and writes no screenshots or generated content. Also run `npx tsc --noEmit` and `npx vite build` directly, without the asset-generating npm prebuild hook.

Browser automation verifies audio graph and lifecycle behavior, not listening quality or physical iOS/Safari autoplay behavior. A device listening pass is still recommended for final mix tuning.
