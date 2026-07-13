import {
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_BONUS_LIFE_SCORE,
  BATTLE_CITY_BULLET_COLLISION_DISTANCE,
  BATTLE_CITY_BULLET_IMPACT_TICKS,
  BATTLE_CITY_CARRIER_ORDERS,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_ENEMY_FIRE_CHANCE,
  BATTLE_CITY_ENEMY_SPAWN_TICKS,
  BATTLE_CITY_ENEMY_STATS,
  BATTLE_CITY_ENEMY_TURN_CHANCE,
  BATTLE_CITY_FORTRESS_WARNING_TICKS,
  BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
  BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
  BATTLE_CITY_ICE_SLIDE_STEPS,
  BATTLE_CITY_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
  BATTLE_CITY_PIXEL_STEP,
  BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  BATTLE_CITY_POWER_UP_SCORE_POPUP_TICKS,
  BATTLE_CITY_STAGE_INTRO_TICKS,
  BATTLE_CITY_STAGE_RESULTS_BASE_TICKS,
  BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_STAGE_TRANSITION_TICKS,
  BATTLE_CITY_STARTING_LIVES,
  BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE,
  BATTLE_CITY_TICK_MS,
  BATTLE_CITY_TOTAL_ENEMIES,
} from "./battle-city/constants";
import {
  createBattleCityTerrain,
  getBattleCityStage,
} from "./battle-city/stages";
import {
  battleCityPowerUpWithinTankRange,
  selectBattleCityPowerUp,
} from "./battle-city/power-ups";
import {
  getBattleCityEnemyQueueStage,
  getBattleCityEnemySpawnIntervalTicks,
  getNextBattleCityStage,
} from "./battle-city/stage-progression";
import {
  applyBattleCityTerrainBulletImpact,
  battleCityTerrainFragmentsIntersectAabb,
  BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
  createBattleCityTerrainFragmentGrid,
} from "./battle-city/terrain-fragments";
import type {
  BattleCityBullet,
  BattleCityDirection,
  BattleCityEnemy,
  BattleCityEnemyType,
  BattleCityFrameInput,
  BattleCityGameState,
  BattleCityKillCounts,
  BattleCityPlayer,
  BattleCityPosition,
  BattleCityPowerUp,
  BattleCityPowerUpScorePopup,
  BattleCityRandom,
  BattleCityTerrain,
  CreateBattleCityGameOptions,
} from "./battle-city/types";

export {
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_BONUS_LIFE_SCORE,
  BATTLE_CITY_BULLET_COLLISION_DISTANCE,
  BATTLE_CITY_BULLET_IMPACT_TICKS,
  BATTLE_CITY_BULLET_RENDER_SIZE,
  BATTLE_CITY_CARRIER_FLASH_TICKS,
  BATTLE_CITY_CARRIER_ORDERS,
  BATTLE_CITY_ENEMY_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_ENEMY_SCORE_POPUP_TICKS,
  BATTLE_CITY_ENEMY_SPAWN_TICKS,
  BATTLE_CITY_ENEMY_STATS,
  BATTLE_CITY_ENEMY_FIRE_CHANCE,
  BATTLE_CITY_ENEMY_TURN_CHANCE,
  BATTLE_CITY_FINAL_STAGE_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_FORTRESS_TICKS,
  BATTLE_CITY_FORTRESS_WARNING_TICKS,
  BATTLE_CITY_FREEZE_TICKS,
  BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
  BATTLE_CITY_HELMET_TICKS,
  BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
  BATTLE_CITY_ICE_SLIDE_STEPS,
  BATTLE_CITY_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
  BATTLE_CITY_PIXEL_STEP,
  BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
  BATTLE_CITY_PLAYER_INVULNERABILITY_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  BATTLE_CITY_POWER_UP_SCORE_POPUP_TICKS,
  BATTLE_CITY_REPEAT_SPAWN_INTERVAL_TICKS,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_STAGE_INTRO_TICKS,
  BATTLE_CITY_STAGE_RESULTS_BASE_TICKS,
  BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS,
  BATTLE_CITY_STAGE_TRANSITION_TICKS,
  BATTLE_CITY_STARTING_LIVES,
  BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE,
  BATTLE_CITY_TICK_MS,
  BATTLE_CITY_TOTAL_ENEMIES,
} from "./battle-city/constants";
export {
  BATTLE_CITY_STAGES,
  createBattleCityTerrain,
  getBattleCityStage,
} from "./battle-city/stages";
export {
  formatBattleCityStageLabel,
  getBattleCityDisplayedStage,
  getBattleCityEnemyQueueStage,
  getBattleCityEnemySpawnIntervalTicks,
  getNextBattleCityStage,
} from "./battle-city/stage-progression";
export type {
  BattleCityBullet,
  BattleCityBulletOwner,
  BattleCityDifficulty,
  BattleCityDirection,
  BattleCityEnemy,
  BattleCityEnemyType,
  BattleCityFrameInput,
  BattleCityGameState,
  BattleCityKillCounts,
  BattleCityPlayer,
  BattleCityPlayerPhase,
  BattleCityPosition,
  BattleCityPowerUp,
  BattleCityPowerUpScorePopup,
  BattleCityPowerUpType,
  BattleCityRandom,
  BattleCityStageDefinition,
  BattleCityStatus,
  BattleCityStageOutcome,
  BattleCityTerrain,
  CreateBattleCityGameOptions,
} from "./battle-city/types";

const DIRECTION_DELTAS: Readonly<
  Record<BattleCityDirection, BattleCityPosition>
> = {
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
  up: { col: 0, row: -1 },
};

const BATTLE_CITY_DIRECTIONS: readonly BattleCityDirection[] = [
  "up",
  "left",
  "down",
  "right",
];
const BATTLE_CITY_ENEMY_SLOTS = [5, 4, 3, 2] as const;
const EMPTY_BATTLE_CITY_FRAME_INPUT: BattleCityFrameInput = {
  direction: null,
  fireRequested: false,
};

const BATTLE_CITY_TANK_SIZE = 2;
const POSITION_EPSILON = 1e-9;
const EMPTY_KILL_COUNTS: BattleCityKillCounts = {
  armor: 0,
  basic: 0,
  fast: 0,
  power: 0,
};

function canControlBattleCityPlayer(game: BattleCityGameState): boolean {
  return (
    (game.status === "running" || game.status === "stage-clear") &&
    game.player.phase === "active"
  );
}

function isActiveEnemy(enemy: BattleCityEnemy): boolean {
  return enemy.spawnTicks === 0 && enemy.explosionTicks === 0;
}

type StageRunContext = {
  bonusLifeAwarded: boolean;
  cycle: number;
  lives: number;
  powerTier: BattleCityPlayer["powerTier"];
  score: number;
  stageIntroTicks?: number;
  status: BattleCityGameState["status"];
  tick: number;
};

export function createInitialBattleCityGame(
  { stage = 1 }: CreateBattleCityGameOptions = {},
): BattleCityGameState {
  return createStageGame(normalizeStage(stage), {
    bonusLifeAwarded: false,
    cycle: 1,
    lives: BATTLE_CITY_STARTING_LIVES,
    powerTier: 0,
    score: 0,
    status: "ready",
    tick: 0,
  });
}

export function startBattleCityGame(
  game: BattleCityGameState,
): BattleCityGameState {
  if (game.status === "paused") {
    return { ...game, status: "running" };
  }
  if (game.status !== "ready") {
    return game;
  }

  return {
    ...game,
    stageTransitionTicks: BATTLE_CITY_STAGE_INTRO_TICKS,
    status: "stage-intro",
  };
}

export function pauseBattleCityGame(
  game: BattleCityGameState,
): BattleCityGameState {
  if (game.status !== "running") {
    return game;
  }
  return { ...game, status: "paused" };
}

export function resumeBattleCityGame(
  game: BattleCityGameState,
): BattleCityGameState {
  if (game.status !== "paused") {
    return game;
  }
  return { ...game, status: "running" };
}

export function restartBattleCityGame(): BattleCityGameState;
export function restartBattleCityGame(
  game: BattleCityGameState,
): BattleCityGameState;
export function restartBattleCityGame(): BattleCityGameState {
  return startBattleCityGame(createInitialBattleCityGame());
}

export function moveBattleCityPlayer(
  game: BattleCityGameState,
  direction: BattleCityDirection,
): BattleCityGameState {
  if (!canControlBattleCityPlayer(game)) {
    return game;
  }

  const player = tryMovePlayer(game, direction);
  if (player === game.player) {
    if (game.player.direction === direction) {
      return game;
    }
    return { ...game, player: { ...game.player, direction } };
  }
  return { ...game, player };
}

export function fireBattleCityPlayer(
  game: BattleCityGameState,
): BattleCityGameState {
  if (!canControlBattleCityPlayer(game)) {
    return game;
  }

  const primaryBullet = game.bullets.find(
    (bullet) => bullet.owner === "player" && bullet.slot === 0,
  );
  const secondaryBullet = game.bullets.find(
    (bullet) => bullet.owner === "player" && bullet.slot === 8,
  );
  const canUseSecondarySlot = game.player.powerTier >= 2;
  const muzzle = getMuzzlePosition(game.player);
  if (
    (primaryBullet !== undefined &&
      (!canUseSecondarySlot || secondaryBullet !== undefined)) ||
    !isMuzzlePositionValid(muzzle.row, muzzle.col)
  ) {
    return game;
  }

  const bullets =
    primaryBullet === undefined
      ? game.bullets
      : game.bullets.map((bullet) =>
          bullet.id === primaryBullet.id ? { ...bullet, slot: 8 } : bullet,
        );

  const isMaximumPower = game.player.powerTier === 3;
  const bullet: BattleCityBullet = {
    ...muzzle,
    canDestroySteel: isMaximumPower,
    direction: game.player.direction,
    id: `bullet-${game.nextBulletId}`,
    impactTicks: 0,
    isNewborn: true,
    owner: "player",
    slot: 0,
    speed:
      game.player.powerTier >= 1
        ? BATTLE_CITY_PIXEL_STEP * 4
        : BATTLE_CITY_PIXEL_STEP * 2,
    strength: isMaximumPower ? 2 : 1,
  };
  return {
    ...game,
    bullets: sortBulletsBySlot([...bullets, bullet]),
    nextBulletId: game.nextBulletId + 1,
  };
}

export function advanceBattleCityGame(
  game: BattleCityGameState,
  random?: BattleCityRandom,
): BattleCityGameState;
export function advanceBattleCityGame(
  game: BattleCityGameState,
  elapsedMs: number,
  random?: BattleCityRandom,
): BattleCityGameState;
export function advanceBattleCityGame(
  game: BattleCityGameState,
  elapsedMs: number,
  random: BattleCityRandom | undefined,
  playerInput: BattleCityFrameInput,
): BattleCityGameState;
export function advanceBattleCityGame(
  game: BattleCityGameState,
  elapsedMsOrRandom: number | BattleCityRandom = BATTLE_CITY_TICK_MS,
  providedRandom: BattleCityRandom = Math.random,
  playerInput: BattleCityFrameInput = EMPTY_BATTLE_CITY_FRAME_INPUT,
): BattleCityGameState {
  const random =
    typeof elapsedMsOrRandom === "function" ? elapsedMsOrRandom : providedRandom;
  let frameGame = game;
  switch (game.status) {
    case "stage-intro": {
      frameGame = advanceStageIntro(game);
      if (frameGame.status === "stage-intro") {
        return frameGame;
      }
      break;
    }
    case "stage-results":
      return advanceStageResults(game);
    case "running":
    case "stage-clear":
    case "game-over":
      break;
    case "lost":
      return game;
    case "ready":
      return { ...game, tick: game.tick + 1 };
    case "paused":
      return advancePausedFrame(game);
  }

  // Ending setup resets the counters between frames. The following NMI
  // advances the low counter before the first (and every later) live-tail
  // handler pass, while the stored state still represents that boundary.
  const gameForFrame =
    frameGame.status === "stage-clear" || frameGame.status === "game-over"
      ? { ...frameGame, tick: frameGame.tick + 1 }
      : frameGame;
  const gameAfterTimers = advanceTimers(gameForFrame);
  const gameAfterEnemyTanks = advanceEnemyTankHandlers(
    gameAfterTimers,
    random,
  );
  const gameAfterPlayerTank = advancePlayerTankHandler(
    gameAfterEnemyTanks,
    playerInput.direction,
  );
  // The hardware handles tank movement and expiring shell slots before the
  // A/B press creates a new player shell later in the same video frame.
  const gameAfterPlayerFire = playerInput.fireRequested
    ? fireBattleCityPlayer(gameAfterPlayerTank)
    : gameAfterPlayerTank;
  const gameAfterEnemyFire = advanceEnemyFire(
    gameAfterPlayerFire,
    random,
  );
  const gameAfterSpawn = spawnNextEnemy(gameAfterEnemyFire);
  const gameAfterBullets = advanceBullets(gameAfterSpawn, random);
  const gameAfterPickup = collectPowerUp(gameAfterBullets);
  const completed = maybeCompleteStage(gameAfterPickup);
  const transitioned =
    completed.status === frameGame.status &&
    (frameGame.status === "stage-clear" || frameGame.status === "game-over")
      ? advanceBattleEnding(completed)
      : completed;
  const enteredEnding =
    transitioned.status !== frameGame.status &&
    (transitioned.status === "stage-clear" || transitioned.status === "game-over");
  return {
    ...transitioned,
    stageBattleTicks: enteredEnding
      ? 0
      : transitioned.status === "running" ||
          transitioned.status === "stage-clear" ||
          transitioned.status === "game-over"
        ? frameGame.stageBattleTicks + 1
        : transitioned.stageBattleTicks,
    // The ending setup clears both hardware frame counters. The low counter
    // then continues through the tail, score tally, and following stage setup.
    tick: enteredEnding ? 0 : frameGame.tick + 1,
  };
}

export function getBattleCityTickDelay(): number {
  return BATTLE_CITY_TICK_MS;
}

export function getBattleCityStageResultDisplay(
  game: BattleCityGameState,
): { killCounts: BattleCityKillCounts; showTotal: boolean } {
  if (game.status !== "stage-results") {
    return { killCounts: { ...EMPTY_KILL_COUNTS }, showTotal: false };
  }

  const order: readonly BattleCityEnemyType[] = [
    "basic",
    "fast",
    "power",
    "armor",
  ];
  const killCounts = { ...EMPTY_KILL_COUNTS };
  // The first row credit becomes visible on frame 39. Later credits are nine
  // frames apart; the row-change waits put subsequent first credits 21 frames
  // beyond each row's empty nine-frame pass.
  let cursor = 39;
  for (const [index, type] of order.entries()) {
    const targetCount = game.stageKillCounts[type];
    const elapsedInRow = game.stageResultTicks - cursor;
    killCounts[type] =
      elapsedInRow < 0
        ? 0
        : Math.min(
            targetCount,
            Math.floor(
              elapsedInRow / BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS,
            ) + 1,
          );
    cursor +=
      (targetCount + 1) * BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS;
    if (index < order.length - 1) {
      cursor += 21;
    }
  }
  return {
    killCounts,
    showTotal: game.stageResultTicks >= cursor + 29,
  };
}

function normalizeStage(stage: number): number {
  if (!Number.isFinite(stage)) {
    return 1;
  }
  return Math.min(BATTLE_CITY_STAGE_COUNT, Math.max(1, Math.round(stage)));
}

function createStageGame(
  stageNumber: number,
  context: StageRunContext,
): BattleCityGameState {
  const stage = getBattleCityStage(stageNumber);
  const terrain = createBattleCityTerrain(stageNumber);
  return {
    activePowerUp: null,
    baseAlive: true,
    baseExplosionTicks: 0,
    bonusLifeAwarded: context.bonusLifeAwarded,
    bullets: [],
    cycle: context.cycle,
    destroyedEnemyCount: 0,
    difficulty: stage.difficulty,
    enemies: [],
    enemySpawnCooldownTicks: 0,
    fortressTicks: 0,
    freezeTicks: 0,
    lives: context.lives,
    nextBulletId: 0,
    nextEnemyId: 0,
    nextPowerUpId: 0,
    player: {
      ...stage.spawns.player1,
      direction: "up",
      iceSlideDirection: null,
      iceSlideStepsRemaining: 0,
      invulnerabilityTicks: 0,
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
      powerTier: context.powerTier,
      shieldTicks: 0,
    },
    powerUpScorePopup: null,
    score: context.score,
    spawnedEnemyCount: 0,
    stage: stageNumber,
    stageBattleTicks: 0,
    stageKillCounts: { ...EMPTY_KILL_COUNTS },
    stageOutcome: null,
    stageResultTicks: 0,
    stageTransitionTicks:
      context.status === "stage-intro"
        ? (context.stageIntroTicks ?? BATTLE_CITY_STAGE_INTRO_TICKS)
        : 0,
    status: context.status,
    terrain,
    terrainFragments: createBattleCityTerrainFragmentGrid(terrain),
    tick: context.tick,
    totalEnemyCount: BATTLE_CITY_TOTAL_ENEMIES,
  };
}

function tryMovePlayer(
  game: BattleCityGameState,
  direction: BattleCityDirection,
  isIceCoast = false,
): BattleCityPlayer {
  const occupied = game.enemies
    .filter(isActiveEnemy)
    .map(({ row, col }) => ({ col, row }));
  let origin: BattleCityPosition = game.player;
  let movementDistance = BATTLE_CITY_PIXEL_STEP;

  if (!tankIsAlignedToDirectionLane(origin, direction)) {
    // The NES rounds perpendicular turns onto the nearest 8-pixel lane. At an
    // exact four-pixel tie, try its preferred greater lane first, then the
    // equally near lower lane so a surviving half-wall cannot strand the tank.
    const snapped = getTankDirectionLaneSnapCandidates(origin, direction).find(
      (candidate) =>
        isTankPositionOpen(
          game.terrain,
          game.terrainFragments,
          candidate.row,
          candidate.col,
          occupied,
        ),
    );
    if (snapped !== undefined) {
      origin = snapped;
    } else {
      // A blocked auto-alignment may rotate the tank, but it must not let the
      // player travel along a perpendicular axis while spanning three lanes.
      movementDistance = 0;
    }
  }

  const moved = moveTankByDistance(
    game.terrain,
    game.terrainFragments,
    origin,
    direction,
    movementDistance,
    occupied,
  );

  if (
    positionsEqual(moved, game.player) &&
    game.player.direction === direction
  ) {
    return game.player;
  }

  const touchesIce = tankTouchesTerrain(
    game.terrain,
    moved.row,
    moved.col,
    "ice",
  );
  const iceSlideStepsRemaining = isIceCoast
    ? Math.max(0, game.player.iceSlideStepsRemaining - 1)
    : touchesIce
      ? BATTLE_CITY_ICE_SLIDE_STEPS
      : 0;

  return {
    ...game.player,
    col: moved.col,
    direction,
    iceSlideDirection:
      touchesIce && iceSlideStepsRemaining > 0 ? direction : null,
    iceSlideStepsRemaining,
    row: moved.row,
  };
}

function advancePlayerMotion(
  game: BattleCityGameState,
  direction: BattleCityDirection | null,
): BattleCityGameState {
  // The original player tank advances on three out of every four video frames.
  if (game.tick % 4 === 2) {
    return game;
  }

  return direction === null
    ? advancePlayerIceSlide(game)
    : moveBattleCityPlayer(game, direction);
}

function advancePlayerIceSlide(
  game: BattleCityGameState,
): BattleCityGameState {
  const direction = game.player.iceSlideDirection;
  if (direction === null || game.player.iceSlideStepsRemaining <= 0) {
    return game;
  }
  const player = tryMovePlayer(game, direction, true);
  if (player === game.player) {
    return {
      ...game,
      player: {
        ...game.player,
        iceSlideDirection: null,
        iceSlideStepsRemaining: 0,
      },
    };
  }
  return { ...game, player };
}

function advancePlayerTankHandler(
  game: BattleCityGameState,
  direction: BattleCityDirection | null,
): BattleCityGameState {
  if (game.player.phase === "active") {
    if (canControlBattleCityPlayer(game)) {
      return advancePlayerMotion(game, direction);
    }
    // The game-over tail clears controller input but still runs the ice and
    // tank movement handlers, so an existing coast continues with no input.
    return game.status === "game-over"
      ? advancePlayerMotion(game, null)
      : game;
  }
  return advancePlayerLifecycle(game);
}

function advanceTimers(game: BattleCityGameState): BattleCityGameState {
  const fortressTicks = decrement(game.fortressTicks);
  let terrainState = {
    terrain: game.terrain,
    terrainFragments: game.terrainFragments,
  };
  if (game.fortressTicks > 0 && fortressTicks === 0) {
    terrainState = setFortressTerrain(
      game.terrain,
      game.terrainFragments,
      "brick",
    );
  } else if (
    fortressTicks > 0 &&
    fortressTicks <= BATTLE_CITY_FORTRESS_WARNING_TICKS &&
    fortressTicks % 16 === 0
  ) {
    terrainState = setFortressTerrain(
      game.terrain,
      game.terrainFragments,
      Math.floor(fortressTicks / 16) % 2 === 0 ? "brick" : "steel",
    );
  }

  return {
    ...game,
    baseExplosionTicks: decrement(game.baseExplosionTicks),
    bullets: advanceBulletImpactTimers(game.bullets),
    enemySpawnCooldownTicks: decrement(game.enemySpawnCooldownTicks),
    fortressTicks,
    freezeTicks: decrement(game.freezeTicks),
    player: {
      ...game.player,
      invulnerabilityTicks: decrement(game.player.invulnerabilityTicks),
      shieldTicks: decrement(game.player.shieldTicks),
    },
    powerUpScorePopup: advancePowerUpScorePopup(game.powerUpScorePopup),
    ...terrainState,
  };
}

function advancePausedFrame(game: BattleCityGameState): BattleCityGameState {
  return {
    ...game,
    powerUpScorePopup: advancePowerUpScorePopup(game.powerUpScorePopup),
    stageBattleTicks: game.stageBattleTicks + 1,
    tick: game.tick + 1,
  };
}

function advancePowerUpScorePopup(
  popup: BattleCityPowerUpScorePopup | null,
): BattleCityPowerUpScorePopup | null {
  if (popup === null || popup.ticks <= 1) {
    return null;
  }
  return { ...popup, ticks: popup.ticks - 1 };
}

function advanceBulletImpactTimers(
  bullets: BattleCityBullet[],
): BattleCityBullet[] {
  return bullets.flatMap((bullet) => {
    if (bullet.impactTicks === 0) {
      return bullet;
    }
    if (bullet.impactTicks === 1) {
      return [];
    }
    return { ...bullet, impactTicks: bullet.impactTicks - 1 };
  });
}

function advancePlayerLifecycle(game: BattleCityGameState): BattleCityGameState {
  if (game.player.phase === "active") {
    return game;
  }
  if (
    (game.player.phase === "exploding" ||
      game.player.phase === "spawning") &&
    !shouldAdvancePlayerTankHandler(game.tick)
  ) {
    return game;
  }
  if (game.player.phaseTicks > 1) {
    return {
      ...game,
      player: { ...game.player, phaseTicks: game.player.phaseTicks - 1 },
    };
  }
  if (game.player.phase === "spawning") {
    return {
      ...game,
      player: {
        ...game.player,
        invulnerabilityTicks: getBattleCitySpawnShieldTicks(game.tick),
        phase: "active",
        phaseTicks: 0,
      },
    };
  }

  const lives = game.lives - 1;
  if (lives <= 0) {
    const endingAlreadyStarted =
      game.status === "stage-clear" || game.status === "game-over";
    return {
      ...game,
      lives: 0,
      player: { ...game.player, phaseTicks: 0 },
      stageOutcome: "lost",
      stageTransitionTicks: endingAlreadyStarted
        ? game.stageTransitionTicks
        : BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
      status: endingAlreadyStarted ? game.status : "game-over",
    };
  }

  return {
    ...game,
    lives,
    player: {
      ...game.player,
      ...getBattleCityStage(game.stage).spawns.player1,
      direction: "up",
      iceSlideDirection: null,
      iceSlideStepsRemaining: 0,
      invulnerabilityTicks: 0,
      phase: "spawning",
      phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
      shieldTicks: 0,
    },
  };
}

function shouldAdvancePlayerTankHandler(tick: number): boolean {
  return Math.max(0, tick) % 4 !== 2;
}

function getBattleCitySpawnShieldTicks(tick: number): number {
  const clockPhase = Math.max(0, tick) % 64;
  // Spawn activation happens before the helmet handler. At phase zero the
  // freshly loaded three-count shield is immediately decremented to two.
  return clockPhase === 0
    ? getQuantizedBattleCityTimerTicks(2, tick)
    : getQuantizedBattleCityTimerTicks(3, tick);
}

function advanceBullets(
  game: BattleCityGameState,
  random: BattleCityRandom,
): BattleCityGameState {
  let bullets = game.bullets.map((bullet) => ({ ...bullet }));
  let terrain = game.terrain;
  let terrainFragments = game.terrainFragments;
  const enemies = game.enemies.map((enemy) => ({ ...enemy }));
  let player = { ...game.player };
  let activePowerUp = game.activePowerUp;
  let powerUpScorePopup = game.powerUpScorePopup;
  let nextPowerUpId = game.nextPowerUpId;
  const destroyedEnemyCount = game.destroyedEnemyCount;
  let score = game.score;
  let lives = game.lives;
  let bonusLifeAwarded = game.bonusLifeAwarded;
  let baseAlive = game.baseAlive;
  let baseExplosionTicks = game.baseExplosionTicks;
  const status = game.status;
  let stageKillCounts = { ...game.stageKillCounts };
  let stageOutcome = game.stageOutcome;
  const stageTransitionTicks = game.stageTransitionTicks;
  // The ROM moves every pre-existing shell through its complete frame distance
  // before its separate terrain, shell, and tank collision passes. Resolving
  // between one-pixel substeps changes which simultaneous impact wins.
  const collisionTestIds = new Set<string>();
  bullets = sortBulletsBySlot(
    bullets.map((bullet) => {
      if (bullet.impactTicks > 0) {
        return bullet;
      }
      collisionTestIds.add(bullet.id);
      if (bullet.isNewborn) {
        return { ...bullet, isNewborn: false };
      }
      const delta = DIRECTION_DELTAS[bullet.direction];
      const moved = {
        ...bullet,
        col: normalizeCoordinate(bullet.col + delta.col * bullet.speed),
        row: normalizeCoordinate(bullet.row + delta.row * bullet.speed),
      };
      if (!isPointInsideBoard(moved.row, moved.col)) {
        return createBulletImpact({
          ...moved,
          col: Math.min(BATTLE_CITY_BOARD_SIZE, Math.max(0, moved.col)),
          row: Math.min(BATTLE_CITY_BOARD_SIZE, Math.max(0, moved.row)),
        });
      }
      return moved;
    }),
  );

  const afterTerrain: BattleCityBullet[] = [];
  for (const bullet of bullets) {
    if (
      bullet.impactTicks > 0 ||
      !collisionTestIds.has(bullet.id) ||
      !shouldResolveBulletTerrain(bullet, game.tick)
    ) {
      afterTerrain.push(bullet);
      continue;
    }

    const terrainImpact = applyBattleCityTerrainBulletImpact(
      terrainFragments,
      terrain,
      {
        col: bullet.col,
        direction: bullet.direction,
        isMaximumPower: bullet.strength === 2,
        row: bullet.row,
      },
    );
    let didImpactTerrain = terrainImpact.didCollide;
    if (terrainImpact.didCollide) {
      terrainFragments = terrainImpact.fragments;
      for (const cell of terrainImpact.cells) {
        if (cell.previousMask !== 0 && cell.nextMask === 0) {
          terrain = replaceTerrainCell(
            terrain,
            cell.cellRow,
            cell.cellCol,
            "empty",
          );
        }
      }
    }

    const hitsHeadquarters = terrainImpact.impacts.some(
      ({ cellCol, cellRow }) =>
        terrain[cellRow]?.[cellCol] === "headquarters",
    );
    if (hitsHeadquarters) {
      didImpactTerrain = true;
      if (baseAlive) {
        baseAlive = false;
        baseExplosionTicks = BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS;
        stageOutcome = "lost";
      }
    }
    if (didImpactTerrain) {
      afterTerrain.push(createBulletImpact(bullet));
      continue;
    }

    afterTerrain.push(bullet);
  }

  const cancelledIds = findCancelledBulletIds(afterTerrain);
  const afterBulletCollisions = afterTerrain.filter(
    (bullet) => !cancelledIds.has(bullet.id),
  );
  const survivingBullets: BattleCityBullet[] = [];
  for (const bullet of afterBulletCollisions) {
    if (bullet.impactTicks > 0 || !collisionTestIds.has(bullet.id)) {
      survivingBullets.push(bullet);
      continue;
    }

    if (bullet.owner === "player") {
      const enemyIndex = enemies.findIndex(
        (enemy) =>
          isActiveEnemy(enemy) && bulletHitsTank(bullet, enemy),
      );
      if (enemyIndex >= 0) {
        const enemy = enemies[enemyIndex]!;
        if (enemy.isCarrier && !enemy.hasDroppedPowerUp) {
          activePowerUp = createRandomPowerUp(player, nextPowerUpId, random);
          nextPowerUpId += 1;
          powerUpScorePopup = null;
        }
        const hitPoints = enemy.hitPoints - 1;
        if (hitPoints <= 0) {
          enemies[enemyIndex] = {
            ...enemy,
            destructionPoints: enemy.score,
            explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
            hasDroppedPowerUp:
              enemy.hasDroppedPowerUp || enemy.isCarrier,
            hitPoints: 0,
          };
          stageKillCounts = {
            ...stageKillCounts,
            [enemy.type]: stageKillCounts[enemy.type] + 1,
          };
          const scored = addScore(
            score,
            lives,
            bonusLifeAwarded,
            enemy.score,
            {
              canAwardBonusLife: baseAlive && status !== "game-over",
            },
          );
          score = scored.score;
          lives = scored.lives;
          bonusLifeAwarded = scored.bonusLifeAwarded;
        } else {
          enemies[enemyIndex] = {
            ...enemy,
            hasDroppedPowerUp:
              enemy.hasDroppedPowerUp || enemy.isCarrier,
            hitPoints,
          };
        }
        survivingBullets.push(createBulletImpact(bullet));
        continue;
      }
    } else if (
      player.phase === "active" &&
      bulletHitsTank(bullet, player)
    ) {
      if (player.invulnerabilityTicks === 0 && player.shieldTicks === 0) {
        player = {
          ...player,
          iceSlideDirection: null,
          iceSlideStepsRemaining: 0,
          phase: "exploding",
          phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
          powerTier: 0,
          shieldTicks: 0,
        };
        survivingBullets.push(createBulletImpact(bullet));
      }
      continue;
    }

    survivingBullets.push(bullet);
  }
  bullets = sortBulletsBySlot(survivingBullets);

  return {
    ...game,
    activePowerUp,
    baseAlive,
    baseExplosionTicks,
    bonusLifeAwarded,
    bullets,
    destroyedEnemyCount,
    enemies,
    lives,
    nextPowerUpId,
    player,
    powerUpScorePopup,
    score,
    stageKillCounts,
    stageOutcome,
    stageTransitionTicks,
    status,
    terrain,
    terrainFragments,
  };
}

function findCancelledBulletIds(bullets: BattleCityBullet[]): Set<string> {
  const cancelled = new Set<string>();
  // The hardware's outer loop visits only player slots (9, 8, 1, 0). A
  // player shell cleared as the inner member of an earlier pass is skipped,
  // but a player shell that clears itself may still clear additional enemy
  // shells during the remainder of its current inner loop.
  for (const first of bullets) {
    if (
      first.owner !== "player" ||
      first.impactTicks > 0 ||
      cancelled.has(first.id)
    ) {
      continue;
    }
    for (const second of bullets) {
      if (
        second.id === first.id ||
        second.impactTicks > 0 ||
        second.owner === "player" ||
        cancelled.has(second.id)
      ) {
        continue;
      }
      if (
        Math.abs(first.col - second.col) < BATTLE_CITY_BULLET_COLLISION_DISTANCE &&
        Math.abs(first.row - second.row) < BATTLE_CITY_BULLET_COLLISION_DISTANCE
      ) {
        cancelled.add(first.id);
        cancelled.add(second.id);
      }
    }
  }
  return cancelled;
}

function shouldResolveBulletTerrain(
  bullet: BattleCityBullet,
  tick: number,
): boolean {
  const isFast =
    bullet.speed > BATTLE_CITY_PIXEL_STEP * 2 + POSITION_EPSILON ||
    bullet.strength === 2;
  return isFast || ((bullet.slot ^ Math.max(0, tick)) & 1) === 1;
}

function sortBulletsBySlot(
  bullets: BattleCityBullet[],
): BattleCityBullet[] {
  return [...bullets].sort((first, second) => second.slot - first.slot);
}

function advanceEnemyTankHandlers(
  game: BattleCityGameState,
  random: BattleCityRandom,
): BattleCityGameState {
  let destroyedEnemyCount = game.destroyedEnemyCount;
  const enemies: BattleCityEnemy[] = [];
  for (const [index, originalEnemy] of game.enemies.entries()) {
    let enemy = { ...originalEnemy };
    if (enemy.explosionTicks > 0) {
      if (shouldAdvanceEnemyMovement(game.tick, enemy)) {
        if (enemy.explosionTicks === 1) {
          destroyedEnemyCount += 1;
          continue;
        }
        enemy.explosionTicks -= 1;
      }
    } else if (enemy.spawnTicks > 0) {
      if (shouldAdvanceEnemyObjectSlot(game.tick, enemy.slot)) {
        enemy.spawnTicks -= 1;
      }
    } else if (game.freezeTicks === 0) {
      if (shouldAdvanceEnemyMovement(game.tick, enemy)) {
        if (enemy.movementPauseSteps > 0) {
          enemy.movementPauseSteps -= 1;
        } else if (enemy.movementTurnPending) {
          enemy = {
            ...enemy,
            direction: choosePendingEnemyDirection(game, enemy, random),
            movementTurnPending: false,
          };
        } else if (
          tankIsAlignedToTerrainGrid(enemy) &&
          normalizeRandom(random()) < BATTLE_CITY_ENEMY_TURN_CHANCE
        ) {
          enemy = {
            ...enemy,
            direction: chooseEnemyStrategicDirection(game, enemy, random),
          };
        } else {
          const occupied = [
            ...enemies
              .filter(isActiveEnemy)
              .map(({ row, col }) => ({ row, col })),
            ...game.enemies
              .slice(index + 1)
              .filter(isActiveEnemy)
              .map(({ row, col }) => ({ row, col })),
            ...(game.player.phase === "active"
              ? [{ row: game.player.row, col: game.player.col }]
              : []),
          ];
          enemy = tryMoveEnemy(
            enemy,
            game.terrain,
            game.terrainFragments,
            occupied,
            random,
          );
        }
      }
    }
    enemies.push(enemy);
  }

  return {
    ...game,
    destroyedEnemyCount,
    enemies,
  };
}

function advanceEnemyFire(
  game: BattleCityGameState,
  random: BattleCityRandom,
): BattleCityGameState {
  if (game.freezeTicks > 0) {
    return game;
  }

  let bullets = game.bullets;
  let nextBulletId = game.nextBulletId;
  // The ROM completes every tank movement handler before its separate fire
  // loop. Each active enemy rolls even when its object slot still owns a
  // shell; the fire routine itself then rejects the occupied slot.
  for (const enemy of game.enemies) {
    if (
      !isActiveEnemy(enemy) ||
      normalizeRandom(random()) >= BATTLE_CITY_ENEMY_FIRE_CHANCE
    ) {
      continue;
    }
    const alreadyHasShot = bullets.some(
      (bullet) => bullet.owner === "enemy" && bullet.slot === enemy.slot,
    );
    if (alreadyHasShot) {
      continue;
    }
    const muzzle = getMuzzlePosition(enemy);
    if (!isMuzzlePositionValid(muzzle.row, muzzle.col)) {
      continue;
    }
    const stats = BATTLE_CITY_ENEMY_STATS[enemy.type];
    bullets = [
      ...bullets,
      {
        ...muzzle,
        canDestroySteel: false,
        direction: enemy.direction,
        id: `bullet-${nextBulletId}`,
        impactTicks: 0,
        isNewborn: true,
        owner: "enemy",
        slot: enemy.slot,
        speed: stats.shotSpeed,
        strength: 1,
      },
    ];
    nextBulletId += 1;
  }

  return { ...game, bullets: sortBulletsBySlot(bullets), nextBulletId };
}

function tryMoveEnemy(
  enemy: BattleCityEnemy,
  terrain: BattleCityTerrain[][],
  terrainFragments: number[][],
  occupied: BattleCityPosition[],
  random: BattleCityRandom,
): BattleCityEnemy {
  const moved = moveTankByDistance(
    terrain,
    terrainFragments,
    enemy,
    enemy.direction,
    BATTLE_CITY_PIXEL_STEP,
    occupied,
  );
  if (!positionsEqual(moved, enemy)) {
    return { ...enemy, ...moved };
  }

  if (normalizeRandom(random()) >= 0.25) {
    return { ...enemy, movementPauseSteps: 2 };
  }

  const direction = getOppositeDirection(enemy.direction);
  return {
    ...enemy,
    direction,
    movementTurnPending: tankIsAlignedToTerrainGrid(enemy),
  };
}

function shouldAdvanceEnemyMovement(
  tick: number,
  enemy: BattleCityEnemy,
): boolean {
  return (
    enemy.moveIntervalTicks === 1 ||
    shouldAdvanceEnemyObjectSlot(tick, enemy.slot)
  );
}

function shouldAdvanceEnemyObjectSlot(tick: number, slot: number): boolean {
  return ((slot ^ Math.max(0, tick)) & 1) === 1;
}

function choosePendingEnemyDirection(
  game: BattleCityGameState,
  enemy: BattleCityEnemy,
  random: BattleCityRandom,
): BattleCityDirection {
  if (normalizeRandom(random()) < 0.5) {
    return chooseEnemyStrategicDirection(game, enemy, random);
  }
  const offset = normalizeRandom(random()) < 0.5 ? -1 : 1;
  const index = BATTLE_CITY_DIRECTIONS.indexOf(enemy.direction);
  return BATTLE_CITY_DIRECTIONS[
    (index + offset + BATTLE_CITY_DIRECTIONS.length) %
      BATTLE_CITY_DIRECTIONS.length
  ]!;
}

function getOppositeDirection(
  direction: BattleCityDirection,
): BattleCityDirection {
  const index = BATTLE_CITY_DIRECTIONS.indexOf(direction);
  return BATTLE_CITY_DIRECTIONS[(index + 2) % BATTLE_CITY_DIRECTIONS.length]!;
}

function chooseEnemyDirection(random: BattleCityRandom): BattleCityDirection {
  return BATTLE_CITY_DIRECTIONS[
    Math.floor(normalizeRandom(random()) * BATTLE_CITY_DIRECTIONS.length)
  ]!;
}

function chooseEnemyStrategicDirection(
  game: BattleCityGameState,
  enemy: BattleCityEnemy,
  random: BattleCityRandom,
): BattleCityDirection {
  if (game.status === "game-over") {
    // The hardware ending loop starts its 64-frame counter at FE, wraps after
    // two boundaries, then finishes at 02. That makes enemies pressure the HQ
    // for the first half of the live tail and use random steering afterward.
    return game.stageTransitionTicks > BATTLE_CITY_GAME_OVER_TRANSITION_TICKS / 2
      ? chooseDirectionToward(enemy, { col: 12, row: 24 }, random)
      : chooseEnemyDirection(random);
  }

  const storedSpawnInterval = getBattleCityEnemySpawnIntervalTicks(
    game.stage,
    game.cycle,
  ) - 1;
  const playerPressureTick =
    (Math.floor(storedSpawnInterval / 8) + 1) * 64;
  const headquartersPressureTick =
    (Math.floor(storedSpawnInterval / 4) + 1) * 64;

  if (game.stageBattleTicks < playerPressureTick) {
    return chooseEnemyDirection(random);
  }
  if (game.stageBattleTicks < headquartersPressureTick) {
    return chooseDirectionToward(enemy, game.player, random);
  }
  return chooseDirectionToward(enemy, { col: 12, row: 24 }, random);
}

function chooseDirectionToward(
  origin: BattleCityPosition,
  target: BattleCityPosition,
  random: BattleCityRandom,
): BattleCityDirection {
  const horizontal: BattleCityDirection =
    target.col < origin.col ? "left" : "right";
  const vertical: BattleCityDirection = target.row < origin.row ? "up" : "down";
  if (Math.abs(target.col - origin.col) <= POSITION_EPSILON) {
    return vertical;
  }
  if (Math.abs(target.row - origin.row) <= POSITION_EPSILON) {
    return horizontal;
  }
  return normalizeRandom(random()) < 0.5 ? vertical : horizontal;
}

function spawnNextEnemy(game: BattleCityGameState): BattleCityGameState {
  if (
    game.enemySpawnCooldownTicks > 0 ||
    game.enemies.length >= BATTLE_CITY_MAX_ACTIVE_ENEMIES ||
    game.spawnedEnemyCount >= game.totalEnemyCount
  ) {
    return game;
  }

  const stage = getBattleCityStage(game.stage);
  const laneIndex = (game.spawnedEnemyCount + 1) % stage.spawns.enemies.length;
  const spawn = stage.spawns.enemies[laneIndex]!;

  const spawnOrder = game.spawnedEnemyCount + 1;
  const enemyQueue = getBattleCityStage(
    getBattleCityEnemyQueueStage(game.stage, game.cycle),
  ).enemyQueue;
  const type = enemyQueue[game.spawnedEnemyCount]!;
  const occupiedSlots = new Set(game.enemies.map(({ slot }) => slot));
  const slot = BATTLE_CITY_ENEMY_SLOTS.find(
    (candidate) => !occupiedSlots.has(candidate),
  );
  if (slot === undefined) {
    return game;
  }
  const enemy = createEnemy(
    type,
    spawn,
    spawnOrder,
    game.nextEnemyId,
    slot,
  );
  return {
    ...game,
    activePowerUp: enemy.isCarrier ? null : game.activePowerUp,
    enemies: [...game.enemies, enemy].sort(
      (first, second) => second.slot - first.slot,
    ),
    enemySpawnCooldownTicks: getBattleCityEnemySpawnIntervalTicks(
      game.stage,
      game.cycle,
    ),
    nextEnemyId: game.nextEnemyId + 1,
    spawnedEnemyCount: spawnOrder,
  };
}

function createEnemy(
  type: BattleCityEnemyType,
  position: BattleCityPosition,
  spawnOrder: number,
  nextEnemyId: number,
  slot: number,
): BattleCityEnemy {
  const stats = BATTLE_CITY_ENEMY_STATS[type];
  return {
    ...position,
    destructionPoints: null,
    direction: "down",
    explosionTicks: 0,
    hasDroppedPowerUp: false,
    hitPoints: stats.hitPoints,
    id: `enemy-${nextEnemyId}`,
    isCarrier: BATTLE_CITY_CARRIER_ORDERS.includes(
      spawnOrder as (typeof BATTLE_CITY_CARRIER_ORDERS)[number],
    ),
    maxHitPoints: stats.hitPoints,
    moveIntervalTicks: stats.moveIntervalTicks,
    movementPauseSteps: 0,
    movementTurnPending: false,
    score: stats.score,
    slot,
    spawnOrder,
    spawnTicks: BATTLE_CITY_ENEMY_SPAWN_TICKS,
    type,
  };
}

function createRandomPowerUp(
  player: BattleCityPlayer,
  nextPowerUpId: number,
  random: BattleCityRandom,
): BattleCityPowerUp {
  const { type, ...position } = selectBattleCityPowerUp(player, random);
  return {
    ...position,
    id: `power-up-${nextPowerUpId}`,
    type,
  };
}

function collectPowerUp(game: BattleCityGameState): BattleCityGameState {
  const powerUp = game.activePowerUp;
  if (
    powerUp === null ||
    (game.status !== "running" &&
      game.status !== "stage-clear" &&
      game.status !== "game-over") ||
    game.player.phase !== "active" ||
    !battleCityPowerUpWithinTankRange(game.player, powerUp)
  ) {
    return game;
  }

  const scored = addScore(
    game.score,
    game.lives,
    game.bonusLifeAwarded,
    500,
    {
      canAwardBonusLife: game.baseAlive && game.status !== "game-over",
    },
  );
  const next: BattleCityGameState = {
    ...game,
    activePowerUp: null,
    bonusLifeAwarded: scored.bonusLifeAwarded,
    lives: scored.lives,
    powerUpScorePopup: {
      col: powerUp.col,
      row: powerUp.row,
      ticks: BATTLE_CITY_POWER_UP_SCORE_POPUP_TICKS,
    },
    score: scored.score,
  };

  switch (powerUp.type) {
    case "star":
      return {
        ...next,
        player: {
          ...next.player,
          powerTier: Math.min(3, next.player.powerTier + 1) as 0 | 1 | 2 | 3,
        },
      };
    case "grenade": {
      return {
        ...next,
        enemies: next.enemies.map((enemy) =>
          isActiveEnemy(enemy)
            ? {
                ...enemy,
                destructionPoints: null,
                explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
                hitPoints: 0,
                // The grenade clears the ROM tank-type byte, so even fast
                // enemies finish exploding on their object-slot parity.
                moveIntervalTicks:
                  BATTLE_CITY_ENEMY_STATS.basic.moveIntervalTicks,
              }
            : enemy,
        ),
      };
    }
    case "helmet":
      return {
        ...next,
        player: {
          ...next.player,
          shieldTicks: getQuantizedBattleCityTimerTicks(10, next.tick),
        },
      };
    case "shovel": {
      // Pickup scoring happens before the ROM handler sees the destroyed-HQ
      // game-over flag and declines to rebuild the enclosure.
      if (!next.baseAlive || next.status === "game-over") {
        return next;
      }
      const fortress = setFortressTerrain(
        next.terrain,
        next.terrainFragments,
        "steel",
      );
      return {
        ...next,
        ...fortress,
        fortressTicks: getQuantizedBattleCityTimerTicks(20, next.tick),
      };
    }
    case "tank":
      return { ...next, lives: next.lives + 1 };
    case "clock":
      return {
        ...next,
        freezeTicks: getQuantizedBattleCityTimerTicks(10, next.tick),
      };
  }
}

function maybeCompleteStage(game: BattleCityGameState): BattleCityGameState {
  if (game.status !== "running") {
    return game;
  }
  const allEnemiesDestroyed =
    game.destroyedEnemyCount >= game.totalEnemyCount &&
    game.enemies.length === 0;
  if (allEnemiesDestroyed && (game.baseAlive || game.baseExplosionTicks > 0)) {
    return {
      ...game,
      stageOutcome: game.baseAlive ? "cleared" : "lost",
      stageTransitionTicks: BATTLE_CITY_STAGE_TRANSITION_TICKS,
      status: "stage-clear",
    };
  }
  if (!game.baseAlive) {
    return game.baseExplosionTicks > 0
      ? game
      : {
          ...game,
          stageOutcome: "lost",
          stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
          status: "game-over",
        };
  }
  return game;
}

function advanceBattleEnding(game: BattleCityGameState): BattleCityGameState {
  if (game.stageTransitionTicks > 1) {
    return {
      ...game,
      stageTransitionTicks: game.stageTransitionTicks - 1,
    };
  }
  return {
    ...game,
    stageResultTicks: 0,
    stageTransitionTicks: getBattleCityStageResultDuration(game.stageKillCounts),
    status: "stage-results",
  };
}

function advanceStageIntro(game: BattleCityGameState): BattleCityGameState {
  if (game.stageTransitionTicks > 1) {
    return {
      ...game,
      stageTransitionTicks: game.stageTransitionTicks - 1,
      tick: game.tick + 1,
    };
  }
  return {
    ...game,
    stageTransitionTicks: 0,
    status: "running",
  };
}

function advanceStageResults(game: BattleCityGameState): BattleCityGameState {
  if (game.stageTransitionTicks > 1) {
    return {
      ...game,
      stageResultTicks: game.stageResultTicks + 1,
      stageTransitionTicks: game.stageTransitionTicks - 1,
      tick: game.tick + 1,
    };
  }
  if (game.stageOutcome === "lost") {
    return {
      ...game,
      stageResultTicks: game.stageResultTicks + 1,
      stageTransitionTicks: 0,
      status: "lost",
      tick: game.tick + 1,
    };
  }

  const nextStage = getNextBattleCityStage(game.stage, game.cycle);
  return createStageGame(nextStage.stage, {
    bonusLifeAwarded: game.bonusLifeAwarded,
    cycle: nextStage.cycle,
    lives: game.lives,
    powerTier: game.player.powerTier,
    score: game.score,
    stageIntroTicks: BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
    status: "stage-intro",
    tick: game.tick + 1,
  });
}

function getBattleCityStageResultDuration(
  stageKillCounts: BattleCityKillCounts,
): number {
  const creditedKills = Object.values(stageKillCounts).reduce(
    (total, count) => total + count,
    0,
  );
  return (
    BATTLE_CITY_STAGE_RESULTS_BASE_TICKS +
    BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS * creditedKills
  );
}

function addScore(
  score: number,
  lives: number,
  bonusLifeAwarded: boolean,
  points: number,
  { canAwardBonusLife }: { canAwardBonusLife: boolean },
): Pick<BattleCityGameState, "bonusLifeAwarded" | "lives" | "score"> {
  const nextScore = score + points;
  const earnedBonus =
    canAwardBonusLife &&
    !bonusLifeAwarded &&
    score < BATTLE_CITY_BONUS_LIFE_SCORE &&
    nextScore >= BATTLE_CITY_BONUS_LIFE_SCORE;
  return {
    bonusLifeAwarded: bonusLifeAwarded || earnedBonus,
    lives: lives + (earnedBonus ? 1 : 0),
    score: nextScore,
  };
}

function replaceTerrainCell(
  terrain: BattleCityTerrain[][],
  row: number,
  col: number,
  value: BattleCityTerrain,
): BattleCityTerrain[][] {
  const next = terrain.map((terrainRow) => [...terrainRow]);
  next[row]![col] = value;
  return next;
}

function setFortressTerrain(
  terrain: BattleCityTerrain[][],
  terrainFragments: number[][],
  value: Extract<BattleCityTerrain, "brick" | "steel">,
): Pick<BattleCityGameState, "terrain" | "terrainFragments"> {
  const headquartersCells: BattleCityPosition[] = [];
  for (let row = 0; row < terrain.length; row += 1) {
    for (let col = 0; col < terrain[row]!.length; col += 1) {
      if (terrain[row]![col] === "headquarters") {
        headquartersCells.push({ row, col });
      }
    }
  }
  const minimumRow = Math.min(...headquartersCells.map(({ row }) => row));
  const maximumRow = Math.max(...headquartersCells.map(({ row }) => row));
  const minimumCol = Math.min(...headquartersCells.map(({ col }) => col));
  const maximumCol = Math.max(...headquartersCells.map(({ col }) => col));
  const next = terrain.map((terrainRow) => [...terrainRow]);
  const nextFragments = terrainFragments.map((row) => [...row]);
  for (let row = minimumRow - 1; row <= maximumRow; row += 1) {
    for (let col = minimumCol - 1; col <= maximumCol + 1; col += 1) {
      const surroundsHeadquarters =
        row === minimumRow - 1 || col === minimumCol - 1 || col === maximumCol + 1;
      if (surroundsHeadquarters && isInsideBoard(row, col)) {
        next[row]![col] = value;
        nextFragments[row]![col] = BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK;
      }
    }
  }
  return { terrain: next, terrainFragments: nextFragments };
}

function getMuzzlePosition(
  tank: BattleCityPosition & { direction: BattleCityDirection },
): BattleCityPosition {
  switch (tank.direction) {
    case "up":
      return { row: tank.row, col: tank.col + 1 };
    case "right":
      return { row: tank.row + 1, col: tank.col + BATTLE_CITY_TANK_SIZE };
    case "down":
      return { row: tank.row + BATTLE_CITY_TANK_SIZE, col: tank.col + 1 };
    case "left":
      return { row: tank.row + 1, col: tank.col };
  }
}

function isTankPositionOpen(
  terrain: BattleCityTerrain[][],
  terrainFragments: number[][],
  row: number,
  col: number,
  occupied: BattleCityPosition[],
): boolean {
  if (
    row < -POSITION_EPSILON ||
    col < -POSITION_EPSILON ||
    row + BATTLE_CITY_TANK_SIZE > BATTLE_CITY_BOARD_SIZE + POSITION_EPSILON ||
    col + BATTLE_CITY_TANK_SIZE > BATTLE_CITY_BOARD_SIZE + POSITION_EPSILON
  ) {
    return false;
  }
  const rows = getOverlappedTerrainRange(row, BATTLE_CITY_TANK_SIZE);
  const cols = getOverlappedTerrainRange(col, BATTLE_CITY_TANK_SIZE);
  const tankBounds = {
    bottom: row + BATTLE_CITY_TANK_SIZE,
    left: col,
    right: col + BATTLE_CITY_TANK_SIZE,
    top: row,
  };
  for (let terrainRow = rows.minimum; terrainRow <= rows.maximum; terrainRow += 1) {
    for (let terrainCol = cols.minimum; terrainCol <= cols.maximum; terrainCol += 1) {
      const terrainType = terrain[terrainRow]![terrainCol]!;
      if (terrainType === "brick" || terrainType === "steel") {
        if (
          battleCityTerrainFragmentsIntersectAabb(
            terrainFragments[terrainRow]![terrainCol]!,
            terrainRow,
            terrainCol,
            tankBounds,
          )
        ) {
          return false;
        }
      } else if (!isTankPassableTerrain(terrainType)) {
        return false;
      }
    }
  }
  return !occupied.some((position) => tanksIntersect({ row, col }, position));
}

function isTankPassableTerrain(terrain: BattleCityTerrain): boolean {
  return terrain === "empty" || terrain === "forest" || terrain === "ice";
}

function tankTouchesTerrain(
  terrain: BattleCityTerrain[][],
  row: number,
  col: number,
  target: BattleCityTerrain,
): boolean {
  const rows = getOverlappedTerrainRange(row, BATTLE_CITY_TANK_SIZE);
  const cols = getOverlappedTerrainRange(col, BATTLE_CITY_TANK_SIZE);
  for (let terrainRow = rows.minimum; terrainRow <= rows.maximum; terrainRow += 1) {
    for (let terrainCol = cols.minimum; terrainCol <= cols.maximum; terrainCol += 1) {
      if (terrain[terrainRow]![terrainCol] === target) {
        return true;
      }
    }
  }
  return false;
}

function tanksIntersect(
  first: BattleCityPosition,
  second: BattleCityPosition,
): boolean {
  return (
    first.row < second.row + BATTLE_CITY_TANK_SIZE &&
    first.row + BATTLE_CITY_TANK_SIZE > second.row &&
    first.col < second.col + BATTLE_CITY_TANK_SIZE &&
    first.col + BATTLE_CITY_TANK_SIZE > second.col
  );
}

function bulletHitsTank(
  bullet: BattleCityBullet,
  tank: BattleCityPosition,
): boolean {
  const tankCenterRow = tank.row + BATTLE_CITY_TANK_SIZE / 2;
  const tankCenterCol = tank.col + BATTLE_CITY_TANK_SIZE / 2;
  return (
    Math.abs(bullet.row - tankCenterRow) <
      BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE &&
    Math.abs(bullet.col - tankCenterCol) <
      BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE
  );
}

function moveTankByDistance(
  terrain: BattleCityTerrain[][],
  terrainFragments: number[][],
  start: BattleCityPosition,
  direction: BattleCityDirection,
  distance: number,
  occupied: BattleCityPosition[],
): BattleCityPosition {
  const delta = DIRECTION_DELTAS[direction];
  let position = { ...start };
  let remaining = distance;

  while (remaining > POSITION_EPSILON) {
    const step = Math.min(BATTLE_CITY_PIXEL_STEP, remaining);
    const candidate = {
      col: normalizeCoordinate(position.col + delta.col * step),
      row: normalizeCoordinate(position.row + delta.row * step),
    };
    if (
      !isTankPositionOpen(
        terrain,
        terrainFragments,
        candidate.row,
        candidate.col,
        [],
      ) ||
      !doesTankMoveAvoidOccupied(position, candidate, occupied)
    ) {
      break;
    }
    position = candidate;
    remaining -= step;
  }

  return position;
}

function doesTankMoveAvoidOccupied(
  current: BattleCityPosition,
  candidate: BattleCityPosition,
  occupied: BattleCityPosition[],
): boolean {
  return occupied.every((other) => {
    const currentOverlap = getTankOverlapArea(current, other);
    const candidateOverlap = getTankOverlapArea(candidate, other);
    return currentOverlap > POSITION_EPSILON
      ? candidateOverlap < currentOverlap - POSITION_EPSILON
      : candidateOverlap <= POSITION_EPSILON;
  });
}

function getTankOverlapArea(
  first: BattleCityPosition,
  second: BattleCityPosition,
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(
      first.col + BATTLE_CITY_TANK_SIZE,
      second.col + BATTLE_CITY_TANK_SIZE,
    ) - Math.max(first.col, second.col),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(
      first.row + BATTLE_CITY_TANK_SIZE,
      second.row + BATTLE_CITY_TANK_SIZE,
    ) - Math.max(first.row, second.row),
  );
  return overlapWidth * overlapHeight;
}

function getTankDirectionLaneSnapCandidates(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): BattleCityPosition[] {
  const preferred = snapTankToDirectionLane(position, direction);
  const laneCoordinate =
    direction === "up" || direction === "down"
      ? position.col
      : position.row;
  if (!isHalfCoordinate(laneCoordinate)) {
    return [preferred];
  }
  const lowerLane = Math.floor(laneCoordinate);
  const fallback =
    direction === "up" || direction === "down"
      ? { ...position, col: lowerLane }
      : { ...position, row: lowerLane };
  return positionsEqual(preferred, fallback)
    ? [preferred]
    : [preferred, fallback];
}

function snapTankToDirectionLane(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): BattleCityPosition {
  return direction === "up" || direction === "down"
    ? { ...position, col: Math.floor(position.col + 0.5) }
    : { ...position, row: Math.floor(position.row + 0.5) };
}

function tankIsAlignedToDirectionLane(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): boolean {
  return direction === "up" || direction === "down"
    ? isWholeCoordinate(position.col)
    : isWholeCoordinate(position.row);
}

function tankIsAlignedToTerrainGrid(position: BattleCityPosition): boolean {
  return isWholeCoordinate(position.row) && isWholeCoordinate(position.col);
}

function isWholeCoordinate(value: number): boolean {
  return Math.abs(value - Math.round(value)) <= POSITION_EPSILON;
}

function isHalfCoordinate(value: number): boolean {
  return Math.abs(value - (Math.floor(value) + 0.5)) <= POSITION_EPSILON;
}

function getOverlappedTerrainRange(start: number, size: number) {
  return {
    maximum: Math.ceil(start + size - POSITION_EPSILON) - 1,
    minimum: Math.floor(start + POSITION_EPSILON),
  };
}

function positionsEqual(
  first: BattleCityPosition,
  second: BattleCityPosition,
): boolean {
  return (
    Math.abs(first.row - second.row) <= POSITION_EPSILON &&
    Math.abs(first.col - second.col) <= POSITION_EPSILON
  );
}

function normalizeCoordinate(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

function createBulletImpact(bullet: BattleCityBullet): BattleCityBullet {
  return {
    ...bullet,
    impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
    isNewborn: false,
  };
}

function isPointInsideBoard(row: number, col: number): boolean {
  return (
    row >= 0 &&
    row < BATTLE_CITY_BOARD_SIZE &&
    col >= 0 &&
    col < BATTLE_CITY_BOARD_SIZE
  );
}

function isMuzzlePositionValid(row: number, col: number): boolean {
  // The NES creates an outward shell on the leading edge even when that
  // coordinate is the bottom or right playfield boundary. Its first movement
  // step then removes it, matching the equivalent top and left edge shots.
  return (
    row >= 0 &&
    row <= BATTLE_CITY_BOARD_SIZE &&
    col >= 0 &&
    col <= BATTLE_CITY_BOARD_SIZE
  );
}

function isInsideBoard(row: number, col: number): boolean {
  return (
    row >= 0 &&
    row < BATTLE_CITY_BOARD_SIZE &&
    col >= 0 &&
    col < BATTLE_CITY_BOARD_SIZE
  );
}

function decrement(value: number): number {
  return Math.max(0, value - 1);
}

function getQuantizedBattleCityTimerTicks(
  counter: number,
  tick: number,
): number {
  return counter * 64 - (Math.max(0, tick) % 64);
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(0.999_999_999, Math.max(0, value));
}
