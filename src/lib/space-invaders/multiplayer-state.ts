import type {
  SpaceInvadersGameState,
  SpaceInvadersPlayerShot,
} from "../space-invaders-game-engine";
import type {
  SpaceInvadersMultiplayerGameState,
  SpaceInvadersMultiplayerSharedState,
  SpaceInvadersMultiplayerShips,
  SpaceInvadersShipSeat,
  SpaceInvadersShipState,
} from "./multiplayer-types";

export function cloneSpaceInvadersMultiplayerState(
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

export function createSpaceInvadersSoloProjection(
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

export function applySpaceInvadersSoloProjection(
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

export function applySpaceInvadersSoloSharedState(
  game: SpaceInvadersMultiplayerGameState,
  projectedGame: SpaceInvadersGameState,
): SpaceInvadersMultiplayerGameState {
  return {
    ...game,
    ...pickSpaceInvadersMultiplayerSharedState(projectedGame),
  };
}

export function pickSpaceInvadersMultiplayerSharedState(
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
