import {
  BURST_SHOT_COUNT,
  BURST_SHOT_DELAY_TICKS,
  COMMANDER_SHOT_MAX_SPEED_X,
  COMMANDER_SHOT_STEER_X,
  INVADER_FIRE_COOLDOWN_TICKS,
  MAX_INVADER_SHOTS,
  PIERCING_SHOT_HEIGHT,
  PIERCING_SHOT_SPEED,
  SCATTER_SHOT_VELOCITIES_X,
  SHOTGUN_SHOT_VELOCITIES_X,
  SHOT_HEIGHT,
  SHOT_SPEED,
  SHOT_WIDTH,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
  SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT,
  SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
} from "./constants";
import { clamp, getEntityCenterX } from "./geometry";
import { getRandomIndex } from "./random";
import type {
  SpaceInvader,
  SpaceInvadersGameState,
  SpaceInvadersInvaderShot,
  SpaceInvadersInvaderShotKind,
  SpaceInvadersPendingShotPowerUp,
  SpaceInvadersPlayer,
  SpaceInvadersPlayerShot,
  SpaceInvadersPlayerShotKind,
  SpaceInvadersRandomSource,
  SpaceInvadersRevengeVolley,
} from "./types";

type InvaderShotSpec = {
  cooldownTicks: number;
  height: number;
  kind: SpaceInvadersInvaderShotKind;
  ttlTicks: number | null;
  velocityX: number;
  velocityY: number;
  width: number;
};

type PlayerShotSpec = {
  height: number;
  velocityY: number;
  width: number;
};

const STANDARD_PLAYER_SHOT_SPEC = {
  height: SHOT_HEIGHT,
  velocityY: SHOT_SPEED,
  width: SHOT_WIDTH,
} satisfies PlayerShotSpec;

const PLAYER_SHOT_SPECS = {
  burst: STANDARD_PLAYER_SHOT_SPEC,
  piercing: {
    height: PIERCING_SHOT_HEIGHT,
    velocityY: PIERCING_SHOT_SPEED,
    width: SHOT_WIDTH,
  },
  shotgun: STANDARD_PLAYER_SHOT_SPEC,
  standard: STANDARD_PLAYER_SHOT_SPEC,
} satisfies Record<SpaceInvadersPlayerShotKind, PlayerShotSpec>;

const SPACE_INVADERS_ROW_SHOT_KINDS: SpaceInvadersInvaderShotKind[] = [
  "commander",
  "burst",
  "scatter",
  "needle",
  "standard",
];
const SPACE_INVADERS_SPECIAL_INVADER_SHOT_KIND =
  SPACE_INVADERS_ROW_SHOT_KINDS[SPACE_INVADERS_ROW_SHOT_KINDS.length - 1] ?? "standard";
const REVENGE_COUNTERFIRE_MAX_SPEED_X = 3.1;
const REVENGE_COUNTERFIRE_VELOCITY_Y = 5.3 * 1.15;
const REVENGE_COUNTERFIRE_WINDUP_TICKS = 2;
const SPLITTER_FORK_SPLIT_DISTANCE_RATIO = 0.5;
const ARMOR_WAVE_VELOCITY_Y = 2.15 * 0.85;
const SPLITTER_FRAGMENT_SHOT_VELOCITIES_X = [-1.35, 1.35] as const;

const INVADER_SHOT_SPECS: Record<SpaceInvadersInvaderShotKind, InvaderShotSpec> = {
  "armor-wave": {
    cooldownTicks: 118,
    height: 14,
    kind: "armor-wave",
    ttlTicks: null,
    velocityX: 0,
    velocityY: ARMOR_WAVE_VELOCITY_Y,
    width: 56,
  },
  commander: {
    cooldownTicks: 132,
    height: 24,
    kind: "commander",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 2.35,
    width: 8,
  },
  burst: {
    cooldownTicks: 92,
    height: 21.6,
    kind: "burst",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.45,
    width: 8.4,
  },
  counterfire: {
    cooldownTicks: 74,
    height: 9.1,
    kind: "counterfire",
    ttlTicks: null,
    velocityX: 0,
    velocityY: REVENGE_COUNTERFIRE_VELOCITY_Y,
    width: 20.8,
  },
  standard: {
    cooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    height: 20,
    kind: "standard",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.2,
    width: 10,
  },
  needle: {
    cooldownTicks: 56,
    height: 34,
    kind: "needle",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 4.9,
    width: 4.8,
  },
  scatter: {
    cooldownTicks: 112,
    height: 12,
    kind: "scatter",
    ttlTicks: 96,
    velocityX: 0,
    velocityY: 2.8,
    width: 12,
  },
  "splitter-fork": {
    cooldownTicks: 96,
    height: 16.8,
    kind: "splitter-fork",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 5.4,
    width: 10.8,
  },
  "splitter-fragment": {
    cooldownTicks: 96,
    height: 12.9,
    kind: "splitter-fragment",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.4,
    width: 9,
  },
};

export function createPlayerShots(
  player: SpaceInvadersPlayer,
  nextPlayerShotId: number,
  pendingShotPowerUp: SpaceInvadersPendingShotPowerUp | null,
): SpaceInvadersPlayerShot[] {
  if (pendingShotPowerUp === "shotgun-shot") {
    return SHOTGUN_SHOT_VELOCITIES_X.map((velocityX, index) =>
      createPlayerShot(player, nextPlayerShotId + index, "shotgun", velocityX),
    );
  }

  return [
    createPlayerShot(
      player,
      nextPlayerShotId,
      getPlayerShotKind(pendingShotPowerUp),
      0,
    ),
  ];
}

function getPlayerShotKind(
  pendingShotPowerUp: SpaceInvadersPendingShotPowerUp | null,
): SpaceInvadersPlayerShotKind {
  if (pendingShotPowerUp === "burst-shot") {
    return "burst";
  }

  if (pendingShotPowerUp === "piercing-laser") {
    return "piercing";
  }

  return "standard";
}

export function createPlayerShot(
  player: SpaceInvadersPlayer,
  nextPlayerShotId: number,
  kind: SpaceInvadersPlayerShotKind,
  velocityX: number,
): SpaceInvadersPlayerShot {
  const spec = PLAYER_SHOT_SPECS[kind];

  return {
    height: spec.height,
    hasScored: false,
    id: `player-shot-${nextPlayerShotId}`,
    kind,
    velocityX,
    velocityY: spec.velocityY,
    width: spec.width,
    x: player.x + player.width / 2 - spec.width / 2,
    y: player.y - spec.height - 2,
  };
}

export function advancePlayerShotPosition(
  shot: SpaceInvadersPlayerShot,
): SpaceInvadersPlayerShot {
  return {
    ...shot,
    x: shot.x + shot.velocityX,
    y: shot.y + shot.velocityY,
  };
}

export function isPlayerShotActive(
  shot: SpaceInvadersPlayerShot,
  game: Pick<SpaceInvadersGameState, "boardHeight" | "boardWidth">,
) {
  return (
    shot.y + shot.height >= 0 &&
    shot.x + shot.width >= 0 &&
    shot.x <= game.boardWidth &&
    shot.y <= game.boardHeight
  );
}

export function maybeFireInvaderShot(game: SpaceInvadersGameState): SpaceInvadersGameState {
  if (game.invaderShotCooldownTicks > 0) {
    return {
      ...game,
      invaderShotCooldownTicks: game.invaderShotCooldownTicks - 1,
    };
  }

  if (game.invaderBurst !== null) {
    return continueInvaderBurst(game);
  }

  if (game.invaderShots.length >= MAX_INVADER_SHOTS) {
    return game;
  }

  const shooter = selectInvaderShotSource(game);

  if (shooter === undefined) {
    return {
      ...game,
      invaderShotCooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    };
  }

  const createdShots = createInvaderShots(shooter, game.nextInvaderShotId, {
    player: game.player,
    useArmoredArmorWave: true,
    useRevengeCounterfire: true,
    useSplitterFork: true,
  });

  if (game.invaderShots.length + createdShots.length > MAX_INVADER_SHOTS) {
    return game;
  }

  const spec = getInvaderShotSpec(shooter, {
    useArmoredArmorWave: true,
    useRevengeCounterfire: true,
    useSplitterFork: true,
  });

  return {
    ...game,
    invaderBurst:
      spec.kind === "burst"
        ? {
            remainingShots: BURST_SHOT_COUNT - createdShots.length,
            sourceInvaderId: shooter.id,
          }
        : null,
    invaderShotCooldownTicks:
      spec.kind === "burst" ? BURST_SHOT_DELAY_TICKS : spec.cooldownTicks,
    invaderShots: [...game.invaderShots, ...createdShots],
    nextInvaderShotId: game.nextInvaderShotId + createdShots.length,
  };
}

function continueInvaderBurst(game: SpaceInvadersGameState): SpaceInvadersGameState {
  const burst = game.invaderBurst;

  if (burst === null) {
    return game;
  }

  const shooter = game.invaders.find(
    (invader) => invader.id === burst.sourceInvaderId && invader.isActive,
  );

  if (shooter === undefined) {
    return {
      ...game,
      invaderBurst: null,
      invaderShotCooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    };
  }

  const createdShots = createInvaderShots(shooter, game.nextInvaderShotId, {
    player: game.player,
    useArmoredArmorWave: true,
    useRevengeCounterfire: true,
    useSplitterFork: true,
  });

  if (game.invaderShots.length + createdShots.length > MAX_INVADER_SHOTS) {
    return game;
  }

  const remainingShots = burst.remainingShots - createdShots.length;

  return {
    ...game,
    invaderBurst:
      remainingShots > 0
        ? {
            ...burst,
            remainingShots,
          }
        : null,
    invaderShotCooldownTicks:
      remainingShots > 0
        ? BURST_SHOT_DELAY_TICKS
        : getInvaderShotSpec(shooter, {
            useArmoredArmorWave: true,
            useRevengeCounterfire: true,
            useSplitterFork: true,
          }).cooldownTicks,
    invaderShots: [...game.invaderShots, ...createdShots],
    nextInvaderShotId: game.nextInvaderShotId + createdShots.length,
  };
}

function selectInvaderShotSource(game: SpaceInvadersGameState) {
  const lowestInvaders = getLowestActiveInvadersByColumn(game.invaders);
  const blockedColumns = new Set(game.invaderShots.map((shot) => shot.sourceColumn));
  const unblockedInvaders = lowestInvaders.filter(
    (invader) => !blockedColumns.has(invader.column),
  );
  const unblockedShooters = unblockedInvaders.filter(canFireNormalInvaderShot);
  const candidates =
    unblockedShooters.length > 0
      ? unblockedShooters
      : lowestInvaders.filter(canFireNormalInvaderShot);

  if (candidates.length === 0) {
    return undefined;
  }

  const playerCenterX = game.player.x + game.player.width / 2;

  return [...candidates].sort((first, second) => {
    const firstDistance = Math.abs(getEntityCenterX(first) - playerCenterX);
    const secondDistance = Math.abs(getEntityCenterX(second) - playerCenterX);

    if (firstDistance !== secondDistance) {
      return firstDistance - secondDistance;
    }

    return first.column - second.column;
  })[0];
}

function canFireNormalInvaderShot(invader: SpaceInvader) {
  return invader.kind !== "splitter-fragment";
}

function getLowestActiveInvadersByColumn(invaders: SpaceInvader[]) {
  const lowestInvaderByColumn = new Map<number, SpaceInvader>();

  for (const invader of invaders) {
    if (!invader.isActive) {
      continue;
    }

    const current = lowestInvaderByColumn.get(invader.column);

    if (
      current === undefined ||
      invader.y > current.y ||
      (invader.y === current.y && invader.row > current.row)
    ) {
      lowestInvaderByColumn.set(invader.column, invader);
    }
  }

  return [...lowestInvaderByColumn.values()];
}

export function advanceInvaderShot(
  shot: SpaceInvadersInvaderShot,
  game: Pick<SpaceInvadersGameState, "player">,
): SpaceInvadersInvaderShot {
  const velocityX = getNextInvaderShotVelocityX(shot, game.player);
  const isWindingUp =
    shot.kind === "counterfire" && shot.ageTicks < REVENGE_COUNTERFIRE_WINDUP_TICKS;

  return {
    ...shot,
    ageTicks: shot.ageTicks + 1,
    ttlTicks: shot.ttlTicks === null ? null : shot.ttlTicks - 1,
    velocityX,
    x: isWindingUp ? shot.x : shot.x + velocityX,
    y: isWindingUp ? shot.y : shot.y + shot.velocityY,
  };
}

export function advanceInvaderShotPositions(
  game: Pick<
    SpaceInvadersGameState,
    | "boardHeight"
    | "boardWidth"
    | "baseY"
    | "invaderShots"
    | "nextInvaderShotId"
    | "player"
  >,
) {
  const movedShots: SpaceInvadersInvaderShot[] = [];
  let nextInvaderShotId = game.nextInvaderShotId;

  for (const shot of game.invaderShots) {
    const movedShot = advanceInvaderShot(shot, game);

    if (!isInvaderShotActive(movedShot, game)) {
      continue;
    }

    if (shouldSplitSplitterFork(movedShot, game.baseY)) {
      const fragmentShots = createSplitterFragmentShots(movedShot, nextInvaderShotId);

      movedShots.push(
        ...fragmentShots.filter((fragmentShot) =>
          isInvaderShotActive(fragmentShot, game),
        ),
      );
      nextInvaderShotId += fragmentShots.length;
      continue;
    }

    movedShots.push(movedShot);
  }

  return {
    invaderShots: movedShots,
    nextInvaderShotId,
  };
}

function shouldSplitSplitterFork(shot: SpaceInvadersInvaderShot, baseY: number) {
  if (shot.kind !== "splitter-fork") {
    return false;
  }

  const originY = shot.y - shot.velocityY * shot.ageTicks;
  const splitY =
    originY + (baseY - originY) * SPLITTER_FORK_SPLIT_DISTANCE_RATIO;

  return shot.y >= splitY;
}

function createSplitterFragmentShots(
  forkShot: SpaceInvadersInvaderShot,
  nextInvaderShotId: number,
) {
  const spec = INVADER_SHOT_SPECS["splitter-fragment"];
  const forkCenterX = getEntityCenterX(forkShot);
  const forkCenterY = forkShot.y + forkShot.height / 2;

  return SPLITTER_FRAGMENT_SHOT_VELOCITIES_X.map((velocityX, index) => ({
    ageTicks: 0,
    height: spec.height,
    id: `invader-shot-${nextInvaderShotId + index}`,
    kind: spec.kind,
    sourceColumn: forkShot.sourceColumn,
    sourceInvaderId: forkShot.sourceInvaderId,
    sourceRow: forkShot.sourceRow,
    ttlTicks: spec.ttlTicks,
    velocityX,
    velocityY: spec.velocityY,
    width: spec.width,
    x: forkCenterX - spec.width / 2,
    y: forkCenterY - spec.height / 2,
  }));
}

function getNextInvaderShotVelocityX(
  shot: SpaceInvadersInvaderShot,
  player: SpaceInvadersPlayer,
) {
  if (shot.kind === "commander") {
    const deltaX = getEntityCenterX(player) - getEntityCenterX(shot);

    if (Math.abs(deltaX) < 1) {
      return shot.velocityX;
    }

    return clamp(
      shot.velocityX + Math.sign(deltaX) * COMMANDER_SHOT_STEER_X,
      -COMMANDER_SHOT_MAX_SPEED_X,
      COMMANDER_SHOT_MAX_SPEED_X,
    );
  }

  return shot.velocityX;
}

export function isInvaderShotActive(
  shot: SpaceInvadersInvaderShot,
  game: Pick<SpaceInvadersGameState, "boardHeight" | "boardWidth">,
) {
  return (
    (shot.ttlTicks === null || shot.ttlTicks > 0) &&
    shot.y <= game.boardHeight &&
    shot.x + shot.width >= 0 &&
    shot.x <= game.boardWidth
  );
}

export function isInvaderShotDangerous(shot: SpaceInvadersInvaderShot) {
  return (
    shot.kind !== "counterfire" ||
    shot.ageTicks > REVENGE_COUNTERFIRE_WINDUP_TICKS
  );
}

type CreateInvaderShotOptions = {
  player?: SpaceInvadersPlayer;
  useArmoredArmorWave?: boolean;
  useRevengeCounterfire?: boolean;
  useSplitterFork?: boolean;
};

function createInvaderShots(
  invader: SpaceInvader,
  nextInvaderShotId: number,
  options: CreateInvaderShotOptions = {},
) {
  const spec = getInvaderShotSpec(invader, options);

  if (spec.kind === "scatter") {
    return SCATTER_SHOT_VELOCITIES_X.map((velocityX, index) =>
      createInvaderShot(invader, nextInvaderShotId + index, spec, velocityX),
    );
  }

  return [
    createInvaderShot(
      invader,
      nextInvaderShotId,
      spec,
      getInitialInvaderShotVelocityX(invader, spec, options.player),
    ),
  ];
}

export function maybePrimeSpaceInvadersRevengeVolley(
  game: SpaceInvadersGameState,
  destroyedInvaders: SpaceInvader[],
  random: SpaceInvadersRandomSource,
): SpaceInvadersGameState {
  const destroyedRevengeInvaders = destroyedInvaders.filter(
    (invader) => invader.kind === "revenge",
  );

  if (destroyedRevengeInvaders.length === 0) {
    return game;
  }

  const invaderIds = selectRevengeVolleyInvaderIds(
    getRevengeVolleyCandidates(destroyedRevengeInvaders, game.invaders),
    random,
  );

  if (invaderIds.length === 0) {
    return game;
  }

  return {
    ...game,
    revengeVolleys: [
      ...game.revengeVolleys,
      {
        invaderIds,
        // Player-shot damage resolves before pending revenge volleys advance in the same tick.
        ticksRemaining: SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS + 1,
      },
    ],
  };
}

export function advanceSpaceInvadersRevengeVolleys(
  game: SpaceInvadersGameState,
): SpaceInvadersGameState {
  if (game.revengeVolleys.length === 0) {
    return game;
  }

  const activeInvaderById = new Map(
    game.invaders
      .filter((invader) => invader.isActive)
      .map((invader) => [invader.id, invader]),
  );
  const pendingVolleys: SpaceInvadersRevengeVolley[] = [];
  const revengeShots: SpaceInvadersInvaderShot[] = [];
  let nextInvaderShotId = game.nextInvaderShotId;

  for (const volley of game.revengeVolleys) {
    const ticksRemaining = volley.ticksRemaining - 1;

    if (ticksRemaining > 0) {
      pendingVolleys.push({
        ...volley,
        ticksRemaining,
      });
      continue;
    }

    for (const invaderId of volley.invaderIds) {
      const source = activeInvaderById.get(invaderId);

      if (source === undefined) {
        continue;
      }

      revengeShots.push(
        createSingleInvaderShot(source, nextInvaderShotId, {
          player: game.player,
          useArmoredArmorWave: true,
          useRevengeCounterfire: true,
          useSplitterFork: true,
        }),
      );
      nextInvaderShotId += 1;
    }
  }

  return {
    ...game,
    invaderShots:
      revengeShots.length === 0
        ? game.invaderShots
        : [...game.invaderShots, ...revengeShots],
    nextInvaderShotId,
    revengeVolleys: pendingVolleys,
  };
}

function getRevengeVolleyCandidates(
  destroyedRevengeInvaders: SpaceInvader[],
  invaders: SpaceInvader[],
) {
  const destroyedRevengeInvaderIds = new Set(
    destroyedRevengeInvaders.map((invader) => invader.id),
  );

  return invaders.filter(
    (invader) =>
      invader.isActive &&
      invader.kind !== "splitter-fragment" &&
      !destroyedRevengeInvaderIds.has(invader.id),
  );
}

function selectRevengeVolleyInvaderIds(
  candidates: SpaceInvader[],
  random: SpaceInvadersRandomSource,
) {
  const remainingCandidates = [...candidates];
  const invaderIds: string[] = [];

  while (
    remainingCandidates.length > 0 &&
    invaderIds.length < SPACE_INVADERS_REVENGE_VOLLEY_TARGET_COUNT
  ) {
    const candidateIndex = getRandomIndex(remainingCandidates.length, random);
    const [selectedInvader] = remainingCandidates.splice(candidateIndex, 1);

    if (selectedInvader !== undefined) {
      invaderIds.push(selectedInvader.id);
    }
  }

  return invaderIds;
}

function createSingleInvaderShot(
  invader: SpaceInvader,
  nextInvaderShotId: number,
  options: CreateInvaderShotOptions = {},
) {
  const spec = getInvaderShotSpec(invader, options);

  return createInvaderShot(
    invader,
    nextInvaderShotId,
    spec,
    getInitialInvaderShotVelocityX(invader, spec, options.player),
  );
}

function createInvaderShot(
  invader: SpaceInvader,
  nextInvaderShotId: number,
  spec: InvaderShotSpec,
  velocityX: number,
): SpaceInvadersInvaderShot {
  return {
    ageTicks: 0,
    height: spec.height,
    id: `invader-shot-${nextInvaderShotId}`,
    kind: spec.kind,
    sourceColumn: invader.column,
    sourceInvaderId: invader.id,
    sourceRow: invader.row,
    ttlTicks: spec.ttlTicks,
    velocityX,
    velocityY: spec.velocityY,
    width: spec.width,
    x: invader.x + invader.width / 2 - spec.width / 2,
    y: invader.y + invader.height + 1,
  };
}

function getInitialInvaderShotVelocityX(
  invader: SpaceInvader,
  spec: InvaderShotSpec,
  player: SpaceInvadersPlayer | undefined,
) {
  if (spec.kind !== "counterfire" || player === undefined) {
    return spec.velocityX;
  }

  const shotCenterX = getEntityCenterX(invader);
  const shotCenterY = invader.y + invader.height + 1 + spec.height / 2;
  const playerCenterY = player.y + player.height / 2;
  const verticalDistance = playerCenterY - shotCenterY;
  const travelTicks = Math.max(1, verticalDistance / spec.velocityY);

  return clamp(
    (getEntityCenterX(player) - shotCenterX) / travelTicks,
    -REVENGE_COUNTERFIRE_MAX_SPEED_X,
    REVENGE_COUNTERFIRE_MAX_SPEED_X,
  );
}

function getInvaderShotSpec(
  invader: Pick<SpaceInvader, "kind" | "row">,
  options: Pick<
    CreateInvaderShotOptions,
    "useArmoredArmorWave" | "useRevengeCounterfire" | "useSplitterFork"
  > = {},
) {
  return INVADER_SHOT_SPECS[getInvaderShotKind(invader, options)];
}

function getInvaderShotKind(
  invader: Pick<SpaceInvader, "kind" | "row">,
  options: Pick<
    CreateInvaderShotOptions,
    "useArmoredArmorWave" | "useRevengeCounterfire" | "useSplitterFork"
  >,
) {
  if (invader.kind === "armored" && options.useArmoredArmorWave === true) {
    return "armor-wave";
  }

  if (invader.kind === "revenge" && options.useRevengeCounterfire === true) {
    return "counterfire";
  }

  if (invader.kind === "splitter" && options.useSplitterFork === true) {
    return "splitter-fork";
  }

  if (invader.kind !== "standard" && invader.kind !== "diver") {
    return SPACE_INVADERS_SPECIAL_INVADER_SHOT_KIND;
  }

  return SPACE_INVADERS_ROW_SHOT_KINDS[invader.row] ?? "scatter";
}

export function createNextPlayerBurstShot(game: SpaceInvadersGameState) {
  const createdShot = createPlayerShot(
    game.player,
    game.nextPlayerShotId,
    "burst",
    0,
  );
  const remainingShots = game.playerBurst!.remainingShots - 1;

  return {
    nextPlayerShotId: game.nextPlayerShotId + 1,
    playerBurst:
      remainingShots > 0
        ? {
            cooldownTicks: SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
            remainingShots,
          }
        : null,
    playerShots: [...game.playerShots, createdShot],
  };
}

export function createInitialPlayerBurstState(createdShotCount: number) {
  return {
    cooldownTicks: SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
    remainingShots: SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT - createdShotCount,
  };
}
