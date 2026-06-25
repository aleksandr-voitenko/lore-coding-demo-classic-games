import { describe, expect, it } from "vitest";

import {
  addPrivateRoomGuestParticipantAsObserver,
  claimPrivateRoomSeat,
  createPrivateRoom,
  type PrivateRoom,
  type PrivateRoomOperationResult,
  type PrivateRoomSettings,
} from "./multiplayer/room";
import {
  createInitialPongGame,
  getPongBallRadius,
  getPongTickDelay,
  PONG_BOARD_HEIGHT,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
} from "./pong-game-engine";
import {
  advancePongMultiplayerTick,
  applyPongMultiplayerHeldInputs,
  createInitialPongMultiplayerGame,
  getPongMultiplayerParticipantSide,
  parsePongMultiplayerRoomSettings,
  pausePongMultiplayerGame,
  projectPongMultiplayerGame,
  restartPongMultiplayerGame,
  resumePongMultiplayerGame,
  startPongMultiplayerGame,
} from "./pong-multiplayer";

const HOST_ID = "host-participant";
const HOST_USER_ID = "user-1";
const LEFT_GUEST_ID = "guest-left";
const RIGHT_GUEST_ID = "guest-right";

const PONG_SEATS = [
  {
    id: "left",
    label: "Left Paddle",
    required: true,
  },
  {
    id: "right",
    label: "Right Paddle",
    required: true,
  },
] as const;

function expectRoom(result: ReturnType<typeof createPrivateRoom>) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.room;
}

function expectUpdatedRoom(result: PrivateRoomOperationResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.room;
}

function createLobbyRoom(settings: PrivateRoomSettings = { gameId: "pong" }) {
  return expectRoom(
    createPrivateRoom({
      code: "pong-room",
      host: {
        displayName: "Ada Host",
        participantId: HOST_ID,
        userId: HOST_USER_ID,
      },
      seats: PONG_SEATS,
      settings,
    }),
  );
}

function addObserver(room: PrivateRoom, participantId: string) {
  return expectUpdatedRoom(
    addPrivateRoomGuestParticipantAsObserver(room, {
      displayName: "Guest Player",
      participantId,
    }),
  );
}

function claimSeat(room: PrivateRoom, participantId: string, seatId: "left" | "right") {
  return expectUpdatedRoom(claimPrivateRoomSeat(room, { participantId, seatId }));
}

function createReadyRoom(settings: PrivateRoomSettings = { gameId: "pong" }) {
  return claimSeat(
    claimSeat(addObserver(createLobbyRoom(settings), RIGHT_GUEST_ID), HOST_ID, "left"),
    RIGHT_GUEST_ID,
    "right",
  );
}

describe("pong multiplayer adapter", () => {
  it("parses launcher-style room settings into Pong game options", () => {
    expect(
      parsePongMultiplayerRoomSettings({
        "pong-board-size": "480x640",
        "pong-target": "7",
      }),
    ).toEqual({
      boardHeight: 640,
      boardWidth: 480,
      targetScore: 7,
    });

    expect(
      parsePongMultiplayerRoomSettings({
        "pong-board-size": "not-a-size",
        "pong-target": "not-a-target",
      }),
    ).toEqual({});
  });

  it("creates initial Pong multiplayer game state from an occupied Pong room", () => {
    const result = createInitialPongMultiplayerGame(
      createReadyRoom({
        gameId: "pong",
        parameters: {
          "pong-board-size": "480x640",
          "pong-target": "7",
        },
      }),
    );

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error(result.error);
    }

    expect(result.game).toMatchObject({
      boardHeight: 640,
      boardWidth: 480,
      score: {
        cpu: 0,
        player: 0,
      },
      status: "ready",
      targetScore: 7,
    });
  });

  it("rejects non-Pong rooms before creating game state or mapping participants", () => {
    const room = createReadyRoom({ gameId: "snake" });

    expect(createInitialPongMultiplayerGame(room)).toEqual({
      code: "unsupported-room-game",
      error: "Pong multiplayer only supports Pong rooms.",
      success: false,
    });
    expect(getPongMultiplayerParticipantSide(room, HOST_ID)).toEqual({
      code: "unsupported-room-game",
      error: "Pong multiplayer only supports Pong rooms.",
      success: false,
    });
  });

  it("rejects Pong rooms without occupied required left and right seats", () => {
    const room = claimSeat(createLobbyRoom(), HOST_ID, "left");

    expect(createInitialPongMultiplayerGame(room)).toEqual({
      code: "missing-required-seats",
      error: "Pong multiplayer requires occupied required left and right seats.",
      success: false,
    });
  });

  it("maps occupied left and right room seats to Pong sides", () => {
    const room = createReadyRoom();

    expect(getPongMultiplayerParticipantSide(room, HOST_ID)).toEqual({
      side: "left",
      success: true,
    });
    expect(getPongMultiplayerParticipantSide(room, RIGHT_GUEST_ID)).toEqual({
      side: "right",
      success: true,
    });
  });

  it("rejects unknown, observer, and otherwise unseated participants", () => {
    const roomWithObserver = addObserver(createReadyRoom(), "observer-1");
    const roomWithUnseatedHost = claimSeat(
      claimSeat(
        addObserver(addObserver(createLobbyRoom(), LEFT_GUEST_ID), RIGHT_GUEST_ID),
        LEFT_GUEST_ID,
        "left",
      ),
      RIGHT_GUEST_ID,
      "right",
    );

    expect(getPongMultiplayerParticipantSide(roomWithObserver, "missing")).toEqual({
      code: "participant-not-found",
      error: "Participant is not in the Pong room.",
      success: false,
    });
    expect(getPongMultiplayerParticipantSide(roomWithObserver, "observer-1")).toEqual({
      code: "participant-not-seated",
      error: "Participant does not occupy a Pong paddle seat.",
      success: false,
    });
    expect(getPongMultiplayerParticipantSide(roomWithUnseatedHost, HOST_ID)).toEqual({
      code: "participant-not-seated",
      error: "Participant does not occupy a Pong paddle seat.",
      success: false,
    });
  });

  it("applies held directional input to the matching paddles", () => {
    const game = createInitialPongGame();
    const moved = applyPongMultiplayerHeldInputs(game, {
      left: {
        up: true,
      },
      right: {
        down: true,
      },
    });

    expect(moved.playerPaddle.y).toBeLessThan(game.playerPaddle.y);
    expect(moved.cpuPaddle.y).toBeGreaterThan(game.cpuPaddle.y);
  });

  it("advances multiplayer ticks without moving the right paddle as CPU AI", () => {
    const initialGame = createInitialPongGame();
    const runningGame = startPongMultiplayerGame({
      ...initialGame,
      ball: {
        position: {
          x: PONG_BOARD_WIDTH / 2,
          y: initialGame.cpuPaddle.y + initialGame.cpuPaddle.height,
        },
        velocity: {
          x: 3,
          y: 0,
        },
      },
    });
    const advanced = advancePongMultiplayerTick(runningGame);

    expect(advanced.cpuPaddle).toEqual(runningGame.cpuPaddle);
    expect(advanced.ball.position.x).not.toBe(runningGame.ball.position.x);
  });

  it("leaves paused multiplayer ticks unchanged even when inputs are held", () => {
    const pausedGame = pausePongMultiplayerGame(
      startPongMultiplayerGame(createInitialPongGame()),
    );
    const ticked = advancePongMultiplayerTick(pausedGame, {
      left: {
        up: true,
      },
      right: {
        down: true,
      },
    });

    expect(ticked).toBe(pausedGame);
  });

  it("projects running snapshots through paddle contact", () => {
    const runningGame = startPongMultiplayerGame(createInitialPongGame());
    const ballRadius = getPongBallRadius();
    const paddleFaceX = runningGame.playerPaddle.x + runningGame.playerPaddle.width;
    const collisionReadyGame = {
      ...runningGame,
      ball: {
        position: {
          x: paddleFaceX + ballRadius + 1,
          y: runningGame.playerPaddle.y + runningGame.playerPaddle.height / 2,
        },
        velocity: {
          x: -4.8,
          y: 0,
        },
      },
    };

    const projectedGame = projectPongMultiplayerGame(
      collisionReadyGame,
      {},
      getPongTickDelay(),
    );

    expect(projectedGame.ball.position.x).toBeCloseTo(paddleFaceX + ballRadius);
    expect(projectedGame.ball.velocity.x).toBeGreaterThan(0);
  });

  it("does not project a running snapshot into a local scoring reset", () => {
    const runningGame = startPongMultiplayerGame(createInitialPongGame());
    const nearlyScoredGame = {
      ...runningGame,
      ball: {
        position: {
          x: runningGame.boardWidth + getPongBallRadius() + 1,
          y: runningGame.boardHeight / 2,
        },
        velocity: {
          x: 4.8,
          y: 0,
        },
      },
    };

    const projectedGame = projectPongMultiplayerGame(
      nearlyScoredGame,
      {},
      getPongTickDelay(),
    );

    expect(projectedGame).toBe(nearlyScoredGame);
  });

  it("starts, pauses, resumes, and restarts multiplayer game state", () => {
    const initialGame = createInitialPongGame({
      boardHeight: 640,
      boardWidth: 480,
      targetScore: 7,
    });
    const started = startPongMultiplayerGame(initialGame);
    const paused = pausePongMultiplayerGame(started);
    const resumed = resumePongMultiplayerGame(paused);
    const restarted = restartPongMultiplayerGame({
      ...resumed,
      remainingScore: 123,
      score: {
        cpu: 2,
        player: 4,
      },
    });

    expect(started.status).toBe("running");
    expect(paused.status).toBe("paused");
    expect(resumed.status).toBe("running");
    expect(restarted).toMatchObject({
      boardHeight: 640,
      boardWidth: 480,
      remainingScore: 1_400,
      score: {
        cpu: 0,
        player: 0,
      },
      status: "running",
      targetScore: 7,
    });
  });

  it("keeps default Pong settings when room parameters are absent", () => {
    const result = createInitialPongMultiplayerGame(createReadyRoom());

    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error(result.error);
    }

    expect(result.game).toMatchObject({
      boardHeight: PONG_BOARD_HEIGHT,
      boardWidth: PONG_BOARD_WIDTH,
      targetScore: PONG_TARGET_SCORE,
    });
  });
});
