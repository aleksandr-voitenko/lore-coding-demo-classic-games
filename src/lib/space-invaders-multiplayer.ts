import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerRealtimeRoomSnapshot,
} from "./multiplayer/protocol";
import {
  createInitialSpaceInvadersGame,
  type CreateSpaceInvadersGameOptions,
  type SpaceInvadersGameState,
  type SpaceInvadersPlayerShot,
} from "./space-invaders-game-engine";
import {
  createInitialSpaceInvadersPlayerState,
  type SpaceInvadersPlayerOwnedState,
} from "./space-invaders/player-state";

export const SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS = [
  "ship-a",
  "ship-b",
] as const;

export type SpaceInvadersShipSeat =
  (typeof SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS)[number];

export type SpaceInvadersMultiplayerRoomSeat = {
  id: SpaceInvadersShipSeat;
  label: string;
  required: true;
};

export const SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS = [
  {
    id: "ship-a",
    label: "Ship A",
    required: true,
  },
  {
    id: "ship-b",
    label: "Ship B",
    required: true,
  },
] as const satisfies readonly SpaceInvadersMultiplayerRoomSeat[];

export type SpaceInvadersMultiplayerSharedState = Pick<
  SpaceInvadersGameState,
  | "alienCount"
  | "alienFreezeTicks"
  | "baseY"
  | "boardHeight"
  | "boardWidth"
  | "explosions"
  | "hitStreak"
  | "invaderBurst"
  | "invaderShotCooldownTicks"
  | "invaderShots"
  | "invaders"
  | "lives"
  | "marchDirection"
  | "multiKillCombo"
  | "nextExplosionId"
  | "nextInvaderShotId"
  | "nextPlayerShotId"
  | "nextPowerUpId"
  | "nextScorePopupId"
  | "powerUps"
  | "revengeVolleys"
  | "score"
  | "scorePopups"
  | "status"
  | "ufo"
  | "ufoHitStreak"
>;

export type SpaceInvadersShipState = SpaceInvadersPlayerOwnedState & {
  seat: SpaceInvadersShipSeat;
};

export type SpaceInvadersMultiplayerShips = Record<
  SpaceInvadersShipSeat,
  SpaceInvadersShipState
>;

export type SpaceInvadersMultiplayerGameState =
  SpaceInvadersMultiplayerSharedState & {
    ships: SpaceInvadersMultiplayerShips;
  };

export type CreateSpaceInvadersMultiplayerGameOptions =
  CreateSpaceInvadersGameOptions;

export type SpaceInvadersMultiplayerGameSnapshot =
  MultiplayerRealtimeGameSnapshot<
    "space-invaders",
    SpaceInvadersMultiplayerGameState
  >;

export type SpaceInvadersMultiplayerRoomSnapshot =
  MultiplayerRealtimeRoomSnapshot<SpaceInvadersMultiplayerGameSnapshot>;

export function createInitialSpaceInvadersMultiplayerGame(
  options: CreateSpaceInvadersMultiplayerGameOptions = {},
): SpaceInvadersMultiplayerGameState {
  const initialGame = createInitialSpaceInvadersGame(options);

  return {
    ...pickSpaceInvadersMultiplayerSharedState(initialGame),
    ships: createInitialSpaceInvadersMultiplayerShips(
      initialGame.boardWidth,
      initialGame.boardHeight,
    ),
  };
}

export function cloneSpaceInvadersMultiplayerGame(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  return {
    ...game,
    explosions: game.explosions.map(cloneObject),
    invaderBurst: cloneNullableObject(game.invaderBurst),
    invaderShots: game.invaderShots.map(cloneObject),
    invaders: game.invaders.map(cloneObject),
    multiKillCombo: cloneNullableObject(game.multiKillCombo),
    powerUps: game.powerUps.map(cloneObject),
    revengeVolleys: game.revengeVolleys.map((volley) => ({
      ...volley,
      invaderIds: [...volley.invaderIds],
    })),
    scorePopups: game.scorePopups.map(cloneObject),
    ships: cloneSpaceInvadersMultiplayerShips(game.ships),
    ufo: { ...game.ufo },
  };
}

export function isSpaceInvadersShipSeat(
  value: unknown,
): value is SpaceInvadersShipSeat {
  return SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.includes(
    value as SpaceInvadersShipSeat,
  );
}

function createInitialSpaceInvadersMultiplayerShips(
  boardWidth: number,
  boardHeight: number,
): SpaceInvadersMultiplayerShips {
  return {
    "ship-a": createInitialSpaceInvadersShipState("ship-a", boardWidth, boardHeight),
    "ship-b": createInitialSpaceInvadersShipState("ship-b", boardWidth, boardHeight),
  };
}

function createInitialSpaceInvadersShipState(
  seat: SpaceInvadersShipSeat,
  boardWidth: number,
  boardHeight: number,
): SpaceInvadersShipState {
  const ship = createInitialSpaceInvadersPlayerState(boardWidth, boardHeight);

  return {
    ...ship,
    player: {
      ...ship.player,
      x: getInitialSpaceInvadersShipX(boardWidth, ship.player.width, seat),
    },
    seat,
  };
}

function getInitialSpaceInvadersShipX(
  boardWidth: number,
  shipWidth: number,
  seat: SpaceInvadersShipSeat,
) {
  const centerX = seat === "ship-a" ? boardWidth / 3 : (boardWidth * 2) / 3;

  return centerX - shipWidth / 2;
}

function pickSpaceInvadersMultiplayerSharedState(
  game: SpaceInvadersGameState,
): SpaceInvadersMultiplayerSharedState {
  return {
    alienCount: game.alienCount,
    alienFreezeTicks: game.alienFreezeTicks,
    baseY: game.baseY,
    boardHeight: game.boardHeight,
    boardWidth: game.boardWidth,
    explosions: game.explosions,
    hitStreak: game.hitStreak,
    invaderBurst: game.invaderBurst,
    invaderShotCooldownTicks: game.invaderShotCooldownTicks,
    invaderShots: game.invaderShots,
    invaders: game.invaders,
    lives: game.lives,
    marchDirection: game.marchDirection,
    multiKillCombo: game.multiKillCombo,
    nextExplosionId: game.nextExplosionId,
    nextInvaderShotId: game.nextInvaderShotId,
    nextPlayerShotId: game.nextPlayerShotId,
    nextPowerUpId: game.nextPowerUpId,
    nextScorePopupId: game.nextScorePopupId,
    powerUps: game.powerUps,
    revengeVolleys: game.revengeVolleys,
    score: game.score,
    scorePopups: game.scorePopups,
    status: game.status,
    ufo: game.ufo,
    ufoHitStreak: game.ufoHitStreak,
  };
}

function cloneSpaceInvadersMultiplayerShips(
  ships: SpaceInvadersMultiplayerShips,
): SpaceInvadersMultiplayerShips {
  return {
    "ship-a": cloneSpaceInvadersShipState(ships["ship-a"]),
    "ship-b": cloneSpaceInvadersShipState(ships["ship-b"]),
  };
}

function cloneSpaceInvadersShipState(
  ship: SpaceInvadersShipState,
): SpaceInvadersShipState {
  return {
    ...ship,
    player: { ...ship.player },
    playerBurst: cloneNullableObject(ship.playerBurst),
    playerShots: ship.playerShots.map(cloneSpaceInvadersPlayerShot),
  };
}

function cloneSpaceInvadersPlayerShot(
  shot: SpaceInvadersPlayerShot,
): SpaceInvadersPlayerShot {
  return {
    ...shot,
    ...(shot.damagedInvaderIds === undefined
      ? {}
      : { damagedInvaderIds: [...shot.damagedInvaderIds] }),
  };
}

function cloneNullableObject<T extends object>(value: T | null): T | null {
  return value === null ? null : { ...value };
}

function cloneObject<T extends object>(value: T): T {
  return { ...value };
}
