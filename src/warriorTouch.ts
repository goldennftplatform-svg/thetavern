/** On-screen + canvas touch for Demplar Warrior — keeps puzzle taps off mobile canvas. */

import type { DemplarWarrior } from "./minigames/demplarWarrior";

type WarriorTouchOpts = {
  touchFriendly: boolean;
  canvas: HTMLCanvasElement;
  getPhase: () => string;
  getGame: () => DemplarWarrior | null;
  buttons: {
    left: HTMLElement;
    right: HTMLElement;
    rotate: HTMLElement;
    drop: HTMLElement;
    hard: HTMLElement;
    jump: HTMLElement;
  };
};

function puzzleStage(game: DemplarWarrior | null): boolean {
  if (!game) return false;
  const s = game.stage;
  return s === "tetris" || s === "drmario";
}

function warriorActive(phase: string, game: DemplarWarrior | null): boolean {
  return phase === "demplar_warrior" && !!game;
}

function bindHold(
  btn: HTMLElement,
  onDown: () => void,
  onUp: () => void,
  gate: () => boolean,
) {
  const down = (e: PointerEvent) => {
    if (!gate()) return;
    e.preventDefault();
    onDown();
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* optional */
    }
  };
  const up = () => {
    onUp();
  };
  btn.addEventListener("pointerdown", down);
  btn.addEventListener("pointerup", up);
  btn.addEventListener("pointercancel", up);
  btn.addEventListener("pointerleave", up);
}

export function bindWarriorTouch(opts: WarriorTouchOpts): void {
  const { touchFriendly, canvas, getPhase, getGame, buttons } = opts;

  const puzzleGate = () => warriorActive(getPhase(), getGame()) && puzzleStage(getGame());
  const platformGate = () => {
    const game = getGame();
    return warriorActive(getPhase(), game) && game!.stage === "platform";
  };

  bindHold(
    buttons.left,
    () => getGame()?.steer(-1),
    () => getGame()?.releaseSteer(),
    puzzleGate,
  );
  bindHold(
    buttons.right,
    () => getGame()?.steer(1),
    () => getGame()?.releaseSteer(),
    puzzleGate,
  );
  bindHold(
    buttons.drop,
    () => {
      const game = getGame();
      if (game?.stage === "drmario") game.boost(true);
      else game?.boost(true);
    },
    () => {
      const game = getGame();
      if (game?.stage === "drmario") return;
      game?.boost(false);
    },
    puzzleGate,
  );

  buttons.rotate.addEventListener("pointerdown", (e) => {
    if (!puzzleGate()) return;
    e.preventDefault();
    getGame()?.jump();
  });

  buttons.hard.addEventListener("pointerdown", (e) => {
    if (!puzzleGate()) return;
    e.preventDefault();
    getGame()?.hardDrop();
  });

  bindHold(
    buttons.jump,
    () => getGame()?.jump(),
    () => getGame()?.releaseJump(),
    platformGate,
  );

  canvas.addEventListener("pointerdown", (e) => {
    const phase = getPhase();
    const game = getGame();
    if (!warriorActive(phase, game)) return;

    if (touchFriendly && puzzleStage(game)) return;

    const rect = canvas.getBoundingClientRect();
    game!.pointerDown(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
    );
  });

  canvas.addEventListener("pointermove", (e) => {
    const game = getGame();
    if (!warriorActive(getPhase(), game)) return;
    if (touchFriendly && puzzleStage(game)) return;

    const rect = canvas.getBoundingClientRect();
    game!.pointerMove(
      e.clientX - rect.left,
      e.clientY - rect.top,
      rect.width,
      rect.height,
    );
  });

  const pointerEnd = () => {
    const game = getGame();
    if (!game) return;
    game.pointerUp();
  };

  canvas.addEventListener("pointerup", pointerEnd);
  canvas.addEventListener("pointercancel", pointerEnd);
}
