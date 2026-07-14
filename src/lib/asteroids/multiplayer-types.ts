import type {
  MultiplayerRealtimeGameSnapshot,
  MultiplayerTerminalSummary,
} from "../multiplayer/protocol";
import type {
  AsteroidsControlInput,
  AsteroidsSharedWorldState,
  AsteroidsShipOwnedState,
  CreateAsteroidsGameOptions,
} from "./types";

export const ASTEROIDS_MULTIPLAYER_SHIP_SEATS = [
  "ship-a",
  "ship-b",
] as const;

export type AsteroidsShipSeat =
  (typeof ASTEROIDS_MULTIPLAYER_SHIP_SEATS)[number];

export type AsteroidsMultiplayerRoomSeat = {
  id: AsteroidsShipSeat;
  label: string;
  required: true;
};

export const ASTEROIDS_MULTIPLAYER_ROOM_SEATS = [
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
] as const satisfies readonly AsteroidsMultiplayerRoomSeat[];

export type AsteroidsMultiplayerShipState = AsteroidsShipOwnedState & {
  isActive: boolean;
  respawnOnExplosionEnd: boolean;
  seat: AsteroidsShipSeat;
};

export type AsteroidsMultiplayerShips = Record<
  AsteroidsShipSeat,
  AsteroidsMultiplayerShipState
>;

export type AsteroidsMultiplayerGameState = AsteroidsSharedWorldState & {
  ships: AsteroidsMultiplayerShips;
};

export type CreateAsteroidsMultiplayerGameOptions = CreateAsteroidsGameOptions;

export type AsteroidsMultiplayerClientInput =
  | {
      controls: AsteroidsControlInput;
      type: "asteroids.setShipControls";
    }
  | {
      type: "asteroids.fire";
    };

export type AsteroidsMultiplayerHeldInput = AsteroidsControlInput & {
  fire?: boolean;
};

export type AsteroidsMultiplayerHeldInputs = Readonly<
  Partial<Record<AsteroidsShipSeat, AsteroidsMultiplayerHeldInput>>
>;

export type AsteroidsMultiplayerTerminalSummary = MultiplayerTerminalSummary<
  Extract<AsteroidsMultiplayerGameState["status"], "lost">,
  {
    livesRemaining: number;
    score: number;
    wave: number;
  }
>;

export type AsteroidsMultiplayerGameSnapshot = MultiplayerRealtimeGameSnapshot<
  "asteroids",
  AsteroidsMultiplayerGameState,
  {
    heldInputs: AsteroidsMultiplayerHeldInputs;
    summary?: AsteroidsMultiplayerTerminalSummary;
  }
>;
