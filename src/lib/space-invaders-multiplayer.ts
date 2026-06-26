import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerRealtimeRoomSnapshot,
  MultiplayerTerminalSummary,
} from "./multiplayer/protocol";
import {
  createInitialSpaceInvadersGame,
  type CreateSpaceInvadersGameOptions,
  type SpaceInvader,
  type SpaceInvadersDirection,
  type SpaceInvadersGameState,
  type SpaceInvadersInvaderShot,
  type SpaceInvadersPlayer,
  type SpaceInvadersPlayerShot,
  type SpaceInvadersPowerUp,
  type SpaceInvadersRandomSource,
} from "./space-invaders-game-engine";
import {
  DIVER_DROP_Y,
  DIVER_STEP_MULTIPLIER,
  EXPLOSION_PADDING_BY_KIND,
  EXPLOSION_TTL_TICKS,
  FORMATION_MAX_SPEED_MULTIPLIER,
  FORMATION_SPEEDUP_START_RATIO,
  INVADER_DROP_Y,
  INVADER_HIT_RECOVERY_TICKS,
  INVADER_STEP_X,
  PLAYER_SPEED,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_EXPLOSION_VARIANTS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  UFO_SPEED,
} from "./space-invaders/constants";
import {
  continueSpaceInvadersMultiKillCombo,
  createSpaceInvadersExplosion,
  deactivateSpaceInvadersUfo,
  finalizeSpaceInvadersMultiKillCombo,
  getProjectileCollisionExplosionTarget,
  maybeCreateSpaceInvadersPowerUpDrop,
} from "./space-invaders/effects";
import {
  createSpaceInvadersSplitterFragments,
  getInvaderHitPointsAfterPlayerShot,
} from "./space-invaders/formation";
import {
  clamp,
  getEntityCenterX,
  rectanglesIntersect,
} from "./space-invaders/geometry";
import { getInvaderCollisionBounds } from "./space-invaders/hitboxes";
import { advanceSpaceInvadersPlayerShots } from "./space-invaders/player-shots";
import {
  advanceSpaceInvadersPlayerBurst,
  createInitialSpaceInvadersPlayerState,
  hasSpaceInvadersPlayerShield,
  isSpaceInvadersPlayerRespawning,
  isSpaceInvadersPlayerVolleyFinished,
  type SpaceInvadersPlayerOwnedState,
} from "./space-invaders/player-state";
import {
  advanceInvaderShotPositions,
  advanceSpaceInvadersRevengeVolleys,
  createCommanderShardShots,
  createInitialPlayerBurstState,
  createPlayerShots,
  isInvaderShotDangerous,
  maybePrimeSpaceInvadersRevengeVolley,
  maybeFireInvaderShot,
} from "./space-invaders/projectiles";
import { getRandomIndex } from "./space-invaders/random";
import {
  getCombinedSpaceInvadersScoreTarget,
  resetSpaceInvadersHitStreak,
} from "./space-invaders/scoring";
import type { SpaceInvadersScoreTarget } from "./space-invaders/types";

type MultiplayerMineBlastInvaderDamage = {
  damagedArmoredInvaders: {
    hitPoints: number;
    invader: SpaceInvader;
  }[];
  destroyedInvaderPoints: number;
  destroyedInvaders: SpaceInvader[];
};

type MultiplayerPlayerShotDamageSets = Record<
  SpaceInvadersShipSeat,
  Set<string>
>;

type MultiplayerMineBlastDamageSets = {
  invaderShotIds: Set<string>;
  playerShotIds: MultiplayerPlayerShotDamageSets;
};

type MultiplayerMineBlastResolution = {
  didDamageShips: boolean;
  game: SpaceInvadersMultiplayerGameState;
};

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

export type SpaceInvadersMultiplayerTerminalSummary = MultiplayerTerminalSummary<
  Extract<SpaceInvadersMultiplayerGameState["status"], "lost" | "won">,
  {
    livesRemaining: number;
    remainingInvaders: number;
    result: Extract<SpaceInvadersMultiplayerGameState["status"], "lost" | "won">;
    score: number;
  }
>;

export type SpaceInvadersMultiplayerGameSnapshot =
  MultiplayerRealtimeGameSnapshot<
    "space-invaders",
    SpaceInvadersMultiplayerGameState,
    {
      summary?: SpaceInvadersMultiplayerTerminalSummary;
    }
  >;

export type SpaceInvadersMultiplayerRoomSnapshot =
  MultiplayerRealtimeRoomSnapshot<SpaceInvadersMultiplayerGameSnapshot>;

export type SpaceInvadersMultiplayerShipDirection = "left" | "right";

export type SpaceInvadersMultiplayerClientInput =
  | {
      direction: SpaceInvadersMultiplayerShipDirection | null;
      type: "space-invaders.setShipDirection";
    }
  | {
      type: "space-invaders.fire";
    };

export type SpaceInvadersMultiplayerHeldInput = {
  fire?: boolean;
  left?: boolean;
  right?: boolean;
};

export type SpaceInvadersMultiplayerHeldInputs = Readonly<
  Partial<Record<SpaceInvadersShipSeat, SpaceInvadersMultiplayerHeldInput>>
>;

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

export function applySpaceInvadersMultiplayerHeldInputs(
  game: SpaceInvadersMultiplayerGameState,
  inputs: SpaceInvadersMultiplayerHeldInputs = {},
): SpaceInvadersMultiplayerGameState {
  let nextGame = game;

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    const input = inputs[seat];

    if (input?.left === true && input.right !== true) {
      nextGame = moveSpaceInvadersMultiplayerShipLeft(nextGame, seat);
    } else if (input?.right === true && input.left !== true) {
      nextGame = moveSpaceInvadersMultiplayerShipRight(nextGame, seat);
    }
  }

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    if (inputs[seat]?.fire === true) {
      nextGame = fireSpaceInvadersMultiplayerShipShot(nextGame, seat);
    }
  }

  return nextGame;
}

export function advanceSpaceInvadersMultiplayerGameTick(
  game: SpaceInvadersMultiplayerGameState,
  inputs: SpaceInvadersMultiplayerHeldInputs = {},
  random: SpaceInvadersRandomSource = Math.random,
): SpaceInvadersMultiplayerGameState {
  if (game.status !== "running") {
    return game;
  }

  const gameAfterInput = applySpaceInvadersMultiplayerHeldInputs(game, inputs);
  const gameAfterExplosions =
    advanceSpaceInvadersMultiplayerExplosions(gameAfterInput);
  const gameAfterScorePopups =
    advanceSpaceInvadersMultiplayerScorePopups(gameAfterExplosions);
  const gameAfterMultiKillComboWindow =
    advanceSpaceInvadersMultiplayerMultiKillComboWindow(gameAfterScorePopups);
  const gameAfterPowerUps = advanceSpaceInvadersMultiplayerPowerUps(
    gameAfterMultiKillComboWindow,
    random,
  );
  const gameAfterPlayerShots = advanceSpaceInvadersMultiplayerPlayerShots(
    gameAfterPowerUps,
    random,
  );
  const gameAfterPlayerBursts =
    advanceSpaceInvadersMultiplayerPlayerBursts(gameAfterPlayerShots);
  const gameAfterMultiKillCombo =
    finalizeSpaceInvadersMultiplayerMultiKillComboIfVolleysEnded(
      gameAfterPlayerBursts,
    );
  const gameAfterPlayerVolleys =
    finalizeSpaceInvadersMultiplayerPlayerVolleys(gameAfterMultiKillCombo);
  const gameAfterInvaderShots = advanceSpaceInvadersMultiplayerInvaderShots(
    gameAfterPlayerVolleys,
    random,
  );

  if (
    gameAfterInvaderShots.status !== gameAfterPlayerVolleys.status ||
    gameAfterInvaderShots.lives < gameAfterPlayerVolleys.lives
  ) {
    return finalizeSpaceInvadersMultiplayerMultiKillCombo(gameAfterInvaderShots);
  }

  if (gameAfterInvaderShots.status === "won") {
    return finalizeSpaceInvadersMultiplayerMultiKillCombo(gameAfterInvaderShots);
  }

  const gameAfterRevengeVolleys =
    advanceSpaceInvadersMultiplayerRevengeVolleys(gameAfterInvaderShots);
  const { game: gameAfterFreezeTick, isFrozen: areAliensFrozen } =
    advanceSpaceInvadersMultiplayerAlienFreeze(gameAfterRevengeVolleys);

  if (areAliensFrozen) {
    return advanceSpaceInvadersMultiplayerShipRecovery(gameAfterFreezeTick);
  }

  const gameAfterInvaderFire =
    advanceSpaceInvadersMultiplayerInvaderFire(gameAfterFreezeTick);
  const gameAfterUfo = advanceSpaceInvadersMultiplayerUfo(gameAfterInvaderFire);
  const marchedGame = marchSpaceInvadersMultiplayerInvaders(gameAfterUfo);

  if (hasSpaceInvadersMultiplayerInvaderReachedBase(marchedGame)) {
    return finalizeSpaceInvadersMultiplayerMultiKillCombo({
      ...marchedGame,
      lives: 0,
      status: "lost" as const,
    });
  }

  return advanceSpaceInvadersMultiplayerShipRecovery(marchedGame);
}

export function resolveSpaceInvadersMultiplayerInvaderShotHits(
  game: SpaceInvadersMultiplayerGameState,
  random: SpaceInvadersRandomSource = Math.random,
): SpaceInvadersMultiplayerGameState {
  if (game.invaderShots.length === 0) {
    return game;
  }

  const directMineHits = getSpaceInvadersMultiplayerDirectMineHitShots(game);

  if (directMineHits.length > 0) {
    const mineBlastResolution = detonateSpaceInvadersMultiplayerMineShots(
      game,
      directMineHits,
      random,
    );

    if (mineBlastResolution.didDamageShips) {
      return mineBlastResolution.game;
    }

    return resolveSpaceInvadersMultiplayerInvaderShotHits(
      mineBlastResolution.game,
      random,
    );
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

function advanceSpaceInvadersMultiplayerPowerUps(
  game: SpaceInvadersMultiplayerGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  if (game.powerUps.length === 0) {
    return game;
  }

  let nextGame = game;
  const activePowerUps: SpaceInvadersPowerUp[] = [];

  for (const powerUp of game.powerUps) {
    const movedPowerUp = {
      ...powerUp,
      y: powerUp.y + powerUp.velocityY,
    };
    const recipient = getSpaceInvadersMultiplayerPowerUpRecipient(
      nextGame,
      movedPowerUp,
      random,
    );

    if (recipient !== null) {
      nextGame = applySpaceInvadersMultiplayerPowerUp(
        nextGame,
        recipient,
        movedPowerUp,
      );
      continue;
    }

    if (movedPowerUp.y <= game.boardHeight) {
      activePowerUps.push(movedPowerUp);
    }
  }

  return {
    ...nextGame,
    powerUps: activePowerUps,
  };
}

function advanceSpaceInvadersMultiplayerPlayerShots(
  game: SpaceInvadersMultiplayerGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  let nextGame = game;

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    if (nextGame.ships[seat].playerShots.length === 0) {
      continue;
    }

    nextGame = applySpaceInvadersSoloProjection(
      nextGame,
      seat,
      advanceSpaceInvadersPlayerShots(
        createSpaceInvadersSoloProjection(nextGame, seat),
        random,
      ),
    );
  }

  return nextGame;
}

function advanceSpaceInvadersMultiplayerPlayerBursts(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  let nextGame = game;

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    const ship = nextGame.ships[seat];

    if (!ship.isActive || ship.playerBurst === null) {
      continue;
    }

    nextGame = applySpaceInvadersSoloProjection(
      nextGame,
      seat,
      advanceSpaceInvadersPlayerBurst(
        createSpaceInvadersSoloProjection(nextGame, seat),
      ),
    );
  }

  return nextGame;
}

function advanceSpaceInvadersMultiplayerInvaderShots(
  game: SpaceInvadersMultiplayerGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  if (game.status !== "running" || game.invaderShots.length === 0) {
    return game;
  }

  const { invaderShots, nextInvaderShotId } = advanceInvaderShotPositions(
    createSpaceInvadersSoloProjection(game, "ship-a"),
    {
      getTargetPlayer: (shot) =>
        getSpaceInvadersMultiplayerShotTargetPlayer(game, shot),
    },
  );
  const gameAfterShotMovement =
    resolveSpaceInvadersMultiplayerOpposingShotCollisions(
      {
        ...game,
        invaderShots,
        nextInvaderShotId,
      },
      random,
    );

  return resolveSpaceInvadersMultiplayerInvaderShotHits(
    gameAfterShotMovement,
    random,
  );
}

function resolveSpaceInvadersMultiplayerOpposingShotCollisions(
  game: SpaceInvadersMultiplayerGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  if (
    game.invaderShots.length === 0 ||
    SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.every(
      (seat) => game.ships[seat].playerShots.length === 0,
    )
  ) {
    return game;
  }

  const collidedPlayerShotIds = createSpaceInvadersMultiplayerPlayerShotDamageSets();
  const collidedInvaderShotIds = new Set<string>();
  const splitCommanderShotIds = new Set<string>();
  const collidedMineShots = new Map<string, SpaceInvadersInvaderShot>();
  let didCollide = false;
  let nextGame = game;

  // Collect all same-tick projectile collisions before mutating shared shots
  // or per-ship player-shot queues.
  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    for (const playerShot of game.ships[seat].playerShots) {
      for (const invaderShot of game.invaderShots) {
        if (!rectanglesIntersect(playerShot, invaderShot)) {
          continue;
        }

        didCollide = true;

        if (!isSpaceInvadersMultiplayerPlayerShotInvulnerable(playerShot)) {
          collidedPlayerShotIds[seat].add(playerShot.id);
        }

        if (!isSpaceInvadersMultiplayerInvaderShotInvulnerable(invaderShot)) {
          collidedInvaderShotIds.add(invaderShot.id);

          if (invaderShot.kind === "mine") {
            collidedMineShots.set(invaderShot.id, invaderShot);
          } else if (
            shouldSplitSpaceInvadersMultiplayerCommanderShotOnCollision(invaderShot)
          ) {
            splitCommanderShotIds.add(invaderShot.id);
          }
        }

        if (invaderShot.kind !== "mine") {
          nextGame = createSpaceInvadersMultiplayerSharedExplosion(
            nextGame,
            "projectile",
            getProjectileCollisionExplosionTarget(playerShot, invaderShot),
            random,
          );
        }
      }
    }
  }

  if (!didCollide) {
    return game;
  }

  if (collidedMineShots.size > 0) {
    const mineBlastResolution = detonateSpaceInvadersMultiplayerMineShots(
      nextGame,
      [...collidedMineShots.values()],
      random,
      {
        invaderShotIds: collidedInvaderShotIds,
        playerShotIds: collidedPlayerShotIds,
      },
    );

    nextGame = mineBlastResolution.game;

    if (mineBlastResolution.didDamageShips) {
      return nextGame;
    }
  }

  nextGame = removeSpaceInvadersMultiplayerDestroyedPlayerShots(
    nextGame,
    collidedPlayerShotIds,
  );

  const splitCommanderShots: SpaceInvadersInvaderShot[] = [];
  let nextInvaderShotId = nextGame.nextInvaderShotId;

  for (const invaderShot of game.invaderShots) {
    if (!splitCommanderShotIds.has(invaderShot.id)) {
      continue;
    }

    const shards = createCommanderShardShots(invaderShot, nextInvaderShotId);

    splitCommanderShots.push(...shards);
    nextInvaderShotId += shards.length;
  }

  return {
    ...nextGame,
    invaderShots: [
      ...nextGame.invaderShots.filter(
        (shot) => !collidedInvaderShotIds.has(shot.id),
      ),
      ...splitCommanderShots,
    ],
    nextInvaderShotId,
  };
}

function shouldSplitSpaceInvadersMultiplayerCommanderShotOnCollision(
  shot: Pick<SpaceInvadersInvaderShot, "kind">,
) {
  return shot.kind === "commander";
}

function isSpaceInvadersMultiplayerPlayerShotInvulnerable(
  shot: Pick<SpaceInvadersPlayerShot, "kind">,
) {
  return shot.kind === "piercing";
}

function isSpaceInvadersMultiplayerInvaderShotInvulnerable(
  shot: Pick<SpaceInvadersInvaderShot, "kind">,
) {
  return shot.kind === "armor-wave";
}

function detonateSpaceInvadersMultiplayerMineShots(
  game: SpaceInvadersMultiplayerGameState,
  mineShots: SpaceInvadersInvaderShot[],
  random: SpaceInvadersRandomSource,
  destroyedShotIds: MultiplayerMineBlastDamageSets = {
    invaderShotIds: new Set<string>(),
    playerShotIds: createSpaceInvadersMultiplayerPlayerShotDamageSets(),
  },
): MultiplayerMineBlastResolution {
  const queuedMineShots = [...mineShots];
  const detonatedMineShotIds = new Set<string>();
  const damagedSeats = new Set<SpaceInvadersShipSeat>();
  let nextGame = game;

  // Mines can trigger other mines; remove destroyed shots only after the chain resolves.
  while (queuedMineShots.length > 0) {
    const mineShot = queuedMineShots.shift()!;

    if (detonatedMineShotIds.has(mineShot.id)) {
      continue;
    }

    detonatedMineShotIds.add(mineShot.id);
    destroyedShotIds.invaderShotIds.add(mineShot.id);

    const blastBounds = getSpaceInvadersMultiplayerMineBlastBounds(mineShot);

    nextGame = createSpaceInvadersMultiplayerSharedExplosion(
      nextGame,
      "mine",
      mineShot,
      random,
    );
    nextGame = applySpaceInvadersMultiplayerMineBlastInvaderDamage(
      nextGame,
      blastBounds,
      random,
    );

    for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
      for (const playerShot of game.ships[seat].playerShots) {
        if (
          !destroyedShotIds.playerShotIds[seat].has(playerShot.id) &&
          rectanglesIntersect(playerShot, blastBounds)
        ) {
          destroyedShotIds.playerShotIds[seat].add(playerShot.id);
        }
      }
    }

    for (const invaderShot of game.invaderShots) {
      if (
        destroyedShotIds.invaderShotIds.has(invaderShot.id) ||
        !rectanglesIntersect(invaderShot, blastBounds)
      ) {
        continue;
      }

      destroyedShotIds.invaderShotIds.add(invaderShot.id);

      if (invaderShot.kind === "mine") {
        queuedMineShots.push(invaderShot);
      }
    }

    for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
      if (
        canSpaceInvadersMultiplayerShipBeDamaged(
          nextGame.ships[seat],
          blastBounds,
        )
      ) {
        damagedSeats.add(seat);
      }
    }
  }

  nextGame = {
    ...removeSpaceInvadersMultiplayerDestroyedPlayerShots(
      nextGame,
      destroyedShotIds.playerShotIds,
    ),
    invaderShots: nextGame.invaderShots.filter(
      (shot) => !destroyedShotIds.invaderShotIds.has(shot.id),
    ),
  };

  if (damagedSeats.size > 0) {
    return {
      didDamageShips: true,
      game: damageSpaceInvadersMultiplayerShips(
        nextGame,
        SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.filter((seat) =>
          damagedSeats.has(seat),
        ),
        nextGame.invaderShots,
        random,
      ),
    };
  }

  return {
    didDamageShips: false,
    game: nextGame,
  };
}

function getSpaceInvadersMultiplayerMineBlastBounds(
  mineShot: Pick<SpaceInvadersInvaderShot, "height" | "width" | "x" | "y">,
): SpaceInvadersScoreTarget {
  const padding = EXPLOSION_PADDING_BY_KIND.mine;
  const height = mineShot.height + padding * 2;
  const width = mineShot.width + padding * 2;

  return {
    height,
    width,
    x: mineShot.x + mineShot.width / 2 - width / 2,
    y: mineShot.y + mineShot.height / 2 - height / 2,
  };
}

function applySpaceInvadersMultiplayerMineBlastInvaderDamage(
  game: SpaceInvadersMultiplayerGameState,
  blastBounds: SpaceInvadersScoreTarget,
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  const hitInvaders = game.invaders.filter(
    (invader) =>
      invader.isActive &&
      rectanglesIntersect(blastBounds, getInvaderCollisionBounds(invader)),
  );

  if (hitInvaders.length === 0) {
    return game;
  }

  const damage = getSpaceInvadersMultiplayerMineBlastInvaderDamage(hitInvaders);
  const damagedArmoredHitPointsById = new Map(
    damage.damagedArmoredInvaders.map(({ hitPoints, invader }) => [
      invader.id,
      hitPoints,
    ]),
  );
  const destroyedInvaderIds = new Set(
    damage.destroyedInvaders.map((invader) => invader.id),
  );
  const invadersAfterDamage = game.invaders.map((invader) => {
    if (destroyedInvaderIds.has(invader.id)) {
      return { ...invader, hitPoints: 0, isActive: false };
    }

    const hitPoints = damagedArmoredHitPointsById.get(invader.id);

    return hitPoints === undefined ? invader : { ...invader, hitPoints };
  });
  const splitterFragments = createSpaceInvadersSplitterFragments(
    damage.destroyedInvaders,
    game.boardWidth,
  );
  const invaders = [...invadersAfterDamage, ...splitterFragments];
  const activeInvaderCount = invaders.filter((invader) => invader.isActive).length;
  let gameWithDamage: SpaceInvadersMultiplayerGameState = {
    ...game,
    invaders,
    score: game.score + damage.destroyedInvaderPoints,
    status: activeInvaderCount === 0 ? "won" : game.status,
  };

  for (const destroyedInvader of damage.destroyedInvaders) {
    gameWithDamage = createSpaceInvadersMultiplayerSharedExplosion(
      gameWithDamage,
      "invader",
      destroyedInvader,
      random,
    );
    gameWithDamage = applySpaceInvadersSoloSharedState(
      gameWithDamage,
      maybeCreateSpaceInvadersPowerUpDrop(
        createSpaceInvadersSoloProjection(gameWithDamage, "ship-a"),
        destroyedInvader,
        random,
      ),
    );
  }

  gameWithDamage = applySpaceInvadersSoloSharedState(
    gameWithDamage,
    maybePrimeSpaceInvadersRevengeVolley(
      createSpaceInvadersSoloProjection(gameWithDamage, "ship-a"),
      damage.destroyedInvaders,
      random,
    ),
  );

  if (damage.destroyedInvaders.length === 0) {
    return gameWithDamage;
  }

  return applySpaceInvadersSoloSharedState(
    gameWithDamage,
    continueSpaceInvadersMultiKillCombo(
      createSpaceInvadersSoloProjection(gameWithDamage, "ship-a"),
      getCombinedSpaceInvadersScoreTarget(damage.destroyedInvaders),
      damage.destroyedInvaders.length,
      damage.destroyedInvaderPoints,
      1,
    ),
  );
}

function getSpaceInvadersMultiplayerMineBlastInvaderDamage(
  hitInvaders: SpaceInvader[],
): MultiplayerMineBlastInvaderDamage {
  const hitResults = hitInvaders.map((invader) => ({
    hitPoints: getInvaderHitPointsAfterPlayerShot(invader),
    invader,
  }));
  const damagedArmoredInvaders = hitResults.filter(
    ({ hitPoints, invader }) => invader.kind === "armored" && hitPoints > 0,
  );
  const destroyedInvaders = hitResults
    .filter(({ hitPoints }) => hitPoints <= 0)
    .map(({ invader }) => invader);
  const destroyedInvaderPoints = destroyedInvaders.reduce(
    (total, invader) => total + invader.points,
    0,
  );

  return {
    damagedArmoredInvaders,
    destroyedInvaderPoints,
    destroyedInvaders,
  };
}

function createSpaceInvadersMultiplayerPlayerShotDamageSets(): MultiplayerPlayerShotDamageSets {
  return {
    "ship-a": new Set<string>(),
    "ship-b": new Set<string>(),
  };
}

function removeSpaceInvadersMultiplayerDestroyedPlayerShots(
  game: SpaceInvadersMultiplayerGameState,
  destroyedPlayerShotIds: MultiplayerPlayerShotDamageSets,
): SpaceInvadersMultiplayerGameState {
  let nextShips = game.ships;

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    const shotIds = destroyedPlayerShotIds[seat];

    if (shotIds.size === 0) {
      continue;
    }

    const ship = game.ships[seat];
    const playerShots = ship.playerShots.filter((shot) => !shotIds.has(shot.id));

    if (playerShots.length === ship.playerShots.length) {
      continue;
    }

    const isPlayerVolleyFinished =
      playerShots.length === 0 && ship.playerBurst === null;

    nextShips = {
      ...nextShips,
      [seat]: {
        ...ship,
        playerShots,
        playerVolleyHasArmoredHit: isPlayerVolleyFinished
          ? false
          : ship.playerVolleyHasArmoredHit,
        playerVolleyHasScored: isPlayerVolleyFinished
          ? false
          : ship.playerVolleyHasScored,
        playerVolleyHasUnscoredExit: isPlayerVolleyFinished
          ? false
          : ship.playerVolleyHasUnscoredExit,
      },
    };
  }

  return nextShips === game.ships
    ? game
    : {
        ...game,
        ships: nextShips,
      };
}

function createSpaceInvadersMultiplayerSharedExplosion(
  game: SpaceInvadersMultiplayerGameState,
  kind: Parameters<typeof createSpaceInvadersExplosion>[1],
  target: SpaceInvadersScoreTarget,
  random: SpaceInvadersRandomSource,
): SpaceInvadersMultiplayerGameState {
  return applySpaceInvadersSoloSharedState(
    game,
    createSpaceInvadersExplosion(
      createSpaceInvadersSoloProjection(game, "ship-a"),
      kind,
      target,
      random,
    ),
  );
}

function advanceSpaceInvadersMultiplayerExplosions(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  if (game.explosions.length === 0) {
    return game;
  }

  return {
    ...game,
    explosions: game.explosions
      .map((explosion) => ({
        ...explosion,
        ageTicks: explosion.ageTicks + 1,
        ttlTicks: explosion.ttlTicks - 1,
      }))
      .filter((explosion) => explosion.ttlTicks > 0),
  };
}

function advanceSpaceInvadersMultiplayerScorePopups(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  if (game.scorePopups.length === 0) {
    return game;
  }

  return {
    ...game,
    scorePopups: game.scorePopups
      .map((popup) => ({
        ...popup,
        ageTicks: popup.ageTicks + 1,
        ttlTicks: popup.ttlTicks - 1,
      }))
      .filter((popup) => popup.ttlTicks > 0),
  };
}

function advanceSpaceInvadersMultiplayerMultiKillComboWindow(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  const combo = game.multiKillCombo;

  if (combo === null) {
    return game;
  }

  if (game.status !== "running" || areSpaceInvadersMultiplayerPlayerVolleysFinished(game)) {
    return finalizeSpaceInvadersMultiplayerMultiKillCombo(game);
  }

  const nextCombo = {
    ...combo,
    ticksRemaining: combo.ticksRemaining - 1,
  };

  if (nextCombo.ticksRemaining <= 0) {
    return finalizeSpaceInvadersMultiplayerMultiKillCombo({
      ...game,
      multiKillCombo: nextCombo,
    });
  }

  return {
    ...game,
    multiKillCombo: nextCombo,
  };
}

function advanceSpaceInvadersMultiplayerRevengeVolleys(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  if (game.revengeVolleys.length === 0) {
    return game;
  }

  return applySpaceInvadersSoloSharedState(
    game,
    advanceSpaceInvadersRevengeVolleys(
      createSpaceInvadersSoloProjection(game, "ship-a"),
      {
        getTargetPlayer: (target) =>
          getSpaceInvadersMultiplayerShotTargetPlayer(game, target),
      },
    ),
  );
}

function advanceSpaceInvadersMultiplayerAlienFreeze(
  game: SpaceInvadersMultiplayerGameState,
) {
  if (game.alienFreezeTicks <= 0) {
    return {
      game,
      isFrozen: false,
    };
  }

  return {
    game: {
      ...game,
      alienFreezeTicks: game.alienFreezeTicks - 1,
    },
    isFrozen: true,
  };
}

function advanceSpaceInvadersMultiplayerInvaderFire(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  return applySpaceInvadersSoloSharedState(
    game,
    maybeFireInvaderShot(createSpaceInvadersSoloProjection(game, "ship-a"), {
      getTargetPlayer: (target) =>
        getSpaceInvadersMultiplayerShotTargetPlayer(game, target),
    }),
  );
}

function advanceSpaceInvadersMultiplayerUfo(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  if (game.ufo.isActive) {
    const movedUfo = {
      ...game.ufo,
      x: game.ufo.x + game.ufo.direction * UFO_SPEED,
    };

    if (
      (movedUfo.direction === 1 && movedUfo.x > game.boardWidth) ||
      (movedUfo.direction === -1 && movedUfo.x + movedUfo.width < 0)
    ) {
      return {
        ...game,
        ufo: deactivateSpaceInvadersUfo(movedUfo, game.boardWidth),
        ufoHitStreak: 0,
      };
    }

    return {
      ...game,
      ufo: movedUfo,
    };
  }

  if (game.ufo.cooldownTicks > 0) {
    return {
      ...game,
      ufo: {
        ...game.ufo,
        cooldownTicks: game.ufo.cooldownTicks - 1,
      },
    };
  }

  return {
    ...game,
    ufo: {
      ...game.ufo,
      isActive: true,
      x: game.ufo.direction === 1 ? -game.ufo.width : game.boardWidth,
    },
  };
}

function marchSpaceInvadersMultiplayerInvaders(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  const activeInvaders = game.invaders.filter((invader) => invader.isActive);

  if (activeInvaders.length === 0) {
    return game;
  }

  const exposedDiverIds = getExposedSpaceInvadersMultiplayerDiverIds(activeInvaders);
  const formationSpeedMultiplier = getSpaceInvadersMultiplayerFormationSpeedMultiplier(
    game,
    activeInvaders.length,
  );
  const formationInvaders = activeInvaders.filter(
    (invader) => !isExposedSpaceInvadersMultiplayerDiver(invader, exposedDiverIds),
  );
  const wouldFormationHitWall = formationInvaders.some((invader) => {
    const nextX =
      invader.x +
      game.marchDirection *
        getSpaceInvadersMultiplayerInvaderStepX(
          invader,
          exposedDiverIds,
          formationSpeedMultiplier,
        );

    return nextX < 0 || nextX + invader.width > game.boardWidth;
  });
  const nextMarchDirection = wouldFormationHitWall
    ? ((game.marchDirection * -1) as SpaceInvadersDirection)
    : game.marchDirection;

  if (wouldFormationHitWall) {
    return {
      ...game,
      invaders: game.invaders.map((invader) => {
        if (!invader.isActive) {
          return invader;
        }

        const isDiving = isExposedSpaceInvadersMultiplayerDiver(
          invader,
          exposedDiverIds,
        );

        return {
          ...invader,
          direction: nextMarchDirection,
          isDiving,
          y: invader.y + (isDiving ? DIVER_DROP_Y : INVADER_DROP_Y),
        };
      }),
      marchDirection: nextMarchDirection,
    };
  }

  return {
    ...game,
    invaders: game.invaders.map((invader) => {
      if (!invader.isActive) {
        return invader;
      }

      if (isExposedSpaceInvadersMultiplayerDiver(invader, exposedDiverIds)) {
        return advanceSpaceInvadersMultiplayerDivingInvader(invader, game);
      }

      return {
        ...invader,
        direction: game.marchDirection,
        isDiving: getNextSpaceInvadersMultiplayerDiverState(
          invader,
          exposedDiverIds,
        ),
        x:
          invader.x +
          game.marchDirection *
            getSpaceInvadersMultiplayerInvaderStepX(
              invader,
              exposedDiverIds,
              formationSpeedMultiplier,
            ),
      };
    }),
  };
}

function advanceSpaceInvadersMultiplayerDivingInvader(
  invader: SpaceInvader,
  game: Pick<SpaceInvadersMultiplayerGameState, "boardWidth">,
): SpaceInvader {
  const nextX = invader.x + invader.direction * INVADER_STEP_X * DIVER_STEP_MULTIPLIER;

  if (nextX < 0 || nextX + invader.width > game.boardWidth) {
    return {
      ...invader,
      direction: (invader.direction * -1) as SpaceInvadersDirection,
      isDiving: true,
      x: clamp(invader.x, 0, game.boardWidth - invader.width),
      y: invader.y + DIVER_DROP_Y,
    };
  }

  return {
    ...invader,
    isDiving: true,
    x: nextX,
  };
}

function getExposedSpaceInvadersMultiplayerDiverIds(activeInvaders: SpaceInvader[]) {
  return new Set(
    activeInvaders
      .filter(isSpaceInvadersMultiplayerDiverMovementInvader)
      .filter(
        (invader) =>
          invader.isDiving ||
          isSpaceInvadersMultiplayerDiverLaneClear(invader, activeInvaders),
      )
      .map((invader) => invader.id),
  );
}

function isSpaceInvadersMultiplayerDiverLaneClear(
  diver: SpaceInvader,
  activeInvaders: SpaceInvader[],
) {
  return !activeInvaders.some(
    (invader) =>
      invader.id !== diver.id &&
      invader.y > diver.y &&
      doSpaceInvadersMultiplayerInvadersOverlapX(diver, invader),
  );
}

function doSpaceInvadersMultiplayerInvadersOverlapX(
  first: SpaceInvader,
  second: SpaceInvader,
) {
  return first.x < second.x + second.width && second.x < first.x + first.width;
}

function getSpaceInvadersMultiplayerFormationSpeedMultiplier(
  game: Pick<SpaceInvadersMultiplayerGameState, "alienCount">,
  activeInvaderCount: number,
) {
  const speedupStartCount = game.alienCount * FORMATION_SPEEDUP_START_RATIO;

  if (activeInvaderCount <= 1) {
    return FORMATION_MAX_SPEED_MULTIPLIER;
  }

  if (activeInvaderCount >= speedupStartCount) {
    return 1;
  }

  const interpolationSpan = speedupStartCount - 1;
  const depletionProgress = (speedupStartCount - activeInvaderCount) / interpolationSpan;

  return 1 + depletionProgress * (FORMATION_MAX_SPEED_MULTIPLIER - 1);
}

function getSpaceInvadersMultiplayerInvaderStepX(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
  formationSpeedMultiplier: number,
) {
  return (
    INVADER_STEP_X *
    getSpaceInvadersMultiplayerInvaderMovementMultiplier(
      invader,
      exposedDiverIds,
      formationSpeedMultiplier,
    )
  );
}

function getSpaceInvadersMultiplayerInvaderMovementMultiplier(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
  formationSpeedMultiplier: number,
) {
  return isExposedSpaceInvadersMultiplayerDiver(invader, exposedDiverIds)
    ? DIVER_STEP_MULTIPLIER
    : formationSpeedMultiplier;
}

function getNextSpaceInvadersMultiplayerDiverState(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
) {
  return (
    invader.isDiving ||
    isExposedSpaceInvadersMultiplayerDiver(invader, exposedDiverIds)
  );
}

function isExposedSpaceInvadersMultiplayerDiver(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
) {
  return (
    isSpaceInvadersMultiplayerDiverMovementInvader(invader) &&
    exposedDiverIds.has(invader.id)
  );
}

function isSpaceInvadersMultiplayerDiverMovementInvader(
  invader: Pick<SpaceInvader, "kind">,
) {
  return invader.kind === "diver" || invader.kind === "splitter-fragment";
}

function hasSpaceInvadersMultiplayerInvaderReachedBase(
  game: SpaceInvadersMultiplayerGameState,
) {
  return game.invaders.some(
    (invader) => invader.isActive && invader.y + invader.height >= game.baseY,
  );
}

function finalizeSpaceInvadersMultiplayerMultiKillComboIfVolleysEnded(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  if (
    game.multiKillCombo === null ||
    !areSpaceInvadersMultiplayerPlayerVolleysFinished(game)
  ) {
    return game;
  }

  return finalizeSpaceInvadersMultiplayerMultiKillCombo(game);
}

function finalizeSpaceInvadersMultiplayerMultiKillCombo(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  return applySpaceInvadersSoloSharedState(
    game,
    finalizeSpaceInvadersMultiKillCombo(
      createSpaceInvadersSoloProjection(game, "ship-a"),
    ),
  );
}

function finalizeSpaceInvadersMultiplayerPlayerVolleys(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  let nextGame = game;

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    const ship = nextGame.ships[seat];

    if (!isSpaceInvadersPlayerVolleyFinished(ship)) {
      continue;
    }

    const shouldResetHitStreak =
      ship.playerVolleyHasUnscoredExit &&
      !ship.playerVolleyHasScored &&
      !ship.playerVolleyHasArmoredHit;

    if (shouldResetHitStreak) {
      nextGame = applySpaceInvadersSoloSharedState(
        nextGame,
        resetSpaceInvadersHitStreak(
          createSpaceInvadersSoloProjection(nextGame, seat),
        ),
      );
    }

    if (
      !ship.playerVolleyHasArmoredHit &&
      !ship.playerVolleyHasScored &&
      !ship.playerVolleyHasUnscoredExit
    ) {
      continue;
    }

    nextGame = updateSpaceInvadersMultiplayerShip(nextGame, seat, {
      ...nextGame.ships[seat],
      playerVolleyHasArmoredHit: false,
      playerVolleyHasScored: false,
      playerVolleyHasUnscoredExit: false,
    });
  }

  return nextGame;
}

function areSpaceInvadersMultiplayerPlayerVolleysFinished(
  game: SpaceInvadersMultiplayerGameState,
) {
  return SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.every((seat) =>
    isSpaceInvadersPlayerVolleyFinished(game.ships[seat]),
  );
}

function advanceSpaceInvadersMultiplayerShipRecovery(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  let nextShips = game.ships;

  for (const seat of SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS) {
    const ship = nextShips[seat];

    if (!ship.isActive) {
      continue;
    }

    if (isSpaceInvadersPlayerRespawning(ship)) {
      const playerRespawnTicks = ship.playerRespawnTicks - 1;

      nextShips = {
        ...nextShips,
        [seat]: {
          ...ship,
          playerRespawnTicks,
          playerShieldTicks:
            playerRespawnTicks === 0
              ? SPACE_INVADERS_PLAYER_SHIELD_TICKS
              : ship.playerShieldTicks,
        },
      };
      continue;
    }

    if (hasSpaceInvadersPlayerShield(ship)) {
      nextShips = {
        ...nextShips,
        [seat]: {
          ...ship,
          playerShieldTicks: ship.playerShieldTicks - 1,
        },
      };
    }
  }

  return nextShips === game.ships
    ? game
    : {
        ...game,
        ships: nextShips,
      };
}

function createSpaceInvadersSoloProjection(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
): SpaceInvadersGameState {
  const { ships, ...sharedGame } = game;
  const ship = ships[seat];

  return {
    ...sharedGame,
    pendingShotPowerUp: ship.pendingShotPowerUp,
    player: ship.player,
    playerBurst: ship.playerBurst,
    playerRespawnTicks: ship.playerRespawnTicks,
    playerShieldTicks: ship.playerShieldTicks,
    playerShots: ship.playerShots,
    playerVolleyHasArmoredHit: ship.playerVolleyHasArmoredHit,
    playerVolleyHasScored: ship.playerVolleyHasScored,
    playerVolleyHasUnscoredExit: ship.playerVolleyHasUnscoredExit,
  };
}

function applySpaceInvadersSoloProjection(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
  projectedGame: SpaceInvadersGameState,
): SpaceInvadersMultiplayerGameState {
  return {
    ...applySpaceInvadersSoloSharedState(game, projectedGame),
    ships: {
      ...game.ships,
      [seat]: {
        ...game.ships[seat],
        pendingShotPowerUp: projectedGame.pendingShotPowerUp,
        player: projectedGame.player,
        playerBurst: projectedGame.playerBurst,
        playerRespawnTicks: projectedGame.playerRespawnTicks,
        playerShieldTicks: projectedGame.playerShieldTicks,
        playerShots: projectedGame.playerShots,
        playerVolleyHasArmoredHit: projectedGame.playerVolleyHasArmoredHit,
        playerVolleyHasScored: projectedGame.playerVolleyHasScored,
        playerVolleyHasUnscoredExit: projectedGame.playerVolleyHasUnscoredExit,
      },
    },
  };
}

function applySpaceInvadersSoloSharedState(
  game: SpaceInvadersMultiplayerGameState,
  projectedGame: SpaceInvadersGameState,
): SpaceInvadersMultiplayerGameState {
  return {
    ...game,
    ...pickSpaceInvadersMultiplayerSharedState(projectedGame),
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

function getSpaceInvadersMultiplayerShotTargetPlayer(
  game: SpaceInvadersMultiplayerGameState,
  target: SpaceInvadersScoreTarget,
): SpaceInvadersPlayer {
  const seat = getSpaceInvadersMultiplayerShotTargetSeat(game, target);

  return game.ships[seat].player;
}

function getSpaceInvadersMultiplayerShotTargetSeat(
  game: SpaceInvadersMultiplayerGameState,
  target: SpaceInvadersScoreTarget,
): SpaceInvadersShipSeat {
  const targetableSeats = SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.filter((seat) => {
    const ship = game.ships[seat];

    return ship.isActive && !isSpaceInvadersPlayerRespawning(ship);
  });

  if (targetableSeats.length === 0) {
    return "ship-a";
  }

  const targetCenterX = getEntityCenterX(target);

  return [...targetableSeats].sort((firstSeat, secondSeat) => {
    const firstDistance = Math.abs(
      getEntityCenterX(game.ships[firstSeat].player) - targetCenterX,
    );
    const secondDistance = Math.abs(
      getEntityCenterX(game.ships[secondSeat].player) - targetCenterX,
    );

    if (firstDistance !== secondDistance) {
      return firstDistance - secondDistance;
    }

    return (
      SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.indexOf(firstSeat) -
      SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.indexOf(secondSeat)
    );
  })[0]!;
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

function getSpaceInvadersMultiplayerDirectMineHitShots(
  game: SpaceInvadersMultiplayerGameState,
) {
  return game.invaderShots.filter(
    (shot) =>
      shot.kind === "mine" &&
      isInvaderShotDangerous(shot) &&
      getSpaceInvadersMultiplayerInvaderShotHitSeats(game, shot).length > 0,
  );
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
