import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerRealtimeRoomSnapshot,
} from "./multiplayer/protocol";
import {
  createInitialSpaceInvadersGame,
  type CreateSpaceInvadersGameOptions,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
  type SpaceInvadersPlayerShot,
  type SpaceInvadersPowerUp,
  type SpaceInvadersRandomSource,
} from "./space-invaders-game-engine";
import {
  EXPLOSION_PADDING_BY_KIND,
  EXPLOSION_TTL_TICKS,
  INVADER_HIT_RECOVERY_TICKS,
  PLAYER_SPEED,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_EXPLOSION_VARIANTS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
} from "./space-invaders/constants";
import { clamp, rectanglesIntersect } from "./space-invaders/geometry";
import {
  createInitialSpaceInvadersPlayerState,
  hasSpaceInvadersPlayerShield,
  isSpaceInvadersPlayerRespawning,
  type SpaceInvadersPlayerOwnedState,
} from "./space-invaders/player-state";
import {
  createInitialPlayerBurstState,
  createPlayerShots,
  isInvaderShotDangerous,
} from "./space-invaders/projectiles";
import { getRandomIndex } from "./space-invaders/random";
import type { SpaceInvadersScoreTarget } from "./space-invaders/types";

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
  isActive: boolean;
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

export function resolveSpaceInvadersMultiplayerInvaderShotHits(
  game: SpaceInvadersMultiplayerGameState,
  random: SpaceInvadersRandomSource = Math.random,
): SpaceInvadersMultiplayerGameState {
  if (game.invaderShots.length === 0) {
    return game;
  }

  const consumedShotIds = new Set<string>();
  const destroyedSeats = new Set<SpaceInvadersShipSeat>();

  for (const shot of game.invaderShots) {
    if (!isInvaderShotDangerous(shot)) {
      continue;
    }

    const hitSeats = getSpaceInvadersMultiplayerInvaderShotHitSeats(game, shot);

    if (hitSeats.length === 0) {
      continue;
    }

    const shieldedSeats = hitSeats.filter((seat) =>
      canSpaceInvadersMultiplayerShipAbsorbHit(game.ships[seat]),
    );
    const vulnerableSeats = hitSeats.filter((seat) =>
      canSpaceInvadersMultiplayerShipBeDamaged(game.ships[seat], shot),
    );

    if (shieldedSeats.length > 0 || vulnerableSeats.length > 0) {
      consumedShotIds.add(shot.id);
    }

    for (const seat of vulnerableSeats) {
      destroyedSeats.add(seat);
    }
  }

  if (consumedShotIds.size === 0) {
    return game;
  }

  const invaderShots = game.invaderShots.filter(
    (shot) => !consumedShotIds.has(shot.id),
  );

  if (destroyedSeats.size === 0) {
    return {
      ...game,
      invaderShots,
    };
  }

  return damageSpaceInvadersMultiplayerShips(
    game,
    [...destroyedSeats],
    invaderShots,
    random,
  );
}

export function resolveSpaceInvadersMultiplayerPowerUpPickup(
  game: SpaceInvadersMultiplayerGameState,
  random: SpaceInvadersRandomSource = Math.random,
): SpaceInvadersMultiplayerGameState {
  if (game.powerUps.length === 0) {
    return game;
  }

  let nextGame = game;
  const remainingPowerUps: SpaceInvadersPowerUp[] = [];

  for (const powerUp of game.powerUps) {
    const recipient = getSpaceInvadersMultiplayerPowerUpRecipient(
      nextGame,
      powerUp,
      random,
    );

    if (recipient === null) {
      remainingPowerUps.push(powerUp);
      continue;
    }

    nextGame = applySpaceInvadersMultiplayerPowerUp(
      nextGame,
      recipient,
      powerUp,
    );
  }

  if (remainingPowerUps.length === game.powerUps.length) {
    return game;
  }

  return {
    ...nextGame,
    powerUps: remainingPowerUps,
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
    isActive: true,
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
    ship.isActive &&
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
    ship.isActive &&
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

function getSpaceInvadersMultiplayerInvaderShotHitSeats(
  game: SpaceInvadersMultiplayerGameState,
  shot: SpaceInvadersInvaderShot,
) {
  return SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.filter((seat) => {
    const ship = game.ships[seat];

    return ship.isActive && rectanglesIntersect(shot, ship.player);
  });
}

function canSpaceInvadersMultiplayerShipAbsorbHit(
  ship: SpaceInvadersShipState,
) {
  return (
    ship.isActive &&
    !isSpaceInvadersPlayerRespawning(ship) &&
    hasSpaceInvadersPlayerShield(ship)
  );
}

function canSpaceInvadersMultiplayerShipBeDamaged(
  ship: SpaceInvadersShipState,
  target: SpaceInvadersScoreTarget,
) {
  return (
    ship.isActive &&
    !isSpaceInvadersPlayerRespawning(ship) &&
    !hasSpaceInvadersPlayerShield(ship) &&
    rectanglesIntersect(target, ship.player)
  );
}

function damageSpaceInvadersMultiplayerShips(
  game: SpaceInvadersMultiplayerGameState,
  destroyedSeats: SpaceInvadersShipSeat[],
  invaderShots: SpaceInvadersInvaderShot[],
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  // Resolve scarce respawn ownership before explosion variants consume randomness.
  const respawningSeats = chooseSpaceInvadersMultiplayerRespawningSeats(
    destroyedSeats,
    game.lives,
    random,
  );
  let nextGame: SpaceInvadersMultiplayerGameState = {
    ...game,
    hitStreak: 0,
    invaderBurst: null,
    invaderShotCooldownTicks: INVADER_HIT_RECOVERY_TICKS,
    invaderShots,
    lives: Math.max(0, game.lives - destroyedSeats.length),
  };
  const nextShips: SpaceInvadersMultiplayerShips = { ...game.ships };

  for (const seat of destroyedSeats) {
    nextGame = createSpaceInvadersMultiplayerExplosion(
      nextGame,
      "player",
      game.ships[seat].player,
      random,
    );
    nextShips[seat] = damageSpaceInvadersMultiplayerShip(
      game.ships[seat],
      game,
      respawningSeats.has(seat),
    );
  }

  return {
    ...nextGame,
    ships: nextShips,
    status: hasAnyActiveSpaceInvadersMultiplayerShip(nextShips)
      ? nextGame.status
      : "lost",
  };
}

function chooseSpaceInvadersMultiplayerRespawningSeats(
  destroyedSeats: SpaceInvadersShipSeat[],
  lives: number,
  random: SpaceInvadersRandomSource,
) {
  const respawnCount = Math.min(lives, destroyedSeats.length);

  if (respawnCount <= 0) {
    return new Set<SpaceInvadersShipSeat>();
  }

  if (respawnCount >= destroyedSeats.length) {
    return new Set(destroyedSeats);
  }

  const chosenSeat =
    destroyedSeats[getRandomIndex(destroyedSeats.length, random)] ??
    destroyedSeats[0];

  return new Set(chosenSeat === undefined ? [] : [chosenSeat]);
}

function damageSpaceInvadersMultiplayerShip(
  ship: SpaceInvadersShipState,
  game: Pick<SpaceInvadersMultiplayerGameState, "boardHeight" | "boardWidth">,
  shouldRespawn: boolean,
): SpaceInvadersShipState {
  const initialShip = createInitialSpaceInvadersShipState(
    ship.seat,
    game.boardWidth,
    game.boardHeight,
  );

  return {
    ...ship,
    isActive: shouldRespawn,
    player: initialShip.player,
    playerBurst: null,
    playerRespawnTicks: shouldRespawn ? SPACE_INVADERS_PLAYER_RESPAWN_TICKS : 0,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasArmoredHit: false,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
  };
}

function hasAnyActiveSpaceInvadersMultiplayerShip(
  ships: SpaceInvadersMultiplayerShips,
) {
  return SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.some((seat) => ships[seat].isActive);
}

function getSpaceInvadersMultiplayerPowerUpRecipient(
  game: SpaceInvadersMultiplayerGameState,
  powerUp: SpaceInvadersPowerUp,
  random: SpaceInvadersRandomSource,
): SpaceInvadersShipSeat | null {
  const collectingSeats = SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.filter((seat) =>
    canSpaceInvadersMultiplayerShipCollectPowerUp(game.ships[seat], powerUp),
  );

  if (collectingSeats.length === 0) {
    return null;
  }

  if (collectingSeats.length === 1) {
    return collectingSeats[0] ?? null;
  }

  return collectingSeats[getRandomIndex(collectingSeats.length, random)] ?? null;
}

function canSpaceInvadersMultiplayerShipCollectPowerUp(
  ship: SpaceInvadersShipState,
  powerUp: SpaceInvadersPowerUp,
) {
  return (
    ship.isActive &&
    !isSpaceInvadersPlayerRespawning(ship) &&
    rectanglesIntersect(powerUp, ship.player)
  );
}

function applySpaceInvadersMultiplayerPowerUp(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
  powerUp: SpaceInvadersPowerUp,
): SpaceInvadersMultiplayerGameState {
  switch (powerUp.kind) {
    case "bonus-score":
      return createSpaceInvadersMultiplayerScorePopup(
        {
          ...game,
          score: game.score + SPACE_INVADERS_BONUS_SCORE_POINTS,
        },
        powerUp,
        SPACE_INVADERS_BONUS_SCORE_POINTS,
      );
    case "extra-life":
      return {
        ...game,
        lives: game.lives + 1,
      };
    case "freeze":
      return {
        ...game,
        alienFreezeTicks: Math.max(
          game.alienFreezeTicks,
          SPACE_INVADERS_ALIEN_FREEZE_TICKS,
        ),
      };
    case "shield":
      return updateSpaceInvadersMultiplayerShip(game, seat, {
        ...game.ships[seat],
        playerShieldTicks: Math.max(
          game.ships[seat].playerShieldTicks,
          SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
        ),
      });
    case "burst-shot":
    case "piercing-laser":
    case "shotgun-shot":
      return updateSpaceInvadersMultiplayerShip(game, seat, {
        ...game.ships[seat],
        pendingShotPowerUp: powerUp.kind,
      });
  }
}

function createSpaceInvadersMultiplayerExplosion(
  game: SpaceInvadersMultiplayerGameState,
  kind: "player",
  target: SpaceInvadersScoreTarget,
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  const padding = EXPLOSION_PADDING_BY_KIND[kind];
  const height = target.height + padding * 2;
  const width = target.width + padding * 2;
  const variant =
    SPACE_INVADERS_EXPLOSION_VARIANTS[
      getRandomIndex(SPACE_INVADERS_EXPLOSION_VARIANTS.length, random)
    ] ?? 1;

  return {
    ...game,
    explosions: [
      ...game.explosions,
      {
        ageTicks: 0,
        height,
        id: `explosion-${game.nextExplosionId}`,
        kind,
        ttlTicks: EXPLOSION_TTL_TICKS,
        variant,
        width,
        x: target.x + target.width / 2 - width / 2,
        y: target.y + target.height / 2 - height / 2,
      },
    ],
    nextExplosionId: game.nextExplosionId + 1,
  };
}

function createSpaceInvadersMultiplayerScorePopup(
  game: SpaceInvadersMultiplayerGameState,
  target: SpaceInvadersScoreTarget,
  points: number,
): SpaceInvadersMultiplayerGameState {
  return {
    ...game,
    nextScorePopupId: game.nextScorePopupId + 1,
    scorePopups: [
      ...game.scorePopups,
      {
        ageTicks: 0,
        height: target.height,
        id: `score-popup-${game.nextScorePopupId}`,
        points,
        ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
        width: target.width,
        x: target.x,
        y: target.y,
      },
    ],
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
