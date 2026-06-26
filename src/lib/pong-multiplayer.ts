import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerTerminalSummary,
} from "./multiplayer/protocol";
import type { PrivateRoom, PrivateRoomSeat, PrivateRoomSettingValue } from "./multiplayer/room";
import {
  advancePongDuelGame,
  createInitialPongGame,
  getPongTickDelay,
  movePongPaddleDown,
  movePongPaddleUp,
  pausePongGame,
  restartPongGame,
  startPongGame,
  type CreatePongGameOptions,
  type PongGameState,
  type PongPaddleMoveDirection,
  type PongSide,
  type PongStatus,
} from "./pong-game-engine";

export type PongMultiplayerErrorCode =
  | "missing-required-seats"
  | "participant-not-found"
  | "participant-not-seated"
  | "unsupported-room-game";

export type PongMultiplayerError = {
  code: PongMultiplayerErrorCode;
  error: string;
  success: false;
};

export type PongMultiplayerGameResult =
  | {
      game: PongGameState;
      success: true;
    }
  | PongMultiplayerError;

export type PongMultiplayerParticipantSideResult =
  | {
      side: PongSide;
      success: true;
    }
  | PongMultiplayerError;

export type PongMultiplayerHeldInput = {
  down?: boolean;
  up?: boolean;
};

export type PongMultiplayerHeldInputs = Readonly<
  Partial<Record<PongSide, PongMultiplayerHeldInput>>
>;

export type PongMultiplayerClientInput =
  | {
      direction: PongPaddleMoveDirection | null;
      type: "pong.setPaddleDirection";
    }
  | {
      type: "pong.serve";
    };

export type PongMultiplayerTerminalSummary = MultiplayerTerminalSummary<
  Extract<PongStatus, "lost" | "won">,
  {
    leftScore: number;
    rightScore: number;
    targetScore: number;
    winnerParticipantId: string | null;
    winnerSeatId: PongSide;
  }
>;

export type PongMultiplayerGameSnapshot = MultiplayerRealtimeGameSnapshot<
  "pong",
  PongGameState,
  {
    heldInputs: PongMultiplayerHeldInputs;
    summary?: PongMultiplayerTerminalSummary;
  }
>;

type PongMultiplayerRoomSeats = {
  left: PrivateRoomSeat;
  right: PrivateRoomSeat;
};

type PongMultiplayerRoomValidationResult =
  | {
      seats: PongMultiplayerRoomSeats;
      success: true;
    }
  | PongMultiplayerError;

const PONG_ROOM_SIDES = ["left", "right"] as const satisfies readonly PongSide[];

export const PONG_MULTIPLAYER_PROJECTION_MAX_MS = 120;

export function parsePongMultiplayerRoomSettings(
  parameters: PrivateRoom["settings"]["parameters"] = {},
): CreatePongGameOptions {
  const options: CreatePongGameOptions = {};
  const boardSize = parameters["pong-board-size"];
  const targetScore = parseFiniteSettingNumber(parameters["pong-target"]);

  if (typeof boardSize === "string") {
    const match = boardSize.trim().match(/^(\d+)x(\d+)$/u);

    if (match !== null) {
      options.boardWidth = Number(match[1]);
      options.boardHeight = Number(match[2]);
    }
  }

  if (targetScore !== null) {
    options.targetScore = targetScore;
  }

  return options;
}

export function createInitialPongMultiplayerGame(
  room: PrivateRoom,
): PongMultiplayerGameResult {
  const roomValidation = validatePongMultiplayerRoom(room);

  if (!roomValidation.success) {
    return roomValidation;
  }

  return {
    game: createInitialPongGame(parsePongMultiplayerRoomSettings(room.settings.parameters)),
    success: true,
  };
}

export function getPongMultiplayerParticipantSide(
  room: PrivateRoom,
  participantId: unknown,
): PongMultiplayerParticipantSideResult {
  const roomValidation = validatePongMultiplayerRoom(room);

  if (!roomValidation.success) {
    return roomValidation;
  }

  const normalizedParticipantId =
    typeof participantId === "string" ? participantId.trim() : "";

  const participant = room.participants.find(
    (entry) => entry.id === normalizedParticipantId,
  );

  if (participant === undefined) {
    return createPongMultiplayerError(
      "participant-not-found",
      "Participant is not in the Pong room.",
    );
  }

  for (const side of PONG_ROOM_SIDES) {
    if (roomValidation.seats[side].occupiedByParticipantId === participant.id) {
      return {
        side,
        success: true,
      };
    }
  }

  return createPongMultiplayerError(
    "participant-not-seated",
    "Participant does not occupy a Pong paddle seat.",
  );
}

export function applyPongMultiplayerHeldInputs(
  game: PongGameState,
  inputs: PongMultiplayerHeldInputs = {},
): PongGameState {
  let nextGame = game;

  for (const side of PONG_ROOM_SIDES) {
    const direction = getHeldPaddleDirection(inputs[side]);

    if (direction === "up") {
      nextGame = movePongPaddleUp(nextGame, side);
    } else if (direction === "down") {
      nextGame = movePongPaddleDown(nextGame, side);
    }
  }

  return nextGame;
}

export function advancePongMultiplayerTick(
  game: PongGameState,
  inputs: PongMultiplayerHeldInputs = {},
): PongGameState {
  if (game.status === "paused") {
    return game;
  }

  return advancePongDuelGame(applyPongMultiplayerHeldInputs(game, inputs));
}

export function getPongMultiplayerProjectionTicks(elapsedMs: number) {
  if (elapsedMs <= 0) {
    return 0;
  }

  const tickDelayMs = getPongTickDelay();

  if (tickDelayMs <= 0) {
    return 0;
  }

  return Math.floor(
    Math.min(elapsedMs, PONG_MULTIPLAYER_PROJECTION_MAX_MS) / tickDelayMs,
  );
}

export function projectPongMultiplayerGame(
  game: PongGameState,
  inputs: PongMultiplayerHeldInputs,
  elapsedMs: number,
): PongGameState {
  if (game.status !== "running") {
    return game;
  }

  const projectionTicks = getPongMultiplayerProjectionTicks(elapsedMs);
  let projectedGame = game;

  for (let tickIndex = 0; tickIndex < projectionTicks; tickIndex += 1) {
    const nextGame = advancePongMultiplayerTick(projectedGame, inputs);

    if (nextGame.status !== "running") {
      break;
    }

    projectedGame = nextGame;
  }

  return projectedGame;
}

export function startPongMultiplayerGame(game: PongGameState): PongGameState {
  return startPongGame(game);
}

export function pausePongMultiplayerGame(game: PongGameState): PongGameState {
  return pausePongGame(game);
}

export function resumePongMultiplayerGame(game: PongGameState): PongGameState {
  return startPongGame(game);
}

export function restartPongMultiplayerGame(game: PongGameState): PongGameState {
  return restartPongGame(game);
}

function validatePongMultiplayerRoom(room: PrivateRoom): PongMultiplayerRoomValidationResult {
  if (room.settings.gameId !== "pong") {
    return createPongMultiplayerError(
      "unsupported-room-game",
      "Pong multiplayer only supports Pong rooms.",
    );
  }

  const leftSeat = findPongRoomSeat(room, "left");
  const rightSeat = findPongRoomSeat(room, "right");

  if (
    leftSeat === null ||
    rightSeat === null ||
    leftSeat.required !== true ||
    rightSeat.required !== true ||
    leftSeat.occupiedByParticipantId === null ||
    rightSeat.occupiedByParticipantId === null
  ) {
    return createPongMultiplayerError(
      "missing-required-seats",
      "Pong multiplayer requires occupied required left and right seats.",
    );
  }

  return {
    seats: {
      left: leftSeat,
      right: rightSeat,
    },
    success: true,
  };
}

function findPongRoomSeat(room: PrivateRoom, side: PongSide) {
  return room.seats.find((seat) => seat.id === side) ?? null;
}

function getHeldPaddleDirection(
  input: PongMultiplayerHeldInput | undefined,
): PongPaddleMoveDirection | null {
  if (input?.up === true && input.down !== true) {
    return "up";
  }

  if (input?.down === true && input.up !== true) {
    return "down";
  }

  return null;
}

function parseFiniteSettingNumber(value: PrivateRoomSettingValue | undefined) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function createPongMultiplayerError(
  code: PongMultiplayerErrorCode,
  error: string,
): PongMultiplayerError {
  return {
    code,
    error,
    success: false,
  };
}
