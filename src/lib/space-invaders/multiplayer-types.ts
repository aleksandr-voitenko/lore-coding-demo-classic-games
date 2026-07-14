import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerRealtimeRoomSnapshot,
  MultiplayerTerminalSummary,
} from "../multiplayer/protocol";
import type {
  CreateSpaceInvadersGameOptions,
  SpaceInvadersGameState,
} from "../space-invaders-game-engine";
import type { SpaceInvadersPlayerOwnedState } from "./player-state";

export const SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS = [
  "ship-a",
  "ship-b",
] as const;

export type SpaceInvadersShipSeat =
  (typeof SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS)[number];

export type SpaceInvadersMultiplayerRoomSeat = {
  id: SpaceInvadersShipSeat;
  label: string;
  required: true;
};

export const SPACE_INVADERS_MULTIPLAYER_ROOM_SEATS = [
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
] as const satisfies readonly SpaceInvadersMultiplayerRoomSeat[];

export type SpaceInvadersMultiplayerSharedState = Pick<
  SpaceInvadersGameState,
  | "alienCount"
  | "alienFreezeTicks"
  | "baseY"
  | "boardHeight"
  | "boardWidth"
  | "explosions"
  | "hitStreak"
  | "invaderBurst"
  | "invaderShotCooldownTicks"
  | "invaderShots"
  | "invaders"
  | "lives"
  | "marchDirection"
  | "multiKillCombo"
  | "nextExplosionId"
  | "nextInvaderShotId"
  | "nextPlayerShotId"
  | "nextPowerUpId"
  | "nextScorePopupId"
  | "powerUps"
  | "revengeVolleys"
  | "score"
  | "scorePopups"
  | "status"
  | "ufo"
  | "ufoHitStreak"
>;

export type SpaceInvadersShipState = SpaceInvadersPlayerOwnedState & {
  isActive: boolean;
  seat: SpaceInvadersShipSeat;
};

export type SpaceInvadersMultiplayerShips = Record<
  SpaceInvadersShipSeat,
  SpaceInvadersShipState
>;

export type SpaceInvadersMultiplayerGameState =
  SpaceInvadersMultiplayerSharedState & {
    ships: SpaceInvadersMultiplayerShips;
  };

export type CreateSpaceInvadersMultiplayerGameOptions =
  CreateSpaceInvadersGameOptions;

export type SpaceInvadersMultiplayerTerminalSummary = MultiplayerTerminalSummary<
  Extract<SpaceInvadersMultiplayerGameState["status"], "lost" | "won">,
  {
    livesRemaining: number;
    remainingInvaders: number;
    result: Extract<
      SpaceInvadersMultiplayerGameState["status"],
      "lost" | "won"
    >;
    score: number;
  }
>;

export type SpaceInvadersMultiplayerGameSnapshot =
  MultiplayerRealtimeGameSnapshot<
    "space-invaders",
    SpaceInvadersMultiplayerGameState,
    {
      summary?: SpaceInvadersMultiplayerTerminalSummary;
    }
  >;

export type SpaceInvadersMultiplayerRoomSnapshot =
  MultiplayerRealtimeRoomSnapshot<SpaceInvadersMultiplayerGameSnapshot>;

export type SpaceInvadersMultiplayerShipDirection = "left" | "right";

export type SpaceInvadersMultiplayerClientInput =
  | {
      direction: SpaceInvadersMultiplayerShipDirection | null;
      type: "space-invaders.setShipDirection";
    }
  | {
      type: "space-invaders.fire";
    };

export type SpaceInvadersMultiplayerHeldInput = {
  fire?: boolean;
  left?: boolean;
  right?: boolean;
};

export type SpaceInvadersMultiplayerHeldInputs = Readonly<
  Partial<Record<SpaceInvadersShipSeat, SpaceInvadersMultiplayerHeldInput>>
>;
