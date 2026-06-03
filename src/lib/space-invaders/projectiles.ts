import {
  BURST_SHOT_COUNT,
  BURST_SHOT_DELAY_TICKS,
  COMMANDER_SHOT_MAX_SPEED_X,
  COMMANDER_SHOT_STEER_X,
  INVADER_FIRE_COOLDOWN_TICKS,
  MAX_INVADER_SHOTS,
  SCATTER_SHOT_VELOCITIES_X,
  SHOTGUN_SHOT_VELOCITIES_X,
  SHOT_HEIGHT,
  SHOT_SPEED,
  SHOT_WIDTH,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
} from "./constants";
import { clamp, getEntityCenterX } from "./geometry";
import type {
  SpaceInvader,
  SpaceInvadersGameState,
  SpaceInvadersInvaderShot,
  SpaceInvadersInvaderShotKind,
  SpaceInvadersPendingShotPowerUp,
  SpaceInvadersPlayer,
  SpaceInvadersPlayerShot,
  SpaceInvadersPlayerShotKind,
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

const SPACE_INVADERS_ROW_SHOT_KINDS: SpaceInvadersInvaderShotKind[] = [
  "commander",
  "burst",
  "scatter",
  "needle",
  "standard",
];
const SPACE_INVADERS_SPECIAL_INVADER_SHOT_KIND =
  SPACE_INVADERS_ROW_SHOT_KINDS[SPACE_INVADERS_ROW_SHOT_KINDS.length - 1] ?? "standard";

const INVADER_SHOT_SPECS: Record<SpaceInvadersInvaderShotKind, InvaderShotSpec> = {
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
    height: 18,
    kind: "burst",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.45,
    width: 7,
  },
  standard: {
    cooldownTicks: INVADER_FIRE_COOLDOWN_TICKS,
    height: 20,
    kind: "standard",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 3.2,
    width: 5,
  },
  needle: {
    cooldownTicks: 56,
    height: 24,
    kind: "needle",
    ttlTicks: null,
    velocityX: 0,
    velocityY: 4.9,
    width: 3,
  },
  scatter: {
    cooldownTicks: 112,
    height: 12,
    kind: "scatter",
    ttlTicks: 96,
    velocityX: 0,
    velocityY: 2.8,
    width: 5,
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
  return {
    height: SHOT_HEIGHT,
    hasScored: false,
    id: `player-shot-${nextPlayerShotId}`,
    kind,
    velocityX,
    velocityY: SHOT_SPEED,
    width: SHOT_WIDTH,
    x: player.x + player.width / 2 - SHOT_WIDTH / 2,
    y: player.y - SHOT_HEIGHT - 2,
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

  const createdShots = createInvaderShots(shooter, game.nextInvaderShotId);

  if (game.invaderShots.length + createdShots.length > MAX_INVADER_SHOTS) {
    return game;
  }

  const spec = getInvaderShotSpec(shooter);

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

  const createdShots = createInvaderShots(shooter, game.nextInvaderShotId);

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
        : getInvaderShotSpec(shooter).cooldownTicks,
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
  const candidates = unblockedInvaders.length > 0 ? unblockedInvaders : lowestInvaders;

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

  return {
    ...shot,
    ageTicks: shot.ageTicks + 1,
    ttlTicks: shot.ttlTicks === null ? null : shot.ttlTicks - 1,
    velocityX,
    x: shot.x + velocityX,
    y: shot.y + shot.velocityY,
  };
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

function createInvaderShots(invader: SpaceInvader, nextInvaderShotId: number) {
  const spec = getInvaderShotSpec(invader);

  if (spec.kind === "scatter") {
    return SCATTER_SHOT_VELOCITIES_X.map((velocityX, index) =>
      createInvaderShot(invader, nextInvaderShotId + index, spec, velocityX),
    );
  }

  return [createInvaderShot(invader, nextInvaderShotId, spec, spec.velocityX)];
}

export function maybeCreateSpaceInvadersRevengeShots(
  game: SpaceInvadersGameState,
  destroyedInvaders: SpaceInvader[],
): SpaceInvadersGameState {
  const destroyedRevengeInvaders = destroyedInvaders.filter(
    (invader) => invader.kind === "revenge",
  );

  if (destroyedRevengeInvaders.length === 0) {
    return game;
  }

  const revengeSources = getRevengeShotSources(
    destroyedRevengeInvaders,
    game.invaders,
  );
  const revengeShots: SpaceInvadersInvaderShot[] = [];
  let nextInvaderShotId = game.nextInvaderShotId;

  for (const source of revengeSources) {
    const createdShots = createInvaderShots(source, nextInvaderShotId);

    revengeShots.push(...createdShots);
    nextInvaderShotId += createdShots.length;
  }

  if (revengeShots.length === 0) {
    return game;
  }

  return {
    ...game,
    invaderShots: [...game.invaderShots, ...revengeShots],
    nextInvaderShotId,
  };
}

function getRevengeShotSources(
  destroyedRevengeInvaders: SpaceInvader[],
  invaders: SpaceInvader[],
) {
  const sourceById = new Map<string, SpaceInvader>();

  for (const revengeInvader of destroyedRevengeInvaders) {
    const adjacentInvaders = invaders
      .filter(
        (invader) =>
          invader.isActive &&
          Math.abs(invader.row - revengeInvader.row) <= 1 &&
          Math.abs(invader.column - revengeInvader.column) <= 1,
      )
      .sort((first, second) =>
        first.row === second.row
          ? first.column - second.column
          : first.row - second.row,
      );

    for (const adjacentInvader of adjacentInvaders) {
      sourceById.set(adjacentInvader.id, adjacentInvader);
    }
  }

  return [...sourceById.values()];
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

function getInvaderShotSpec(invader: Pick<SpaceInvader, "kind" | "row">) {
  return INVADER_SHOT_SPECS[getInvaderShotKind(invader)];
}

function getInvaderShotKind(invader: Pick<SpaceInvader, "kind" | "row">) {
  if (invader.kind !== "standard") {
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
