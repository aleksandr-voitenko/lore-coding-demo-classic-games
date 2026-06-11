import { describe, expect, it } from "vitest";

import {
  advanceSpaceInvadersGame,
  createInitialSpaceInvadersGame,
  createPlayerShotAlignedWith,
  createRunningGame,
  getArmoredAlienIds,
  getDiverIds,
  getInvader,
  getRevengeAlienIds,
  getShieldBearerIds,
  getSpaceInvadersTickDelay,
  getSplitterAlienIds,
  isSpaceInvaderShielded,
  restartSpaceInvadersGame,
  SPACE_INVADERS_ARMORED_ALIEN_COUNT,
  SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_REVENGE_ALIEN_COUNT,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SHIELD_BEARER_COUNT,
  SPACE_INVADERS_SPLITTER_ALIEN_COUNT,
  SPACE_INVADERS_STARTING_LIVES,
  withOnlyActiveInvader,
} from "./space-invaders-game-engine.test-helpers";

describe("space invaders formation engine", () => {
  it("creates a ready formation with a centered player cannon", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const diverInvaders = game.invaders.filter((invader) => invader.kind === "diver");
    const shieldBearerInvaders = game.invaders.filter(
      (invader) => invader.kind === "shield-bearer",
    );
    const revengeAlienInvaders = game.invaders.filter(
      (invader) => invader.kind === "revenge",
    );
    const splitterAlienInvaders = game.invaders.filter(
      (invader) => invader.kind === "splitter",
    );
    const armoredAlienInvaders = game.invaders.filter(
      (invader) => invader.kind === "armored",
    );
    const bottomRowInvaders = game.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );

    expect(game.status).toBe("ready");
    expect(game.score).toBe(0);
    expect(game.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(game.player.height).toBe(40);
    expect(game.player.width).toBeCloseTo(49.6);
    expect(game.player.x + game.player.width / 2).toBe(SPACE_INVADERS_BOARD_WIDTH / 2);
    expect(game.alienFreezeTicks).toBe(0);
    expect(game.explosions).toEqual([]);
    expect(game.hitStreak).toBe(0);
    expect(game.invaderBurst).toBeNull();
    expect(game.invaderShots).toEqual([]);
    expect(game.invaderShotCooldownTicks).toBeGreaterThan(0);
    expect(game.nextExplosionId).toBe(0);
    expect(game.nextInvaderShotId).toBe(0);
    expect(game.nextPlayerShotId).toBe(0);
    expect(game.nextPowerUpId).toBe(0);
    expect(game.nextScorePopupId).toBe(0);
    expect(game.multiKillCombo).toBeNull();
    expect(game.pendingShotPowerUp).toBeNull();
    expect(game.playerBurst).toBeNull();
    expect(game.playerRespawnTicks).toBe(0);
    expect(game.playerShieldTicks).toBe(0);
    expect(game.playerVolleyHasArmoredHit).toBe(false);
    expect(game.playerShots).toEqual([]);
    expect(game.playerVolleyHasScored).toBe(false);
    expect(game.playerVolleyHasUnscoredExit).toBe(false);
    expect(game.powerUps).toEqual([]);
    expect(game.revengeVolleys).toEqual([]);
    expect(game.scorePopups).toEqual([]);
    expect(game.marchDirection).toBe(1);
    expect(game.ufoHitStreak).toBe(0);
    expect(game.invaders.every((invader) => invader.direction === 1)).toBe(true);
    expect(game.ufo).toMatchObject({
      direction: 1,
      height: 18,
      isActive: false,
      points: 100,
      width: 48,
      x: -48,
      y: 34,
    });
    expect(game.ufo.cooldownTicks).toBeGreaterThan(0);
    expect(game.invaders).toHaveLength(SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS);
    expect(game.invaders.every((invader) => invader.isActive)).toBe(true);
    expect(getInvader(game, 0, 1).x - (game.invaders[0]!.x + game.invaders[0]!.width)).toBeCloseTo(
      9,
    );
    expect(diverInvaders).toHaveLength(10);
    expect(diverInvaders.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
    expect(shieldBearerInvaders).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(revengeAlienInvaders).toHaveLength(SPACE_INVADERS_REVENGE_ALIEN_COUNT);
    expect(splitterAlienInvaders).toHaveLength(SPACE_INVADERS_SPLITTER_ALIEN_COUNT);
    expect(armoredAlienInvaders).toHaveLength(SPACE_INVADERS_ARMORED_ALIEN_COUNT);
    expect(
      armoredAlienInvaders.every(
        (invader) =>
          invader.hitPoints === SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
      ),
    ).toBe(true);
    expect(
      game.invaders.every((invader) =>
        invader.kind === "armored"
          ? invader.hitPoints === SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS
          : invader.hitPoints === 1,
      ),
    ).toBe(true);
    expect(
      shieldBearerInvaders.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      revengeAlienInvaders.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      splitterAlienInvaders.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      armoredAlienInvaders.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      shieldBearerInvaders.every(
        (invader) =>
          !diverInvaders.some((diverInvader) => diverInvader.id === invader.id),
      ),
    ).toBe(true);
    expect(
      revengeAlienInvaders.every(
        (invader) =>
          !diverInvaders.some((diverInvader) => diverInvader.id === invader.id) &&
          !shieldBearerInvaders.some(
            (shieldBearerInvader) => shieldBearerInvader.id === invader.id,
          ) &&
          !splitterAlienInvaders.some(
            (splitterAlienInvader) => splitterAlienInvader.id === invader.id,
          ),
      ),
    ).toBe(true);
    expect(
      splitterAlienInvaders.every(
        (invader) =>
          !diverInvaders.some((diverInvader) => diverInvader.id === invader.id) &&
          !shieldBearerInvaders.some(
            (shieldBearerInvader) => shieldBearerInvader.id === invader.id,
          ) &&
          !revengeAlienInvaders.some(
            (revengeAlienInvader) => revengeAlienInvader.id === invader.id,
          ),
      ),
    ).toBe(true);
    expect(
      armoredAlienInvaders.every(
        (invader) =>
          !diverInvaders.some((diverInvader) => diverInvader.id === invader.id) &&
          !shieldBearerInvaders.some(
            (shieldBearerInvader) => shieldBearerInvader.id === invader.id,
          ) &&
          !revengeAlienInvaders.some(
            (revengeAlienInvader) => revengeAlienInvader.id === invader.id,
          ) &&
          !splitterAlienInvaders.some(
            (splitterAlienInvader) => splitterAlienInvader.id === invader.id,
          ),
      ),
    ).toBe(true);
    expect(bottomRowInvaders.every((invader) => invader.kind === "standard")).toBe(true);
    expect(game.invaders[0]).toMatchObject({
      column: 0,
      kind: "diver",
      points: 30,
      row: 0,
    });
    expect(getInvader(game, 0, 9)).toMatchObject({
      kind: "diver",
      points: 30,
    });
    expect(getInvader(game, 1, 0)).toMatchObject({
      kind: "shield-bearer",
      points: 20,
    });
    expect(isSpaceInvaderShielded(getInvader(game, 1, 4), game.invaders)).toBe(true);
    expect(getInvader(game, 1, 4)).toMatchObject({
      kind: "splitter",
      points: 20,
    });
    expect(getInvader(game, 1, 5)).toMatchObject({
      kind: "revenge",
      points: 20,
    });
    expect(getInvader(game, 2, 0)).toMatchObject({
      hitPoints: SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
      kind: "armored",
      points: 20,
    });
    expect(game.invaders.at(-1)).toMatchObject({
      column: SPACE_INVADERS_COLUMNS - 1,
      kind: "standard",
      points: 10,
      row: SPACE_INVADERS_ROWS - 1,
    });
  });


  it("uses the random source to choose special aliens from safe rows", () => {
    const firstSelection = createInitialSpaceInvadersGame({ random: () => 0 });
    const lastSelection = createInitialSpaceInvadersGame({ random: () => 1 });
    const firstDiverIds = getDiverIds(firstSelection);
    const lastDiverIds = getDiverIds(lastSelection);
    const firstShieldBearerIds = getShieldBearerIds(firstSelection);
    const lastShieldBearerIds = getShieldBearerIds(lastSelection);
    const firstRevengeAlienIds = getRevengeAlienIds(firstSelection);
    const lastRevengeAlienIds = getRevengeAlienIds(lastSelection);
    const firstSplitterAlienIds = getSplitterAlienIds(firstSelection);
    const lastSplitterAlienIds = getSplitterAlienIds(lastSelection);
    const firstArmoredAlienIds = getArmoredAlienIds(firstSelection);
    const lastArmoredAlienIds = getArmoredAlienIds(lastSelection);
    const firstDivers = firstSelection.invaders.filter((invader) => invader.kind === "diver");
    const lastDivers = lastSelection.invaders.filter((invader) => invader.kind === "diver");
    const firstShieldBearers = firstSelection.invaders.filter(
      (invader) => invader.kind === "shield-bearer",
    );
    const lastShieldBearers = lastSelection.invaders.filter(
      (invader) => invader.kind === "shield-bearer",
    );
    const firstRevengeAliens = firstSelection.invaders.filter(
      (invader) => invader.kind === "revenge",
    );
    const lastRevengeAliens = lastSelection.invaders.filter(
      (invader) => invader.kind === "revenge",
    );
    const firstSplitterAliens = firstSelection.invaders.filter(
      (invader) => invader.kind === "splitter",
    );
    const lastSplitterAliens = lastSelection.invaders.filter(
      (invader) => invader.kind === "splitter",
    );
    const firstArmoredAliens = firstSelection.invaders.filter(
      (invader) => invader.kind === "armored",
    );
    const lastArmoredAliens = lastSelection.invaders.filter(
      (invader) => invader.kind === "armored",
    );
    const firstBottomRowInvaders = firstSelection.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );
    const lastBottomRowInvaders = lastSelection.invaders.filter(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1,
    );

    expect(firstDiverIds).toHaveLength(10);
    expect(lastDiverIds).toHaveLength(10);
    expect(firstShieldBearerIds).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(lastShieldBearerIds).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(firstRevengeAlienIds).toHaveLength(SPACE_INVADERS_REVENGE_ALIEN_COUNT);
    expect(lastRevengeAlienIds).toHaveLength(SPACE_INVADERS_REVENGE_ALIEN_COUNT);
    expect(firstSplitterAlienIds).toHaveLength(SPACE_INVADERS_SPLITTER_ALIEN_COUNT);
    expect(lastSplitterAlienIds).toHaveLength(SPACE_INVADERS_SPLITTER_ALIEN_COUNT);
    expect(firstArmoredAlienIds).toHaveLength(SPACE_INVADERS_ARMORED_ALIEN_COUNT);
    expect(lastArmoredAlienIds).toHaveLength(SPACE_INVADERS_ARMORED_ALIEN_COUNT);
    expect(firstDiverIds).not.toEqual(lastDiverIds);
    expect(firstShieldBearerIds).not.toEqual(lastShieldBearerIds);
    expect(firstRevengeAlienIds).not.toEqual(lastRevengeAlienIds);
    expect(firstSplitterAlienIds).not.toEqual(lastSplitterAlienIds);
    expect(firstArmoredAlienIds).not.toEqual(lastArmoredAlienIds);
    expect(firstDivers.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
    expect(lastDivers.every((invader) => invader.row < SPACE_INVADERS_ROWS - 1)).toBe(true);
    expect(
      firstShieldBearers.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      lastShieldBearers.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      firstRevengeAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      lastRevengeAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      firstSplitterAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      lastSplitterAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      firstArmoredAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(
      lastArmoredAliens.every(
        (invader) => invader.row > 0 && invader.row < SPACE_INVADERS_ROWS - 1,
      ),
    ).toBe(true);
    expect(firstShieldBearerIds.every((id) => !firstDiverIds.includes(id))).toBe(true);
    expect(lastShieldBearerIds.every((id) => !lastDiverIds.includes(id))).toBe(true);
    expect(
      firstRevengeAlienIds.every(
        (id) => !firstDiverIds.includes(id) && !firstShieldBearerIds.includes(id),
      ),
    ).toBe(true);
    expect(
      lastRevengeAlienIds.every(
        (id) => !lastDiverIds.includes(id) && !lastShieldBearerIds.includes(id),
      ),
    ).toBe(true);
    expect(
      firstSplitterAlienIds.every(
        (id) =>
          !firstDiverIds.includes(id) &&
          !firstShieldBearerIds.includes(id) &&
          !firstRevengeAlienIds.includes(id),
      ),
    ).toBe(true);
    expect(
      lastSplitterAlienIds.every(
        (id) =>
          !lastDiverIds.includes(id) &&
          !lastShieldBearerIds.includes(id) &&
          !lastRevengeAlienIds.includes(id),
      ),
    ).toBe(true);
    expect(
      firstArmoredAlienIds.every(
        (id) =>
          !firstDiverIds.includes(id) &&
          !firstShieldBearerIds.includes(id) &&
          !firstRevengeAlienIds.includes(id) &&
          !firstSplitterAlienIds.includes(id),
      ),
    ).toBe(true);
    expect(
      lastArmoredAlienIds.every(
        (id) =>
          !lastDiverIds.includes(id) &&
          !lastShieldBearerIds.includes(id) &&
          !lastRevengeAlienIds.includes(id) &&
          !lastSplitterAlienIds.includes(id),
      ),
    ).toBe(true);
    expect(firstBottomRowInvaders.every((invader) => invader.kind === "standard")).toBe(true);
    expect(lastBottomRowInvaders.every((invader) => invader.kind === "standard")).toBe(true);
  });


  it("creates configurable board sizes and alien counts", () => {
    const game = createInitialSpaceInvadersGame({
      alienCount: 24,
      boardHeight: 640,
      boardWidth: 480,
    });
    const restarted = restartSpaceInvadersGame(game);
    const expectedSmallPresetRevengeAlienCount = 2;
    const expectedSmallPresetSplitterAlienCount = 0;
    const expectedSmallPresetArmoredAlienCount = 0;

    expect(game.alienCount).toBe(24);
    expect(game.boardHeight).toBe(640);
    expect(game.boardWidth).toBe(480);
    expect(game.baseY).toBe(572);
    expect(game.invaders).toHaveLength(24);
    expect(game.invaders.filter((invader) => invader.kind === "diver")).toHaveLength(10);
    expect(game.invaders.filter((invader) => invader.kind === "shield-bearer")).toHaveLength(
      SPACE_INVADERS_SHIELD_BEARER_COUNT,
    );
    expect(game.invaders.filter((invader) => invader.kind === "revenge")).toHaveLength(
      expectedSmallPresetRevengeAlienCount,
    );
    expect(game.invaders.filter((invader) => invader.kind === "splitter")).toHaveLength(
      expectedSmallPresetSplitterAlienCount,
    );
    expect(game.invaders.filter((invader) => invader.kind === "armored")).toHaveLength(
      expectedSmallPresetArmoredAlienCount,
    );
    expect(game.player.x + game.player.width / 2).toBe(240);
    expect(restarted.alienCount).toBe(24);
    expect(restarted.boardHeight).toBe(640);
    expect(restarted.boardWidth).toBe(480);
    expect(restarted.invaders).toHaveLength(24);
    expect(restarted.invaders.filter((invader) => invader.kind === "diver")).toHaveLength(10);
    expect(
      restarted.invaders.filter((invader) => invader.kind === "shield-bearer"),
    ).toHaveLength(SPACE_INVADERS_SHIELD_BEARER_COUNT);
    expect(restarted.invaders.filter((invader) => invader.kind === "revenge")).toHaveLength(
      expectedSmallPresetRevengeAlienCount,
    );
    expect(restarted.invaders.filter((invader) => invader.kind === "splitter")).toHaveLength(
      expectedSmallPresetSplitterAlienCount,
    );
    expect(restarted.invaders.filter((invader) => invader.kind === "armored")).toHaveLength(
      expectedSmallPresetArmoredAlienCount,
    );
    expect(restarted.status).toBe("running");
  });


  it("marches invaders horizontally until they hit an edge, then drops and reverses", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const standardEdgeInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 0);
    const targetInvader = {
      ...standardEdgeInvader,
      x: SPACE_INVADERS_BOARD_WIDTH - standardEdgeInvader.width - 0.1,
      y: 100,
    };
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        invaders: game.invaders.map((invader) =>
          invader.id === targetInvader.id ? targetInvader : invader,
        ),
        marchDirection: 1,
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame);
    const marchedInvader = advanced.invaders.find((invader) => invader.id === targetInvader.id);

    expect(marchedInvader).toMatchObject({
      x: targetInvader.x,
    });
    expect(marchedInvader?.y).toBeCloseTo(targetInvader.y + 4);
    expect(advanced.marchDirection).toBe(-1);
  });


  it("keeps covered divers in formation until lower invaders leave their lane", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const coveredDiver = {
      ...getInvader(game, 2, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      kind: "diver" as const,
    };
    const lowerInvader = getInvader(game, 3, coveredDiver.column);
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) =>
          invader.id === coveredDiver.id ? coveredDiver : invader,
        ),
      }),
    );
    const movedDiver = advanced.invaders.find((invader) => invader.id === coveredDiver.id);

    expect(coveredDiver.kind).toBe("diver");
    expect(lowerInvader.isActive).toBe(true);
    expect(movedDiver?.x).toBeCloseTo(coveredDiver.x + 0.8);
    expect(movedDiver?.isDiving).toBe(false);
  });


  it("accelerates divers when their current screen lane is clear", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const laneDiver = {
      ...getInvader(game, 1, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      kind: "diver" as const,
    };
    const shiftedLowerInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, laneDiver.column),
      x: laneDiver.x + laneDiver.width + 8,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === laneDiver.id) {
            return laneDiver;
          }

          if (invader.id === shiftedLowerInvader.id) {
            return shiftedLowerInvader;
          }

          return { ...invader, isActive: false };
        }),
      }),
    );
    const movedDiver = advanced.invaders.find((invader) => invader.id === laneDiver.id);
    const movedLowerInvader = advanced.invaders.find(
      (invader) => invader.id === shiftedLowerInvader.id,
    );

    expect(laneDiver.kind).toBe("diver");
    expect(shiftedLowerInvader.column).toBe(laneDiver.column);
    expect(shiftedLowerInvader.x).toBeGreaterThan(laneDiver.x + laneDiver.width);
    expect(movedDiver?.x).toBeCloseTo(laneDiver.x + 3.5);
    expect(movedDiver?.isDiving).toBe(true);
    expect(movedLowerInvader?.x).toBeCloseTo(shiftedLowerInvader.x + 0.8);
    expect(movedLowerInvader?.isDiving).toBe(false);
  });


  it("bounces released divers without dropping or reversing the formation", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const releasedDiver = {
      ...getInvader(game, 1, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      direction: 1 as const,
      isDiving: true,
      kind: "diver" as const,
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 0.1,
    };
    const lowerInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, releasedDiver.column),
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 1,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === releasedDiver.id) {
            return releasedDiver;
          }

          if (invader.id === lowerInvader.id) {
            return lowerInvader;
          }

          return { ...invader, isActive: false };
        }),
        marchDirection: 1,
      }),
    );
    const droppedDiver = advanced.invaders.find((invader) => invader.id === releasedDiver.id);
    const droppedLowerInvader = advanced.invaders.find(
      (invader) => invader.id === lowerInvader.id,
    );

    expect(releasedDiver.kind).toBe("diver");
    expect(lowerInvader.y).toBeGreaterThan(releasedDiver.y);
    expect(lowerInvader.x).toBeLessThan(releasedDiver.x);
    expect(droppedDiver?.y).toBeCloseTo(releasedDiver.y + 16);
    expect(droppedDiver?.direction).toBe(-1);
    expect(droppedDiver?.isDiving).toBe(true);
    expect(droppedLowerInvader?.x).toBeCloseTo(lowerInvader.x + 0.8);
    expect(droppedLowerInvader?.y).toBeCloseTo(lowerInvader.y);
    expect(advanced.marchDirection).toBe(1);
  });


  it("keeps released divers hard-dropping when the formation itself descends", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const releasedDiver = {
      ...getInvader(game, 1, Math.floor(SPACE_INVADERS_COLUMNS / 2) - 1),
      isDiving: true,
      kind: "diver" as const,
    };
    const lowerInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, releasedDiver.column),
      x: releasedDiver.x,
    };
    const edgeInvader = {
      ...getInvader(game, SPACE_INVADERS_ROWS - 1, SPACE_INVADERS_COLUMNS - 1),
      x: SPACE_INVADERS_BOARD_WIDTH - game.invaders[0]!.width - 0.1,
    };
    const advanced = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: game.invaders.map((invader) => {
          if (invader.id === releasedDiver.id) {
            return releasedDiver;
          }

          if (invader.id === lowerInvader.id) {
            return lowerInvader;
          }

          if (invader.id === edgeInvader.id) {
            return edgeInvader;
          }

          return { ...invader, isActive: false };
        }),
        marchDirection: 1,
      }),
    );
    const droppedDiver = advanced.invaders.find((invader) => invader.id === releasedDiver.id);
    const droppedLowerInvader = advanced.invaders.find(
      (invader) => invader.id === lowerInvader.id,
    );

    expect(releasedDiver.kind).toBe("diver");
    expect(lowerInvader.y).toBeGreaterThan(releasedDiver.y);
    expect(lowerInvader.x).toBe(releasedDiver.x);
    expect(droppedDiver?.y).toBeCloseTo(releasedDiver.y + 16);
    expect(droppedDiver?.direction).toBe(-1);
    expect(droppedDiver?.isDiving).toBe(true);
    expect(droppedLowerInvader?.y).toBeCloseTo(lowerInvader.y + 4);
    expect(advanced.marchDirection).toBe(-1);
  });


  it("moves exposed divers twice as fast as the previous tuning and hard-drops them on their own edge bounce", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const standardInvader = getInvader(game, SPACE_INVADERS_ROWS - 1, 3);
    const diverInvader = {
      ...getInvader(game, 2, 4),
      direction: 1 as const,
      kind: "diver" as const,
    };
    const exposedInvaders = game.invaders.map((invader) => {
      if (invader.id === diverInvader.id) {
        return { ...diverInvader, isActive: true };
      }

      return {
        ...invader,
        isActive: invader.id === standardInvader.id,
      };
    });
    const afterHorizontalMarch = advanceSpaceInvadersGame(
      createRunningGame({
        invaderShotCooldownTicks: 1_000,
        invaders: exposedInvaders,
      }),
    );
    const movedStandard = afterHorizontalMarch.invaders.find(
      (invader) => invader.id === standardInvader.id,
    )!;
    const movedDiver = afterHorizontalMarch.invaders.find(
      (invader) => invader.id === diverInvader.id,
    )!;
    const edgeGame = createRunningGame({
      invaderShotCooldownTicks: 1_000,
      invaders: game.invaders.map((invader) => {
        if (invader.id === standardInvader.id) {
          return standardInvader;
        }

        if (invader.id === diverInvader.id) {
          return {
            ...diverInvader,
            x: SPACE_INVADERS_BOARD_WIDTH - diverInvader.width - 0.1,
          };
        }

        return { ...invader, isActive: false };
      }),
      marchDirection: 1,
    });
    const afterDrop = advanceSpaceInvadersGame(edgeGame);
    const droppedStandard = afterDrop.invaders.find(
      (invader) => invader.id === standardInvader.id,
    )!;
    const droppedDiver = afterDrop.invaders.find(
      (invader) => invader.id === diverInvader.id,
    )!;

    expect(standardInvader.kind).toBe("standard");
    expect(diverInvader.kind).toBe("diver");
    expect(movedStandard.x - standardInvader.x).toBeCloseTo(0.8);
    expect(movedDiver.x - diverInvader.x).toBeCloseTo(3.5);
    expect(movedDiver.x - diverInvader.x).toBeGreaterThan(1.75);
    expect(droppedStandard.x - standardInvader.x).toBeCloseTo(0.8);
    expect(droppedStandard.y - standardInvader.y).toBeCloseTo(0);
    expect(droppedDiver.y - diverInvader.y).toBeCloseTo(16);
    expect(droppedDiver.direction).toBe(-1);
    expect(afterDrop.marchDirection).toBe(1);
  });


  it("keeps the untouched formation above the base for a playable opening window", () => {
    const ticksForTwoMinutes = Math.floor(120_000 / getSpaceInvadersTickDelay());
    const ticksForThreeMinutes = Math.floor(180_000 / getSpaceInvadersTickDelay());
    let game = createRunningGame({
      invaderShotCooldownTicks: ticksForThreeMinutes + 10,
    });

    for (let tick = 0; tick < ticksForTwoMinutes; tick += 1) {
      game = advanceSpaceInvadersGame(game);
    }

    const lowestActiveInvaderEdge = Math.max(
      ...game.invaders
        .filter((invader) => invader.isActive)
        .map((invader) => invader.y + invader.height),
    );

    expect(game.status).toBe("running");
    expect(lowestActiveInvaderEdge).toBeLessThan(SPACE_INVADERS_BASE_Y);

    for (let tick = ticksForTwoMinutes; tick < ticksForThreeMinutes; tick += 1) {
      game = advanceSpaceInvadersGame(game);
    }

    expect(game.status).toBe("lost");
  });


  it("loses when an active invader reaches the player base", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = {
      ...game.invaders[0]!,
      y: SPACE_INVADERS_BASE_Y - game.invaders[0]!.height + 1,
    };
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        invaders: game.invaders.map((invader) =>
          invader.id === targetInvader.id ? targetInvader : invader,
        ),
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.status).toBe("lost");
    expect(advanced.lives).toBe(0);
  });


  it("wins when the final active invader is cleared", () => {
    const game = createInitialSpaceInvadersGame();
    const targetInvader = game.invaders[0]!;
    const runningGame = withOnlyActiveInvader(
      createRunningGame({
        invaders: game.invaders,
        playerShots: [createPlayerShotAlignedWith(targetInvader)],
        ufo: {
          ...game.ufo,
          isActive: true,
          x: 180,
        },
      }),
      targetInvader,
    );
    const advanced = advanceSpaceInvadersGame(runningGame);

    expect(advanced.status).toBe("won");
    expect(advanced.score).toBe(targetInvader.points);
    expect(advanced.ufo.isActive).toBe(true);
  });

});
