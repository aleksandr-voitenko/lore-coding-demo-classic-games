import { describe, expect, it } from "vitest";

import {
  createExplosionFixture,
  createInitialSpaceInvadersGame,
  createInvaderShotFixture,
  createPowerUpFixture,
  createRandomSequence,
  createPlayerShotAlignedWith,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
  SPACE_INVADERS_BASE_Y,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  createScorePopupFixture,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
  SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_STARTING_LIVES,
  type SpaceInvader,
} from "./space-invaders-game-engine.test-helpers";
import {
  advanceSpaceInvadersMultiplayerGameTick,
  cloneSpaceInvadersMultiplayerGame,
  createInitialSpaceInvadersMultiplayerGame,
  fireSpaceInvadersMultiplayerShipShot,
  isSpaceInvadersShipSeat,
  moveSpaceInvadersMultiplayerShip,
  resolveSpaceInvadersMultiplayerInvaderShotHits,
  resolveSpaceInvadersMultiplayerPowerUpPickup,
  SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS,
  SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS,
  type SpaceInvadersMultiplayerGameSnapshot,
  type SpaceInvadersMultiplayerGameState,
  type SpaceInvadersMultiplayerRoomSnapshot,
  type SpaceInvadersShipSeat,
} from "./space-invaders-multiplayer";

function createRunningSpaceInvadersMultiplayerGame(
  overrides: Partial<SpaceInvadersMultiplayerGameState> = {},
): SpaceInvadersMultiplayerGameState {
  return {
    ...createInitialSpaceInvadersMultiplayerGame({ random: () => 0 }),
    status: "running",
    ...overrides,
  };
}

function withShipPlayer(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
  playerOverrides: Partial<
    SpaceInvadersMultiplayerGameState["ships"][SpaceInvadersShipSeat]["player"]
  >,
): SpaceInvadersMultiplayerGameState {
  return {
    ...game,
    ships: {
      ...game.ships,
      [seat]: {
        ...game.ships[seat],
        player: {
          ...game.ships[seat].player,
          ...playerOverrides,
        },
      },
    },
  };
}

function withOverlappingShips(
  game: SpaceInvadersMultiplayerGameState,
): SpaceInvadersMultiplayerGameState {
  return withShipPlayer(game, "ship-b", game.ships["ship-a"].player);
}

function withOnlyActiveMultiplayerInvader(
  game: SpaceInvadersMultiplayerGameState,
  activeInvader: SpaceInvader,
): SpaceInvadersMultiplayerGameState {
  return {
    ...game,
    invaders: game.invaders.map((invader) => ({
      ...invader,
      ...(invader.id === activeInvader.id ? activeInvader : {}),
      isActive: invader.id === activeInvader.id,
    })),
  };
}

function createInvaderShotTouchingShip(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
  overrides: Partial<ReturnType<typeof createInvaderShotFixture>> = {},
) {
  const ship = game.ships[seat].player;
  const height = overrides.height ?? 20;
  const width = overrides.width ?? 5;

  return createInvaderShotFixture({
    height,
    width,
    x: ship.x + ship.width / 2 - width / 2,
    y: ship.y + ship.height / 2 - height / 2,
    ...overrides,
  });
}

function createInvaderShotMovingIntoShip(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
  overrides: Partial<ReturnType<typeof createInvaderShotFixture>> = {},
) {
  const ship = game.ships[seat].player;
  const height = overrides.height ?? 20;
  const velocityY = overrides.velocityY ?? 3.2;
  const width = overrides.width ?? 5;

  return createInvaderShotFixture({
    height,
    velocityY,
    width,
    x: ship.x + ship.width / 2 - width / 2,
    y: ship.y - height - velocityY + 1,
    ...overrides,
  });
}

function createPlayerShotMovingIntoTarget(
  target: { height: number; width: number; x: number; y: number },
  overrides: Partial<ReturnType<typeof createPlayerShotAlignedWith>> = {},
) {
  const shot = {
    ...createPlayerShotAlignedWith(target),
    ...overrides,
  };

  return {
    ...shot,
    x: target.x + target.width / 2 - shot.width / 2,
    y: target.y + target.height / 2 - shot.height / 2 - shot.velocityY,
  };
}

function createPowerUpTouchingShip(
  game: SpaceInvadersMultiplayerGameState,
  seat: SpaceInvadersShipSeat,
  overrides: Partial<ReturnType<typeof createPowerUpFixture>> = {},
) {
  const ship = game.ships[seat].player;
  const height = overrides.height ?? 18;
  const width = overrides.width ?? 18;

  return createPowerUpFixture({
    height,
    width,
    x: ship.x + ship.width / 2 - width / 2,
    y: ship.y + ship.height / 2 - height / 2,
    ...overrides,
  });
}

describe("space invaders multiplayer state model", () => {
  it("creates a separate two-ship state from the shared solo wave defaults", () => {
    const soloGame = createInitialSpaceInvadersGame({ random: () => 0 });
    const game = createInitialSpaceInvadersMultiplayerGame({ random: () => 0 });

    expect("player" in game).toBe(false);
    expect("playerShots" in game).toBe(false);
    expect(game).toMatchObject({
      alienCount: SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
      boardHeight: soloGame.boardHeight,
      boardWidth: soloGame.boardWidth,
      hitStreak: 0,
      lives: SPACE_INVADERS_STARTING_LIVES,
      score: 0,
      status: "ready",
      ufo: soloGame.ufo,
    });
    expect(game.invaders).toEqual(soloGame.invaders);
    expect(game.invaderShots).toEqual([]);
    expect(game.powerUps).toEqual([]);
    expect(game.ships["ship-a"].seat).toBe("ship-a");
    expect(game.ships["ship-b"].seat).toBe("ship-b");
  });

  it("places both ships on deterministic symmetric non-overlapping starts", () => {
    const game = createInitialSpaceInvadersMultiplayerGame({
      alienCount: 40,
      boardHeight: 640,
      boardWidth: 480,
      random: () => 0,
    });
    const shipA = game.ships["ship-a"].player;
    const shipB = game.ships["ship-b"].player;
    const shipACenterX = shipA.x + shipA.width / 2;
    const shipBCenterX = shipB.x + shipB.width / 2;

    expect(game.boardWidth).toBe(480);
    expect(game.boardHeight).toBe(640);
    expect(game.alienCount).toBe(40);
    expect(shipA.y).toBe(shipB.y);
    expect(shipA.width).toBe(shipB.width);
    expect(shipA.height).toBe(shipB.height);
    expect(shipACenterX).toBeCloseTo(game.boardWidth / 3);
    expect(shipBCenterX).toBeCloseTo((game.boardWidth * 2) / 3);
    expect(shipACenterX + shipBCenterX).toBeCloseTo(game.boardWidth);
    expect(shipA.x + shipA.width).toBeLessThan(shipB.x);
  });

  it("keeps player-owned state independent per ship while sharing lives", () => {
    const game = createInitialSpaceInvadersMultiplayerGame();
    const shipA = game.ships["ship-a"];
    const shipB = game.ships["ship-b"];

    expect(game.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(shipA.player).not.toBe(shipB.player);
    expect(shipA.playerShots).not.toBe(shipB.playerShots);
    expect(shipA.playerBurst).toBeNull();
    expect(shipB.playerBurst).toBeNull();
    expect(shipA.playerRespawnTicks).toBe(0);
    expect(shipB.playerRespawnTicks).toBe(0);
    expect(shipA.playerShieldTicks).toBe(0);
    expect(shipB.playerShieldTicks).toBe(0);
    expect(shipA.pendingShotPowerUp).toBeNull();
    expect(shipB.pendingShotPowerUp).toBeNull();
    expect(shipA.playerVolleyHasArmoredHit).toBe(false);
    expect(shipB.playerVolleyHasArmoredHit).toBe(false);
    expect(shipA.playerVolleyHasScored).toBe(false);
    expect(shipB.playerVolleyHasScored).toBe(false);
    expect(shipA.playerVolleyHasUnscoredExit).toBe(false);
    expect(shipB.playerVolleyHasUnscoredExit).toBe(false);
    expect(shipA.isActive).toBe(true);
    expect(shipB.isActive).toBe(true);
  });

  it("moves each ship independently and clamps to the side walls", () => {
    const game = createInitialSpaceInvadersMultiplayerGame();
    const movedA = moveSpaceInvadersMultiplayerShip(game, "ship-a", -1_000);
    const invalidSeatMove = moveSpaceInvadersMultiplayerShip(movedA, "left", -1_000);
    const movedB = moveSpaceInvadersMultiplayerShip(movedA, "ship-b", 1_000);
    const unchangedAtWall = moveSpaceInvadersMultiplayerShip(movedB, "ship-b", 1_000);

    expect(movedA.ships["ship-a"].player.x).toBe(0);
    expect(movedA.ships["ship-a"]).not.toBe(game.ships["ship-a"]);
    expect(movedA.ships["ship-b"]).toBe(game.ships["ship-b"]);
    expect(invalidSeatMove).toBe(movedA);
    expect(movedB.ships["ship-b"].player.x).toBe(
      movedB.boardWidth - movedB.ships["ship-b"].player.width,
    );
    expect(movedB.ships["ship-a"]).toBe(movedA.ships["ship-a"]);
    expect(unchangedAtWall).toBe(movedB);
  });

  it("does not treat the other ship as a movement obstacle", () => {
    const initialGame = createInitialSpaceInvadersMultiplayerGame();
    const shipB = initialGame.ships["ship-b"];
    const overlappingGame: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          player: {
            ...initialGame.ships["ship-a"].player,
            x: shipB.player.x - 4,
          },
        },
      },
    };
    const moved = moveSpaceInvadersMultiplayerShip(overlappingGame, "ship-a", 8);

    expect(moved.ships["ship-a"].player.x).toBe(shipB.player.x + 4);
    expect(moved.ships["ship-a"].player.x).toBeLessThan(
      shipB.player.x + shipB.player.width,
    );
    expect(moved.ships["ship-b"]).toBe(overlappingGame.ships["ship-b"]);
  });

  it("fires each ship independently with globally unique player shot ids", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const shotgunReadyGame: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          pendingShotPowerUp: "shotgun-shot",
        },
      },
    };
    const firedA = fireSpaceInvadersMultiplayerShipShot(
      shotgunReadyGame,
      "ship-a",
    );
    const invalidSeatFire = fireSpaceInvadersMultiplayerShipShot(firedA, "left");
    const firedB = fireSpaceInvadersMultiplayerShipShot(firedA, "ship-b");

    expect(firedA.ships["ship-a"].pendingShotPowerUp).toBeNull();
    expect(firedA.ships["ship-a"].playerShots.map((shot) => shot.id)).toEqual([
      "player-shot-0",
      "player-shot-1",
      "player-shot-2",
      "player-shot-3",
      "player-shot-4",
    ]);
    expect(firedA.ships["ship-a"].playerShots.map((shot) => shot.kind)).toEqual([
      "shotgun",
      "shotgun",
      "shotgun",
      "shotgun",
      "shotgun",
    ]);
    expect(firedA.ships["ship-b"].playerShots).toEqual([]);
    expect(firedA.nextPlayerShotId).toBe(5);
    expect(invalidSeatFire).toBe(firedA);
    expect(firedB.ships["ship-a"]).toBe(firedA.ships["ship-a"]);
    expect(firedB.ships["ship-b"].playerShots).toHaveLength(1);
    expect(firedB.ships["ship-b"].playerShots[0]).toMatchObject({
      id: "player-shot-5",
      kind: "standard",
    });
    expect(firedB.nextPlayerShotId).toBe(6);
  });

  it("blocks only the firing ship when that ship already has a shot or burst", () => {
    const game = createRunningSpaceInvadersMultiplayerGame();
    const firedA = fireSpaceInvadersMultiplayerShipShot(game, "ship-a");
    const blockedByActiveShot = fireSpaceInvadersMultiplayerShipShot(
      firedA,
      "ship-a",
    );
    const firedBAfterActiveShot = fireSpaceInvadersMultiplayerShipShot(
      blockedByActiveShot,
      "ship-b",
    );
    const burstBlockedGame: SpaceInvadersMultiplayerGameState = {
      ...game,
      nextPlayerShotId: 10,
      ships: {
        ...game.ships,
        "ship-a": {
          ...game.ships["ship-a"],
          playerBurst: {
            cooldownTicks: 1,
            remainingShots: 1,
          },
        },
      },
    };
    const blockedByBurst = fireSpaceInvadersMultiplayerShipShot(
      burstBlockedGame,
      "ship-a",
    );
    const firedBAfterBurst = fireSpaceInvadersMultiplayerShipShot(
      blockedByBurst,
      "ship-b",
    );

    expect(blockedByActiveShot).toBe(firedA);
    expect(firedBAfterActiveShot.ships["ship-b"].playerShots[0]).toMatchObject({
      id: "player-shot-1",
      kind: "standard",
    });
    expect(firedBAfterActiveShot.nextPlayerShotId).toBe(2);
    expect(blockedByBurst).toBe(burstBlockedGame);
    expect(firedBAfterBurst.ships["ship-a"]).toBe(burstBlockedGame.ships["ship-a"]);
    expect(firedBAfterBurst.ships["ship-b"].playerShots[0]).toMatchObject({
      id: "player-shot-10",
      kind: "standard",
    });
    expect(firedBAfterBurst.nextPlayerShotId).toBe(11);
  });

  it("respects game status and per-ship respawn gates", () => {
    const readyGame = createInitialSpaceInvadersMultiplayerGame();
    const runningGame = createRunningSpaceInvadersMultiplayerGame();
    const respawningGame: SpaceInvadersMultiplayerGameState = {
      ...runningGame,
      ships: {
        ...runningGame.ships,
        "ship-a": {
          ...runningGame.ships["ship-a"],
          playerRespawnTicks: 2,
        },
      },
    };
    const movedB = moveSpaceInvadersMultiplayerShip(respawningGame, "ship-b", 10);
    const firedB = fireSpaceInvadersMultiplayerShipShot(respawningGame, "ship-b");

    expect(fireSpaceInvadersMultiplayerShipShot(readyGame, "ship-a")).toBe(
      readyGame,
    );
    expect(moveSpaceInvadersMultiplayerShip(respawningGame, "ship-a", 10)).toBe(
      respawningGame,
    );
    expect(fireSpaceInvadersMultiplayerShipShot(respawningGame, "ship-a")).toBe(
      respawningGame,
    );
    expect(movedB.ships["ship-b"].player.x).toBe(
      respawningGame.ships["ship-b"].player.x + 10,
    );
    expect(firedB.ships["ship-b"].playerShots[0]).toMatchObject({
      id: "player-shot-0",
      kind: "standard",
    });
  });

  it("sets up pending burst shots for only the firing ship", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const burstReadyGame: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      nextPlayerShotId: 7,
      ships: {
        ...initialGame.ships,
        "ship-b": {
          ...initialGame.ships["ship-b"],
          pendingShotPowerUp: "burst-shot",
        },
      },
    };
    const fired = fireSpaceInvadersMultiplayerShipShot(burstReadyGame, "ship-b");
    const firedShot = fired.ships["ship-b"].playerShots[0]!;

    expect(fired.ships["ship-a"]).toBe(burstReadyGame.ships["ship-a"]);
    expect(fired.ships["ship-b"].pendingShotPowerUp).toBeNull();
    expect(fired.ships["ship-b"].playerBurst).toEqual({
      cooldownTicks: SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
      remainingShots: SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT - 1,
    });
    expect(firedShot).toMatchObject({
      id: "player-shot-7",
      kind: "burst",
    });
    expect(fired.nextPlayerShotId).toBe(8);
  });

  it("applies held tick input to only the addressed ship", () => {
    const game = createRunningSpaceInvadersMultiplayerGame();
    const ticked = advanceSpaceInvadersMultiplayerGameTick(game, {
      "ship-a": {
        fire: true,
        right: true,
      },
    });

    expect(ticked.ships["ship-a"].player.x).toBeGreaterThan(
      game.ships["ship-a"].player.x,
    );
    expect(ticked.ships["ship-b"].player.x).toBe(game.ships["ship-b"].player.x);
    expect(ticked.ships["ship-a"].playerShots).toHaveLength(1);
    expect(ticked.ships["ship-a"].playerShots[0]).toMatchObject({
      id: "player-shot-0",
      kind: "standard",
    });
    expect(ticked.ships["ship-a"].playerShots[0]!.y).toBeLessThan(
      game.ships["ship-a"].player.y,
    );
    expect(ticked.ships["ship-b"].playerShots).toEqual([]);
    expect(ticked.nextPlayerShotId).toBe(1);
  });

  it("ignores contradictory held horizontal input while still applying fire", () => {
    const game = createRunningSpaceInvadersMultiplayerGame();
    const ticked = advanceSpaceInvadersMultiplayerGameTick(game, {
      "ship-b": {
        fire: true,
        left: true,
        right: true,
      },
    });

    expect(ticked.ships["ship-b"].player.x).toBe(game.ships["ship-b"].player.x);
    expect(ticked.ships["ship-b"].playerShots).toHaveLength(1);
    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
  });

  it("advances both ships' player shots against the shared invader wave", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const targetA = initialGame.invaders[0]!;
    const targetB = initialGame.invaders[1]!;
    const shotA = createPlayerShotAlignedWith(targetA);
    const shotB = createPlayerShotAlignedWith(targetB);
    const game: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      invaders: initialGame.invaders.map((invader) => ({
        ...invader,
        isActive: invader.id === targetA.id || invader.id === targetB.id,
      })),
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerShots: [{ ...shotA, id: "ship-a-shot" }],
        },
        "ship-b": {
          ...initialGame.ships["ship-b"],
          playerShots: [{ ...shotB, id: "ship-b-shot" }],
        },
      },
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick(game, {}, () => 0);

    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
    expect(ticked.ships["ship-b"].playerShots).toEqual([]);
    expect(
      ticked.invaders.filter((invader) => invader.isActive).map((invader) => invader.id),
    ).toEqual([]);
    expect(ticked.score).toBe(
      targetA.points +
        targetB.points +
        SPACE_INVADERS_HIT_STREAK_BONUS_STEP +
        SPACE_INVADERS_MULTI_KILL_BONUSES[2],
    );
    expect(ticked.status).toBe("won");
  });

  it("advances queued burst shots independently per ship", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame({
      nextPlayerShotId: 20,
    });
    const game: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerBurst: {
            cooldownTicks: 0,
            remainingShots: 1,
          },
        },
        "ship-b": {
          ...initialGame.ships["ship-b"],
          playerBurst: {
            cooldownTicks: 2,
            remainingShots: 1,
          },
        },
      },
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick(game);

    expect(ticked.ships["ship-a"].playerBurst).toBeNull();
    expect(ticked.ships["ship-a"].playerShots[0]).toMatchObject({
      id: "player-shot-20",
      kind: "burst",
    });
    expect(ticked.ships["ship-b"].playerBurst).toEqual({
      cooldownTicks: 1,
      remainingShots: 1,
    });
    expect(ticked.ships["ship-b"].playerShots).toEqual([]);
    expect(ticked.nextPlayerShotId).toBe(21);
  });

  it("moves falling power-ups before resolving per-ship pickup", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const shipB = initialGame.ships["ship-b"].player;
    const collectablePowerUp = createPowerUpFixture({
      kind: "shield",
      x: shipB.x + shipB.width / 2 - 9,
      y: shipB.y - 18,
      height: 18,
      velocityY: 18,
      width: 18,
    });
    const fallingPowerUp = createPowerUpFixture({
      id: "falling",
      kind: "bonus-score",
      x: 0,
      y: 10,
      velocityY: 3,
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      powerUps: [collectablePowerUp, fallingPowerUp],
    });

    expect(ticked.ships["ship-a"].playerShieldTicks).toBe(0);
    expect(ticked.ships["ship-b"].playerShieldTicks).toBe(
      SPACE_INVADERS_POWER_UP_SHIELD_TICKS - 1,
    );
    expect(ticked.powerUps).toEqual([
      {
        ...fallingPowerUp,
        y: fallingPowerUp.y + fallingPowerUp.velocityY,
      },
    ]);
  });

  it("counts down respawn and shield recovery independently per ship", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const game: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerRespawnTicks: 1,
        },
        "ship-b": {
          ...initialGame.ships["ship-b"],
          playerShieldTicks: 2,
        },
      },
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick(game);

    expect(ticked.ships["ship-a"].playerRespawnTicks).toBe(0);
    expect(ticked.ships["ship-a"].playerShieldTicks).toBe(
      SPACE_INVADERS_PLAYER_SHIELD_TICKS,
    );
    expect(ticked.ships["ship-b"].playerRespawnTicks).toBe(0);
    expect(ticked.ships["ship-b"].playerShieldTicks).toBe(1);
  });

  it("ages shared effects and active multi-kill combo windows", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const activeExplosion = createExplosionFixture({
      ageTicks: 3,
      id: "active-explosion",
      ttlTicks: 2,
    });
    const expiredExplosion = createExplosionFixture({
      id: "expired-explosion",
      ttlTicks: 1,
    });
    const activePopup = createScorePopupFixture({
      ageTicks: 4,
      id: "active-popup",
      ttlTicks: 2,
    });
    const expiredPopup = createScorePopupFixture({
      id: "expired-popup",
      ttlTicks: 1,
    });
    const comboKeeperShot = {
      height: 14,
      id: "combo-keeper",
      kind: "standard" as const,
      velocityX: 0,
      velocityY: -6.4,
      width: 4,
      x: 0,
      y: initialGame.boardHeight / 2,
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      alienFreezeTicks: 1,
      explosions: [activeExplosion, expiredExplosion],
      multiKillCombo: {
        destroyedCount: 2,
        height: 24,
        points: 40,
        ticksRemaining: 3,
        width: 40,
        x: 100,
        y: 80,
      },
      scorePopups: [activePopup, expiredPopup],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerShots: [comboKeeperShot],
        },
      },
    });

    expect(ticked.explosions).toEqual([
      {
        ...activeExplosion,
        ageTicks: activeExplosion.ageTicks + 1,
        ttlTicks: activeExplosion.ttlTicks - 1,
      },
    ]);
    expect(ticked.scorePopups).toEqual([
      {
        ...activePopup,
        ageTicks: activePopup.ageTicks + 1,
        ttlTicks: activePopup.ttlTicks - 1,
      },
    ]);
    expect(ticked.multiKillCombo).toMatchObject({
      destroyedCount: 2,
      points: 40,
      ticksRemaining: 2,
    });
  });

  it("finalizes an expired multi-kill combo through the tick path", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const comboKeeperShot = {
      height: 14,
      id: "combo-keeper",
      kind: "standard" as const,
      velocityX: 0,
      velocityY: -6.4,
      width: 4,
      x: 0,
      y: initialGame.boardHeight / 2,
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      alienFreezeTicks: 1,
      multiKillCombo: {
        destroyedCount: 2,
        height: 24,
        points: 40,
        ticksRemaining: 1,
        width: 40,
        x: 100,
        y: 80,
      },
      score: 90,
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerShots: [comboKeeperShot],
        },
      },
    });

    expect(ticked.multiKillCombo).toBeNull();
    expect(ticked.score).toBe(90 + SPACE_INVADERS_MULTI_KILL_BONUSES[2]);
    expect(ticked.scorePopups).toEqual([
      expect.objectContaining({
        id: "score-popup-0",
        points: 40 + SPACE_INVADERS_MULTI_KILL_BONUSES[2],
      }),
    ]);
  });

  it("pauses alien fire, UFOs, and formation movement while freeze ticks down", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const firstInvader = initialGame.invaders[0]!;
    const activeUfo = {
      ...initialGame.ufo,
      isActive: true,
      x: 120,
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      alienFreezeTicks: SPACE_INVADERS_ALIEN_FREEZE_TICKS,
      invaderShotCooldownTicks: 0,
      ufo: activeUfo,
    });
    const frozenInvader = ticked.invaders.find(
      (invader) => invader.id === firstInvader.id,
    );

    expect(ticked.alienFreezeTicks).toBe(SPACE_INVADERS_ALIEN_FREEZE_TICKS - 1);
    expect(ticked.invaderShotCooldownTicks).toBe(0);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ufo.x).toBe(activeUfo.x);
    expect(frozenInvader?.x).toBe(firstInvader.x);
  });

  it("advances invader shots and shared formation movement in one tick", () => {
    const shot = createInvaderShotFixture();
    const game = createRunningSpaceInvadersMultiplayerGame({
      invaderShotCooldownTicks: 1_000,
      invaderShots: [shot],
    });
    const firstInvader = game.invaders[0]!;
    const ticked = advanceSpaceInvadersMultiplayerGameTick(game);
    const marchedInvader = ticked.invaders.find(
      (invader) => invader.id === firstInvader.id,
    );

    expect(ticked.invaderShots).toEqual([
      {
        ...shot,
        ageTicks: shot.ageTicks + 1,
        y: shot.y + shot.velocityY,
      },
    ]);
    expect(marchedInvader?.x).toBeGreaterThan(firstInvader.x);
    expect(ticked.ufo.cooldownTicks).toBe(game.ufo.cooldownTicks - 1);
  });

  it("counts down invader fire cooldowns and fires from the nearest active ship target", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const shooter = initialGame.invaders.find(
      (invader) => invader.row === SPACE_INVADERS_ROWS - 1 && invader.column === 7,
    )!;
    const shipBTarget = {
      ...initialGame.ships["ship-b"].player,
      x: shooter.x + shooter.width / 2 - initialGame.ships["ship-b"].player.width / 2,
    };
    const targetedGame: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      invaderShotCooldownTicks: 0,
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          isActive: false,
        },
        "ship-b": {
          ...initialGame.ships["ship-b"],
          player: shipBTarget,
        },
      },
    };
    const cooling = advanceSpaceInvadersMultiplayerGameTick({
      ...targetedGame,
      invaderShotCooldownTicks: 1,
    });
    const fired = advanceSpaceInvadersMultiplayerGameTick(targetedGame);
    const firedShot = fired.invaderShots[0]!;

    expect(cooling.invaderShotCooldownTicks).toBe(0);
    expect(cooling.invaderShots).toEqual([]);
    expect(fired.invaderShots).toHaveLength(1);
    expect(firedShot).toMatchObject({
      id: "invader-shot-0",
      kind: "standard",
      sourceColumn: shooter.column,
      sourceInvaderId: shooter.id,
      sourceRow: shooter.row,
    });
    expect(firedShot.x).toBeCloseTo(shooter.x + shooter.width / 2 - firedShot.width / 2);
    expect(fired.nextInvaderShotId).toBe(1);
    expect(fired.invaderShotCooldownTicks).toBeGreaterThan(0);
  });

  it("creates and continues invader burst fire through the multiplayer tick", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const burstShooter = {
      ...initialGame.invaders.find(
        (invader) => invader.row === 1 && invader.column === 5,
      )!,
      kind: "standard" as const,
    };
    const fired = advanceSpaceInvadersMultiplayerGameTick(
      withOnlyActiveMultiplayerInvader(
        {
          ...initialGame,
          invaderShotCooldownTicks: 0,
        },
        burstShooter,
      ),
    );
    const secondBurstTick = advanceSpaceInvadersMultiplayerGameTick({
      ...fired,
      invaderShotCooldownTicks: 0,
    });

    expect(fired.invaderShots).toHaveLength(1);
    expect(fired.invaderShots[0]).toMatchObject({
      id: "invader-shot-0",
      kind: "burst",
      sourceInvaderId: burstShooter.id,
    });
    expect(fired.invaderBurst).toEqual({
      remainingShots: 2,
      sourceInvaderId: burstShooter.id,
    });
    expect(secondBurstTick.invaderShots).toHaveLength(2);
    expect(secondBurstTick.invaderShots[1]).toMatchObject({
      id: "invader-shot-1",
      kind: "burst",
      sourceInvaderId: burstShooter.id,
    });
    expect(secondBurstTick.invaderBurst).toEqual({
      remainingShots: 1,
      sourceInvaderId: burstShooter.id,
    });
  });

  it("fires pending revenge volleys before frozen alien world progression pauses", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const revengeSource = {
      ...initialGame.invaders.find(
        (invader) => invader.row === 1 && invader.column === 5,
      )!,
      kind: "revenge" as const,
    };
    const shipBTarget = {
      ...initialGame.ships["ship-b"].player,
      x:
        revengeSource.x +
        revengeSource.width / 2 +
        90 -
        initialGame.ships["ship-b"].player.width / 2,
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      withOnlyActiveMultiplayerInvader(
        {
          ...initialGame,
          alienFreezeTicks: 1,
          invaderShotCooldownTicks: 0,
          revengeVolleys: [
            {
              invaderIds: [revengeSource.id],
              ticksRemaining: 1,
            },
          ],
          ships: {
            ...initialGame.ships,
            "ship-a": {
              ...initialGame.ships["ship-a"],
              isActive: false,
            },
            "ship-b": {
              ...initialGame.ships["ship-b"],
              player: shipBTarget,
            },
          },
        },
        revengeSource,
      ),
    );

    expect(ticked.alienFreezeTicks).toBe(0);
    expect(ticked.revengeVolleys).toEqual([]);
    expect(ticked.invaderShots).toHaveLength(1);
    expect(ticked.invaderShots[0]).toMatchObject({
      id: "invader-shot-0",
      kind: "counterfire",
      sourceInvaderId: revengeSource.id,
    });
    expect(ticked.invaderShots[0]?.velocityX).toBeGreaterThan(0);
  });

  it("spawns, moves, and deactivates UFOs through shared world ticks", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const spawned = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShotCooldownTicks: 1_000,
      ufo: {
        ...initialGame.ufo,
        cooldownTicks: 0,
      },
    });
    const moved = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShotCooldownTicks: 1_000,
      ufo: spawned.ufo,
    });
    const exited = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShotCooldownTicks: 1_000,
      ufo: {
        ...initialGame.ufo,
        isActive: true,
        x: initialGame.boardWidth - 1,
      },
      ufoHitStreak: 2,
    });

    expect(spawned.ufo).toMatchObject({
      direction: 1,
      isActive: true,
      x: -initialGame.ufo.width,
    });
    expect(moved.ufo.x).toBeCloseTo(spawned.ufo.x + 2.4);
    expect(exited.ufo).toMatchObject({
      direction: -1,
      isActive: false,
      x: initialGame.boardWidth,
    });
    expect(exited.ufoHitStreak).toBe(0);
    expect(exited.ufo.cooldownTicks).toBeGreaterThan(0);
  });

  it("drops and reverses the formation when active invaders hit an edge", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const edgeInvader = {
      ...initialGame.invaders.find(
        (invader) => invader.row === SPACE_INVADERS_ROWS - 1 && invader.column === 0,
      )!,
      x: initialGame.boardWidth - initialGame.invaders[0]!.width - 0.1,
      y: 100,
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      withOnlyActiveMultiplayerInvader(
        {
          ...initialGame,
          invaderShotCooldownTicks: 1_000,
          marchDirection: 1,
        },
        edgeInvader,
      ),
    );
    const droppedInvader = ticked.invaders.find(
      (invader) => invader.id === edgeInvader.id,
    );

    expect(droppedInvader?.x).toBe(edgeInvader.x);
    expect(droppedInvader?.y).toBeCloseTo(edgeInvader.y + 4);
    expect(ticked.marchDirection).toBe(-1);
  });

  it("loses the shared game when an active invader reaches the base", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const baseInvader = {
      ...initialGame.invaders[0]!,
      y: SPACE_INVADERS_BASE_Y - initialGame.invaders[0]!.height + 1,
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      withOnlyActiveMultiplayerInvader(
        {
          ...initialGame,
          invaderShotCooldownTicks: 1_000,
        },
        baseInvader,
      ),
    );

    expect(ticked.status).toBe("lost");
    expect(ticked.lives).toBe(0);
  });

  it("moves invader shots before resolving a ship-a hit", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const hittingShot = createInvaderShotMovingIntoShip(initialGame, "ship-a", {
      id: "moving-hit-ship-a",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShots: [hittingShot],
      },
      {},
      () => 0,
    );

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 1);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(ticked.ships["ship-b"]).toBe(initialGame.ships["ship-b"]);
    expect(ticked.explosions).toHaveLength(1);
  });

  it("moves invader shots before resolving a ship-b hit", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const hittingShot = createInvaderShotMovingIntoShip(initialGame, "ship-b", {
      id: "moving-hit-ship-b",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShots: [hittingShot],
      },
      {},
      () => 0,
    );

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 1);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"]).toBe(initialGame.ships["ship-a"]);
    expect(ticked.ships["ship-b"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(ticked.explosions).toHaveLength(1);
  });

  it("moves one invader shot into overlapping ships and spends shared lives for both", () => {
    const overlappingGame = withOverlappingShips(
      createRunningSpaceInvadersMultiplayerGame(),
    );
    const sharedHit = createInvaderShotMovingIntoShip(overlappingGame, "ship-a", {
      id: "moving-double-hit",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...overlappingGame,
        invaderShots: [sharedHit],
      },
      {},
      () => 0,
    );

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 2);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(ticked.ships["ship-b"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(ticked.explosions).toHaveLength(2);
  });

  it("absorbs moved invader shots with shields through the tick path", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const shieldedHit = createInvaderShotMovingIntoShip(initialGame, "ship-a", {
      id: "shielded-tick-hit",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShots: [shieldedHit],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerShieldTicks: 4,
        },
      },
    });

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerShieldTicks).toBe(3);
    expect(ticked.explosions).toEqual([]);
  });

  it("keeps moved invader shots harmless against respawning and inactive ships", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const respawnHit = createInvaderShotMovingIntoShip(initialGame, "ship-a", {
      id: "respawn-tick-hit",
    });
    const inactiveHit = createInvaderShotMovingIntoShip(initialGame, "ship-b", {
      id: "inactive-tick-hit",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShots: [respawnHit, inactiveHit],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerRespawnTicks: 4,
        },
        "ship-b": {
          ...initialGame.ships["ship-b"],
          isActive: false,
        },
      },
    });

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(ticked.invaderShots).toEqual([
      {
        ...respawnHit,
        ageTicks: respawnHit.ageTicks + 1,
        y: respawnHit.y + respawnHit.velocityY,
      },
      {
        ...inactiveHit,
        ageTicks: inactiveHit.ageTicks + 1,
        y: inactiveHit.y + inactiveHit.velocityY,
      },
    ]);
    expect(ticked.ships["ship-a"].playerRespawnTicks).toBe(3);
    expect(ticked.ships["ship-b"].isActive).toBe(false);
    expect(ticked.explosions).toEqual([]);
  });

  it("removes expired and out-of-bounds invader shots through solo movement", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const outOfBoundsShot = createInvaderShotFixture({
      id: "out-of-bounds",
      y: initialGame.boardHeight,
    });
    const expiredScatter = createInvaderShotFixture({
      id: "expired-scatter",
      kind: "scatter",
      ttlTicks: 1,
      velocityX: 1.25,
      velocityY: 2.8,
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShots: [outOfBoundsShot, expiredScatter],
    });

    expect(ticked.invaderShots).toEqual([]);
  });

  it("chooses deterministic active targets for steering invader shots", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const shipB = initialGame.ships["ship-b"].player;
    const commanderShot = createInvaderShotFixture({
      height: 24,
      id: "commander-targeting",
      kind: "commander",
      sourceRow: 0,
      velocityX: 0,
      velocityY: 2.35,
      width: 8,
      x: shipB.x + shipB.width / 2 - 28,
      y: 100,
    });
    const targetedActiveShipB = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShots: [commanderShot],
    });
    const stableFallbackGame = advanceSpaceInvadersMultiplayerGameTick({
      ...initialGame,
      invaderShots: [commanderShot],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          isActive: false,
        },
        "ship-b": {
          ...initialGame.ships["ship-b"],
          playerRespawnTicks: 4,
        },
      },
    });

    expect(targetedActiveShipB.invaderShots[0]?.velocityX).toBeGreaterThan(0);
    expect(targetedActiveShipB.invaderShots[0]?.x).toBeGreaterThan(commanderShot.x);
    expect(stableFallbackGame.invaderShots[0]?.velocityX).toBeLessThan(0);
    expect(stableFallbackGame.invaderShots[0]?.x).toBeLessThan(commanderShot.x);
  });

  it("destroys opposing player and invader shots through the multiplayer tick", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const invaderShot = createInvaderShotFixture({
      id: "opposing-invader-shot",
      x: 180,
    });
    const collisionY = 300;
    const movedInvaderShot = {
      ...invaderShot,
      y: collisionY,
    };
    const playerShot = createPlayerShotMovingIntoTarget(movedInvaderShot, {
      id: "ship-a-opposing-shot",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...invaderShot,
            y: collisionY - invaderShot.velocityY,
          },
        ],
        ships: {
          ...initialGame.ships,
          "ship-a": {
            ...initialGame.ships["ship-a"],
            playerShots: [playerShot],
            playerVolleyHasArmoredHit: true,
            playerVolleyHasScored: true,
            playerVolleyHasUnscoredExit: true,
          },
        },
      },
      {},
      () => 0,
    );

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.explosions).toEqual([
      expect.objectContaining({
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        kind: "projectile",
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
    expect(ticked.ships["ship-a"].playerVolleyHasArmoredHit).toBe(false);
    expect(ticked.ships["ship-a"].playerVolleyHasScored).toBe(false);
    expect(ticked.ships["ship-a"].playerVolleyHasUnscoredExit).toBe(false);
    expect(ticked.ships["ship-b"]).toBe(initialGame.ships["ship-b"]);
  });

  it("keeps piercing shots and armor waves active after opposing collisions", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const armorWave = createInvaderShotFixture({
      height: 14,
      id: "armor-wave-opposing-shot",
      kind: "armor-wave",
      velocityY: 2,
      width: 56,
      x: 160,
    });
    const collisionY = 260;
    const movedArmorWave = {
      ...armorWave,
      y: collisionY,
    };
    const piercingShot = createPlayerShotMovingIntoTarget(movedArmorWave, {
      height: 44,
      id: "ship-b-piercing-shot",
      kind: "piercing",
      velocityY: -12.8,
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...armorWave,
            y: collisionY - armorWave.velocityY,
          },
        ],
        ships: {
          ...initialGame.ships,
          "ship-b": {
            ...initialGame.ships["ship-b"],
            playerShots: [piercingShot],
          },
        },
      },
      {},
      () => 0,
    );

    expect(ticked.ships["ship-b"].playerShots).toHaveLength(1);
    expect(ticked.ships["ship-b"].playerShots[0]).toMatchObject({
      id: piercingShot.id,
      kind: "piercing",
      x: piercingShot.x,
      y: piercingShot.y + piercingShot.velocityY,
    });
    expect(ticked.invaderShots).toEqual([
      {
        ...armorWave,
        ageTicks: armorWave.ageTicks + 1,
        y: collisionY,
      },
    ]);
    expect(ticked.explosions).toEqual([
      expect.objectContaining({
        height: SPACE_INVADERS_PROJECTILE_EXPLOSION_HEIGHT,
        kind: "projectile",
        width: SPACE_INVADERS_PROJECTILE_EXPLOSION_WIDTH,
      }),
    ]);
  });

  it("splits commander shots into shards through the multiplayer tick", () => {
    const commanderShot = createInvaderShotFixture({
      height: 24,
      id: "commander-opposing-shot",
      kind: "commander",
      sourceColumn: 6,
      sourceInvaderId: "0:6",
      sourceRow: 0,
      velocityY: 2.35,
      width: 8,
      x: 180,
    });
    const collisionY = 300;
    const movedCommanderShot = {
      ...commanderShot,
      y: collisionY,
    };
    const playerShot = createPlayerShotMovingIntoTarget(movedCommanderShot, {
      id: "commander-trigger-shot",
    });
    const commanderGame = createRunningSpaceInvadersMultiplayerGame({
      nextInvaderShotId: 9,
    });
    const initialGame = withShipPlayer(
      commanderGame,
      "ship-a",
      {
        x:
          commanderShot.x +
          commanderShot.width / 2 -
          commanderGame.ships["ship-a"].player.width / 2,
      },
    );
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...commanderShot,
            y: collisionY - commanderShot.velocityY,
          },
        ],
        ships: {
          ...initialGame.ships,
          "ship-a": {
            ...initialGame.ships["ship-a"],
            playerShots: [playerShot],
          },
        },
      },
      {},
      () => 0,
    );
    const [leftShard, rightShard] = ticked.invaderShots;

    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
    expect(ticked.invaderShots.map((shot) => shot.kind)).toEqual([
      "commander-shard",
      "commander-shard",
    ]);
    expect(ticked.invaderShots.map((shot) => shot.id)).toEqual([
      "invader-shot-9",
      "invader-shot-10",
    ]);
    expect(leftShard).toMatchObject({
      height: 12,
      sourceColumn: commanderShot.sourceColumn,
      sourceInvaderId: commanderShot.sourceInvaderId,
      sourceRow: commanderShot.sourceRow,
      ttlTicks: null,
      velocityY: 2.35 * 0.8,
      width: 4,
    });
    expect(leftShard?.velocityX).toBeLessThan(0);
    expect(rightShard?.velocityX).toBeGreaterThan(0);
    expect(leftShard?.targetOffsetX).toBeLessThan(0);
    expect(rightShard?.targetOffsetX).toBeGreaterThan(0);
    expect(ticked.nextInvaderShotId).toBe(11);
    expect(ticked.explosions).toEqual([
      expect.objectContaining({
        kind: "projectile",
      }),
    ]);
  });

  it("removes collided player shots from only their owning ship queue", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const invaderShot = createInvaderShotFixture({
      id: "queue-cleanup-invader-shot",
      x: 180,
    });
    const collisionY = 300;
    const movedInvaderShot = {
      ...invaderShot,
      y: collisionY,
    };
    const collidingShot = createPlayerShotMovingIntoTarget(movedInvaderShot, {
      id: "ship-a-colliding-shot",
    });
    const remainingShot = {
      ...createPlayerShotAlignedWith({
        height: 20,
        width: 5,
        x: 20,
        y: 340,
      }),
      id: "ship-b-remaining-shot",
      x: 20,
      y: 340,
    };
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...invaderShot,
            y: collisionY - invaderShot.velocityY,
          },
        ],
        ships: {
          ...initialGame.ships,
          "ship-a": {
            ...initialGame.ships["ship-a"],
            playerShots: [collidingShot],
            playerVolleyHasArmoredHit: true,
            playerVolleyHasScored: true,
            playerVolleyHasUnscoredExit: true,
          },
          "ship-b": {
            ...initialGame.ships["ship-b"],
            playerShots: [remainingShot],
            playerVolleyHasArmoredHit: true,
            playerVolleyHasScored: true,
            playerVolleyHasUnscoredExit: true,
          },
        },
      },
      {},
      () => 0,
    );

    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerVolleyHasArmoredHit).toBe(false);
    expect(ticked.ships["ship-a"].playerVolleyHasScored).toBe(false);
    expect(ticked.ships["ship-a"].playerVolleyHasUnscoredExit).toBe(false);
    expect(ticked.ships["ship-b"].playerShots).toEqual([
      {
        ...remainingShot,
        hasScored: true,
        y: remainingShot.y + remainingShot.velocityY,
      },
    ]);
    expect(ticked.ships["ship-b"].playerVolleyHasArmoredHit).toBe(true);
    expect(ticked.ships["ship-b"].playerVolleyHasScored).toBe(true);
    expect(ticked.ships["ship-b"].playerVolleyHasUnscoredExit).toBe(true);
  });

  it("detonates mines intercepted by player shots through the multiplayer tick", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const movedMine = createInvaderShotFixture({
      height: 18,
      id: "intercepted-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: 200,
      y: 260,
    });
    const playerShot = createPlayerShotMovingIntoTarget(movedMine, {
      id: "mine-trigger-shot",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...movedMine,
            y: movedMine.y - movedMine.velocityY,
          },
        ],
        invaders: initialGame.invaders.map((invader) => ({
          ...invader,
          isActive: false,
        })),
        ships: {
          ...initialGame.ships,
          "ship-a": {
            ...initialGame.ships["ship-a"],
            playerShots: [playerShot],
          },
        },
      },
      {},
      () => 0,
    );

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
    expect(ticked.explosions.map((explosion) => explosion.kind)).toEqual(["mine"]);
  });

  it("chains mine detonations when a multiplayer blast reaches another mine", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const firstMine = createInvaderShotFixture({
      height: 18,
      id: "first-chain-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: 200,
      y: 260,
    });
    const secondMine = createInvaderShotFixture({
      height: 18,
      id: "second-chain-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: 240,
      y: 260,
    });
    const playerShot = createPlayerShotMovingIntoTarget(firstMine, {
      id: "chain-trigger-shot",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...firstMine,
            y: firstMine.y - firstMine.velocityY,
          },
          {
            ...secondMine,
            y: secondMine.y - secondMine.velocityY,
          },
        ],
        invaders: initialGame.invaders.map((invader) => ({
          ...invader,
          isActive: false,
        })),
        ships: {
          ...initialGame.ships,
          "ship-a": {
            ...initialGame.ships["ship-a"],
            playerShots: [playerShot],
          },
        },
      },
      {},
      () => 0,
    );

    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
    expect(ticked.explosions.filter((explosion) => explosion.kind === "mine")).toHaveLength(
      2,
    );
  });

  it("damages one vulnerable ship when a mine blast catches it", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame({
      invaderBurst: {
        remainingShots: 2,
        sourceInvaderId: "1:5",
      },
    });
    const shipA = initialGame.ships["ship-a"].player;
    const movedMine = createInvaderShotFixture({
      height: 18,
      id: "single-ship-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: shipA.x + shipA.width / 2 - 9,
      y: shipA.y - 42,
    });
    const playerShot = createPlayerShotMovingIntoTarget(movedMine, {
      id: "single-ship-mine-trigger",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...movedMine,
            y: movedMine.y - movedMine.velocityY,
          },
        ],
        ships: {
          ...initialGame.ships,
          "ship-a": {
            ...initialGame.ships["ship-a"],
            playerBurst: {
              cooldownTicks: 2,
              remainingShots: 1,
            },
            playerShots: [playerShot],
          },
        },
      },
      {},
      () => 0,
    );

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 1);
    expect(ticked.invaderBurst).toBeNull();
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerBurst).toBeNull();
    expect(ticked.ships["ship-a"].playerShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(ticked.ships["ship-b"]).toBe(initialGame.ships["ship-b"]);
    expect(ticked.explosions.map((explosion) => explosion.kind)).toEqual([
      "mine",
      "player",
    ]);
  });

  it("damages both vulnerable ships from a shared mine blast", () => {
    const overlappingGame = withOverlappingShips(
      createRunningSpaceInvadersMultiplayerGame(),
    );
    const shipA = overlappingGame.ships["ship-a"].player;
    const movedMine = createInvaderShotFixture({
      height: 18,
      id: "double-ship-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: shipA.x + shipA.width / 2 - 9,
      y: shipA.y - 42,
    });
    const playerShot = createPlayerShotMovingIntoTarget(movedMine, {
      id: "double-ship-mine-trigger",
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...overlappingGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...movedMine,
            y: movedMine.y - movedMine.velocityY,
          },
        ],
        ships: {
          ...overlappingGame.ships,
          "ship-a": {
            ...overlappingGame.ships["ship-a"],
            playerShots: [playerShot],
          },
        },
      },
      {},
      () => 0,
    );
    const scarceLivesTick = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...overlappingGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...movedMine,
            y: movedMine.y - movedMine.velocityY,
          },
        ],
        lives: 1,
        ships: {
          ...overlappingGame.ships,
          "ship-a": {
            ...overlappingGame.ships["ship-a"],
            playerShots: [playerShot],
          },
        },
      },
      {},
      createRandomSequence([0, 0.99, 0, 0]),
    );

    expect(ticked.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 2);
    expect(ticked.invaderShots).toEqual([]);
    expect(ticked.ships["ship-a"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(ticked.ships["ship-b"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(ticked.explosions.map((explosion) => explosion.kind)).toEqual([
      "mine",
      "player",
      "player",
    ]);
    expect(scarceLivesTick.lives).toBe(0);
    expect(scarceLivesTick.status).toBe("running");
    expect(scarceLivesTick.ships["ship-a"].isActive).toBe(false);
    expect(scarceLivesTick.ships["ship-a"].playerRespawnTicks).toBe(0);
    expect(scarceLivesTick.ships["ship-b"].isActive).toBe(true);
    expect(scarceLivesTick.ships["ship-b"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
  });

  it("keeps shielded, respawning, and inactive ships immune to mine blasts", () => {
    const overlappingGame = withOverlappingShips(
      createRunningSpaceInvadersMultiplayerGame(),
    );
    const sharedMine = createInvaderShotFixture({
      height: 18,
      id: "shield-respawn-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: overlappingGame.ships["ship-a"].player.x + 12,
      y: overlappingGame.ships["ship-a"].player.y - 42,
    });
    const shieldRespawnTick = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...overlappingGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...sharedMine,
            y: sharedMine.y - sharedMine.velocityY,
          },
        ],
        ships: {
          ...overlappingGame.ships,
          "ship-a": {
            ...overlappingGame.ships["ship-a"],
            playerShieldTicks: 4,
            playerShots: [
              createPlayerShotMovingIntoTarget(sharedMine, {
                id: "shield-respawn-trigger",
              }),
            ],
          },
          "ship-b": {
            ...overlappingGame.ships["ship-b"],
            playerRespawnTicks: 4,
          },
        },
      },
      {},
      () => 0,
    );
    const inactiveGame = createRunningSpaceInvadersMultiplayerGame();
    const inactiveMine = createInvaderShotFixture({
      height: 18,
      id: "inactive-ship-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: inactiveGame.ships["ship-b"].player.x + 12,
      y: inactiveGame.ships["ship-b"].player.y - 42,
    });
    const inactiveTick = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...inactiveGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...inactiveMine,
            y: inactiveMine.y - inactiveMine.velocityY,
          },
        ],
        ships: {
          ...inactiveGame.ships,
          "ship-a": {
            ...inactiveGame.ships["ship-a"],
            playerShots: [
              createPlayerShotMovingIntoTarget(inactiveMine, {
                id: "inactive-ship-trigger",
              }),
            ],
          },
          "ship-b": {
            ...inactiveGame.ships["ship-b"],
            isActive: false,
          },
        },
      },
      {},
      () => 0,
    );

    expect(shieldRespawnTick.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(shieldRespawnTick.ships["ship-a"].playerShieldTicks).toBe(3);
    expect(shieldRespawnTick.ships["ship-b"].playerRespawnTicks).toBe(3);
    expect(shieldRespawnTick.explosions.map((explosion) => explosion.kind)).toEqual([
      "mine",
    ]);
    expect(inactiveTick.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(inactiveTick.ships["ship-b"].isActive).toBe(false);
    expect(inactiveTick.explosions.map((explosion) => explosion.kind)).toEqual([
      "mine",
    ]);
  });

  it("applies mine blast invader damage with scoring, drops, popups, and revenge", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const [standardSource, diverSource, revengeSource, survivorSource] =
      initialGame.invaders;
    const standardTarget = {
      ...standardSource!,
      hitPoints: 1,
      isActive: true,
      kind: "standard" as const,
      x: 225,
      y: 250,
    };
    const diverTarget = {
      ...diverSource!,
      hitPoints: 1,
      isActive: true,
      kind: "diver" as const,
      x: 285,
      y: 250,
    };
    const revengeTarget = {
      ...revengeSource!,
      hitPoints: 1,
      isActive: true,
      kind: "revenge" as const,
      x: 300,
      y: 250,
    };
    const survivor = {
      ...survivorSource!,
      hitPoints: 1,
      isActive: true,
      kind: "standard" as const,
      x: 340,
      y: 250,
    };
    const armoredTarget = {
      ...initialGame.invaders[4]!,
      hitPoints: SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
      isActive: true,
      kind: "armored" as const,
      x: 235,
      y: 290,
    };
    const movedMine = createInvaderShotFixture({
      height: 18,
      id: "invader-damage-mine",
      kind: "mine",
      velocityY: 1.55,
      width: 18,
      x: 260,
      y: 260,
    });
    const expectedDestroyedPoints =
      standardTarget.points + diverTarget.points + revengeTarget.points;
    const ticked = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...initialGame,
        invaderShotCooldownTicks: 1_000,
        invaderShots: [
          {
            ...movedMine,
            y: movedMine.y - movedMine.velocityY,
          },
        ],
        invaders: initialGame.invaders.map((invader) => {
          if (invader.id === standardTarget.id) {
            return standardTarget;
          }

          if (invader.id === diverTarget.id) {
            return diverTarget;
          }

          if (invader.id === revengeTarget.id) {
            return revengeTarget;
          }

          if (invader.id === survivor.id) {
            return survivor;
          }

          if (invader.id === armoredTarget.id) {
            return armoredTarget;
          }

          return {
            ...invader,
            isActive: false,
          };
        }),
        ships: {
          ...initialGame.ships,
          "ship-a": {
            ...initialGame.ships["ship-a"],
            playerShots: [
              createPlayerShotMovingIntoTarget(movedMine, {
                id: "invader-damage-trigger",
              }),
            ],
          },
        },
      },
      {},
      () => 0,
    );
    const armoredAfterBlast = ticked.invaders.find(
      (invader) => invader.id === armoredTarget.id,
    );
    const finalizedCombo = advanceSpaceInvadersMultiplayerGameTick(
      {
        ...ticked,
        alienFreezeTicks: 1,
        invaderShotCooldownTicks: 1_000,
      },
      {},
      () => 0,
    );

    expect(ticked.score).toBe(expectedDestroyedPoints);
    expect(ticked.status).toBe("running");
    expect(
      ticked.invaders
        .filter((invader) => !invader.isActive)
        .map((invader) => invader.id),
    ).toEqual(
      expect.arrayContaining([
        standardTarget.id,
        diverTarget.id,
        revengeTarget.id,
      ]),
    );
    expect(armoredAfterBlast).toMatchObject({
      hitPoints: SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS - 1,
      isActive: true,
    });
    expect(ticked.explosions.filter((explosion) => explosion.kind === "invader")).toHaveLength(
      3,
    );
    expect(ticked.powerUps).toHaveLength(1);
    expect(ticked.powerUps[0]).toMatchObject({
      id: "power-up-0",
    });
    expect(ticked.revengeVolleys).toEqual([
      {
        invaderIds: [survivor.id, armoredTarget.id],
        ticksRemaining: SPACE_INVADERS_REVENGE_VOLLEY_WINDUP_TICKS,
      },
    ]);
    expect(ticked.multiKillCombo).toMatchObject({
      destroyedCount: 3,
      points: expectedDestroyedPoints,
    });
    expect(finalizedCombo.multiKillCombo).toBeNull();
    expect(finalizedCombo.score).toBe(
      expectedDestroyedPoints + SPACE_INVADERS_MULTI_KILL_BONUSES[3],
    );
    expect(finalizedCombo.scorePopups).toEqual([
      expect.objectContaining({
        points: expectedDestroyedPoints + SPACE_INVADERS_MULTI_KILL_BONUSES[3],
      }),
    ]);
  });

  it("destroys one vulnerable ship, spends one shared life, and consumes the hitting shot", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame({
      hitStreak: 3,
      invaderBurst: {
        remainingShots: 2,
        sourceInvaderId: "1:5",
      },
    });
    const hittingShot = createInvaderShotTouchingShip(initialGame, "ship-a", {
      id: "hit-ship-a",
    });
    const missedShot = createInvaderShotFixture({
      id: "miss",
      x: 0,
      y: 0,
    });
    const game: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      invaderShots: [hittingShot, missedShot],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          pendingShotPowerUp: "piercing-laser",
          playerBurst: {
            cooldownTicks: 2,
            remainingShots: 3,
          },
          playerShots: [
            {
              height: 14,
              id: "player-shot-test",
              kind: "standard",
              velocityX: 0,
              velocityY: -16,
              width: 4,
              x: 10,
              y: 10,
            },
          ],
          playerVolleyHasArmoredHit: true,
          playerVolleyHasScored: true,
          playerVolleyHasUnscoredExit: true,
        },
      },
    };
    const resolved = resolveSpaceInvadersMultiplayerInvaderShotHits(
      game,
      () => 0,
    );

    expect(resolved.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 1);
    expect(resolved.status).toBe("running");
    expect(resolved.invaderShots).toEqual([missedShot]);
    expect(resolved.invaderBurst).toBeNull();
    expect(resolved.hitStreak).toBe(0);
    expect(resolved.ships["ship-a"].isActive).toBe(true);
    expect(resolved.ships["ship-a"].pendingShotPowerUp).toBe("piercing-laser");
    expect(resolved.ships["ship-a"].playerBurst).toBeNull();
    expect(resolved.ships["ship-a"].playerShots).toEqual([]);
    expect(resolved.ships["ship-a"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(resolved.ships["ship-a"].playerShieldTicks).toBe(0);
    expect(resolved.ships["ship-a"].playerVolleyHasArmoredHit).toBe(false);
    expect(resolved.ships["ship-a"].playerVolleyHasScored).toBe(false);
    expect(resolved.ships["ship-a"].playerVolleyHasUnscoredExit).toBe(false);
    expect(resolved.ships["ship-a"].player.x).toBe(
      initialGame.ships["ship-a"].player.x,
    );
    expect(resolved.ships["ship-b"]).toBe(game.ships["ship-b"]);
    expect(resolved.explosions[0]).toMatchObject({
      id: "explosion-0",
      kind: "player",
      variant: 1,
    });
  });

  it("destroys both ships from one shared shot and spends two shared lives when available", () => {
    const overlappingGame = withOverlappingShips(
      createRunningSpaceInvadersMultiplayerGame(),
    );
    const sharedHit = createInvaderShotTouchingShip(overlappingGame, "ship-a", {
      id: "double-hit",
    });
    const resolved = resolveSpaceInvadersMultiplayerInvaderShotHits(
      {
        ...overlappingGame,
        invaderShots: [sharedHit],
      },
      () => 0,
    );

    expect(resolved.lives).toBe(SPACE_INVADERS_STARTING_LIVES - 2);
    expect(resolved.invaderShots).toEqual([]);
    expect(resolved.ships["ship-a"].isActive).toBe(true);
    expect(resolved.ships["ship-b"].isActive).toBe(true);
    expect(resolved.ships["ship-a"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(resolved.ships["ship-b"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(resolved.explosions).toHaveLength(2);
  });

  it("randomly chooses the only respawning ship when a double hit has one shared life", () => {
    const overlappingGame = withOverlappingShips(
      createRunningSpaceInvadersMultiplayerGame({
        lives: 1,
      }),
    );
    const sharedHit = createInvaderShotTouchingShip(overlappingGame, "ship-a", {
      id: "double-hit",
    });
    const resolved = resolveSpaceInvadersMultiplayerInvaderShotHits(
      {
        ...overlappingGame,
        invaderShots: [sharedHit],
      },
      createRandomSequence([0.99, 0, 0]),
    );

    expect(resolved.lives).toBe(0);
    expect(resolved.status).toBe("running");
    expect(resolved.ships["ship-a"].isActive).toBe(false);
    expect(resolved.ships["ship-a"].playerRespawnTicks).toBe(0);
    expect(resolved.ships["ship-b"].isActive).toBe(true);
    expect(resolved.ships["ship-b"].playerRespawnTicks).toBe(
      SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
    );
    expect(resolved.invaderShots).toEqual([]);
  });

  it("prevents shielded and respawning ships from taking damage with solo-style shot handling", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const game: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      invaderShots: [
        createInvaderShotTouchingShip(initialGame, "ship-a", {
          id: "shielded-hit",
        }),
        createInvaderShotTouchingShip(initialGame, "ship-b", {
          id: "respawn-hit",
        }),
      ],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerShieldTicks: 4,
        },
        "ship-b": {
          ...initialGame.ships["ship-b"],
          playerRespawnTicks: 4,
        },
      },
    };
    const resolved = resolveSpaceInvadersMultiplayerInvaderShotHits(game);

    expect(resolved.lives).toBe(SPACE_INVADERS_STARTING_LIVES);
    expect(resolved.explosions).toEqual([]);
    expect(resolved.ships).toBe(game.ships);
    expect(resolved.invaderShots).toEqual([game.invaderShots[1]]);
  });

  it("blocks movement and firing for ships that no longer have a respawn life", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const game: SpaceInvadersMultiplayerGameState = {
      ...initialGame,
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          isActive: false,
        },
      },
    };

    expect(moveSpaceInvadersMultiplayerShip(game, "ship-a", 10)).toBe(game);
    expect(fireSpaceInvadersMultiplayerShipShot(game, "ship-a")).toBe(game);
    expect(moveSpaceInvadersMultiplayerShip(game, "ship-b", 10)).not.toBe(game);
  });

  it("awards a touched shot power-up to the collecting ship only", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const powerUp = createPowerUpTouchingShip(initialGame, "ship-a", {
      kind: "piercing-laser",
    });
    const resolved = resolveSpaceInvadersMultiplayerPowerUpPickup({
      ...initialGame,
      powerUps: [powerUp],
    });

    expect(resolved.powerUps).toEqual([]);
    expect(resolved.ships["ship-a"].pendingShotPowerUp).toBe("piercing-laser");
    expect(resolved.ships["ship-b"].pendingShotPowerUp).toBeNull();
  });

  it("randomly chooses the recipient when both ships touch the same power-up", () => {
    const overlappingGame = withOverlappingShips(
      createRunningSpaceInvadersMultiplayerGame(),
    );
    const powerUp = createPowerUpTouchingShip(overlappingGame, "ship-a", {
      kind: "shield",
    });
    const resolved = resolveSpaceInvadersMultiplayerPowerUpPickup(
      {
        ...overlappingGame,
        powerUps: [powerUp],
      },
      () => 0.99,
    );

    expect(resolved.powerUps).toEqual([]);
    expect(resolved.ships["ship-a"].playerShieldTicks).toBe(0);
    expect(resolved.ships["ship-b"].playerShieldTicks).toBe(
      SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
    );
  });

  it("applies power-ups to shared state or the receiving ship state", () => {
    const initialGame = createRunningSpaceInvadersMultiplayerGame();
    const bonusPowerUp = createPowerUpTouchingShip(initialGame, "ship-a", {
      kind: "bonus-score",
    });
    const extraLifePowerUp = createPowerUpTouchingShip(initialGame, "ship-a", {
      kind: "extra-life",
    });
    const freezePowerUp = createPowerUpTouchingShip(initialGame, "ship-a", {
      kind: "freeze",
    });
    const shieldPowerUp = createPowerUpTouchingShip(initialGame, "ship-a", {
      kind: "shield",
    });
    const bonusScored = resolveSpaceInvadersMultiplayerPowerUpPickup({
      ...initialGame,
      powerUps: [bonusPowerUp],
      score: 40,
    });
    const extraLife = resolveSpaceInvadersMultiplayerPowerUpPickup({
      ...initialGame,
      lives: 2,
      powerUps: [extraLifePowerUp],
    });
    const frozen = resolveSpaceInvadersMultiplayerPowerUpPickup({
      ...initialGame,
      alienFreezeTicks: 1,
      powerUps: [freezePowerUp],
    });
    const shielded = resolveSpaceInvadersMultiplayerPowerUpPickup({
      ...initialGame,
      powerUps: [shieldPowerUp],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerShieldTicks: 1,
        },
      },
    });

    expect(bonusScored.score).toBe(40 + SPACE_INVADERS_BONUS_SCORE_POINTS);
    expect(bonusScored.scorePopups).toEqual([
      {
        ageTicks: 0,
        height: bonusPowerUp.height,
        id: "score-popup-0",
        points: SPACE_INVADERS_BONUS_SCORE_POINTS,
        ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
        width: bonusPowerUp.width,
        x: bonusPowerUp.x,
        y: bonusPowerUp.y,
      },
    ]);
    expect(extraLife.lives).toBe(3);
    expect(frozen.alienFreezeTicks).toBe(SPACE_INVADERS_ALIEN_FREEZE_TICKS);
    expect(shielded.ships["ship-a"].playerShieldTicks).toBe(
      SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
    );

    for (const kind of ["burst-shot", "piercing-laser", "shotgun-shot"] as const) {
      const powered = resolveSpaceInvadersMultiplayerPowerUpPickup({
        ...initialGame,
        powerUps: [
          createPowerUpTouchingShip(initialGame, "ship-b", {
            kind,
          }),
        ],
      });

      expect(powered.ships["ship-a"].pendingShotPowerUp).toBeNull();
      expect(powered.ships["ship-b"].pendingShotPowerUp).toBe(kind);
    }
  });

  it("exposes stable room seat metadata and snapshot-friendly types", () => {
    const game = createInitialSpaceInvadersMultiplayerGame();
    const gameSnapshot: SpaceInvadersMultiplayerGameSnapshot = {
      gameId: "space-invaders",
      seq: 12,
      serverTimeMs: 1_000,
      snapshot: game,
    };
    const roomSnapshot: SpaceInvadersMultiplayerRoomSnapshot = {
      game: gameSnapshot,
      room: {
        code: "SPACE-ROOM",
        hostParticipantId: "host",
        participants: [],
        seats: [],
        settings: {
          gameId: "space-invaders",
        },
        status: "lobby",
      },
      seq: 24,
    };

    expect(SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS).toEqual(["ship-a", "ship-b"]);
    expect(SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS).toEqual([
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
    ]);
    expect(isSpaceInvadersShipSeat("ship-a")).toBe(true);
    expect(isSpaceInvadersShipSeat("ship-b")).toBe(true);
    expect(isSpaceInvadersShipSeat("left")).toBe(false);
    expect(roomSnapshot.game?.snapshot.ships["ship-a"].seat).toBe("ship-a");
  });

  it("deep-clones multiplayer state for immutable server snapshots", () => {
    const initialGame = createInitialSpaceInvadersMultiplayerGame({ random: () => 0 });
    const game = {
      ...initialGame,
      explosions: [createExplosionFixture()],
      invaderBurst: {
        remainingShots: 2,
        sourceInvaderId: "1:5",
      },
      invaderShots: [createInvaderShotFixture()],
      multiKillCombo: {
        destroyedCount: 2,
        height: 24,
        points: 50,
        ticksRemaining: 4,
        width: 60,
        x: 120,
        y: 80,
      },
      powerUps: [createPowerUpFixture()],
      revengeVolleys: [
        {
          invaderIds: ["0:0", "0:1"],
          ticksRemaining: 8,
        },
      ],
      scorePopups: [createScorePopupFixture()],
      ships: {
        ...initialGame.ships,
        "ship-a": {
          ...initialGame.ships["ship-a"],
          playerBurst: {
            cooldownTicks: 2,
            remainingShots: 3,
          },
          playerShots: [
            {
              damagedInvaderIds: ["0:0"],
              hasScored: true,
              height: 14,
              id: "ship-a-shot",
              kind: "piercing" as const,
              velocityX: 0,
              velocityY: -16,
              width: 4,
              x: 10,
              y: 10,
            },
          ],
        },
      },
    };
    const cloned = cloneSpaceInvadersMultiplayerGame(game);

    expect(cloned).toEqual(game);
    expect(cloned).not.toBe(game);
    expect(cloned.invaders).not.toBe(game.invaders);
    expect(cloned.invaders[0]).not.toBe(game.invaders[0]);
    expect(cloned.invaderBurst).not.toBe(game.invaderBurst);
    expect(cloned.invaderShots[0]).not.toBe(game.invaderShots[0]);
    expect(cloned.multiKillCombo).not.toBe(game.multiKillCombo);
    expect(cloned.powerUps[0]).not.toBe(game.powerUps[0]);
    expect(cloned.revengeVolleys[0]).not.toBe(game.revengeVolleys[0]);
    expect(cloned.revengeVolleys[0]?.invaderIds).not.toBe(
      game.revengeVolleys[0]?.invaderIds,
    );
    expect(cloned.scorePopups[0]).not.toBe(game.scorePopups[0]);
    expect(cloned.ufo).not.toBe(game.ufo);
    expect(cloned.ships).not.toBe(game.ships);
    expect(cloned.ships["ship-a"]).not.toBe(game.ships["ship-a"]);
    expect(cloned.ships["ship-a"].player).not.toBe(game.ships["ship-a"].player);
    expect(cloned.ships["ship-a"].playerBurst).not.toBe(
      game.ships["ship-a"].playerBurst,
    );
    expect(cloned.ships["ship-a"].playerShots[0]).not.toBe(
      game.ships["ship-a"].playerShots[0],
    );
    expect(cloned.ships["ship-a"].playerShots[0]?.damagedInvaderIds).not.toBe(
      game.ships["ship-a"].playerShots[0]?.damagedInvaderIds,
    );

    cloned.ships["ship-a"].player.x = 0;
    cloned.ships["ship-a"].playerShots[0]?.damagedInvaderIds?.push("0:2");
    cloned.revengeVolleys[0]?.invaderIds.push("0:2");

    expect(game.ships["ship-a"].player.x).not.toBe(0);
    expect(game.ships["ship-a"].playerShots[0]?.damagedInvaderIds).toEqual(["0:0"]);
    expect(game.revengeVolleys[0]?.invaderIds).toEqual(["0:0", "0:1"]);
  });
});
