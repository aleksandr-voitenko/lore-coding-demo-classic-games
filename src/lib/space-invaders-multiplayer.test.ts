import { describe, expect, it } from "vitest";

import {
  createExplosionFixture,
  createInitialSpaceInvadersGame,
  createInvaderShotFixture,
  createPowerUpFixture,
  createRandomSequence,
  createPlayerShotAlignedWith,
  SPACE_INVADERS_ALIEN_FREEZE_TICKS,
  SPACE_INVADERS_BONUS_SCORE_POINTS,
  createScorePopupFixture,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_PLAYER_BURST_SHOT_COUNT,
  SPACE_INVADERS_PLAYER_BURST_SHOT_DELAY_TICKS,
  SPACE_INVADERS_PLAYER_RESPAWN_TICKS,
  SPACE_INVADERS_PLAYER_SHIELD_TICKS,
  SPACE_INVADERS_POWER_UP_SHIELD_TICKS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
  SPACE_INVADERS_STARTING_LIVES,
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

  it("leaves invader shots and shared wave movement for the follow-up tick slice", () => {
    const game = createRunningSpaceInvadersMultiplayerGame({
      invaderShots: [createInvaderShotFixture()],
    });
    const ticked = advanceSpaceInvadersMultiplayerGameTick(game);

    expect(ticked.invaderShots).toEqual(game.invaderShots);
    expect(ticked.invaders).toEqual(game.invaders);
    expect(ticked.ufo).toEqual(game.ufo);
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
