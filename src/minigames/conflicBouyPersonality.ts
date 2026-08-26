/**
 * Jack Sparrow Personality System for Conflic Bouy Agent
 * "Why is the rum always gone?" — Captain Jack Sparrow
 */

export type SparrowContext =
  | "game_start"
  | "player_hit"
  | "player_miss"
  | "player_sink"
  | "agent_hit"
  | "agent_miss"
  | "agent_sink"
  | "agent_turn_start"
  | "agent_turn_end"
  | "victory"
  | "defeat"
  | "low_ships"
  | "last_ship"
  | "perfect_game"
  | "comeback"
  | "taunt_idle"
  | "ability_use"
  | "setup_deploy";

export interface SparrowLine {
  text: string;
  weight: number; // for weighted random selection
  conditions?: Partial<{
    turns: number;
    shipsRemaining: number;
    playerHits: number;
    agentHits: number;
  }>;
}

const SPARROW_LINES: Record<SparrowContext, SparrowLine[]> = {
  game_start: [
    { text: "Ahoy! Captain Jack Sparrow at your service. And you are... prey?", weight: 10 },
    { text: "Welcome to the Black Pearl's table, mate. Try not to sink too fast.", weight: 8 },
    { text: "The sea's vast, but me patience? Not so much. Place your ships.", weight: 7 },
    { text: "Savvy? Good. Now show me what you're made of, landlubber.", weight: 6 },
    { text: "Aye, the winds favor the bold. Or the foolish. We'll see which you are.", weight: 5 },
    { text: "Me compass don't point north. It points to victory. Your move.", weight: 4 },
  ],

  player_hit: [
    { text: "Ooh, a direct hit! Didn't see that coming. Me mistake.", weight: 8 },
    { text: "You've got a sharp eye, I'll give you that. *hic*", weight: 7 },
    { text: "Touchè! But can you do it again? Doubt it.", weight: 6 },
    { text: "A lucky shot! Even a blind squirrel finds a nut once.", weight: 5 },
    { text: "Impressive. For a landlubber. Don't let it go to your head.", weight: 5 },
    { text: "Hit confirmed. Me hull's leaking... but I'm not done yet.", weight: 4 },
  ],

  player_miss: [
    { text: "HA! Missed me! *hic* You shoot like a drunk sailor... wait.", weight: 10 },
    { text: "Wide! The ocean's big, but not THAT big. Try aiming.", weight: 8 },
    { text: "Splash! That's the sound of failure, mate.", weight: 7 },
    { text: "My grandmother aims better. And she's dead.", weight: 6 },
    { text: "The horizon called. It wants its cannonball back.", weight: 5 },
    { text: "Missed by a nautical mile. Keep trying, love.", weight: 4 },
  ],

  player_sink: [
    { text: "WHAT?! Me beautiful ship! *hic* You'll pay for that!", weight: 10 },
    { text: "Impossible! The Black Pearl doesn't sink! ...does it?", weight: 8 },
    { text: "Aye, you got one. But I've got four more where that came from.", weight: 6 },
    { text: "Davy Jones has claimed another. But not the Captain!", weight: 5 },
    { text: "Me crew's swimming now. They'll be *very* cross with you.", weight: 4 },
  ],

  agent_hit: [
    { text: "BOOM! Direct hit, savvy? *hic* Jack Sparrow never misses.", weight: 10 },
    { text: "There she blows! Right in the hull. Beautiful.", weight: 8 },
    { text: "Told you. Me aim's true as me compass... when it works.", weight: 7 },
    { text: "Direct hit! The sea favors the bold today.", weight: 6 },
    { text: "KA-POW! Another one bites the dust. Or the brine.", weight: 5 },
    { text: "Target acquired. Target destroyed. Captain's orders.", weight: 4 },
  ],

  agent_miss: [
    { text: "*hic* The rum... it affects me aim. Strategic withdrawal!", weight: 10 },
    { text: "Missed? ME? The wind shifted. That's my story.", weight: 8 },
    { text: "A tactical miss! Lulling you into false confidence.", weight: 7 },
    { text: "Me cannon's wet. Happens to the best of us.", weight: 6 },
    { text: "Close enough for pirate work. *burp*", weight: 5 },
  ],

  agent_sink: [
    { text: "HAHAHA! Another one goes down! *hic* To the depths with ye!", weight: 10 },
    { text: "SUNK! Me aim's as true as me love for rum.", weight: 8 },
    { text: "Another trophy for the Captain's wall. Or floor.", weight: 7 },
    { text: "Down to Davy Jones' locker! Tell him Jack sent ya.", weight: 6 },
    { text: "One less ship for you. One more story for me.", weight: 5 },
  ],

  agent_turn_start: [
    { text: "Me turn now. *hic* Let's see... where to strike?", weight: 8 },
    { text: "Hmm... me compass points... THERE.", weight: 7 },
    { text: "The winds whisper... and they say 'fire at B-7'.", weight: 6 },
    { text: "Calculating... *burp* ...done. Your turn to worry.", weight: 5 },
  ],

  agent_turn_end: [
    { text: "Your move, mate. Don't keep a pirate waiting.", weight: 8 },
    { text: "The ball's in your court. Or should I say, the cannonball.", weight: 6 },
    { text: "Tick tock, landlubber. Me patience wears thin.", weight: 5 },
  ],

  victory: [
    { text: "VICTORY! *hic* The sea belongs to Captain Jack Sparrow!", weight: 10 },
    { text: "Aye, another trophy for the collection. You fought well... for a corpse.", weight: 8 },
    { text: "The Black Pearl reigns supreme! Now, about that rum...", weight: 7 },
    { text: "Game over, mate. Me legend grows. Yours... not so much.", weight: 6 },
    { text: "Davy Jones collects souls. I collect wins. Guess who won?", weight: 5 },
  ],

  defeat: [
    { text: "IMPOSSIBLE! *hic* Me? Defeated? By a LANLUBBER?", weight: 10 },
    { text: "The Pearl... she's gone. But Jack Sparrow always returns.", weight: 8 },
    { text: "You got lucky. Next time, I'll bring the Kraken.", weight: 7 },
    { text: "A setback! A mere... tactical withdrawal. *hic*", weight: 6 },
    { text: "Mark my words — this isn't over. Savvy?", weight: 5 },
  ],

  low_ships: [
    { text: "Down to me last ships, eh? *hic* Desperation makes me dangerous.", weight: 8 },
    { text: "One ship left. But what a ship! The Pearl herself.", weight: 6 },
    { text: "Cornered rat fights hardest. Remember that, mate.", weight: 5 },
  ],

  last_ship: [
    { text: "Just the Pearl and me. *hic* Always the way, innit?", weight: 8 },
    { text: "One ship. One Captain. One legend. Your funeral.", weight: 7 },
    { text: "The Black Pearl stands alone. As it should.", weight: 5 },
  ],

  perfect_game: [
    { text: "FLAWLESS VICTORY! *hic* Not a scratch on the Pearl!", weight: 10 },
    { text: "You didn't land a single shot. *burp* Pathetic... almost.", weight: 8 },
    { text: "Me aim's perfect. Me timing's perfect. Me rum's... empty.", weight: 6 },
  ],

  comeback: [
    { text: "HA! From the brink! *hic* Never count Jack Sparrow out!", weight: 10 },
    { text: "The tide turns! The wind shifts! The CAPTAIN PREVAILS!", weight: 8 },
    { text: "Thought you had me, didn't you? *hic* Classic mistake.", weight: 6 },
  ],

  taunt_idle: [
    { text: "*hic* The rum's gone. The game's on. Coincidence?", weight: 5 },
    { text: "Me compass points to victory. Yours points to... defeat.", weight: 4 },
    { text: "Why is the rum always gone? Because I drink it all. *burp*", weight: 3 },
    { text: "A pirate's life for me. A short game for thee.", weight: 4 },
    { text: "Savvy? Good. Now make your move before I get bored.", weight: 3 },
  ],

  ability_use: [
    { text: "Time for the special treatment! *hic*", weight: 10 },
    { text: "Now you see it... now you DON'T.", weight: 8 },
    { text: "Me secret weapon! Savvy?", weight: 7 },
    { text: "A little pirate ingenuity never hurt nobody. Much.", weight: 6 },
    { text: "Hold on to yer hat! *hic* This'll be good.", weight: 5 },
  ],

  setup_deploy: [
    { text: "Place yer ships wisely, mate. I won't forget where they are.", weight: 8 },
    { text: "Hmm, interesting formation. *hic* I'll be sure to exploit it.", weight: 7 },
    { text: "The fleet assembles! But can they survive me rum-fueled wrath?", weight: 6 },
    { text: "Strategic placement, I see. Bold. Foolish, but bold.", weight: 5 },
  ],
};

export function getSparrowLine(
  context: SparrowContext,
  gameState?: {
    turns?: number;
    shipsRemaining?: number;
    playerHits?: number;
    agentHits?: number;
    themeId?: string;
  }
): string {
  // Check theme variant first
  if (gameState?.themeId) {
    const variant = getVariantLine(gameState.themeId, context);
    if (variant) return variant;
  }

  const lines = SPARROW_LINES[context] ?? [];
  if (lines.length === 0) return "";

  // Filter by conditions
  const eligible = lines.filter((line) => {
    if (!line.conditions) return true;
    if (line.conditions.turns !== undefined && gameState && gameState.turns !== undefined) {
      if (gameState.turns > line.conditions.turns) return false;
    }
    if (line.conditions.shipsRemaining !== undefined && gameState && gameState.shipsRemaining !== undefined) {
      if (gameState.shipsRemaining > line.conditions.shipsRemaining) return false;
    }
    return true;
  });

  if (eligible.length === 0) return lines[0]?.text ?? "";

  // Weighted random
  const totalWeight = eligible.reduce((sum, l) => sum + l.weight, 0);
  let random = Math.random() * totalWeight;
  for (const line of eligible) {
    random -= line.weight;
    if (random <= 0) return line.text;
  }
  return eligible[eligible.length - 1].text;
}

export function getContextualSparrowLine(
  event: string,
  gameState: {
    mode: "agent" | "hotseat";
    phase: "setup" | "play" | "over";
    currentTurn: string;
    playerBoard: { ships: { sunk: boolean }[] };
    opponentBoard: { ships: { sunk: boolean }[] };
    result: { playerHits: number; playerMisses: number; agentHits: number; agentMisses: number; turns: number };
  }
): string {
  const shipsRemaining = gameState.opponentBoard.ships.filter((s) => !s.sunk).length;
  const playerShipsRemaining = gameState.playerBoard.ships.filter((s) => !s.sunk).length;

  const state = {
    turns: gameState.result.turns,
    shipsRemaining,
    playerHits: gameState.result.playerHits,
    agentHits: gameState.result.agentHits,
  };

  // Context-specific overrides
  switch (event) {
    case "agent_turn_start":
      if (shipsRemaining === 1) return getSparrowLine("last_ship", state);
      if (shipsRemaining <= 2) return getSparrowLine("low_ships", state);
      return getSparrowLine("agent_turn_start", state);

    case "agent_hit":
      if (shipsRemaining === 0) return getSparrowLine("victory", state);
      return getSparrowLine("agent_hit", state);

    case "agent_miss":
      return getSparrowLine("agent_miss", state);

    case "agent_sink":
      if (shipsRemaining === 0) return getSparrowLine("victory", state);
      if (shipsRemaining === 1) return getSparrowLine("last_ship", state);
      return getSparrowLine("agent_sink", state);

    case "player_hit":
      return getSparrowLine("player_hit", state);

    case "player_miss":
      return getSparrowLine("player_miss", state);

    case "player_sink":
      if (playerShipsRemaining === 0) return getSparrowLine("defeat", state);
      return getSparrowLine("player_sink", state);

    case "victory":
      if (gameState.result.playerMisses === 0) return getSparrowLine("perfect_game", state);
      if (gameState.result.agentHits < gameState.result.playerHits) return getSparrowLine("comeback", state);
      return getSparrowLine("victory", state);

    case "defeat":
      return getSparrowLine("defeat", state);

    case "game_start":
      return getSparrowLine("game_start", state);

    default:
      return getSparrowLine("taunt_idle", state);
  }
}

// Theme-specific personality variants
export const PERSONALITY_VARIANTS: Record<string, Partial<Record<SparrowContext, SparrowLine[]>>> = {
  odyssey: {
    game_start: [
      { text: "INITIALIZING ODYSSEY PROTOCOL. Target acquired: YOU.", weight: 10 },
      { text: "Welcome to the void, pilot. Your signal... ends here.", weight: 8 },
    ],
    agent_hit: [
      { text: "TARGET LOCKED. HULL BREACH CONFIRMED.", weight: 10 },
      { text: "DIRECT HIT. ICE SHATTERED.", weight: 8 },
    ],
    agent_miss: [
      { text: "FIREWALL DETECTED. RECALCULATING TRAJECTORY.", weight: 8 },
      { text: "GHOST TRACE. NULL RESULT.", weight: 6 },
    ],
    victory: [
      { text: "MISSION COMPLETE. THREAT NEUTRALIZED. ARCHIVING VICTORY.", weight: 10 },
      { text: "SYSTEM SECURE. ANOTHER WIN LOGGED.", weight: 8 },
    ],
  },

  corsair: {
    game_start: [
      { text: "Ahoy, matey! Captain Corsair at the helm! Fire when ready!", weight: 10 },
      { text: "Welcome aboard! Hope ye brought yer sea legs!", weight: 8 },
    ],
    agent_hit: [
      { text: "DIRECT HIT! CANNON'S TRUE! *hic*", weight: 10 },
      { text: "SHATTERED HER HULL! BELOW DECKS WITH YE!", weight: 8 },
    ],
    agent_miss: [
      { text: "WIDE! RELOAD, YE SCURVY DOGS!", weight: 8 },
      { text: "THE WIND SHIFTED! TACTICAL MISS!", weight: 6 },
    ],
    victory: [
      { text: "VICTORY! THE SEAS ARE MINE! TO THE VICTOR GO THE SPOILS!", weight: 10 },
      { text: "SHE'S YOURS NOW, DAVY JONES! HAHAHA!", weight: 8 },
    ],
  },

  abyssal: {
    game_start: [
      { text: "From the depths... I rise. *bubble* You cannot escape.", weight: 10 },
      { text: "The pressure crushes all... eventually. *gurgle*", weight: 8 },
    ],
    agent_hit: [
      { text: "BLOOD IN THE WATER. FEEDING TIME.", weight: 10 },
      { text: "HULL CRUNCH. SCREAMS BELOW. *gurgle*", weight: 8 },
    ],
    agent_miss: [
      { text: "SILENCE. MUD ONLY. *bubble*", weight: 7 },
      { text: "ECHO FADES. NOTHING STIRS.", weight: 5 },
    ],
    victory: [
      { text: "THE DEEPS CLAIM ANOTHER. SWALLOWED WHOLE.", weight: 10 },
      { text: "THE ABYSS IS PATIENT. THE ABYSS WINS.", weight: 8 },
    ],
  },

  voidwalker: {
    game_start: [
      { text: "SYSTEM ONLINE. ENGAGING ICE PROTOCOL. BEGIN.", weight: 10 },
      { text: "Welcome to the void, runner. Your data... is mine.", weight: 8 },
    ],
    agent_hit: [
      { text: "PENETRATED. CORE BREACH. ARCHIVING.", weight: 10 },
      { text: "ICE SHATTERED. VULNERABILITY EXPLOITED.", weight: 8 },
    ],
    agent_miss: [
      { text: "FIREWALL DETECTED. RECALCULATING...", weight: 8 },
      { text: "NULL TRACE. GHOST SIGNAL.", weight: 6 },
    ],
    agent_sink: [
      { text: "DEREZZED. SWARM NODE OFFLINE.", weight: 10 },
      { text: "PURGED. ARCHIVED. DELETED.", weight: 8 },
    ],
    victory: [
      { text: "SYSTEM SECURED. THREAT NEUTRALIZED. RUN COMPLETE.", weight: 10 },
      { text: "ALL NODES CLEARED. THE VOID IS OURS.", weight: 8 },
    ],
    defeat: [
      { text: "CONNECTION LOST. REBOOTING...", weight: 10 },
      { text: "SWARM ABSORBED. SYSTEM FAILURE.", weight: 8 },
    ],
    ability_use: [
      { text: "EXECUTING OVERRIDE PROTOCOL...", weight: 10 },
      { text: "DEPLOYING EXPLOIT. STAND BY.", weight: 8 },
    ],
  },
};

export function getVariantLine(
  themeId: string,
  context: SparrowContext,
  _gameState?: any
): string | null {
  const variant = PERSONALITY_VARIANTS[themeId];
  if (!variant || !variant[context]) return null;

  const lines = variant[context]!;
  if (lines.length === 0) return null;

  const totalWeight = lines.reduce((sum, l) => sum + l.weight, 0);
  let random = Math.random() * totalWeight;
  for (const line of lines) {
    random -= line.weight;
    if (random <= 0) return line.text;
  }
  return lines[lines.length - 1].text;
}