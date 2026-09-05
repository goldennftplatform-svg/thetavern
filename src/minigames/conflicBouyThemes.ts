/**
 * Conflic Bouy Theme System
 * Visual themes that transform the entire game aesthetic
 */

export type BouyThemeId = "charter" | "odyssey" | "abyssal" | "corsair" | "voidwalker";

export interface BouyTheme {
  id: BouyThemeId;
  name: string;
  tagline: string;
  // Palette
  bg: string;
  bgDeep: string;
  panel: string;
  panelBorder: string;
  gridBg: string;
  gridLine: string;
  accent: string;
  accentDim: string;
  playerColor: string;
  enemyColor: string;
  hitColor: string;
  hitGlow: string;
  missColor: string;
  sunkColor: string;
  sunkGlow: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  gold: string;
  // Ship colors per type
  shipColors: Record<string, { main: string; light: string; dark: string }>;
  // Water colors for animated ocean
  water: { base: string; wave1: string; wave2: string; foam: string; deep: string };
  // Explosion effect colors
  explosion: { core: string; mid: string; outer: string; smoke: string; splash: string };
  // Ship rendering style
  shipStyle: "sharp" | "organic" | "ornate" | "digital" | "military";
  // Terminology
  terms: {
    gameTitle: string;
    playerFleet: string;
    enemyFleet: string;
    targetingGrid: string;
    turnYou: string;
    turnEnemy: string;
    turnPlayer2: string;
    hit: string[];
    miss: string[];
    sink: string[];
    victory: string;
    defeat: string;
    deploy: string;
    ready: string;
  };
  // Visual effects
  effects: {
    scanlines: boolean;
    crt: boolean;
    glitch: boolean;
    particles: boolean;
    vignette: number;
  };
  // Font overrides
  fonts: {
    title: string;
    body: string;
    mono: string;
  };
}

// ============================================
// CHARTER NAVY — Pirate Ship Knights (default)
// ============================================
export const CHARTER_THEME: BouyTheme = {
  id: "charter",
  name: "CHARTER NAVY",
  tagline: "By the Charter, we sail",
  bg: "#101828",
  bgDeep: "#080c18",
  panel: "#182840",
  panelBorder: "#7898b8",
  gridBg: "#182840",
  gridLine: "#385878",
  accent: "#f8d878",
  accentDim: "#7898b8",
  playerColor: "#a8d8f8",
  enemyColor: "#f88878",
  hitColor: "#d84838",
  hitGlow: "#f8e8c8",
  missColor: "#a8d8f8",
  sunkColor: "#682838",
  sunkGlow: "#f88878",
  textPrimary: "#f8e8c8",
  textSecondary: "#a8d8f8",
  textMuted: "#b8c8d8",
  gold: "#f8d878",
  shipColors: {
    carrier: { main: "#7898b8", light: "#a8d8f8", dark: "#385878" },
    battleship: { main: "#7898b8", light: "#a8d8f8", dark: "#385878" },
    cruiser: { main: "#7898b8", light: "#a8d8f8", dark: "#385878" },
    submarine: { main: "#7898b8", light: "#a8d8f8", dark: "#385878" },
    destroyer: { main: "#7898b8", light: "#a8d8f8", dark: "#385878" },
  },
  terms: {
    gameTitle: "CONFLIC BOUY",
    playerFleet: "YOUR FLEET",
    enemyFleet: "ENEMY FLEET",
    targetingGrid: "TARGETING GRID",
    turnYou: "YOUR TURN",
    turnEnemy: "ENEMY TURN",
    turnPlayer2: "PLAYER 2 TURN",
    hit: ["DIRECT HIT", "TARGET STRUCK", "IMPACT CONFIRMED", "ARMOR BREACHED"],
    miss: ["MISS", "SPLASH", "WIDE", "LOST IN THE MIST"],
    sink: ["SUNK", "HULL BREACHED", "SHE SLIPS BELOW", "ANOTHER ONE GONE"],
    victory: "VICTORY — ENEMY FLEET DESTROYED",
    defeat: "DEFEAT — YOUR FLEET SUNK",
    deploy: "PLACE",
    ready: "FLEETS DEPLOYED — YOUR TURN",
  },
  effects: { scanlines: false, crt: false, glitch: false, particles: false, vignette: 0 },
  fonts: { title: '"Press Start 2P", monospace', body: '"Courier New", monospace', mono: '"Courier New", monospace' },
  water: { base: "#0c1828", wave1: "#1a3050", wave2: "#142840", foam: "#3a5878", deep: "#060c18" },
  explosion: { core: "#fff8e0", mid: "#ffb040", outer: "#e86020", smoke: "#404040", splash: "#60a0d0" },
  shipStyle: "ornate",
};

// ============================================
// ODYSSEY — Trending space/void aesthetic
// ============================================
export const ODYSSEY_THEME: BouyTheme = {
  id: "odyssey",
  name: "ODYSSEY PROTOCOL",
  tagline: "Through the void we hunt",
  bg: "#050510",
  bgDeep: "#020208",
  panel: "#0a0a1a",
  panelBorder: "#00f0ff",
  gridBg: "#080818",
  gridLine: "rgba(0, 240, 255, 0.12)",
  accent: "#00f0ff",
  accentDim: "#008899",
  playerColor: "#00ffcc",
  enemyColor: "#ff3366",
  hitColor: "#ff3366",
  hitGlow: "#ff6699",
  missColor: "#101028",
  sunkColor: "#2a0510",
  sunkGlow: "#ff3366",
  textPrimary: "#e0ffff",
  textSecondary: "#00f0ff",
  textMuted: "rgba(0, 240, 255, 0.35)",
  gold: "#ffd700",
  shipColors: {
    carrier: { main: "#00f0ff", light: "#80faff", dark: "#0099aa" },
    battleship: { main: "#aa00ff", light: "#cc80ff", dark: "#660099" },
    cruiser: { main: "#00ffcc", light: "#80ffdd", dark: "#009977" },
    submarine: { main: "#ff3366", light: "#ff8099", dark: "#cc0033" },
    destroyer: { main: "#ffd700", light: "#ffe880", dark: "#ccaa00" },
  },
  terms: {
    gameTitle: "ODYSSEY PROTOCOL",
    playerFleet: "YOUR ARMADA",
    enemyFleet: "HOSTILE CONTACTS",
    targetingGrid: "SCAN GRID",
    turnYou: "YOUR CYCLE",
    turnEnemy: "ENEMY CYCLE",
    turnPlayer2: "UNIT 2 CYCLE",
    hit: ["CONTACT", "SHIELDS BREACHED", "TARGET LOCKED", "DIRECT HIT"],
    miss: ["GHOST ECHO", "VOID MISS", "NO CONTACT", "SCAN CLEAR"],
    sink: ["ELIMINATED", "HULL COLLAPSE", "SIGNAL LOST", "CONFIRMED KILL"],
    victory: "MISSION COMPLETE — SECTOR SECURED",
    defeat: "ARMADA LOST — EVACUATE",
    deploy: "DEPLOY",
    ready: "ARMADA DEPLOYED — INITIATE SCAN",
  },
  effects: { scanlines: true, crt: false, glitch: true, particles: true, vignette: 0.5 },
  fonts: { title: '"Orbitron", "VT323", monospace', body: '"VT323", monospace', mono: '"VT323", monospace' },
  water: { base: "#040810", wave1: "#081428", wave2: "#060e1c", foam: "#00f0ff40", deep: "#020408" },
  explosion: { core: "#ffffff", mid: "#00f0ff", outer: "#ff3366", smoke: "#203040", splash: "#00ccdd" },
  shipStyle: "digital",
};

// ============================================
// ABYSSAL — Deep sea horror
// ============================================
export const ABYSSAL_THEME: BouyTheme = {
  id: "abyssal",
  name: "ABYSSAL DEPTHS",
  tagline: "Below, something stirs",
  bg: "#03080c",
  bgDeep: "#010305",
  panel: "#051018",
  panelBorder: "#44ccaa",
  gridBg: "#040e14",
  gridLine: "rgba(68, 204, 170, 0.1)",
  accent: "#44ccaa",
  accentDim: "#2a8870",
  playerColor: "#44ffdd",
  enemyColor: "#ff4466",
  hitColor: "#ff4466",
  hitGlow: "#ff88aa",
  missColor: "#0a1a22",
  sunkColor: "#1a0510",
  sunkGlow: "#ff4466",
  textPrimary: "#c8fff0",
  textSecondary: "#44ccaa",
  textMuted: "rgba(68, 204, 170, 0.3)",
  gold: "#ffaa00",
  shipColors: {
    carrier: { main: "#44ccaa", light: "#88ffe8", dark: "#288870" },
    battleship: { main: "#8844ff", light: "#bb88ff", dark: "#5522aa" },
    cruiser: { main: "#ffaa00", light: "#ffcc66", dark: "#cc7700" },
    submarine: { main: "#ff4466", light: "#ff8899", dark: "#aa2233" },
    destroyer: { main: "#ff6600", light: "#ffaa44", dark: "#cc4400" },
  },
  terms: {
    gameTitle: "ABYSSAL CONFLICT",
    playerFleet: "YOUR SCHOOL",
    enemyFleet: "DEEP ONES",
    targetingGrid: "SONAR SWEEP",
    turnYou: "YOUR PING",
    turnEnemy: "THEIR CALL",
    turnPlayer2: "SECOND PING",
    hit: ["BLOOD IN WATER", "HULL CRUNCH", "SCREAM BELOW", "FEEDING TIME"],
    miss: ["SILENCE", "MUD ONLY", "ECHO FADES", "NOTHING STIRS"],
    sink: ["CRUSHED DEEP", "SILENCE FOREVER", "THE DEPTHS CLAIM", "GONE TO PRESSURE"],
    victory: "THE DEEPS ARE YOURS",
    defeat: "SWALLOWED BY THE ABYSS",
    deploy: "SUBMERGE",
    ready: "SCHOOL DEPLOYED — ACTIVE SONAR",
  },
  effects: { scanlines: false, crt: false, glitch: false, particles: true, vignette: 0.6 },
  fonts: { title: '"Creepster", "VT323", monospace', body: '"VT323", monospace', mono: '"VT323", monospace' },
  water: { base: "#040c10", wave1: "#081820", wave2: "#061418", foam: "#44ccaa40", deep: "#020608" },
  explosion: { core: "#ffffff", mid: "#44ffdd", outer: "#ff4466", smoke: "#1a2a28", splash: "#228870" },
  shipStyle: "organic",
};

// ============================================
// CORSAIR — Golden age pirates
// ============================================
export const CORSAIR_THEME: BouyTheme = {
  id: "corsair",
  name: "CORSAIR'S GAMBIT",
  tagline: "Fortune favors the bold",
  bg: "#1a1008",
  bgDeep: "#0d0804",
  panel: "#2a1a0a",
  panelBorder: "#d4a018",
  gridBg: "#1f1206",
  gridLine: "rgba(212, 160, 24, 0.18)",
  accent: "#d4a018",
  accentDim: "#997010",
  playerColor: "#e8c840",
  enemyColor: "#c84030",
  hitColor: "#c84030",
  hitGlow: "#e88070",
  missColor: "#2a1a08",
  sunkColor: "#3a1008",
  sunkGlow: "#c84030",
  textPrimary: "#fff8d8",
  textSecondary: "#d4a018",
  textMuted: "rgba(212, 160, 24, 0.4)",
  gold: "#ffd000",
  shipColors: {
    carrier: { main: "#d4a018", light: "#f0c860", dark: "#997010" },
    battleship: { main: "#c84030", light: "#e88070", dark: "#882820" },
    cruiser: { main: "#40a060", light: "#80c890", dark: "#286040" },
    submarine: { main: "#805020", light: "#b08050", dark: "#503010" },
    destroyer: { main: "#a08030", light: "#d0b860", dark: "#605020" },
  },
  terms: {
    gameTitle: "CORSAIR'S GAMBIT",
    playerFleet: "YOUR FLOTILLA",
    enemyFleet: "RIVAL CREWS",
    targetingGrid: "SPYGLASS VIEW",
    turnYou: "YOUR SHOT",
    turnEnemy: "THEIR VOLLEY",
    turnPlayer2: "MATE'S TURN",
    hit: ["DIRECT HIT!", "CANNON'S TRUE!", "SHATTERED!", "BELOW DECKS!"],
    miss: ["WIDE!", "SPLASH!", "MISSED!", "RELOAD!"],
    sink: ["SHE'S GOING DOWN!", "STRIKE COLORS!", "TO DAVY JONES!", "SINK HER!"],
    victory: "VICTORY — THE SEAS ARE YOURS",
    defeat: "DEFEAT — TO THE DEPTHS",
    deploy: "STATION",
    ready: "FLOTILLA READY — FIRE AT WILL",
  },
  effects: { scanlines: false, crt: true, glitch: false, particles: false, vignette: 0.4 },
  fonts: { title: '"Pirata One", "VT323", monospace', body: '"VT323", monospace', mono: '"VT323", monospace' },
  water: { base: "#181008", wave1: "#281c0c", wave2: "#201408", foam: "#d4a01840", deep: "#0c0804" },
  explosion: { core: "#fff8e0", mid: "#ffaa20", outer: "#ff6600", smoke: "#302010", splash: "#d4a01880" },
  shipStyle: "ornate",
};

// ============================================
// VOIDWALKER — Dark sci-fi / cyberpunk
// ============================================
export const VOIDWALKER_THEME: BouyTheme = {
  id: "voidwalker",
  name: "VOIDWALKER",
  tagline: "In darkness, we are the light",
  bg: "#080214",
  bgDeep: "#04010a",
  panel: "#100420",
  panelBorder: "#bb44ff",
  gridBg: "#0c0218",
  gridLine: "rgba(187, 68, 255, 0.15)",
  accent: "#bb44ff",
  accentDim: "#7722aa",
  playerColor: "#cc88ff",
  enemyColor: "#ff44aa",
  hitColor: "#ff44aa",
  hitGlow: "#ff88cc",
  missColor: "#180428",
  sunkColor: "#280418",
  sunkGlow: "#ff44aa",
  textPrimary: "#f0e0ff",
  textSecondary: "#bb44ff",
  textMuted: "rgba(187, 68, 255, 0.35)",
  gold: "#ffcc00",
  shipColors: {
    carrier: { main: "#bb44ff", light: "#dd88ff", dark: "#7722aa" },
    battleship: { main: "#ff44aa", light: "#ff88cc", dark: "#aa2266" },
    cruiser: { main: "#44ccff", light: "#88eeff", dark: "#2288aa" },
    submarine: { main: "#ffcc00", light: "#ffe666", dark: "#aa8800" },
    destroyer: { main: "#88ff44", light: "#ccee88", dark: "#55aa22" },
  },
  terms: {
    gameTitle: "VOIDWALKER",
    playerFleet: "YOUR SWARM",
    enemyFleet: "CORRUPTED",
    targetingGrid: "TACMAP",
    turnYou: "EXECUTE",
    turnEnemy: "HOSTILE ACTION",
    turnPlayer2: "LINK 2 ACT",
    hit: ["PENETRATED", "CORE BREACH", "DATA STOLEN", "ICE SHATTERED"],
    miss: ["FIREWALL", "GHOST TRACE", "ENCRYPTED", "NULL"],
    sink: ["DEREZZED", "PURGED", "ARCHIVED", "OFFLINE"],
    victory: "SYSTEM SECURED — THREAT NEUTRALIZED",
    defeat: "CONNECTION LOST — SWARM ABSORBED",
    deploy: "INITIALIZE",
    ready: "SWARM DEPLOYED — ENGAGE ICE",
  },
  effects: { scanlines: true, crt: false, glitch: true, particles: true, vignette: 0.55 },
  fonts: { title: '"Share Tech Mono", "VT323", monospace', body: '"VT323", monospace', mono: '"VT323", monospace' },
  water: { base: "#060210", wave1: "#0c041c", wave2: "#080314", foam: "#bb44ff30", deep: "#03010a" },
  explosion: { core: "#ffffff", mid: "#bb44ff", outer: "#ff44aa", smoke: "#201040", splash: "#8844cc" },
  shipStyle: "digital",
};

export const ALL_THEMES: Record<BouyThemeId, BouyTheme> = {
  charter: CHARTER_THEME,
  odyssey: ODYSSEY_THEME,
  abyssal: ABYSSAL_THEME,
  corsair: CORSAIR_THEME,
  voidwalker: VOIDWALKER_THEME,
};

export function getTheme(id: BouyThemeId): BouyTheme {
  return ALL_THEMES[id] ?? CHARTER_THEME;
}

export function getThemeIds(): BouyThemeId[] {
  return Object.keys(ALL_THEMES) as BouyThemeId[];
}
