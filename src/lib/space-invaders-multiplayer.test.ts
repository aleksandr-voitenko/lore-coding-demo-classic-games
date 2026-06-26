import { describe, expect, it } from "vitest";

import {
  createExplosionFixture,
  createInitialSpaceInvadersGame,
  createInvaderShotFixture,
  createPowerUpFixture,
  createScorePopupFixture,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_STARTING_LIVES,
} from "./space-invaders-game-engine.test-helpers";
import {
  cloneSpaceInvadersMultiplayerGame,
  createInitialSpaceInvadersMultiplayerGame,
  isSpaceInvadersShipSeat,
  SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS,
  SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS,
  type SpaceInvadersMultiplayerGameSnapshot,
  type SpaceInvadersMultiplayerRoomSnapshot,
} from "./space-invaders-multiplayer";

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
