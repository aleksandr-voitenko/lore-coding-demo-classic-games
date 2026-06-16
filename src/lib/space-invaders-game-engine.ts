import {
  DIVER_DROP_Y,
  DIVER_STEP_MULTIPLIER,
  EXPLOSION_PADDING_BY_KIND,
  EXPLOSION_TTL_TICKS,
  FORMATION_MAX_SPEED_MULTIPLIER,
  FORMATION_SPEEDUP_START_RATIO,
  INVADER_DROP_Y,
  INVADER_FIRE_COOLDOWN_TICKS,
  INVADER_HIT_RECOVERY_TICKS,
  INVADER_STEP_X,
  PLAYER_BOTTOM_MARGIN,
  PLAYER_HEIGHT,
  PLAYER_SPEED,
  PLAYER_WIDTH,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_COMMON_POWER_UP_KINDS,
  SPACE_INVADERS_EXPLOSION_VARIANTS,
  SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_TICK_DELAY_MS,
  UFO_COOLDOWN_TICKS,
  UFO_HEIGHT,
  UFO_POINT_VALUES,
  UFO_SPEED,
  UFO_WIDTH,
  UFO_Y,
} from "./space-invaders/constants";
export {
  SPACE_INVADERS_ALIEN_COUNT_OPTIONS,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_ARMORED_ALIEN_COUNT,
  SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_SIZE_OPTIONS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE,
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_CAP,
  SPACE_INVADERS_HIT_STREAK_POPUP_SCALE_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
  SPACE_INVADERS_POWER_UP_KINDS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_POWER_UP_SPEED,
  SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT,
  SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
  SPACE_INVADERS_REVENGE_ALIEN_COUNT,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_SHIELD_BEARER_COUNT,
  SPACE_INVADERS_SPLITTER_ALIEN_COUNT,
  SPACE_INVADERS_STARTING_LIVES,
  SPACE_INVADERS_TICK_DELAY_MS,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
} from "./space-invaders/constants";
import {
  createSpaceInvadersFormation,
  createSpaceInvadersSplitterFragments,
  getInvaderHitPointsAfterPlayerShot,
  getSpaceInvadersFormationSpec,
  isSpaceInvaderShielded,
} from "./space-invaders/formation";
export {
  createSpaceInvadersFormation,
  isSpaceInvaderShielded,
} from "./space-invaders/formation";
import {
  clamp,
  normalizeSpaceInvadersDimension,
  rectanglesIntersect,
} from "./space-invaders/geometry";
import { getInvaderCollisionBounds } from "./space-invaders/hitboxes";
import {
  advanceInvaderShotPositions,
  advanceSpaceInvadersRevengeVolleys,
  advancePlayerShotPosition,
  createInitialPlayerBurstState,
  createNextPlayerBurstShot,
  createPlayerShots,
  isInvaderShotDangerous,
  isPlayerShotActive,
  maybePrimeSpaceInvadersRevengeVolley,
  maybeFireInvaderShot,
} from "./space-invaders/projectiles";
import { getRandomIndex, getRandomValue } from "./space-invaders/random";
import {
  advanceSpaceInvadersHitStreak,
  advanceSpaceInvadersUfoChain,
  getCombinedSpaceInvadersScoreTarget,
  getSpaceInvadersHitStreakPopupScale,
  getSpaceInvadersInvaderScorePopupLabel,
  getSpaceInvadersMultiKillBonus,
  resetSpaceInvadersHitStreak,
} from "./space-invaders/scoring";
import type {
  CreateSpaceInvadersGameOptions,
  SpaceInvader,
  SpaceInvadersDirection,
  SpaceInvadersExplosion,
  SpaceInvadersExplosionKind,
  SpaceInvadersGameState,
  SpaceInvadersInvaderShot,
  SpaceInvadersPlayer,
  SpaceInvadersPlayerShot,
  SpaceInvadersPowerUp,
  SpaceInvadersRandomSource,
  SpaceInvadersScorePopup,
  SpaceInvadersScorePopupOptions,
  SpaceInvadersScoreTarget,
  SpaceInvadersUfoState,
} from "./space-invaders/types";

type PlayerShotAdvanceState = {
  activeShots: SpaceInvadersPlayerShot[];
  destroyedInvaderBounds: SpaceInvadersScoreTarget[];
  destroyedInvaderPopupPoints: number;
  game: SpaceInvadersGameState;
  invaderPopupScoreScale: number;
  playerVolleyHasArmoredHit: boolean;
  playerVolleyHasScored: boolean;
  playerVolleyHasUnscoredExit: boolean;
};

type PlayerShotUfoResolution = {
  didScoreWithShot: boolean;
  isShotConsumed: boolean;
};

type PlayerShotInvaderTargets = {
  hitInvaders: SpaceInvader[];
  vulnerableHitInvaders: SpaceInvader[];
};

type PlayerShotInvaderDamage = {
  damagedArmoredInvaders: {
    hitPoints: number;
    invader: SpaceInvader;
  }[];
  destroyedInvaderPoints: number;
  destroyedInvaders: SpaceInvader[];
  hitTargets: SpaceInvader[];
};

type PlayerShotInvaderResolution = {
  didScoreWithShot: boolean;
  shotDamagedInvaderIds: string[];
};

export type {
  CreateSpaceInvadersGameOptions,
  SpaceInvader,
  SpaceInvaderKind,
  SpaceInvadersDirection,
  SpaceInvadersExplosion,
  SpaceInvadersExplosionKind,
  SpaceInvadersExplosionVariant,
  SpaceInvadersGameState,
  SpaceInvadersInvaderBurst,
  SpaceInvadersInvaderShot,
  SpaceInvadersInvaderShotKind,
  SpaceInvadersMultiKillCombo,
  SpaceInvadersPendingShotPowerUp,
  SpaceInvadersPlayer,
  SpaceInvadersPlayerBurst,
  SpaceInvadersPlayerShot,
  SpaceInvadersPlayerShotKind,
  SpaceInvadersPowerUp,
  SpaceInvadersPowerUpKind,
  SpaceInvadersRandomSource,
  SpaceInvadersScorePopup,
  SpaceInvadersShot,
  SpaceInvadersStatus,
  SpaceInvadersUfoState,
} from "./space-invaders/types";

export function createInitialSpaceInvadersGame({
  alienCount = SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
  boardHeight = SPACE_INVADERS_BOARD_HEIGHT,
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  random = Math.random,
}: CreateSpaceInvadersGameOptions = {}): SpaceInvadersGameState {
  const normalizedBoardWidth = normalizeSpaceInvadersDimension(
    boardWidth,
    SPACE_INVADERS_BOARD_WIDTH,
    360,
  );
  const normalizedBoardHeight = normalizeSpaceInvadersDimension(
    boardHeight,
    SPACE_INVADERS_BOARD_HEIGHT,
    480,
  );
  const formation = getSpaceInvadersFormationSpec(alienCount);

  return {
    alienCount: formation.alienCount,
    alienFreezeTicks: 0,
    baseY: normalizedBoardHeight - 68,
    boardHeight: normalizedBoardHeight,
    boardWidth: normalizedBoardWidth,
    explosions: [],
    hitStreak: 0,
    invaderBurst: null,
    invaderShotCooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    invaderShots: [],
    invaders: createSpaceInvadersFormation({
      boardWidth: normalizedBoardWidth,
      columns: formation.columns,
      random,
      rows: formation.rows,
    }),
    lives: SPACE_INVADERS_STARTING_LIVES,
    marchDirection: 1,
    nextExplosionId: 0,
    nextInvaderShotId: 0,
    nextPlayerShotId: 0,
    nextPowerUpId: 0,
    nextScorePopupId: 0,
    pendingShotPowerUp: null,
    player: createCenteredPlayer(normalizedBoardWidth, normalizedBoardHeight),
    playerBurst: null,
    playerRespawnTicks: 0,
    playerShieldTicks: 0,
    playerVolleyHasArmoredHit: false,
    playerShots: [],
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
    powerUps: [],
    revengeVolleys: [],
    score: 0,
    scorePopups: [],
    status: "ready",
    multiKillCombo: null,
    ufo: createInitialSpaceInvadersUfo(),
    ufoHitStreak: 0,
  };
}

export function startSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.status === "running") {
    return game;
  }

  if (game.status === "paused") {
    return {
      ...game,
      status: "running" as const,
    };
  }

  if (game.status === "lost" || game.status === "won") {
    return restartSpaceInvadersGame(game);
  }

  return {
    ...game,
    status: "running" as const,
  };
}

export function pauseSpaceInvadersGame(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.status !== "running") {
    return game;
  }

  return {
    ...game,
    status: "paused" as const,
  };
}

export function restartSpaceInvadersGame(
  game: Pick<SpaceInvadersGameState, "alienCount" | "boardHeight" | "boardWidth"> = {
    alienCount: SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
    boardHeight: SPACE_INVADERS_BOARD_HEIGHT,
    boardWidth: SPACE_INVADERS_BOARD_WIDTH,
  },
): SpaceInvadersGameState {
  return {
    ...createInitialSpaceInvadersGame({
      alienCount: game.alienCount,
      boardHeight: game.boardHeight,
      boardWidth: game.boardWidth,
    }),
    status: "running" as const,
  };
}

export function moveSpaceInvadersPlayer(
  game: SpaceInvadersGameState,
  deltaX: number,
): SpaceInvadersGameState {
  if (game.status === "lost" || game.status === "won" || game.playerRespawnTicks > 0) {
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

export function moveSpaceInvadersPlayerLeft(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, -PLAYER_SPEED);
}

export function moveSpaceInvadersPlayerRight(game: SpaceInvadersGameState) {
  return moveSpaceInvadersPlayer(game, PLAYER_SPEED);
}

export function fireSpaceInvadersShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (
    game.status !== "running" ||
    game.playerRespawnTicks > 0 ||
    game.playerBurst !== null ||
    game.playerShots.length > 0
  ) {
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

export function advanceSpaceInvadersGame(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource = Math.random,
): SpaceInvadersGameState {
  if (game.status !== "running") {
    return game;
  }

  const gameAfterExplosions = advanceExplosions(game);
  const gameAfterScorePopups = advanceScorePopups(gameAfterExplosions);
  const gameAfterMultiKillComboWindow =
    advanceSpaceInvadersMultiKillComboWindow(gameAfterScorePopups);
  const gameAfterPowerUps = advancePowerUps(gameAfterMultiKillComboWindow);
  const gameAfterShot = advancePlayerShots(gameAfterPowerUps, random);

  if (gameAfterShot.status === "won") {
    return finalizeSpaceInvadersPlayerVolley(
      finalizeSpaceInvadersMultiKillCombo(gameAfterShot),
    );
  }

  const gameAfterPlayerBurst = advancePlayerBurst(gameAfterShot);
  const gameAfterMultiKillCombo =
    finalizeSpaceInvadersMultiKillComboIfVolleyEnded(gameAfterPlayerBurst);
  const gameAfterPlayerVolley = finalizeSpaceInvadersPlayerVolley(
    gameAfterMultiKillCombo,
  );
  const gameAfterInvaderShots = advanceInvaderShots(gameAfterPlayerVolley, random);

  if (
    gameAfterInvaderShots.status === "lost" ||
    gameAfterInvaderShots.lives < gameAfterPlayerVolley.lives
  ) {
    return finalizeSpaceInvadersMultiKillCombo(gameAfterInvaderShots);
  }

  const gameAfterRevengeVolleys =
    advanceSpaceInvadersRevengeVolleys(gameAfterInvaderShots);
  const { game: gameAfterFreezeTick, isFrozen: areAliensFrozen } =
    advanceAlienFreeze(gameAfterRevengeVolleys);

  if (areAliensFrozen) {
    return advancePlayerRecovery(gameAfterFreezeTick);
  }

  const gameAfterInvaderFire = maybeFireInvaderShot(gameAfterFreezeTick);
  const gameAfterUfo = advanceSpaceInvadersUfo(gameAfterInvaderFire);
  const marchedGame = marchInvaders(gameAfterUfo);

  if (hasInvaderReachedBase(marchedGame)) {
    return finalizeSpaceInvadersMultiKillCombo({
      ...marchedGame,
      lives: 0,
      status: "lost" as const,
    });
  }

  return advancePlayerRecovery(marchedGame);
}

export function getSpaceInvadersTickDelay() {
  return SPACE_INVADERS_TICK_DELAY_MS;
}

export function getSpaceInvadersPlayerSpeed() {
  return PLAYER_SPEED;
}

function advancePlayerShots(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (game.playerShots.length === 0) {
    return game;
  }

  const state = createPlayerShotAdvanceState(game);

  for (const shot of game.playerShots) {
    advancePlayerShotCollision(state, shot, random);
  }

  return finalizePlayerShotAdvanceState(state);
}

function createPlayerShotAdvanceState(
  game: SpaceInvadersGameState,
): PlayerShotAdvanceState {
  return {
    activeShots: [],
    destroyedInvaderBounds: [],
    destroyedInvaderPopupPoints: 0,
    game: {
      ...game,
      playerShots: [],
    },
    invaderPopupScoreScale: 1,
    playerVolleyHasArmoredHit: game.playerVolleyHasArmoredHit,
    playerVolleyHasScored:
      game.playerVolleyHasScored ||
      game.playerShots.some((shot) => shot.hasScored === true),
    playerVolleyHasUnscoredExit: game.playerVolleyHasUnscoredExit,
  };
}

function finalizePlayerShotAdvanceState(
  state: PlayerShotAdvanceState,
): SpaceInvadersGameState {
  if (state.destroyedInvaderBounds.length > 0) {
    state.game = continueSpaceInvadersMultiKillCombo(
      state.game,
      getCombinedSpaceInvadersScoreTarget(state.destroyedInvaderBounds),
      state.destroyedInvaderBounds.length,
      state.destroyedInvaderPopupPoints,
      state.invaderPopupScoreScale,
    );
  }

  const playerShots = state.playerVolleyHasScored
    ? state.activeShots.map((shot) =>
        shot.hasScored === true
          ? shot
          : {
              ...shot,
              hasScored: true,
            },
      )
    : state.activeShots;

  return {
    ...state.game,
    playerShots,
    playerVolleyHasArmoredHit: state.playerVolleyHasArmoredHit,
    playerVolleyHasScored: state.playerVolleyHasScored,
    playerVolleyHasUnscoredExit: state.playerVolleyHasUnscoredExit,
  };
}

function advancePlayerShotCollision(
  state: PlayerShotAdvanceState,
  shot: SpaceInvadersPlayerShot,
  random: SpaceInvadersRandomSource,
) {
  const movedShot = advancePlayerShotPosition(shot);
  const damagedInvaderIds = new Set(movedShot.damagedInvaderIds ?? []);
  let didScoreWithShot = shot.hasScored === true || state.playerVolleyHasScored;

  if (!isPlayerShotActive(movedShot, state.game)) {
    recordPlayerShotExit(state, didScoreWithShot);
    return;
  }

  const ufoResolution = resolvePlayerShotUfoHit(
    state,
    movedShot,
    didScoreWithShot,
    random,
  );

  didScoreWithShot = ufoResolution.didScoreWithShot;

  if (ufoResolution.isShotConsumed) {
    return;
  }

  const { hitInvaders, vulnerableHitInvaders } = getPlayerShotInvaderTargets(
    state.game,
    movedShot,
    damagedInvaderIds,
  );

  if (hitInvaders.length === 0) {
    keepActivePlayerShot(state, movedShot, didScoreWithShot);
    return;
  }

  if (vulnerableHitInvaders.length === 0) {
    resolvePlayerShotShieldImpact(state, movedShot, hitInvaders[0]!, didScoreWithShot, random);
    return;
  }

  const invaderResolution = resolvePlayerShotInvaderHits(
    state,
    movedShot,
    vulnerableHitInvaders,
    damagedInvaderIds,
    didScoreWithShot,
    random,
  );

  if (movedShot.kind === "piercing" && state.game.status !== "won") {
    state.activeShots.push({
      ...movedShot,
      damagedInvaderIds: invaderResolution.shotDamagedInvaderIds,
      hasScored: invaderResolution.didScoreWithShot,
    });
  }
}

function recordPlayerShotExit(
  state: PlayerShotAdvanceState,
  didScoreWithShot: boolean,
) {
  if (!didScoreWithShot) {
    state.playerVolleyHasUnscoredExit = true;
  }
}

function keepActivePlayerShot(
  state: PlayerShotAdvanceState,
  movedShot: SpaceInvadersPlayerShot,
  didScoreWithShot: boolean,
) {
  state.activeShots.push({
    ...movedShot,
    hasScored: didScoreWithShot,
  });
}

function resolvePlayerShotUfoHit(
  state: PlayerShotAdvanceState,
  movedShot: SpaceInvadersPlayerShot,
  didScoreWithShot: boolean,
  random: SpaceInvadersRandomSource,
): PlayerShotUfoResolution {
  if (!state.game.ufo.isActive || !rectanglesIntersect(movedShot, state.game.ufo)) {
    return {
      didScoreWithShot,
      isShotConsumed: false,
    };
  }

  const hitUfo = state.game.ufo;
  const gameWithExplosion = createSpaceInvadersExplosion(
    state.game,
    "ufo",
    hitUfo,
    random,
  );
  let ufoPopupPoints = hitUfo.points;
  let ufoPopupLabel: string | undefined;
  let ufoPopupScoreScale = 1;
  let gameWithScore: SpaceInvadersGameState = {
    ...gameWithExplosion,
    score: gameWithExplosion.score + hitUfo.points,
  };

  if (!didScoreWithShot) {
    const hitStreakResult = advanceSpaceInvadersHitStreak(gameWithScore);

    gameWithScore = hitStreakResult.game;
    ufoPopupPoints += hitStreakResult.bonus;

    if (hitStreakResult.bonus > 0) {
      ufoPopupScoreScale = getSpaceInvadersHitStreakPopupScale(
        gameWithScore.hitStreak,
      );
    }
  }

  const ufoChainResult = advanceSpaceInvadersUfoChain(gameWithScore);

  gameWithScore = ufoChainResult.game;
  ufoPopupPoints += ufoChainResult.bonus;

  if (ufoChainResult.bonus > 0) {
    ufoPopupLabel = "UFO CHAIN";
  }

  const gameWithScorePopup = createSpaceInvadersScorePopup(
    gameWithScore,
    hitUfo,
    {
      label: ufoPopupLabel,
      points: ufoPopupPoints,
      scoreScale: ufoPopupScoreScale,
    },
  );

  state.game = {
    ...gameWithScorePopup,
    ufo: deactivateSpaceInvadersUfo(hitUfo, state.game.boardWidth),
  };
  state.playerVolleyHasScored = true;

  return {
    didScoreWithShot: true,
    isShotConsumed: movedShot.kind !== "piercing",
  };
}

function getPlayerShotInvaderTargets(
  game: SpaceInvadersGameState,
  movedShot: SpaceInvadersPlayerShot,
  damagedInvaderIds: Set<string>,
): PlayerShotInvaderTargets {
  const hitInvaders = game.invaders.filter(
    (invader) =>
      invader.isActive &&
      !damagedInvaderIds.has(invader.id) &&
      rectanglesIntersect(movedShot, getInvaderCollisionBounds(invader)),
  );
  const vulnerableHitInvaders =
    movedShot.kind === "piercing"
      ? hitInvaders
      : hitInvaders.filter(
          (invader) => !isSpaceInvaderShielded(invader, game.invaders),
        );

  return {
    hitInvaders,
    vulnerableHitInvaders,
  };
}

function resolvePlayerShotShieldImpact(
  state: PlayerShotAdvanceState,
  movedShot: SpaceInvadersPlayerShot,
  shieldedInvader: SpaceInvader,
  didScoreWithShot: boolean,
  random: SpaceInvadersRandomSource,
) {
  state.game = createSpaceInvadersExplosion(
    state.game,
    "shield",
    getProjectileCollisionExplosionTarget(
      movedShot,
      getInvaderCollisionBounds(shieldedInvader),
    ),
    random,
  );

  if (!didScoreWithShot) {
    state.playerVolleyHasUnscoredExit = true;
  }
}

function resolvePlayerShotInvaderHits(
  state: PlayerShotAdvanceState,
  movedShot: SpaceInvadersPlayerShot,
  vulnerableHitInvaders: SpaceInvader[],
  damagedInvaderIds: Set<string>,
  didScoreWithShot: boolean,
  random: SpaceInvadersRandomSource,
): PlayerShotInvaderResolution {
  const damage = getPlayerShotInvaderDamage(movedShot, vulnerableHitInvaders);
  const shotDamagedInvaderIds = [
    ...damagedInvaderIds,
    ...damage.hitTargets.map(({ id }) => id),
  ];
  const nextDidScoreWithShot = applyPlayerShotInvaderDamage(
    state,
    damage,
    didScoreWithShot,
    random,
  );

  return {
    didScoreWithShot: nextDidScoreWithShot,
    shotDamagedInvaderIds,
  };
}

function getPlayerShotInvaderDamage(
  movedShot: SpaceInvadersPlayerShot,
  vulnerableHitInvaders: SpaceInvader[],
): PlayerShotInvaderDamage {
  const hitTargets =
    movedShot.kind === "piercing"
      ? vulnerableHitInvaders
      : vulnerableHitInvaders.slice(0, 1);
  const hitResults = hitTargets.map((invader) => ({
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
    hitTargets,
  };
}

function applyPlayerShotInvaderDamage(
  state: PlayerShotAdvanceState,
  damage: PlayerShotInvaderDamage,
  didScoreWithShot: boolean,
  random: SpaceInvadersRandomSource,
) {
  const damagedArmoredHitPointsById = new Map(
    damage.damagedArmoredInvaders.map(({ hitPoints, invader }) => [
      invader.id,
      hitPoints,
    ]),
  );
  const destroyedInvaderIds = new Set(
    damage.destroyedInvaders.map((invader) => invader.id),
  );
  const invadersAfterDestroy = state.game.invaders.map((invader) => {
    if (destroyedInvaderIds.has(invader.id)) {
      return { ...invader, hitPoints: 0, isActive: false };
    }

    const hitPoints = damagedArmoredHitPointsById.get(invader.id);

    return hitPoints === undefined ? invader : { ...invader, hitPoints };
  });
  const splitterFragments = createSpaceInvadersSplitterFragments(
    damage.destroyedInvaders,
    state.game.boardWidth,
  );
  const invaders = [...invadersAfterDestroy, ...splitterFragments];
  const activeInvaderCount = invaders.filter((invader) => invader.isActive).length;
  let gameWithHits: SpaceInvadersGameState = {
    ...state.game,
    invaders,
    score: state.game.score + damage.destroyedInvaderPoints,
  };

  state.destroyedInvaderPopupPoints += damage.destroyedInvaderPoints;

  for (const hitInvader of damage.destroyedInvaders) {
    state.destroyedInvaderBounds.push(hitInvader);
    gameWithHits = createSpaceInvadersExplosion(
      gameWithHits,
      "invader",
      hitInvader,
      random,
    );
    gameWithHits = maybeCreateSpaceInvadersPowerUpDrop(
      gameWithHits,
      hitInvader,
      random,
    );
  }

  gameWithHits = maybePrimeSpaceInvadersRevengeVolley(
    gameWithHits,
    damage.destroyedInvaders,
    random,
  );

  const scoredWithHit = applyPlayerShotInvaderScore(
    state,
    gameWithHits,
    damage,
    didScoreWithShot,
  );

  state.game = {
    ...scoredWithHit.game,
    status: activeInvaderCount === 0 ? "won" : state.game.status,
  };

  return scoredWithHit.didScoreWithShot;
}

function applyPlayerShotInvaderScore(
  state: PlayerShotAdvanceState,
  gameWithHits: SpaceInvadersGameState,
  damage: PlayerShotInvaderDamage,
  didScoreWithShot: boolean,
) {
  if (damage.destroyedInvaders.length > 0 && !didScoreWithShot) {
    const hitStreakResult = advanceSpaceInvadersHitStreak(gameWithHits);

    state.destroyedInvaderPopupPoints += hitStreakResult.bonus;

    if (hitStreakResult.bonus > 0) {
      state.invaderPopupScoreScale = Math.max(
        state.invaderPopupScoreScale,
        getSpaceInvadersHitStreakPopupScale(hitStreakResult.game.hitStreak),
      );
    }

    state.playerVolleyHasScored = true;

    return {
      didScoreWithShot: true,
      game: hitStreakResult.game,
    };
  }

  if (damage.damagedArmoredInvaders.length > 0) {
    state.playerVolleyHasArmoredHit = true;
  }

  return {
    didScoreWithShot,
    game: gameWithHits,
  };
}

function advanceSpaceInvadersUfo(game: SpaceInvadersGameState): SpaceInvadersGameState {
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

function advancePlayerBurst(game: SpaceInvadersGameState): SpaceInvadersGameState {
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

function advancePowerUps(game: SpaceInvadersGameState): SpaceInvadersGameState {
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

    if (game.playerRespawnTicks === 0 && rectanglesIntersect(movedPowerUp, nextGame.player)) {
      nextGame = applySpaceInvadersPowerUp(nextGame, movedPowerUp);
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

function applySpaceInvadersPowerUp(
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

function advanceAlienFreeze(game: SpaceInvadersGameState) {
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

function advanceInvaderShots(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (game.invaderShots.length === 0) {
    return game;
  }

  const {
    invaderShots: movedShots,
    nextInvaderShotId,
  } = advanceInvaderShotPositions(game);
  const gameAfterShotCollisions = resolveOpposingShotCollisions(
    {
      ...game,
      invaderShots: movedShots,
      nextInvaderShotId,
    },
    random,
  );
  const hittingShots = gameAfterShotCollisions.invaderShots.filter(
    (shot) =>
      isInvaderShotDangerous(shot) &&
      rectanglesIntersect(shot, gameAfterShotCollisions.player),
  );
  const didHitPlayer = hittingShots.length > 0;

  if (!didHitPlayer) {
    return gameAfterShotCollisions;
  }

  if (gameAfterShotCollisions.playerRespawnTicks > 0) {
    return gameAfterShotCollisions;
  }

  if (gameAfterShotCollisions.playerShieldTicks > 0) {
    return {
      ...gameAfterShotCollisions,
      invaderShots: gameAfterShotCollisions.invaderShots.filter(
        (shot) => !hittingShots.includes(shot),
      ),
    };
  }

  const lives = gameAfterShotCollisions.lives - 1;
  const gameWithExplosion = createSpaceInvadersExplosion(
    gameAfterShotCollisions,
    "player",
    gameAfterShotCollisions.player,
    random,
  );

  return {
    ...gameWithExplosion,
    invaderBurst: null,
    invaderShotCooldownTicks: INVADER_HIT_RECOVERY_TICKS,
    invaderShots: [],
    nextInvaderShotId: gameAfterShotCollisions.nextInvaderShotId,
    hitStreak: 0,
    lives,
    player: createCenteredPlayer(
      gameAfterShotCollisions.boardWidth,
      gameAfterShotCollisions.boardHeight,
    ),
    playerBurst: null,
    playerRespawnTicks: lives <= 0 ? 0 : SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    playerShieldTicks: 0,
    playerShots: [],
    playerVolleyHasArmoredHit: false,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
    status: lives <= 0 ? "lost" : gameAfterShotCollisions.status,
  };
}

function resolveOpposingShotCollisions(
  game: SpaceInvadersGameState,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (game.playerShots.length === 0 || game.invaderShots.length === 0) {
    return game;
  }

  const collidedPlayerShotIds = new Set<string>();
  const collidedInvaderShotIds = new Set<string>();
  let didCollide = false;
  let nextGame = game;

  for (const playerShot of game.playerShots) {
    for (const invaderShot of game.invaderShots) {
      if (rectanglesIntersect(playerShot, invaderShot)) {
        didCollide = true;
        if (!isPlayerShotInvulnerable(playerShot)) {
          collidedPlayerShotIds.add(playerShot.id);
        }
        if (!isInvaderShotInvulnerable(invaderShot)) {
          collidedInvaderShotIds.add(invaderShot.id);
        }
        nextGame = createSpaceInvadersExplosion(
          nextGame,
          "projectile",
          getProjectileCollisionExplosionTarget(playerShot, invaderShot),
          random,
        );
      }
    }
  }

  if (!didCollide) {
    return game;
  }

  const playerShots = game.playerShots.filter(
    (shot) => !collidedPlayerShotIds.has(shot.id),
  );
  const isPlayerVolleyFinished = playerShots.length === 0 && game.playerBurst === null;

  return {
    ...nextGame,
    invaderShots: game.invaderShots.filter(
      (shot) => !collidedInvaderShotIds.has(shot.id),
    ),
    playerShots,
    playerVolleyHasArmoredHit: isPlayerVolleyFinished
      ? false
      : game.playerVolleyHasArmoredHit,
    playerVolleyHasScored: isPlayerVolleyFinished ? false : game.playerVolleyHasScored,
    playerVolleyHasUnscoredExit: isPlayerVolleyFinished
      ? false
      : game.playerVolleyHasUnscoredExit,
  };
}

function isPlayerShotInvulnerable(
  shot: Pick<SpaceInvadersPlayerShot, "kind">,
) {
  return shot.kind === "piercing";
}

function isInvaderShotInvulnerable(
  shot: Pick<SpaceInvadersInvaderShot, "kind">,
) {
  return shot.kind === "armor-wave";
}

function getProjectileCollisionExplosionTarget(
  firstTarget: { height: number; width: number; x: number; y: number },
  secondTarget: { height: number; width: number; x: number; y: number },
): SpaceInvadersScoreTarget {
  const left = Math.max(firstTarget.x, secondTarget.x);
  const right = Math.min(
    firstTarget.x + firstTarget.width,
    secondTarget.x + secondTarget.width,
  );
  const top = Math.max(firstTarget.y, secondTarget.y);
  const bottom = Math.min(
    firstTarget.y + firstTarget.height,
    secondTarget.y + secondTarget.height,
  );
  const centerX =
    left < right
      ? (left + right) / 2
      : (firstTarget.x +
          firstTarget.width / 2 +
          secondTarget.x +
          secondTarget.width / 2) /
        2;
  const centerY =
    top < bottom
      ? (top + bottom) / 2
      : (firstTarget.y +
          firstTarget.height / 2 +
          secondTarget.y +
          secondTarget.height / 2) /
        2;

  return {
    height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
    width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
    x: centerX - SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH / 2,
    y: centerY - SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT / 2,
  };
}

function advancePlayerRecovery(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.playerRespawnTicks > 0) {
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

  if (game.playerShieldTicks > 0) {
    return {
      ...game,
      playerShieldTicks: game.playerShieldTicks - 1,
    };
  }

  return game;
}

function advanceExplosions(game: SpaceInvadersGameState): SpaceInvadersGameState {
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

function advanceScorePopups(game: SpaceInvadersGameState): SpaceInvadersGameState {
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

function advanceSpaceInvadersMultiKillComboWindow(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  const combo = game.multiKillCombo;

  if (combo === null) {
    return game;
  }

  if (game.status !== "running" || isSpaceInvadersVolleyFinished(game)) {
    return finalizeSpaceInvadersMultiKillCombo(game);
  }

  const nextCombo = {
    ...combo,
    ticksRemaining: combo.ticksRemaining - 1,
  };

  if (nextCombo.ticksRemaining <= 0) {
    return finalizeSpaceInvadersMultiKillCombo({
      ...game,
      multiKillCombo: nextCombo,
    });
  }

  return {
    ...game,
    multiKillCombo: nextCombo,
  };
}

function finalizeSpaceInvadersMultiKillComboIfVolleyEnded(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.multiKillCombo === null || !isSpaceInvadersVolleyFinished(game)) {
    return game;
  }

  return finalizeSpaceInvadersMultiKillCombo(game);
}

function finalizeSpaceInvadersPlayerVolley(game: SpaceInvadersGameState) {
  if (!isSpaceInvadersVolleyFinished(game)) {
    return game;
  }

  const resolvedGame =
    game.playerVolleyHasUnscoredExit &&
    !game.playerVolleyHasScored &&
    !game.playerVolleyHasArmoredHit
      ? resetSpaceInvadersHitStreak(game)
      : game;

  if (
    !resolvedGame.playerVolleyHasArmoredHit &&
    !resolvedGame.playerVolleyHasScored &&
    !resolvedGame.playerVolleyHasUnscoredExit
  ) {
    return resolvedGame;
  }

  return {
    ...resolvedGame,
    playerVolleyHasArmoredHit: false,
    playerVolleyHasScored: false,
    playerVolleyHasUnscoredExit: false,
  };
}

function continueSpaceInvadersMultiKillCombo(
  game: SpaceInvadersGameState,
  target: SpaceInvadersScoreTarget,
  destroyedCount: number,
  points: number,
  scoreScale: number,
): SpaceInvadersGameState {
  const combo = game.multiKillCombo;
  const mergedTarget =
    combo === null
      ? target
      : getCombinedSpaceInvadersScoreTarget([combo, target]);

  return {
    ...game,
    multiKillCombo: {
      destroyedCount: (combo?.destroyedCount ?? 0) + destroyedCount,
      height: mergedTarget.height,
      points: (combo?.points ?? 0) + points,
      scoreScale: Math.max(combo?.scoreScale ?? 1, scoreScale),
      ticksRemaining: SPACE_INVADERS_MULTI_KILL_COMBO_TICKS,
      width: mergedTarget.width,
      x: mergedTarget.x,
      y: mergedTarget.y,
    },
  };
}

function finalizeSpaceInvadersMultiKillCombo(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  const combo = game.multiKillCombo;

  if (combo === null) {
    return game;
  }

  const multiKillBonus = getSpaceInvadersMultiKillBonus(combo.destroyedCount);
  const gameWithBonus = {
    ...game,
    multiKillCombo: null,
    score: game.score + multiKillBonus,
  };

  return createSpaceInvadersScorePopup(gameWithBonus, combo, {
    label: getSpaceInvadersInvaderScorePopupLabel(
      combo.destroyedCount,
      multiKillBonus,
    ),
    points: combo.points + multiKillBonus,
    scoreScale: combo.scoreScale,
  });
}

function isSpaceInvadersVolleyFinished(
  game: Pick<SpaceInvadersGameState, "playerBurst" | "playerShots">,
) {
  return game.playerShots.length === 0 && game.playerBurst === null;
}

function createSpaceInvadersExplosion(
  game: SpaceInvadersGameState,
  kind: SpaceInvadersExplosionKind,
  target: { height: number; width: number; x: number; y: number },
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  const padding = EXPLOSION_PADDING_BY_KIND[kind];
  const height = target.height + padding * 2;
  const width = target.width + padding * 2;
  const variant =
    SPACE_INVADERS_EXPLOSION_VARIANTS[
      getRandomIndex(SPACE_INVADERS_EXPLOSION_VARIANTS.length, random)
    ] ?? 1;
  const explosion: SpaceInvadersExplosion = {
    ageTicks: 0,
    height,
    id: `explosion-${game.nextExplosionId}`,
    kind,
    ttlTicks: EXPLOSION_TTL_TICKS,
    variant,
    width,
    x: target.x + target.width / 2 - width / 2,
    y: target.y + target.height / 2 - height / 2,
  };

  return {
    ...game,
    explosions: [...game.explosions, explosion],
    nextExplosionId: game.nextExplosionId + 1,
  };
}

function createSpaceInvadersScorePopup(
  game: SpaceInvadersGameState,
  target: SpaceInvadersScoreTarget,
  { label, points, scoreScale = 1 }: SpaceInvadersScorePopupOptions,
): SpaceInvadersGameState {
  const scorePopup: SpaceInvadersScorePopup = {
    ageTicks: 0,
    height: target.height,
    id: `score-popup-${game.nextScorePopupId}`,
    ...(label === undefined ? {} : { label }),
    points,
    ...(scoreScale <= 1 ? {} : { scoreScale }),
    ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
    width: target.width,
    x: target.x,
    y: target.y,
  };

  return {
    ...game,
    nextScorePopupId: game.nextScorePopupId + 1,
    scorePopups: [...game.scorePopups, scorePopup],
  };
}

function marchInvaders(game: SpaceInvadersGameState): SpaceInvadersGameState {
  const activeInvaders = game.invaders.filter((invader) => invader.isActive);

  if (activeInvaders.length === 0) {
    return game;
  }

  const exposedDiverIds = getExposedDiverIds(activeInvaders);
  const formationSpeedMultiplier = getFormationSpeedMultiplier(
    game,
    activeInvaders.length,
  );
  const formationInvaders = activeInvaders.filter(
    (invader) => !isExposedDiver(invader, exposedDiverIds),
  );
  const wouldFormationHitWall = formationInvaders.some((invader) => {
    const nextX =
      invader.x +
      game.marchDirection *
        getInvaderStepX(invader, exposedDiverIds, formationSpeedMultiplier);

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

        const isDiving = isExposedDiver(invader, exposedDiverIds);

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

      if (isExposedDiver(invader, exposedDiverIds)) {
        return advanceDivingInvader(invader, game);
      }

      return {
        ...invader,
        direction: game.marchDirection,
        x:
          invader.x +
          game.marchDirection *
            getInvaderStepX(invader, exposedDiverIds, formationSpeedMultiplier),
        isDiving: getNextDiverState(invader, exposedDiverIds),
      };
    }),
  };
}

function advanceDivingInvader(
  invader: SpaceInvader,
  game: Pick<SpaceInvadersGameState, "boardWidth">,
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

function getExposedDiverIds(activeInvaders: SpaceInvader[]) {
  return new Set(
    activeInvaders
      .filter(isDiverMovementInvader)
      .filter((invader) => invader.isDiving || isDiverLaneClear(invader, activeInvaders))
      .map((invader) => invader.id),
  );
}

function isDiverLaneClear(diver: SpaceInvader, activeInvaders: SpaceInvader[]) {
  return !activeInvaders.some(
    (invader) =>
      invader.id !== diver.id && invader.y > diver.y && invadersOverlapX(diver, invader),
  );
}

function invadersOverlapX(first: SpaceInvader, second: SpaceInvader) {
  return first.x < second.x + second.width && second.x < first.x + first.width;
}

function getFormationSpeedMultiplier(
  game: Pick<SpaceInvadersGameState, "alienCount">,
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

function getInvaderStepX(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
  formationSpeedMultiplier: number,
) {
  return (
    INVADER_STEP_X *
    getInvaderMovementMultiplier(invader, exposedDiverIds, formationSpeedMultiplier)
  );
}

function getInvaderMovementMultiplier(
  invader: SpaceInvader,
  exposedDiverIds: Set<string>,
  formationSpeedMultiplier: number,
) {
  return isExposedDiver(invader, exposedDiverIds)
    ? DIVER_STEP_MULTIPLIER
    : formationSpeedMultiplier;
}

function getNextDiverState(invader: SpaceInvader, exposedDiverIds: Set<string>) {
  return invader.isDiving || isExposedDiver(invader, exposedDiverIds);
}

function isExposedDiver(invader: SpaceInvader, exposedDiverIds: Set<string>) {
  return isDiverMovementInvader(invader) && exposedDiverIds.has(invader.id);
}

function isDiverMovementInvader(invader: Pick<SpaceInvader, "kind">) {
  return invader.kind === "diver" || invader.kind === "splitter-fragment";
}

function hasInvaderReachedBase(game: SpaceInvadersGameState) {
  return game.invaders.some(
    (invader) => invader.isActive && invader.y + invader.height >= game.baseY,
  );
}

function createCenteredPlayer(
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  boardHeight = SPACE_INVADERS_BOARD_HEIGHT,
): SpaceInvadersPlayer {
  return {
    height: PLAYER_HEIGHT,
    width: PLAYER_WIDTH,
    x: (boardWidth - PLAYER_WIDTH) / 2,
    y: boardHeight - PLAYER_HEIGHT - PLAYER_BOTTOM_MARGIN,
  };
}

function maybeCreateSpaceInvadersPowerUpDrop(
  game: SpaceInvadersGameState,
  invader: SpaceInvader,
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  if (invader.kind !== "diver") {
    return game;
  }

  const powerUp: SpaceInvadersPowerUp = {
    height: SPACE_INVADERS_POWER_UP_SIZE,
    id: `power-up-${game.nextPowerUpId}`,
    kind: getRandomPowerUpKind(random),
    velocityY: SPACE_INVADERS_POWER_UP_SPEED,
    width: SPACE_INVADERS_POWER_UP_SIZE,
    x: invader.x + invader.width / 2 - SPACE_INVADERS_POWER_UP_SIZE / 2,
    y: invader.y + invader.height / 2 - SPACE_INVADERS_POWER_UP_SIZE / 2,
  };

  return {
    ...game,
    nextPowerUpId: game.nextPowerUpId + 1,
    powerUps: [...game.powerUps, powerUp],
  };
}

function getRandomPowerUpKind(random: SpaceInvadersRandomSource) {
  const randomValue = getRandomValue(random);

  if (randomValue < SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE) {
    return "extra-life";
  }

  const commonRandomValue =
    (randomValue - SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE) /
    (1 - SPACE_INVADERS_EXTRA_LIFE_DROP_CHANCE);

  return (
    SPACE_INVADERS_COMMON_POWER_UP_KINDS[
      getRandomIndex(SPACE_INVADERS_COMMON_POWER_UP_KINDS.length, () => commonRandomValue)
    ] ?? "bonus-score"
  );
}

function createInitialSpaceInvadersUfo(): SpaceInvadersUfoState {
  return {
    cooldownTicks: UFO_COOLDOWN_TICKS,
    direction: 1,
    height: UFO_HEIGHT,
    isActive: false,
    points: UFO_POINT_VALUES[0],
    width: UFO_WIDTH,
    x: -UFO_WIDTH,
    y: UFO_Y,
  };
}

function deactivateSpaceInvadersUfo(
  ufo: SpaceInvadersUfoState,
  boardWidth: number,
): SpaceInvadersUfoState {
  const nextDirection = (ufo.direction * -1) as SpaceInvadersDirection;

  return {
    ...ufo,
    cooldownTicks: UFO_COOLDOWN_TICKS,
    direction: nextDirection,
    isActive: false,
    points: getNextSpaceInvadersUfoPoints(ufo.points),
    x: nextDirection === 1 ? -ufo.width : boardWidth,
  };
}

function getNextSpaceInvadersUfoPoints(points: number) {
  const pointIndex = UFO_POINT_VALUES.findIndex((value) => value === points);
  const nextIndex = pointIndex === -1 ? 0 : (pointIndex + 1) % UFO_POINT_VALUES.length;

  return UFO_POINT_VALUES[nextIndex] ?? UFO_POINT_VALUES[0];
}
