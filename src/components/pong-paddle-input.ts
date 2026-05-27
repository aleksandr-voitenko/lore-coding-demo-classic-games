import {
  createHeldDirectionMovementKeyGetter,
  createHeldDirectionMovementState,
  pressHeldDirectionMovementKey,
  releaseHeldDirectionMovementKey,
  resetHeldDirectionMovementState,
  type HeldDirectionMovementKey,
  type HeldDirectionMovementState,
} from "./game-input";

const PONG_PADDLE_MOVEMENT_DIRECTIONS = ["up", "down"] as const;

export type PongPaddleMovementDirection =
  (typeof PONG_PADDLE_MOVEMENT_DIRECTIONS)[number];

export type PongPaddleMovementKey = HeldDirectionMovementKey<PongPaddleMovementDirection>;

export type PongPaddleMovementState =
  HeldDirectionMovementState<PongPaddleMovementDirection>;

export function createPongPaddleMovementState(): PongPaddleMovementState {
  return createHeldDirectionMovementState(PONG_PADDLE_MOVEMENT_DIRECTIONS);
}

export const getPongPaddleMovementKey = createHeldDirectionMovementKeyGetter({
  down: ["ArrowDown", "s"],
  up: ["ArrowUp", "w"],
});

export function pressPongPaddleMovementKey(
  state: PongPaddleMovementState,
  movementKey: PongPaddleMovementKey,
) {
  return pressHeldDirectionMovementKey(state, movementKey);
}

export function releasePongPaddleMovementKey(
  state: PongPaddleMovementState,
  movementKey: PongPaddleMovementKey,
) {
  return releaseHeldDirectionMovementKey(state, movementKey);
}

export function resetPongPaddleMovementState(state: PongPaddleMovementState) {
  resetHeldDirectionMovementState(state);
}
