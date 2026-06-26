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
import { PLAYER_SPEED } from "./space-invaders/constants";
import { clamp } from "./space-invaders/geometry";
import {
  createInitialSpaceInvadersPlayerState,
  isSpaceInvadersPlayerRespawning,
  type SpaceInvadersPlayerOwnedState,
} from "./space-invaders/player-state";
import {
  createInitialPlayerBurstState,
  createPlayerShots,
} from "./space-invaders/projectiles";

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

export function moveSpaceInvadersMultiplayerShip(
  game: SpaceInvadersMultiplayerGameState,
  seat: unknown,
  deltaX: number,
): SpaceInvadersMultiplayerGameState {
  if (!isSpaceInvadersShipSeat(seat)) {
    return game;
  }

  const ship = game.ships[seat];

  if (!canMoveSpaceInvadersMultiplayerShip(game, ship)) {
    return game;
  }

  const nextX = clamp(ship.player.x + deltaX, 0, game.boardWidth - ship.player.width);

  if (nextX === ship.player.x) {
    return game;
  }

  return updateSpaceInvadersMultiplayerShip(game, seat, {
    ...ship,
    player: {
      ...ship.player,
      x: nextX,
    },
  });
}

export function moveSpaceInvadersMultiplayerShipLeft(
  game: SpaceInvadersMultiplayerGameState,
  seat: unknown,
): SpaceInvadersMultiplayerGameState {
  return moveSpaceInvadersMultiplayerShip(game, seat, -PLAYER_SPEED);
}

export function moveSpaceInvadersMultiplayerShipRight(
  game: SpaceInvadersMultiplayerGameState,
  seat: unknown,
): SpaceInvadersMultiplayerGameState {
  return moveSpaceInvadersMultiplayerShip(game, seat, PLAYER_SPEED);
}

export function fireSpaceInvadersMultiplayerShipShot(
  game: SpaceInvadersMultiplayerGameState,
  seat: unknown,
): SpaceInvadersMultiplayerGameState {
  if (!isSpaceInvadersShipSeat(seat)) {
    return game;
  }

  const ship = game.ships[seat];

  if (!canFireSpaceInvadersMultiplayerShipShot(game, ship)) {
    return game;
  }

  const createdShots = createPlayerShots(
    ship.player,
    game.nextPlayerShotId,
    ship.pendingShotPowerUp,
  );

  return {
    ...updateSpaceInvadersMultiplayerShip(game, seat, {
      ...ship,
      pendingShotPowerUp: null,
      playerBurst:
        ship.pendingShotPowerUp === "burst-shot"
          ? createInitialPlayerBurstState(createdShots.length)
          : null,
      playerShots: createdShots,
    }),
    nextPlayerShotId: game.nextPlayerShotId + createdShots.length,
  };
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

function canMoveSpaceInvadersMultiplayerShip(
  game: Pick<SpaceInvadersMultiplayerGameState, "status">,
  ship: SpaceInvadersShipState,
) {
  return (
    game.status !== "lost" &&
    game.status !== "won" &&
    !isSpaceInvadersPlayerRespawning(ship)
  );
}

function canFireSpaceInvadersMultiplayerShipShot(
  game: Pick<SpaceInvadersMultiplayerGameState, "status">,
  ship: SpaceInvadersShipState,
) {
  return (
    game.status === "running" &&
    !isSpaceInvadersPlayerRespawning(ship) &&
    ship.playerBurst === null &&
    ship.playerShots.length === 0
  );
}

function updateSpaceInvadersMultiplayerShip(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
  ship: SpaceInvadersShipState,
): SpaceInvadersMultiplayerGameState {
  return {
    ...game,
    ships: {
      ...game.ships,
      [seat]: ship,
    },
  };
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
