import {
  INVADER_HIT_RECOVERY_TICKS,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
} from "./constants";
import {
  createCenteredSpaceInvadersPlayer,
  createSpaceInvadersExplosion,
  createSpaceInvadersScorePopup,
} from "./effects";
import { clamp, rectanglesIntersect } from "./geometry";
import {
  createInitialPlayerBurstState,
  createNextPlayerBurstShot,
  createPlayerShots,
} from "./projectiles";
import type {
  SpaceInvadersGameState,
  SpaceInvadersInvaderShot,
  SpaceInvadersPowerUp,
  SpaceInvadersRandomSource,
  SpaceInvadersScoreTarget,
} from "./types";

export type SpaceInvadersPlayerOwnedState = Pick<
  SpaceInvadersGameState,
  | "pendingShotPowerUp"
  | "player"
  | "playerBurst"
  | "playerRespawnTicks"
  | "playerShieldTicks"
  | "playerShots"
  | "playerVolleyHasArmoredHit"
  | "playerVolleyHasScored"
  | "playerVolleyHasUnscoredExit"
>;

// These helpers still write the solo singleton fields; the function boundary
// keeps player-owned mutations grouped for later multi-ship state.
export function createInitialSpaceInvadersPlayerState(
  boardWidth: number,
  boardHeight: number,
): SpaceInvadersPlayerOwnedState {
  return {
    pendingShotPowerUp: null,
    player: createCenteredSpaceInvadersPlayer(boardWidth, boardHeight),
    playerBurst: null,
    playerRespawnTicks: 0,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasArmoredHit: false,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
  };
}

export function moveSpaceInvadersPlayerState(
  game: SpaceInvadersGameState,
  deltaX: number,
): SpaceInvadersGameState {
  if (!canMoveSpaceInvadersPlayer(game)) {
    return game;
  }

  return {
    ...game,
    player: {
      ...game.player,
      x: clamp(game.player.x + deltaX, 0, game.boardWidth - game.player.width),
    },
  };
}

function canMoveSpaceInvadersPlayer(
  game: Pick<SpaceInvadersGameState, "playerRespawnTicks" | "status">,
) {
  return (
    game.status !== "lost" &&
    game.status !== "won" &&
    !isSpaceInvadersPlayerRespawning(game)
  );
}

export function fireSpaceInvadersPlayerShot(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (!canFireSpaceInvadersPlayerShot(game)) {
    return game;
  }

  const createdShots = createPlayerShots(
    game.player,
    game.nextPlayerShotId,
    game.pendingShotPowerUp,
  );

  return {
    ...game,
    nextPlayerShotId: game.nextPlayerShotId + createdShots.length,
    pendingShotPowerUp: null,
    playerBurst:
      game.pendingShotPowerUp === "burst-shot"
        ? createInitialPlayerBurstState(createdShots.length)
        : null,
    playerShots: createdShots,
  };
}

function canFireSpaceInvadersPlayerShot(
  game: Pick<
    SpaceInvadersGameState,
    "playerBurst" | "playerRespawnTicks" | "playerShots" | "status"
  >,
) {
  return (
    game.status === "running" &&
    !isSpaceInvadersPlayerRespawning(game) &&
    game.playerBurst === null &&
    game.playerShots.length === 0
  );
}

export function advanceSpaceInvadersPlayerBurst(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.playerBurst === null) {
    return game;
  }

  if (game.playerBurst.cooldownTicks > 0) {
    return {
      ...game,
      playerBurst: {
        ...game.playerBurst,
        cooldownTicks: game.playerBurst.cooldownTicks - 1,
      },
    };
  }

  return {
    ...game,
    ...createNextPlayerBurstShot(game),
  };
}

export function advanceSpaceInvadersPlayerPowerUps(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
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

    if (canSpaceInvadersPlayerCollectPowerUp(nextGame, movedPowerUp)) {
      nextGame = applySpaceInvadersPlayerPowerUp(nextGame, movedPowerUp);
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

function canSpaceInvadersPlayerCollectPowerUp(
  game: Pick<SpaceInvadersGameState, "player" | "playerRespawnTicks">,
  powerUp: SpaceInvadersPowerUp,
) {
  return (
    !isSpaceInvadersPlayerRespawning(game) &&
    rectanglesIntersect(powerUp, game.player)
  );
}

function applySpaceInvadersPlayerPowerUp(
  game: SpaceInvadersGameState,
  powerUp: SpaceInvadersPowerUp,
): SpaceInvadersGameState {
  switch (powerUp.kind) {
    case "bonus-score":
      return createSpaceInvadersScorePopup(
        {
          ...game,
          score: game.score + SPACE_INVADERS_BONUS_SCORE_POINTS,
        },
        powerUp,
        { points: SPACE_INVADERS_BONUS_SCORE_POINTS },
      );
    case "extra-life":
      return {
        ...game,
        lives: game.lives + 1,
      };
    case "burst-shot":
    case "piercing-laser":
    case "shotgun-shot":
      return {
        ...game,
        pendingShotPowerUp: powerUp.kind,
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
      return {
        ...game,
        playerShieldTicks: Math.max(
          game.playerShieldTicks,
          SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
        ),
      };
  }
}

export function damageSpaceInvadersPlayer(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  const lives = game.lives - 1;
  const gameWithExplosion = createSpaceInvadersExplosion(
    game,
    "player",
    game.player,
    random,
  );

  return {
    ...gameWithExplosion,
    invaderBurst: null,
    invaderShotCooldownTicks: INVADER_HIT_RECOVERY_TICKS,
    invaderShots: [],
    hitStreak: 0,
    lives,
    player: createCenteredSpaceInvadersPlayer(game.boardWidth, game.boardHeight),
    playerBurst: null,
    playerRespawnTicks: lives <= 0 ? 0 : SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasArmoredHit: false,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
    status: lives <= 0 ? "lost" : game.status,
  };
}

export function absorbSpaceInvadersPlayerHitShots(
  game: SpaceInvadersGameState,
  hittingShots: SpaceInvadersInvaderShot[],
): SpaceInvadersGameState {
  const hittingShotIds = new Set(hittingShots.map((shot) => shot.id));

  return {
    ...game,
    invaderShots: game.invaderShots.filter((shot) => !hittingShotIds.has(shot.id)),
  };
}

export function canSpaceInvadersPlayerBeDamaged(
  game: Pick<
    SpaceInvadersGameState,
    "player" | "playerRespawnTicks" | "playerShieldTicks"
  >,
  target: SpaceInvadersScoreTarget,
) {
  return (
    !isSpaceInvadersPlayerRespawning(game) &&
    !hasSpaceInvadersPlayerShield(game) &&
    rectanglesIntersect(target, game.player)
  );
}

export function isSpaceInvadersPlayerRespawning(
  game: Pick<SpaceInvadersGameState, "playerRespawnTicks">,
) {
  return game.playerRespawnTicks > 0;
}

export function hasSpaceInvadersPlayerShield(
  game: Pick<SpaceInvadersGameState, "playerShieldTicks">,
) {
  return game.playerShieldTicks > 0;
}

export function advanceSpaceInvadersPlayerRecovery(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (isSpaceInvadersPlayerRespawning(game)) {
    const playerRespawnTicks = game.playerRespawnTicks - 1;

    return {
      ...game,
      playerRespawnTicks,
      playerShieldTicks:
        playerRespawnTicks === 0
          ? SPACE_INVADERS_PLAYER_SHIELD_TICKS
          : game.playerShieldTicks,
    };
  }

  if (hasSpaceInvadersPlayerShield(game)) {
    return {
      ...game,
      playerShieldTicks: game.playerShieldTicks - 1,
    };
  }

  return game;
}

export function isSpaceInvadersPlayerVolleyFinished(
  game: Pick<SpaceInvadersGameState, "playerBurst" | "playerShots">,
) {
  return game.playerShots.length === 0 && game.playerBurst === null;
}
