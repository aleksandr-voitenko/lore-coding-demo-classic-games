import {
  BATTLE_CITY_TICK_MS,
  createInitialBattleCityMultiplayerGame,
  projectBattleCityMultiplayerPlayerMotion,
  startBattleCityGame,
  type BattleCityDirection,
  type BattleCityMultiplayerGameState,
} from "./battle-city-game-engine";
import type { PrivateRoomSeatInput } from "./multiplayer/room";
import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerTerminalSummary,
} from "./multiplayer/protocol";

export const BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS = [
  "player-1",
  "player-2",
] as const;

export type BattleCityMultiplayerPlayerSeat =
  (typeof BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS)[number];

export const BATTLE_CITY_MULTIPLAYER_ROOM_SEATS = [
  { id: "player-1", label: "Player 1", required: true },
  { id: "player-2", label: "Player 2", required: true },
] as const satisfies readonly PrivateRoomSeatInput[];

export type BattleCityMultiplayerClientInput =
  | {
      direction: BattleCityDirection | null;
      type: "battle-city.setDirection";
    }
  | {
      type: "battle-city.fire";
    };

export type BattleCityMultiplayerHeldInput = {
  direction: BattleCityDirection | null;
  fireRequested?: boolean;
};

export type BattleCityMultiplayerHeldInputs = Readonly<
  Partial<
    Record<BattleCityMultiplayerPlayerSeat, BattleCityMultiplayerHeldInput>
  >
>;

export type BattleCityMultiplayerTerminalSummary = MultiplayerTerminalSummary<
  "lost",
  {
    cycle: number;
    player1Lives: number;
    player1ReserveLives: number;
    player1Score: number;
    player2Lives: number;
    player2ReserveLives: number;
    player2Score: number;
    stage: number;
  }
>;

export type BattleCityMultiplayerGameSnapshot =
  MultiplayerRealtimeGameSnapshot<
    "battle-city",
    BattleCityMultiplayerGameState,
    {
      heldInputs: BattleCityMultiplayerHeldInputs;
      summary?: BattleCityMultiplayerTerminalSummary;
    }
  >;

const BATTLE_CITY_MULTIPLAYER_PROJECTION_MAX_TICKS = 7;

export const BATTLE_CITY_MULTIPLAYER_PROJECTION_MAX_MS =
  BATTLE_CITY_TICK_MS * BATTLE_CITY_MULTIPLAYER_PROJECTION_MAX_TICKS;

export function isBattleCityMultiplayerPlayerSeat(
  value: unknown,
): value is BattleCityMultiplayerPlayerSeat {
  return (
    typeof value === "string" &&
    BATTLE_CITY_MULTIPLAYER_PLAYER_SEATS.includes(
      value as BattleCityMultiplayerPlayerSeat,
    )
  );
}

export function createStartedBattleCityMultiplayerGame() {
  return startBattleCityGame(
    createInitialBattleCityMultiplayerGame(),
  ) as BattleCityMultiplayerGameState;
}

export function cloneBattleCityMultiplayerGame(
  game: BattleCityMultiplayerGameState,
): BattleCityMultiplayerGameState {
  return {
    ...game,
    activePowerUp:
      game.activePowerUp === null ? null : { ...game.activePowerUp },
    bullets: game.bullets.map((bullet) => ({ ...bullet })),
    enemies: game.enemies.map((enemy) => ({ ...enemy })),
    player: { ...game.player },
    player2: { ...game.player2 },
    playerGameOverMessage:
      game.playerGameOverMessage === null
        ? null
        : { ...game.playerGameOverMessage },
    player2StageKillCounts: { ...game.player2StageKillCounts },
    powerUpScorePopup:
      game.powerUpScorePopup === null ? null : { ...game.powerUpScorePopup },
    stageKillCounts: { ...game.stageKillCounts },
    terrain: game.terrain.map((row) => [...row]),
    terrainFragments: game.terrainFragments.map((row) => [...row]),
  };
}

export function getBattleCityMultiplayerProjectionTicks(elapsedMs: number) {
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) {
    return 0;
  }
  return Math.min(
    BATTLE_CITY_MULTIPLAYER_PROJECTION_MAX_TICKS,
    Math.floor(elapsedMs / BATTLE_CITY_TICK_MS),
  );
}

export function projectBattleCityMultiplayerGame(
  game: BattleCityMultiplayerGameState,
  heldInputs: BattleCityMultiplayerHeldInputs,
  elapsedMs: number,
): BattleCityMultiplayerGameState {
  const projectionTicks = getBattleCityMultiplayerProjectionTicks(elapsedMs);
  if (projectionTicks === 0) {
    return game;
  }

  return projectBattleCityMultiplayerPlayerMotion(
    cloneBattleCityMultiplayerGame(game),
    {
      player1: heldInputs["player-1"]?.direction ?? null,
      player2: heldInputs["player-2"]?.direction ?? null,
    },
    projectionTicks,
  );
}
