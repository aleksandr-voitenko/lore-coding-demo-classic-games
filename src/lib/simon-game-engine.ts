export type SimonPadId = "green" | "red" | "yellow" | "blue";
export type SimonStatus =
  | "ready"
  | "showing"
  | "input"
  | "correct"
  | "missed"
  | "paused"
  | "lost"
  | "won";

export type SimonPlayableStatus = Exclude<SimonStatus, "ready" | "paused" | "lost" | "won">;

export type SimonGameState = {
  activePad: SimonPadId | null;
  inputIndex: number;
  pausedFrom: SimonPlayableStatus | null;
  playbackIndex: number;
  round: number;
  score: number;
  sequence: SimonPadId[];
  status: SimonStatus;
  winTarget: number;
};

export type CreateSimonGameOptions = {
  winTarget?: number;
};

export type SimonRandomOptions = {
  random?: RandomSource;
};

type RandomSource = () => number;

export const SIMON_PADS = ["green", "red", "yellow", "blue"] as const;
export const SIMON_DEFAULT_WIN_TARGET = 12;
export const SIMON_PLAYBACK_DELAY_MS = 520;
export const SIMON_INPUT_FLASH_MS = 180;
export const SIMON_ROUND_COMPLETE_DELAY_MS = 1_000;
export const SIMON_MISS_FEEDBACK_DELAY_MS = 1_000;
export const SIMON_WIN_TARGET_OPTIONS = [8, 12, 16] as const;

export function createInitialSimonGame({
  winTarget = SIMON_DEFAULT_WIN_TARGET,
}: CreateSimonGameOptions = {}): SimonGameState {
  return {
    activePad: null,
    inputIndex: 0,
    pausedFrom: null,
    playbackIndex: 0,
    round: 0,
    score: 0,
    sequence: [],
    status: "ready",
    winTarget: normalizeWinTarget(winTarget),
  };
}

export function startSimonGame(
  game: SimonGameState,
  { random = Math.random }: SimonRandomOptions = {},
): SimonGameState {
  if (
    game.status === "showing" ||
    game.status === "input" ||
    game.status === "correct" ||
    game.status === "missed"
  ) {
    return game;
  }

  if (game.status === "paused") {
    return {
      ...game,
      activePad: null,
      pausedFrom: null,
      status: game.pausedFrom ?? "input",
    };
  }

  return createFirstRound(game.winTarget, random);
}

export function pauseSimonGame(game: SimonGameState): SimonGameState {
  if (
    game.status !== "showing" &&
    game.status !== "input" &&
    game.status !== "correct" &&
    game.status !== "missed"
  ) {
    return game;
  }

  return {
    ...game,
    activePad: null,
    pausedFrom: game.status,
    status: "paused",
  };
}

export function restartSimonGame(
  game: Pick<SimonGameState, "winTarget"> = { winTarget: SIMON_DEFAULT_WIN_TARGET },
  { random = Math.random }: SimonRandomOptions = {},
): SimonGameState {
  return createFirstRound(game.winTarget, random);
}

export function advanceSimonPlayback(game: SimonGameState): SimonGameState {
  if (game.status !== "showing") {
    return game;
  }

  if (game.activePad === null) {
    return {
      ...game,
      activePad: game.sequence[game.playbackIndex] ?? null,
    };
  }

  const nextPlaybackIndex = game.playbackIndex + 1;

  if (nextPlaybackIndex >= game.sequence.length) {
    return {
      ...game,
      activePad: null,
      inputIndex: 0,
      playbackIndex: 0,
      status: "input",
    };
  }

  return {
    ...game,
    activePad: null,
    playbackIndex: nextPlaybackIndex,
  };
}

export function advanceSimonRound(
  game: SimonGameState,
  { random = Math.random }: SimonRandomOptions = {},
): SimonGameState {
  if (game.status !== "correct") {
    return game;
  }

  const sequence = appendRandomSimonPad(game.sequence, random);

  return {
    ...game,
    activePad: sequence[0] ?? null,
    inputIndex: 0,
    pausedFrom: null,
    playbackIndex: 0,
    round: sequence.length,
    sequence,
    status: "showing",
  };
}

export function advanceSimonMiss(game: SimonGameState): SimonGameState {
  if (game.status !== "missed") {
    return game;
  }

  return {
    ...game,
    activePad: null,
    inputIndex: 0,
    pausedFrom: null,
    playbackIndex: 0,
    status: "lost",
  };
}

export function playSimonPad(
  game: SimonGameState,
  pad: SimonPadId,
): SimonGameState {
  if (game.status !== "input") {
    return game;
  }

  if (game.sequence[game.inputIndex] !== pad) {
    return {
      ...game,
      activePad: pad,
      inputIndex: 0,
      pausedFrom: null,
      playbackIndex: 0,
      status: "missed",
    };
  }

  const nextInputIndex = game.inputIndex + 1;

  if (nextInputIndex < game.sequence.length) {
    return {
      ...game,
      activePad: pad,
      inputIndex: nextInputIndex,
    };
  }

  if (game.sequence.length >= game.winTarget) {
    return {
      ...game,
      activePad: pad,
      inputIndex: nextInputIndex,
      pausedFrom: null,
      score: game.sequence.length,
      status: "won",
    };
  }

  return {
    ...game,
    activePad: pad,
    inputIndex: nextInputIndex,
    pausedFrom: null,
    playbackIndex: 0,
    score: game.sequence.length,
    status: "correct",
  };
}

export function clearSimonActivePad(game: SimonGameState): SimonGameState {
  if (
    (game.status !== "input" &&
      game.status !== "correct" &&
      game.status !== "missed") ||
    game.activePad === null
  ) {
    return game;
  }

  return {
    ...game,
    activePad: null,
  };
}

export function getSimonPlaybackDelay() {
  return SIMON_PLAYBACK_DELAY_MS;
}

export function getSimonInputFlashDelay() {
  return SIMON_INPUT_FLASH_MS;
}

export function getSimonRoundCompleteDelay() {
  return SIMON_ROUND_COMPLETE_DELAY_MS;
}

export function getSimonMissFeedbackDelay() {
  return SIMON_MISS_FEEDBACK_DELAY_MS;
}

export function getRandomSimonPad(random: RandomSource = Math.random): SimonPadId {
  const index = Math.min(SIMON_PADS.length - 1, Math.floor(random() * SIMON_PADS.length));

  return SIMON_PADS[index] ?? SIMON_PADS[0];
}

function createFirstRound(winTarget: number, random: RandomSource): SimonGameState {
  const sequence = [getRandomSimonPad(random)];

  return {
    ...createInitialSimonGame({ winTarget }),
    activePad: sequence[0] ?? null,
    round: 1,
    sequence,
    status: "showing",
  };
}

function appendRandomSimonPad(sequence: SimonPadId[], random: RandomSource) {
  return [...sequence, getRandomSimonPad(random)];
}

function normalizeWinTarget(winTarget: number) {
  return Math.max(1, Math.floor(winTarget));
}
