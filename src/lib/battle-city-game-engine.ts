import {
  BATTLE_CITY_CARRIER_ORDERS,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_ENEMY_FIRE_CHANCE,
  BATTLE_CITY_ENEMY_SPAWN_TICKS,
  BATTLE_CITY_ENEMY_STATS,
  BATTLE_CITY_ENEMY_TURN_CHANCE,
  BATTLE_CITY_FORTRESS_WARNING_TICKS,
  BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
  BATTLE_CITY_ICE_SLIDE_STEPS,
  BATTLE_CITY_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_MULTIPLAYER_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_MULTIPLAYER_SPAWN_ADVANCE_TICKS,
  BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
  BATTLE_CITY_PIXEL_STEP,
  BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_INITIAL_MOVEMENT_PIXELS,
  BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_SLIDE_TIMER_COUNT,
  BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TIMER_STEP_TICKS,
  BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  BATTLE_CITY_POWER_UP_SCORE_POPUP_TICKS,
  BATTLE_CITY_STAGE_INTRO_TICKS,
  BATTLE_CITY_STAGE_RESULTS_BASE_TICKS,
  BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS,
  BATTLE_CITY_STAGE_COUNT,
  BATTLE_CITY_STAGE_TRANSITION_TICKS,
  BATTLE_CITY_STARTING_LIVES,
  BATTLE_CITY_TICK_MS,
  BATTLE_CITY_TOTAL_ENEMIES,
} from "./battle-city/constants";
import {
  getMuzzlePosition,
  getTankDirectionLaneSnapCandidates,
  isInsideBoard,
  isMuzzlePositionValid,
  isTankPositionOpen,
  moveTankByDistance,
  POSITION_EPSILON,
  positionsEqual,
  tankIsAlignedToDirectionLane,
  tankIsAlignedToTerrainGrid,
  tankTouchesTerrain,
} from "./battle-city/geometry";
import {
  advanceBullets,
  sortBulletsBySlot,
} from "./battle-city/projectiles";
import {
  createBattleCityTerrain,
  getBattleCityStage,
} from "./battle-city/stages";
import { battleCityPowerUpWithinTankRange } from "./battle-city/power-ups";
import { addScore, EMPTY_KILL_COUNTS } from "./battle-city/scoring";
import {
  getBattleCityEnemyQueueStage,
  getBattleCityEnemySpawnIntervalTicks,
  getNextBattleCityStage,
} from "./battle-city/stage-progression";
import {
  BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK,
  createBattleCityTerrainFragmentGrid,
} from "./battle-city/terrain-fragments";
import {
  isActiveEnemy,
  isBattleCityMultiplayerGame,
} from "./battle-city/state";
import type {
  BattleCityBullet,
  BattleCityDirection,
  BattleCityEnemy,
  BattleCityEnemyType,
  BattleCityFrameInput,
  BattleCityGameState,
  BattleCityKillCounts,
  BattleCityMultiplayerFrameInput,
  BattleCityMultiplayerGameState,
  BattleCityPlayer,
  BattleCityPlayerGameOverMessage,
  BattleCityPlayerId,
  BattleCityPlayerPhase,
  BattleCityPosition,
  BattleCityPowerUpScorePopup,
  BattleCityRandom,
  BattleCityTerrain,
  CreateBattleCityGameOptions,
} from "./battle-city/types";

export { isBattleCityMultiplayerGame } from "./battle-city/state";

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
  BATTLE_CITY_FRIENDLY_FIRE_STUN_TICKS,
  BATTLE_CITY_FREEZE_TICKS,
  BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
  BATTLE_CITY_HELMET_TICKS,
  BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
  BATTLE_CITY_ICE_SLIDE_STEPS,
  BATTLE_CITY_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_MULTIPLAYER_MAX_ACTIVE_ENEMIES,
  BATTLE_CITY_MULTIPLAYER_SPAWN_ADVANCE_TICKS,
  BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
  BATTLE_CITY_PIXEL_STEP,
  BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
  BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS,
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
  BattleCityMultiplayerFrameInput,
  BattleCityMultiplayerGameState,
  BattleCityPlayer,
  BattleCityPlayerGameOverMessage,
  BattleCityPlayerId,
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

const BATTLE_CITY_DIRECTIONS: readonly BattleCityDirection[] = [
  "up",
  "left",
  "down",
  "right",
];
const BATTLE_CITY_ENEMY_SLOTS = [5, 4, 3, 2] as const;
const BATTLE_CITY_MULTIPLAYER_ENEMY_SLOTS = [7, 6, 5, 4, 3, 2] as const;
const BATTLE_CITY_MULTIPLAYER_KILL_LEADER_BONUS_DELAY_TICKS = 0x0f;
const EMPTY_BATTLE_CITY_FRAME_INPUT: BattleCityFrameInput = {
  direction: null,
  fireRequested: false,
};
const EMPTY_BATTLE_CITY_MULTIPLAYER_FRAME_INPUT: BattleCityMultiplayerFrameInput = {
  player1: EMPTY_BATTLE_CITY_FRAME_INPUT,
  player2: EMPTY_BATTLE_CITY_FRAME_INPUT,
};

export function getBattleCityReserveLives(
  lives: number,
  phase: BattleCityPlayerPhase,
) {
  return Math.max(0, lives - (phase === "inactive" ? 0 : 1));
}

function getBattleCityPlayer(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
): BattleCityPlayer | null {
  return playerId === "player1" ? game.player : game.player2 ?? null;
}

function setBattleCityPlayer(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
  player: BattleCityPlayer,
): BattleCityGameState {
  return playerId === "player1"
    ? { ...game, player }
    : { ...game, player2: player };
}

function getBattleCityPlayerLives(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
) {
  return playerId === "player1" ? game.lives : game.player2Lives ?? 0;
}

function canControlBattleCityPlayer(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId = "player1",
): boolean {
  const player = getBattleCityPlayer(game, playerId);
  return (
    player !== null &&
    (game.status === "running" || game.status === "stage-clear") &&
    player.phase === "active" &&
    (player.movementStunTicks ?? 0) === 0
  );
}

function canFireBattleCityPlayer(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
): boolean {
  const player = getBattleCityPlayer(game, playerId);
  return (
    player !== null &&
    (game.status === "running" || game.status === "stage-clear") &&
    player.phase === "active"
  );
}

type StageRunContext = {
  bonusLifeAwarded: boolean;
  cycle: number;
  lives: number;
  powerTier: BattleCityPlayer["powerTier"];
  score: number;
  player2?: {
    bonusLifeAwarded: boolean;
    lives: number;
    powerTier: BattleCityPlayer["powerTier"];
    score: number;
  };
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

export function createInitialBattleCityMultiplayerGame(
  { stage = 1 }: CreateBattleCityGameOptions = {},
): BattleCityMultiplayerGameState {
  return createStageGame(normalizeStage(stage), {
    bonusLifeAwarded: false,
    cycle: 1,
    lives: BATTLE_CITY_STARTING_LIVES,
    player2: {
      bonusLifeAwarded: false,
      lives: BATTLE_CITY_STARTING_LIVES,
      powerTier: 0,
      score: 0,
    },
    powerTier: 0,
    score: 0,
    status: "ready",
    tick: 0,
  }) as BattleCityMultiplayerGameState;
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
  return moveBattleCityPlayerById(game, "player1", direction);
}

export function moveBattleCityMultiplayerPlayer(
  game: BattleCityMultiplayerGameState,
  playerId: BattleCityPlayerId,
  direction: BattleCityDirection,
): BattleCityMultiplayerGameState {
  return moveBattleCityPlayerById(
    game,
    playerId,
    direction,
  ) as BattleCityMultiplayerGameState;
}

function moveBattleCityPlayerById(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
  direction: BattleCityDirection,
): BattleCityGameState {
  if (!canControlBattleCityPlayer(game, playerId)) {
    return game;
  }

  const currentPlayer = getBattleCityPlayer(game, playerId)!;
  const player = tryMovePlayer(game, playerId, direction);
  if (player === currentPlayer) {
    if (currentPlayer.direction === direction) {
      return game;
    }
    return setBattleCityPlayer(game, playerId, {
      ...currentPlayer,
      direction,
    });
  }
  return setBattleCityPlayer(game, playerId, player);
}

export function fireBattleCityPlayer(
  game: BattleCityGameState,
): BattleCityGameState {
  return fireBattleCityPlayerById(game, "player1");
}

export function fireBattleCityMultiplayerPlayer(
  game: BattleCityMultiplayerGameState,
  playerId: BattleCityPlayerId,
): BattleCityMultiplayerGameState {
  return fireBattleCityPlayerById(
    game,
    playerId,
  ) as BattleCityMultiplayerGameState;
}

function fireBattleCityPlayerById(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
): BattleCityGameState {
  if (!canFireBattleCityPlayer(game, playerId)) {
    return game;
  }

  const player = getBattleCityPlayer(game, playerId)!;
  const owner = playerId === "player1" ? "player" : "player2";
  const primarySlot = playerId === "player1" ? 0 : 1;
  const secondarySlot = playerId === "player1" ? 8 : 9;

  const primaryBullet = game.bullets.find(
    (bullet) => bullet.owner === owner && bullet.slot === primarySlot,
  );
  const secondaryBullet = game.bullets.find(
    (bullet) => bullet.owner === owner && bullet.slot === secondarySlot,
  );
  const canUseSecondarySlot = player.powerTier >= 2;
  const muzzle = getMuzzlePosition(player);
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
          bullet.id === primaryBullet.id
            ? { ...bullet, slot: secondarySlot }
            : bullet,
        );

  const isMaximumPower = player.powerTier === 3;
  const bullet: BattleCityBullet = {
    ...muzzle,
    canDestroySteel: isMaximumPower,
    direction: player.direction,
    id: `bullet-${game.nextBulletId}`,
    impactTicks: 0,
    isNewborn: true,
    owner,
    slot: primarySlot,
    speed:
      player.powerTier >= 1
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
  return advanceBattleCityFrame(
    game,
    random,
    playerInput,
    EMPTY_BATTLE_CITY_FRAME_INPUT,
  );
}

export function advanceBattleCityMultiplayerGame(
  game: BattleCityMultiplayerGameState,
  elapsedMs: number = BATTLE_CITY_TICK_MS,
  random: BattleCityRandom = Math.random,
  playerInput: BattleCityMultiplayerFrameInput =
    EMPTY_BATTLE_CITY_MULTIPLAYER_FRAME_INPUT,
): BattleCityMultiplayerGameState {
  void elapsedMs;
  return advanceBattleCityFrame(
    game,
    random,
    playerInput.player1,
    playerInput.player2,
  ) as BattleCityMultiplayerGameState;
}

function advanceBattleCityFrame(
  game: BattleCityGameState,
  random: BattleCityRandom,
  player1Input: BattleCityFrameInput,
  player2Input: BattleCityFrameInput,
): BattleCityGameState {
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
      return advanceBattleCityPausedFrames(game, 1);
  }

  // Ending setup resets the counters between frames. The following NMI
  // advances the low counter before the first (and every later) live-tail
  // handler pass, while the stored state still represents that boundary.
  const gameForFrame =
    frameGame.status === "stage-clear" ||
    frameGame.status === "game-over" ||
    frameGame.frameCounterResetPending === true
      ? {
          ...frameGame,
          ...(isBattleCityMultiplayerGame(frameGame)
            ? { frameCounterResetPending: false }
            : {}),
          tick: frameGame.tick + 1,
        }
      : frameGame;
  const gameAfterTimers = advanceTimers(gameForFrame);
  const gameAfterEnemyTanks = advanceEnemyTankHandlers(
    gameAfterTimers,
    random,
  );
  const gameAfterPlayer2Tank = isBattleCityMultiplayerGame(gameAfterEnemyTanks)
    ? advancePlayerTankHandler(
        gameAfterEnemyTanks,
        "player2",
        player2Input.direction,
      )
    : gameAfterEnemyTanks;
  const gameAfterPlayerTank = advancePlayerTankHandler(
    gameAfterPlayer2Tank,
    "player1",
    player1Input.direction,
  );
  const frameCounterResetThisFrame =
    gameAfterEnemyTanks.frameCounterResetPending !== true &&
    gameAfterPlayerTank.frameCounterResetPending === true;
  const gameAfterCounterReset = frameCounterResetThisFrame
    ? rephaseBattleCityTimersAfterFrameCounterReset(
        gameAfterPlayerTank,
        gameForFrame.tick,
      )
    : gameAfterPlayerTank;
  // The hardware handles tank movement and expiring shell slots before the
  // A/B press creates a new player shell later in the same video frame.
  const gameAfterPlayer2Fire =
    isBattleCityMultiplayerGame(gameAfterCounterReset) &&
    player2Input.fireRequested
      ? fireBattleCityPlayerById(gameAfterCounterReset, "player2")
      : gameAfterCounterReset;
  const gameAfterPlayerFire = player1Input.fireRequested
    ? fireBattleCityPlayerById(gameAfterPlayer2Fire, "player1")
    : gameAfterPlayer2Fire;
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
  const counterResetTransitioned =
    enteredEnding && isBattleCityMultiplayerGame(transitioned)
      ? rephaseBattleCityTimersForEndingCounterReset(transitioned)
      : transitioned;
  const advancedPlayerGameOverMessage = isBattleCityMultiplayerGame(
    counterResetTransitioned,
  )
    ? counterResetTransitioned.playerGameOverMessage ===
      gameForFrame.playerGameOverMessage
      ? advanceBattleCityPlayerGameOverMessage(
          counterResetTransitioned.playerGameOverMessage,
        )
      : counterResetTransitioned.playerGameOverMessage
    : undefined;
  const playerGameOverMessage =
    enteredEnding && advancedPlayerGameOverMessage
      ? rephaseBattleCityPlayerGameOverMessageForCounterReset(
          advancedPlayerGameOverMessage,
        )
      : advancedPlayerGameOverMessage;
  return {
    ...counterResetTransitioned,
    ...(playerGameOverMessage === undefined
      ? {}
      : { playerGameOverMessage }),
    stageBattleTicks: enteredEnding
      ? 0
      : frameCounterResetThisFrame
        ? Math.floor(frameGame.stageBattleTicks / 64) * 64
      : transitioned.status === "running" ||
          transitioned.status === "stage-clear" ||
          transitioned.status === "game-over"
        ? frameGame.stageBattleTicks + 1
        : transitioned.stageBattleTicks,
    // The ending setup clears both hardware frame counters. The low counter
    // then continues through the tail, score tally, and following stage setup.
    tick: enteredEnding
      ? 0
      : frameCounterResetThisFrame
        ? transitioned.tick
        : frameGame.tick + 1,
  };
}

export function projectBattleCityMultiplayerPlayerMotion(
  game: BattleCityMultiplayerGameState,
  directions: Readonly<Record<BattleCityPlayerId, BattleCityDirection | null>>,
  frameCount: number,
): BattleCityMultiplayerGameState {
  if (!Number.isSafeInteger(frameCount) || frameCount <= 0) {
    return game;
  }

  let projected: BattleCityGameState = game;
  for (let frame = 0; frame < frameCount; frame += 1) {
    // Ending tails and the first frame after an individual elimination advance
    // the low hardware counter before tank handlers inspect its movement phase.
    const advancesCounterBeforeHandlers =
      projected.status === "stage-clear" ||
      projected.status === "game-over" ||
      projected.frameCounterResetPending === true;
    let projectedFrame = advancesCounterBeforeHandlers
      ? {
          ...projected,
          frameCounterResetPending: false,
          tick: projected.tick + 1,
        }
      : projected;
    if (
      projectedFrame.status === "running" ||
      projectedFrame.status === "stage-clear"
    ) {
      for (const playerId of ["player2", "player1"] as const) {
        const player = getBattleCityPlayer(projectedFrame, playerId);
        if (
          player?.phase === "active" &&
          (player.movementStunTicks ?? 0) === 0
        ) {
          projectedFrame = advancePlayerMotion(
            projectedFrame,
            playerId,
            directions[playerId],
          );
        }
      }
    }
    projected = advancesCounterBeforeHandlers
      ? projectedFrame
      : { ...projectedFrame, tick: projectedFrame.tick + 1 };
  }
  return projected as BattleCityMultiplayerGameState;
}

export function getBattleCityTickDelay(): number {
  return BATTLE_CITY_TICK_MS;
}

export function getBattleCityStageResultDisplay(
  game: BattleCityGameState,
): { killCounts: BattleCityKillCounts; showTotal: boolean } {
  return getBattleCityStageResultDisplayForCounts(
    game,
    game.stageKillCounts,
    game.stageKillCounts,
  );
}

export function getBattleCityMultiplayerStageResultDisplay(
  game: BattleCityMultiplayerGameState,
): {
  player1: BattleCityKillCounts;
  player2: BattleCityKillCounts;
  showTotal: boolean;
} {
  const timingCounts = getBattleCityMultiplayerResultTimingCounts(game);
  const player1 = getBattleCityStageResultDisplayForCounts(
    game,
    game.stageKillCounts,
    timingCounts,
  );
  const player2 = getBattleCityStageResultDisplayForCounts(
    game,
    game.player2StageKillCounts,
    timingCounts,
  );
  return {
    player1: player1.killCounts,
    player2: player2.killCounts,
    showTotal: player1.showTotal,
  };
}

function getBattleCityStageResultDisplayForCounts(
  game: BattleCityGameState,
  targetCounts: BattleCityKillCounts,
  timingCounts: BattleCityKillCounts,
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
    const targetCount = targetCounts[type];
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
      (timingCounts[type] + 1) * BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS;
    if (index < order.length - 1) {
      cursor += 21;
    }
  }
  return {
    killCounts,
    showTotal:
      game.stageResultTicks >=
      getBattleCityStageResultTotalRevealTick(timingCounts),
  };
}

function getBattleCityStageResultTotalRevealTick(
  timingCounts: BattleCityKillCounts,
) {
  const order: readonly BattleCityEnemyType[] = [
    "basic",
    "fast",
    "power",
    "armor",
  ];
  let cursor = 39;
  for (const [index, type] of order.entries()) {
    cursor +=
      (timingCounts[type] + 1) * BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS;
    if (index < order.length - 1) {
      cursor += 21;
    }
  }
  return cursor + 29;
}

function getBattleCityMultiplayerResultTimingCounts(
  game: BattleCityMultiplayerGameState,
): BattleCityKillCounts {
  return {
    armor: Math.max(
      game.stageKillCounts.armor,
      game.player2StageKillCounts.armor,
    ),
    basic: Math.max(
      game.stageKillCounts.basic,
      game.player2StageKillCounts.basic,
    ),
    fast: Math.max(
      game.stageKillCounts.fast,
      game.player2StageKillCounts.fast,
    ),
    power: Math.max(
      game.stageKillCounts.power,
      game.player2StageKillCounts.power,
    ),
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
  const createPlayer = (
    playerId: BattleCityPlayerId,
    lives: number,
    powerTier: BattleCityPlayer["powerTier"],
  ): BattleCityPlayer => {
    const isMultiplayer = context.player2 !== undefined;
    return {
      ...stage.spawns[playerId],
      direction: "up",
      iceSlideDirection: null,
      iceSlideStepsRemaining: 0,
      invulnerabilityTicks: 0,
      ...(isMultiplayer ? { movementStunTicks: 0 } : {}),
      phase: isMultiplayer && lives <= 0 ? "inactive" : "spawning",
      phaseTicks:
        isMultiplayer && lives <= 0 ? 0 : BATTLE_CITY_PLAYER_SPAWN_TICKS,
      powerTier,
      shieldTicks: 0,
    };
  };
  const multiplayerFields = context.player2
    ? {
        player2: createPlayer(
          "player2",
          context.player2.lives,
          context.player2.powerTier,
        ),
        player2BonusLifeAwarded: context.player2.bonusLifeAwarded,
        player2Lives: context.player2.lives,
        player2Score: context.player2.score,
        player2StageKillCounts: { ...EMPTY_KILL_COUNTS },
        playerGameOverMessage: null,
        stageKillLeaderBonusAwarded: false,
        frameCounterResetPending: false,
      }
    : {};
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
    player: createPlayer("player1", context.lives, context.powerTier),
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
    ...multiplayerFields,
  };
}

function tryMovePlayer(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
  direction: BattleCityDirection,
  isIceCoast = false,
): BattleCityPlayer {
  const currentPlayer = getBattleCityPlayer(game, playerId)!;
  const otherPlayer = getBattleCityPlayer(
    game,
    playerId === "player1" ? "player2" : "player1",
  );
  const occupied = game.enemies
    .filter(isActiveEnemy)
    .map(({ row, col }) => ({ col, row }));
  if (otherPlayer?.phase === "active") {
    occupied.push({ col: otherPlayer.col, row: otherPlayer.row });
  }
  let origin: BattleCityPosition = currentPlayer;
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
    positionsEqual(moved, currentPlayer) &&
    currentPlayer.direction === direction
  ) {
    return currentPlayer;
  }

  const touchesIce = tankTouchesTerrain(
    game.terrain,
    moved.row,
    moved.col,
    "ice",
  );
  const iceSlideStepsRemaining = isIceCoast
    ? Math.max(0, currentPlayer.iceSlideStepsRemaining - 1)
    : touchesIce
      ? BATTLE_CITY_ICE_SLIDE_STEPS
      : 0;

  return {
    ...currentPlayer,
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
  playerId: BattleCityPlayerId,
  direction: BattleCityDirection | null,
): BattleCityGameState {
  // The original player tank advances on three out of every four video frames.
  if (game.tick % 4 === 2) {
    return game;
  }

  return direction === null
    ? advancePlayerIceSlide(game, playerId)
    : moveBattleCityPlayerById(game, playerId, direction);
}

function advancePlayerIceSlide(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
): BattleCityGameState {
  const currentPlayer = getBattleCityPlayer(game, playerId)!;
  const direction = currentPlayer.iceSlideDirection;
  if (direction === null || currentPlayer.iceSlideStepsRemaining <= 0) {
    return game;
  }
  const player = tryMovePlayer(game, playerId, direction, true);
  if (player === currentPlayer) {
    return setBattleCityPlayer(game, playerId, {
      ...currentPlayer,
      iceSlideDirection: null,
      iceSlideStepsRemaining: 0,
    });
  }
  return setBattleCityPlayer(game, playerId, player);
}

function advancePlayerTankHandler(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
  direction: BattleCityDirection | null,
): BattleCityGameState {
  const player = getBattleCityPlayer(game, playerId);
  if (player === null) {
    return game;
  }
  if (player.phase === "active") {
    if ((player.movementStunTicks ?? 0) > 0) {
      return shouldAdvancePlayerTankHandler(game.tick)
        ? setBattleCityPlayer(game, playerId, {
            ...player,
            movementStunTicks: (player.movementStunTicks ?? 0) - 1,
          })
        : game;
    }
    if (canControlBattleCityPlayer(game, playerId)) {
      return advancePlayerMotion(game, playerId, direction);
    }
    // The game-over tail clears controller input but still runs the ice and
    // tank movement handlers, so an existing coast continues with no input.
    return game.status === "game-over"
      ? advancePlayerMotion(game, playerId, null)
      : game;
  }
  return advancePlayerLifecycle(game, playerId);
}

function advanceTimers(game: BattleCityGameState): BattleCityGameState {
  const fortressTicks = decrement(game.fortressTicks);
  const terrainState = getFortressTerrainAfterTimerChange(
    game,
    fortressTicks,
  );

  const player2 = game.player2;
  const multiplayerFields = player2
    ? {
        player2: {
          ...player2,
          invulnerabilityTicks: decrement(player2.invulnerabilityTicks),
          shieldTicks: decrement(player2.shieldTicks),
        },
      }
    : {};

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
    ...multiplayerFields,
  };
}

function getFortressTerrainAfterTimerChange(
  game: BattleCityGameState,
  fortressTicks: number,
) {
  if (game.fortressTicks > 0 && fortressTicks === 0) {
    return setFortressTerrain(
      game.terrain,
      game.terrainFragments,
      "brick",
    );
  }
  if (
    fortressTicks > 0 &&
    fortressTicks <= BATTLE_CITY_FORTRESS_WARNING_TICKS &&
    fortressTicks % 16 === 0
  ) {
    return setFortressTerrain(
      game.terrain,
      game.terrainFragments,
      Math.floor(fortressTicks / 16) % 2 === 0 ? "brick" : "steel",
    );
  }
  return {
    terrain: game.terrain,
    terrainFragments: game.terrainFragments,
  };
}

function rephaseBattleCityTimersAfterFrameCounterReset(
  game: BattleCityGameState,
  previousTick: number,
): BattleCityGameState {
  // Individual elimination clears the low hardware counter between timer
  // handlers: clock/freeze already ran, while fortress and shield handlers see
  // phase zero immediately. Preserve that asymmetric ordering in frame counts.
  const rephasePostResetPlayer = (player: BattleCityPlayer) => ({
    ...player,
    invulnerabilityTicks:
      Math.floor(player.invulnerabilityTicks / 64) * 64,
    shieldTicks: Math.floor(player.shieldTicks / 64) * 64,
  });
  const fortressTicks = Math.floor(game.fortressTicks / 64) * 64;
  const freezeCounter =
    Math.max(0, previousTick) % 64 === 0
      ? Math.floor(game.freezeTicks / 64)
      : Math.ceil(game.freezeTicks / 64);

  return {
    ...game,
    ...getFortressTerrainAfterTimerChange(game, fortressTicks),
    fortressTicks,
    freezeTicks: freezeCounter * 64,
    player: rephasePostResetPlayer(game.player),
    ...(game.player2
      ? { player2: rephasePostResetPlayer(game.player2) }
      : {}),
  };
}

function rephaseBattleCityTimersForEndingCounterReset(
  game: BattleCityMultiplayerGameState,
): BattleCityMultiplayerGameState {
  const rephase = (ticks: number) =>
    ticks <= 0 ? 0 : Math.ceil(ticks / 64) * 64;
  const rephasePlayer = (player: BattleCityPlayer): BattleCityPlayer => ({
    ...player,
    invulnerabilityTicks: rephase(player.invulnerabilityTicks),
    shieldTicks: rephase(player.shieldTicks),
  });

  return {
    ...game,
    fortressTicks: rephase(game.fortressTicks),
    freezeTicks: rephase(game.freezeTicks),
    player: rephasePlayer(game.player),
    player2: rephasePlayer(game.player2),
  };
}

export function advanceBattleCityPausedFrames(
  game: BattleCityGameState,
  frameCount: number,
): BattleCityGameState {
  if (
    game.status !== "paused" ||
    !Number.isSafeInteger(frameCount) ||
    frameCount <= 0
  ) {
    return game;
  }

  const popup = game.powerUpScorePopup;

  return {
    ...game,
    // Paused replay spans are compacted, so preserve the frame-by-frame popup
    // outcome without allocating one intermediate game state per paused frame.
    powerUpScorePopup:
      popup === null || popup.ticks <= frameCount
        ? null
        : { ...popup, ticks: popup.ticks - frameCount },
    stageBattleTicks: game.stageBattleTicks + frameCount,
    tick: game.tick + frameCount,
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

function advanceBattleCityPlayerGameOverMessage(
  message: BattleCityPlayerGameOverMessage | null,
): BattleCityPlayerGameOverMessage | null {
  if (message === null || message.ticksRemaining <= 1) {
    return null;
  }
  const ticksRemaining = message.ticksRemaining - 1;
  return {
    ...message,
    movementPixels:
      message.movementPixels +
      (Math.ceil(
        ticksRemaining /
          BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TIMER_STEP_TICKS,
      ) >= BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_SLIDE_TIMER_COUNT
        ? 1
        : 0),
    ticksRemaining,
  };
}

function rephaseBattleCityPlayerGameOverMessageForCounterReset(
  message: BattleCityPlayerGameOverMessage,
): BattleCityPlayerGameOverMessage {
  return {
    ...message,
    ticksRemaining:
      Math.ceil(
        message.ticksRemaining /
          BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TIMER_STEP_TICKS,
      ) * BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TIMER_STEP_TICKS,
  };
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

function advancePlayerLifecycle(
  game: BattleCityGameState,
  playerId: BattleCityPlayerId,
): BattleCityGameState {
  const player = getBattleCityPlayer(game, playerId)!;
  if (player.phase === "active" || player.phase === "inactive") {
    return game;
  }
  if (
    (player.phase === "exploding" || player.phase === "spawning") &&
    !shouldAdvancePlayerTankHandler(game.tick)
  ) {
    return game;
  }
  if (player.phaseTicks > 1) {
    return setBattleCityPlayer(game, playerId, {
      ...player,
      phaseTicks: player.phaseTicks - 1,
    });
  }
  if (player.phase === "spawning") {
    return setBattleCityPlayer(game, playerId, {
      ...player,
      invulnerabilityTicks: getBattleCitySpawnShieldTicks(game.tick),
      phase: "active",
      phaseTicks: 0,
    });
  }

  const lives = getBattleCityPlayerLives(game, playerId) - 1;
  if (lives <= 0) {
    if (!isBattleCityMultiplayerGame(game)) {
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
    const otherPlayerLives = getBattleCityPlayerLives(
      game,
      playerId === "player1" ? "player2" : "player1",
    );
    const startsIndividualGameOverMessage =
      isBattleCityMultiplayerGame(game) &&
      game.baseAlive &&
      game.status !== "game-over" &&
      otherPlayerLives > 0;
    const next = setBattleCityPlayer(game, playerId, {
      ...player,
      phase: "inactive",
      phaseTicks: 0,
    });
    return {
      ...next,
      ...(playerId === "player1" ? { lives: 0 } : { player2Lives: 0 }),
      ...(startsIndividualGameOverMessage
        ? {
            frameCounterResetPending: true,
            playerGameOverMessage: {
              movementPixels:
                BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_INITIAL_MOVEMENT_PIXELS,
              playerId,
              ticksRemaining: BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS,
            },
            // The following frame consumes phase one; the explicit pending
            // flag prevents phase zero from running twice after this boundary.
            tick: 0,
          }
        : {}),
    };
  }

  const respawnedPlayer: BattleCityPlayer = {
    ...player,
    ...getBattleCityStage(game.stage).spawns[playerId],
    direction: "up",
    iceSlideDirection: null,
    iceSlideStepsRemaining: 0,
    invulnerabilityTicks: 0,
    ...(isBattleCityMultiplayerGame(game) ? { movementStunTicks: 0 } : {}),
    phase: "spawning",
    phaseTicks: BATTLE_CITY_PLAYER_SPAWN_TICKS,
    shieldTicks: 0,
  };
  return {
    ...setBattleCityPlayer(game, playerId, respawnedPlayer),
    ...(playerId === "player1" ? { lives } : { player2Lives: lives }),
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
            ...(game.player2?.phase === "active"
              ? [{ row: game.player2.row, col: game.player2.col }]
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
  const usesResetEndingCounter =
    game.status === "game-over" ||
    (game.status === "stage-clear" &&
      game.stageTransitionTicks > BATTLE_CITY_STAGE_TRANSITION_TICKS);
  if (usesResetEndingCounter) {
    // The hardware ending loop starts its 64-frame counter at FE, wraps after
    // two boundaries, then finishes at 02. Central game over and a clear with
    // an individual side message therefore pressure the HQ for the first half
    // of their long live tail and use random steering afterward.
    return game.stageTransitionTicks > BATTLE_CITY_GAME_OVER_TRANSITION_TICKS / 2
      ? chooseDirectionToward(enemy, { col: 12, row: 24 }, random)
      : chooseEnemyDirection(random);
  }

  const storedSpawnInterval = getBattleCitySpawnIntervalTicks(game) - 1;
  const playerPressureTick =
    (Math.floor(storedSpawnInterval / 8) + 1) * 64;
  const headquartersPressureTick =
    (Math.floor(storedSpawnInterval / 4) + 1) * 64;

  if (game.stageBattleTicks < playerPressureTick) {
    return chooseEnemyDirection(random);
  }
  if (game.stageBattleTicks < headquartersPressureTick) {
    return chooseDirectionToward(
      enemy,
      getBattleCityEnemyPlayerTarget(game, enemy.slot),
      random,
    );
  }
  return chooseDirectionToward(enemy, { col: 12, row: 24 }, random);
}

function getBattleCityEnemyPlayerTarget(
  game: BattleCityGameState,
  enemySlot: number,
): BattleCityPosition {
  if (!isBattleCityMultiplayerGame(game)) {
    return game.player;
  }

  const preferredPlayerId: BattleCityPlayerId =
    enemySlot % 2 === 0 ? "player1" : "player2";
  const fallbackPlayerId: BattleCityPlayerId =
    preferredPlayerId === "player1" ? "player2" : "player1";
  const preferredPlayer = getBattleCityPlayer(game, preferredPlayerId)!;
  if (preferredPlayer.phase !== "inactive") {
    return preferredPlayer;
  }
  return getBattleCityPlayer(game, fallbackPlayerId) ?? game.player;
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
  const enemySlots = isBattleCityMultiplayerGame(game)
    ? BATTLE_CITY_MULTIPLAYER_ENEMY_SLOTS
    : BATTLE_CITY_ENEMY_SLOTS;
  const maximumActiveEnemies = isBattleCityMultiplayerGame(game)
    ? BATTLE_CITY_MULTIPLAYER_MAX_ACTIVE_ENEMIES
    : BATTLE_CITY_MAX_ACTIVE_ENEMIES;
  if (
    game.enemySpawnCooldownTicks > 0 ||
    game.enemies.length >= maximumActiveEnemies ||
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
  const slot = enemySlots.find(
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
    enemySpawnCooldownTicks: getBattleCitySpawnIntervalTicks(game),
    nextEnemyId: game.nextEnemyId + 1,
    spawnedEnemyCount: spawnOrder,
  };
}

function getBattleCitySpawnIntervalTicks(game: BattleCityGameState) {
  const baseInterval = getBattleCityEnemySpawnIntervalTicks(
    game.stage,
    game.cycle,
  );
  return isBattleCityMultiplayerGame(game)
    ? Math.max(1, baseInterval - BATTLE_CITY_MULTIPLAYER_SPAWN_ADVANCE_TICKS)
    : baseInterval;
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

function collectPowerUp(game: BattleCityGameState): BattleCityGameState {
  const powerUp = game.activePowerUp;
  if (
    powerUp === null ||
    (game.status !== "running" &&
      game.status !== "stage-clear" &&
      game.status !== "game-over")
  ) {
    return game;
  }

  // The original checks Player 2 before Player 1, so simultaneous overlap has
  // a stable collector instead of depending on client or network ordering.
  const collector = (
    [
      ...(game.player2
        ? [["player2", game.player2] as const]
        : []),
      ["player1", game.player] as const,
    ] satisfies readonly (readonly [BattleCityPlayerId, BattleCityPlayer])[]
  ).find(
    ([, player]) =>
      player.phase === "active" &&
      battleCityPowerUpWithinTankRange(player, powerUp),
  );
  if (collector === undefined) {
    return game;
  }

  const [collectorId] = collector;
  const collectorScore =
    collectorId === "player1" ? game.score : game.player2Score ?? 0;
  const collectorLives = getBattleCityPlayerLives(game, collectorId);
  const collectorBonusLifeAwarded =
    collectorId === "player1"
      ? game.bonusLifeAwarded
      : game.player2BonusLifeAwarded ?? false;

  const scored = addScore(
    collectorScore,
    collectorLives,
    collectorBonusLifeAwarded,
    500,
    {
      canAwardBonusLife: game.baseAlive && game.status !== "game-over",
    },
  );
  const next: BattleCityGameState = {
    ...game,
    activePowerUp: null,
    powerUpScorePopup: {
      col: powerUp.col,
      row: powerUp.row,
      ticks: BATTLE_CITY_POWER_UP_SCORE_POPUP_TICKS,
    },
    ...(collectorId === "player1"
      ? {
          bonusLifeAwarded: scored.bonusLifeAwarded,
          lives: scored.lives,
          score: scored.score,
        }
      : {
          player2BonusLifeAwarded: scored.bonusLifeAwarded,
          player2Lives: scored.lives,
          player2Score: scored.score,
        }),
  };

  switch (powerUp.type) {
    case "star": {
      const player = getBattleCityPlayer(next, collectorId)!;
      return setBattleCityPlayer(next, collectorId, {
        ...player,
        powerTier: Math.min(3, player.powerTier + 1) as 0 | 1 | 2 | 3,
      });
    }
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
    case "helmet": {
      const player = getBattleCityPlayer(next, collectorId)!;
      return setBattleCityPlayer(next, collectorId, {
        ...player,
        shieldTicks: getQuantizedBattleCityTimerTicks(10, next.tick),
      });
    }
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
      return collectorId === "player1"
        ? { ...next, lives: next.lives + 1 }
        : { ...next, player2Lives: (next.player2Lives ?? 0) + 1 };
    case "clock":
      return {
        ...next,
        freezeTicks: getQuantizedBattleCityTimerTicks(10, next.tick),
      };
  }
}

function maybeCompleteStage(game: BattleCityGameState): BattleCityGameState {
  const isMultiplayer = isBattleCityMultiplayerGame(game);
  const allPlayersEliminated =
    isMultiplayer && game.lives <= 0 && game.player2Lives <= 0;
  if (isMultiplayer && game.status === "stage-clear") {
    if (!game.baseAlive) {
      return game;
    }
    const stageOutcome = allPlayersEliminated ? "lost" : "cleared";
    return game.stageOutcome === stageOutcome
      ? game
      : { ...game, stageOutcome };
  }
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
      stageTransitionTicks: game.playerGameOverMessage
        ? BATTLE_CITY_GAME_OVER_TRANSITION_TICKS
        : BATTLE_CITY_STAGE_TRANSITION_TICKS,
      status: "stage-clear",
    };
  }
  if (!game.baseAlive) {
    return game.baseExplosionTicks > 0
      ? game
      : {
          ...game,
          ...(isMultiplayer ? { playerGameOverMessage: null } : {}),
          stageOutcome: "lost",
          stageTransitionTicks: BATTLE_CITY_GAME_OVER_TRANSITION_TICKS,
          status: "game-over",
        };
  }
  if (isMultiplayer && allPlayersEliminated) {
    return {
      ...game,
      playerGameOverMessage: null,
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
    stageTransitionTicks: getBattleCityStageResultDuration(
      isBattleCityMultiplayerGame(game)
        ? getBattleCityMultiplayerResultTimingCounts(game)
        : game.stageKillCounts,
    ),
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
  const currentGame = maybeAwardBattleCityMultiplayerKillLeaderBonus(game);
  if (currentGame.stageTransitionTicks > 1) {
    return {
      ...currentGame,
      stageResultTicks: currentGame.stageResultTicks + 1,
      stageTransitionTicks: currentGame.stageTransitionTicks - 1,
      tick: currentGame.tick + 1,
    };
  }
  if (currentGame.stageOutcome === "lost") {
    return {
      ...currentGame,
      stageResultTicks: currentGame.stageResultTicks + 1,
      stageTransitionTicks: 0,
      status: "lost",
      tick: currentGame.tick + 1,
    };
  }

  const nextStage = getNextBattleCityStage(
    currentGame.stage,
    currentGame.cycle,
  );
  return createStageGame(nextStage.stage, {
    bonusLifeAwarded: currentGame.bonusLifeAwarded,
    cycle: nextStage.cycle,
    lives: currentGame.lives,
    ...(isBattleCityMultiplayerGame(currentGame)
      ? {
          player2: {
            bonusLifeAwarded: currentGame.player2BonusLifeAwarded,
            lives: currentGame.player2Lives,
            powerTier: currentGame.player2.powerTier,
            score: currentGame.player2Score,
          },
        }
      : {}),
    powerTier: currentGame.player.powerTier,
    score: currentGame.score,
    stageIntroTicks: BATTLE_CITY_NEXT_STAGE_INTRO_TICKS,
    status: "stage-intro",
    tick: currentGame.tick + 1,
  });
}

function maybeAwardBattleCityMultiplayerKillLeaderBonus(
  game: BattleCityGameState,
): BattleCityGameState {
  const bonusRevealTick = isBattleCityMultiplayerGame(game)
    ? getBattleCityStageResultTotalRevealTick(
        getBattleCityMultiplayerResultTimingCounts(game),
      ) +
      BATTLE_CITY_MULTIPLAYER_KILL_LEADER_BONUS_DELAY_TICKS -
      1
    : Number.POSITIVE_INFINITY;
  if (
    !isBattleCityMultiplayerGame(game) ||
    game.stageOutcome !== "cleared" ||
    game.stageKillLeaderBonusAwarded ||
    game.stageResultTicks < bonusRevealTick
  ) {
    return game;
  }

  const player1Kills = getBattleCityTotalKills(game.stageKillCounts);
  const player2Kills = getBattleCityTotalKills(game.player2StageKillCounts);
  if (player1Kills > player2Kills && game.lives > 0) {
    const scored = addScore(
      game.score,
      game.lives,
      game.bonusLifeAwarded,
      1_000,
      { canAwardBonusLife: true },
    );
    return {
      ...game,
      ...scored,
      stageKillLeaderBonusAwarded: true,
    };
  }
  if (player2Kills > player1Kills && game.player2Lives > 0) {
    const scored = addScore(
      game.player2Score,
      game.player2Lives,
      game.player2BonusLifeAwarded,
      1_000,
      { canAwardBonusLife: true },
    );
    return {
      ...game,
      player2BonusLifeAwarded: scored.bonusLifeAwarded,
      player2Lives: scored.lives,
      player2Score: scored.score,
      stageKillLeaderBonusAwarded: true,
    };
  }
  return { ...game, stageKillLeaderBonusAwarded: true };
}

function getBattleCityTotalKills(killCounts: BattleCityKillCounts) {
  return Object.values(killCounts).reduce((total, count) => total + count, 0);
}

function getBattleCityStageResultDuration(
  stageKillCounts: BattleCityKillCounts,
): number {
  const creditedKills = getBattleCityTotalKills(stageKillCounts);
  return (
    BATTLE_CITY_STAGE_RESULTS_BASE_TICKS +
    BATTLE_CITY_STAGE_RESULTS_PER_KILL_TICKS * creditedKills
  );
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
