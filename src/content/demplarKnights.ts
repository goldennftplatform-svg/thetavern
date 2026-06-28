/** Neighbor lore on X — this file feeds tavern voice. We are the Moonwell Tavern, not Knights Demplar. */

export const demplarEpigraphs = [
  "Pull up a chair — the well is open, the arcade is loud, the fish don't care who you are.",
  "Moonlit water, honest casts, and three arcade trials when you're bored of waiting for a bite.",
  "Neighbor legends drift in from X; we borrow the scenery and run our own scoreboard.",
  "This is a tavern. Fish, feast, cards, and the arcade in the back room.",
];

export const knightHallWhispers = [
  "⚔ Crossed swords above the well mean arcade night — fish first if you're shy.",
  "Tapestry threads show a desert sprint — borrowed set dressing for trial one.",
  "Someone on X keeps posting epic lore; we keep posting who caught what.",
  "The back-room cabinet glows green — stack attack, then pill puzzle, then back to the bar.",
  "Planet Sargaano is a mood, not a membership card.",
  "Degens and anglers share one table. Only the fish know your house.",
  "House rule: we don't claim their charter. We claim the strike window.",
  "Valenplar Ball candles gutter; tavern night favors honest casts.",
];

export const knightGateLines = [
  "Bind thy name — the tavern wall remembers anglers who dare cast.",
  "The Moonwell Tavern: moonlit well, arcade in back, renown on the wall.",
  "Thou narratest with wrist and reel — not with a manifesto.",
];

export const warriorTrialNames = {
  platform: "I · Desert Sprint — platformer",
  race: "II · Stack Attack — Tetris",
  asteroids: "III · Veil Cure — Dr. Mario",
} as const;

export const warriorBriefLines = [
  "Three tavern arcade trials — speed goes on our wall.",
  "Borrowed scenery night: sprint, stack, cure the veil — then back to fishing.",
  "The well can wait. The cabinet cannot.",
  "Neighbor lore on X; the high scores are ours.",
];

export const warriorCompleteLines = [
  "The tavern wall chalks thy run — back to the well when ready.",
  "Arcade cleared — the bar approves.",
  "Even the degen table pretends not to stare. They fail.",
];

export const demplarWarriorChronicles = [
  "{angler} clears the tavern arcade — {score} on our wall.",
  "⚔ {angler} sprints, stacks, and cures the veil — {score} at the Moonwell.",
  "Rim tavern: {angler} earns {score} on the back-room track.",
  "{angler} survives three arcade trials — {score} in tavern chalk.",
];

export const demplarWarriorSubtexts = [
  "Run {platform} · Tetris {race} · Dr Mario {asteroids}",
  "Back-room cabinet favors the bold — tavern night keeps the score.",
  "Arcade at the rim: speed over story, renown over doubt.",
];

export const knightNoticeBoard = [
  "Rim notice: arcade cabinet lit — fish or play the back-room trials.",
  "Neighbor adventures post on @DemplarOfficial — here we fish live at the Great Table.",
  "House rule: we relay their lore, we don't speak for them.",
  "Tonight claim only the strike window — and maybe the high score.",
];

export const bigboardHeadlines = [
  "Tavern Chronicle",
  "Moonwell Ledger",
  "Great Table",
  "Overheard at the bar",
];

export const bigboardMoodLines: Record<string, string> = {
  quiet: "Shadow breathes — the tavern waits; someone should cast.",
  gathering: "Patrons pull up chairs · lamps low, well bright",
  live: "⚔ Someone is at the well or the arcade",
  chronicle: "Tavern deed posted — neighbor lore stays on X",
  celebration: "Legends ignite at the bar — the wall remembers",
};

export const bigboardSpotlightKickers = [
  "Overheard at the Moonwell…",
  "Tavern chalk flows — our wall, our scores",
  "The back-room cabinet hums…",
  "Where the well ripples, the tavern remembers anglers",
];

export const bigboardFeedHints: Record<string, string> = {
  quiet: "Pull up a chair — this is a tavern, not a crusade.",
  gathering: "Tales arrive one at a time — house rules apply.",
  live: "Watch the Great Table — an angler is playing.",
  chronicle: "Hold — we inscribe a tavern deed.",
  celebration: "Tonight the tavern wall will remember.",
};
