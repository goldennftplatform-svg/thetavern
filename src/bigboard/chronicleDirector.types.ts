export type Deed = {
  ts?: number;
  kind?: string;
  chronicle?: string;
  text?: string;
  renown?: number;
  fish?: string;
  rarity?: string;
  from?: string;
  game?: string;
  outcome?: string;
  cards?: Array<{ label: string; rank: number; suit: string }>;
  target?: number;
  combo?: boolean;
  demplar?: boolean;
  correct?: boolean;
  milestone?: number;
  bold?: boolean;
};
