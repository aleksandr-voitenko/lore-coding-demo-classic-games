import {
  continueSpaceInvadersMultiKillCombo,
  createSpaceInvadersExplosion,
  createSpaceInvadersScorePopup,
  deactivateSpaceInvadersUfo,
  getProjectileCollisionExplosionTarget,
  maybeCreateSpaceInvadersPowerUpDrop,
} from "./effects";
import {
  createSpaceInvadersSplitterFragments,
  getInvaderHitPointsAfterPlayerShot,
  isSpaceInvaderShielded,
} from "./formation";
import { rectanglesIntersect } from "./geometry";
import { getInvaderCollisionBounds } from "./hitboxes";
import {
  advancePlayerShotPosition,
  isPlayerShotActive,
  maybePrimeSpaceInvadersRevengeVolley,
} from "./projectiles";
import {
  advanceSpaceInvadersHitStreak,
  advanceSpaceInvadersUfoChain,
  getCombinedSpaceInvadersScoreTarget,
  getSpaceInvadersHitStreakPopupScale,
} from "./scoring";
import type {
  SpaceInvader,
  SpaceInvadersGameState,
  SpaceInvadersPlayerShot,
  SpaceInvadersRandomSource,
  SpaceInvadersScoreTarget,
} from "./types";

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

export function advanceSpaceInvadersPlayerShots(
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
    resolvePlayerShotShieldImpact(
      state,
      movedShot,
      hitInvaders[0]!,
      didScoreWithShot,
      random,
    );
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
