import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  applyAsteroidsReplayEvent,
  createInitialAsteroidsReplayGame,
  parseAsteroidsReplayPayload,
} from "../asteroids-replay";
import {
  applyBreakoutReplayEvent,
  createInitialBreakoutReplayGame,
  parseBreakoutReplayPayload,
  type BreakoutReplayEvent,
} from "../breakout-replay";
import type {
  BaseGameReplayPayload,
  GameReplayEventEnvelope,
  GameReplayPayloadParser,
} from "../game-replay";
import {
  applyMinesweeperReplayEvent,
  createInitialMinesweeperReplayGame,
  parseMinesweeperReplayPayload,
  type MinesweeperReplayEvent,
} from "../minesweeper-replay";
import {
  applyPongReplayEvent,
  createInitialPongReplayGame,
  parsePongReplayPayload,
  type PongReplayEvent,
} from "../pong-replay";
import {
  applySimonReplayEvent,
  createInitialSimonReplayGame,
  parseSimonReplayPayload,
  type SimonReplayEvent,
} from "../simon-replay";
import {
  applySnakeReplayEvent,
  createInitialSnakeReplayGame,
  parseSnakeReplayPayload,
  type SnakeReplayEvent,
} from "../snake-replay";
import {
  applySpaceInvadersReplayEvent,
  createInitialSpaceInvadersReplayGame,
  parseSpaceInvadersReplayPayload,
} from "../space-invaders-replay";
import {
  applyTetrisReplayEvent,
  createInitialTetrisReplayGame,
  parseTetrisReplayPayload,
  type TetrisReplayEvent,
} from "../tetris-replay";
import {
  applyTwentyFortyEightReplayEvent,
  createInitialTwentyFortyEightReplayGame,
  parseTwentyFortyEightReplayPayload,
  type TwentyFortyEightReplayEvent,
} from "../twenty-forty-eight-replay";
import arcadeFixtures from "./arcade.fixture.json";
import engineFixtures from "./engines.fixture.json";

type CompatibilityFixture = {
  name: string;
  gameId: string;
  payload: Record<string, unknown>;
  eventRuns: { event: { type: string }; count: number }[];
  tickEventTypes: string[];
  checkpoints: {
    eventCount: number;
    state: Record<string, unknown>;
    stateHash: string;
  }[];
  final: Record<string, unknown>;
  finalStateHash: string;
  finalEventCount: number;
};

// Captured from unchanged runtime at 721d749f26af3bec9eaec7f8e137e1701a66df7f.
// Inputs and expected outcomes are fixed: generating them with the engine under
// test would let a deterministic replay incompatibility update its own oracle.
// Review any changed golden against the persisted schema before replacing it.
const fixtures: CompatibilityFixture[] = [...engineFixtures, ...arcadeFixtures];

function canonicalizeState(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeState);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, entry]) => [key, canonicalizeState(entry)]),
    );
  }
  // State includes floating point physics. Preserve array order and integer
  // counters exactly while allowing sub-pixel arithmetic noise across platforms.
  return typeof value === "number" && Number.isFinite(value) && !Number.isInteger(value)
    ? Number(value.toFixed(6))
    : value;
}

function hashState(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeState(value)))
    .digest("hex");
}

function verifyReplayCompatibility<
  Payload extends BaseGameReplayPayload & { events: GameReplayEventEnvelope[] },
  Playback extends { game: { status: string } },
>(
  gameId: string,
  parsePayload: GameReplayPayloadParser<Payload>,
  createPlayback: (payload: Payload) => Playback,
  applyEvent: (current: Playback, event: Payload["events"][number]) => Playback,
  getFinalMetadata: (game: Playback["game"], finalTick: number) => Record<string, unknown>,
) {
  describe(`${gameId} saved replay compatibility`, () => {
    const gameFixtures = fixtures.filter((fixture) => fixture.gameId === gameId);

    it.each(gameFixtures)("$name", (fixture) => {
      const events: GameReplayEventEnvelope[] = [];
      let tick = 0;
      for (const run of fixture.eventRuns) {
        for (let repeat = 0; repeat < run.count; repeat += 1) {
          events.push({
            ...run.event,
            seq: events.length,
            tick,
            elapsedMs: events.length * 16,
          });
          // The fixture pins the recorder's stamp-before-increment rule and
          // which inputs advance its clock, independently of the live engine.
          if (fixture.tickEventTypes.includes(run.event.type)) {
            tick += 1;
          }
        }
      }
      const payload = { ...fixture.payload, events };
      const parsed = parsePayload(payload);
      if (!parsed.success) {
        throw new Error(parsed.error);
      }
      expect(parsed.payload).toEqual(payload);
      expect(parsed.payload.gameId).toBe(gameId);
      expect(tick).toBe(parsed.payload.finalTick);
      let playback = createPlayback(parsed.payload);
      let eventCount = 0;
      const remainingCheckpoints = new Map(
        fixture.checkpoints.map((checkpoint) => [checkpoint.eventCount, checkpoint]),
      );

      const verifyCheckpoint = () => {
        const checkpoint = remainingCheckpoints.get(eventCount);
        if (checkpoint === undefined) {
          return;
        }
        expect(canonicalizeState(playback.game), `state after event ${eventCount}`)
          .toMatchObject(checkpoint.state);
        expect(hashState(playback.game), `complete state after event ${eventCount}`)
          .toBe(checkpoint.stateHash);
        remainingCheckpoints.delete(eventCount);
      };

      verifyCheckpoint();
      for (const event of parsed.payload.events) {
        // A terminal state normally ignores later inputs. Check the boundary
        // too, so an earlier loss cannot hide behind the same final board.
        if (playback.game.status === "lost" || playback.game.status === "won") {
          throw new Error(`Replay became terminal before recorded event ${eventCount}.`);
        }
        playback = applyEvent(playback, event);
        eventCount += 1;
        verifyCheckpoint();
      }

      expect(remainingCheckpoints.size).toBe(0);
      expect(eventCount).toBe(fixture.finalEventCount);
      expect(["lost", "won"]).toContain(playback.game.status);
      expect(canonicalizeState(playback.game)).toMatchObject(fixture.final);
      expect(hashState(playback.game)).toBe(fixture.finalStateHash);
      expect(parsed.payload).toMatchObject(getFinalMetadata(playback.game, tick));
    });
  });
}

verifyReplayCompatibility(
  "snake",
  parseSnakeReplayPayload,
  createInitialSnakeReplayGame,
  (current, event: SnakeReplayEvent) => ({
    ...current,
    game: applySnakeReplayEvent(current.game, event, current.random),
  }),
  (game) => ({ finalScore: game.score, finalStatus: game.status, finalLevel: game.level }),
);
verifyReplayCompatibility(
  "tetris",
  parseTetrisReplayPayload,
  createInitialTetrisReplayGame,
  (current, event: TetrisReplayEvent) => ({
    ...current,
    game: applyTetrisReplayEvent(current.game, event, current.random),
  }),
  (game) => ({
    finalScore: game.score,
    finalStatus: game.status,
    finalLevel: game.level,
    finalLines: game.lines,
  }),
);
verifyReplayCompatibility(
  "minesweeper",
  parseMinesweeperReplayPayload,
  createInitialMinesweeperReplayGame,
  (current, event: MinesweeperReplayEvent) => ({
    ...current,
    game: applyMinesweeperReplayEvent(current.game, event, current.random),
  }),
  (game, finalTick) => ({
    finalStatus: game.status,
    finalScore: finalTick,
    finalFlagCount: game.flagCount,
    finalRevealedSafeCellCount: game.revealedSafeCellCount,
  }),
);
verifyReplayCompatibility(
  "space-invaders",
  parseSpaceInvadersReplayPayload,
  createInitialSpaceInvadersReplayGame,
  applySpaceInvadersReplayEvent,
  (game) => ({
    finalScore: game.score,
    finalStatus: game.status,
    finalLives: game.lives,
    finalInvaderCount: game.invaders.filter((invader) => invader.isActive).length,
  }),
);
verifyReplayCompatibility(
  "asteroids",
  parseAsteroidsReplayPayload,
  createInitialAsteroidsReplayGame,
  applyAsteroidsReplayEvent,
  (game) => ({
    finalScore: game.score,
    finalStatus: game.status,
    finalLives: game.lives,
    finalAsteroidCount: game.asteroids.length,
    finalWave: game.wave,
  }),
);
verifyReplayCompatibility(
  "breakout",
  parseBreakoutReplayPayload,
  createInitialBreakoutReplayGame,
  (current, event: BreakoutReplayEvent) => ({
    ...current,
    game: applyBreakoutReplayEvent(current.game, event, current.random),
  }),
  (game) => ({
    finalScore: game.score,
    finalStatus: game.status,
    finalLives: game.lives,
    finalActiveBrickCount: game.bricks.filter((brick) => brick.isActive).length,
  }),
);
verifyReplayCompatibility(
  "pong",
  parsePongReplayPayload,
  createInitialPongReplayGame,
  (current, event: PongReplayEvent) => ({
    ...current,
    game: applyPongReplayEvent(current.game, event),
  }),
  (game) => ({
    finalScore: game.remainingScore,
    finalStatus: game.status,
    finalCpuScore: game.score.cpu,
    finalPlayerScore: game.score.player,
  }),
);
verifyReplayCompatibility(
  "simon",
  parseSimonReplayPayload,
  createInitialSimonReplayGame,
  (current, event: SimonReplayEvent) => ({
    ...current,
    game: applySimonReplayEvent(current.game, event, current.random),
  }),
  (game) => ({
    finalScore: game.score,
    finalStatus: game.status,
    finalInputIndex: game.inputIndex,
    finalRound: game.round,
    finalSequenceLength: game.sequence.length,
  }),
);
verifyReplayCompatibility(
  "twenty-forty-eight",
  parseTwentyFortyEightReplayPayload,
  createInitialTwentyFortyEightReplayGame,
  (current, event: TwentyFortyEightReplayEvent) => ({
    ...current,
    game: applyTwentyFortyEightReplayEvent(current.game, event, current.random),
  }),
  (game) => ({
    finalScore: game.score,
    finalStatus: game.status,
    finalMoveCount: game.moveCount,
    finalTopTile: Math.max(...game.tiles.map((tile) => tile.value)),
  }),
);
