import {
  createHeldDirectionMovementKeyGetter,
  createHeldDirectionMovementState,
  pressHeldDirectionMovementKey,
  releaseHeldDirectionMovementKey,
  resetHeldDirectionMovementState,
  type HeldDirectionMovementKey,
  type HeldDirectionMovementState,
} from "./game-input";

const BREAKOUT_PADDLE_MOVEMENT_DIRECTIONS = ["left", "right"] as const;

export type BreakoutPaddleMovementDirection =
  (typeof BREAKOUT_PADDLE_MOVEMENT_DIRECTIONS)[number];

export type BreakoutPaddleMovementKey =
  HeldDirectionMovementKey<BreakoutPaddleMovementDirection>;

export type BreakoutPaddleMovementState =
  HeldDirectionMovementState<BreakoutPaddleMovementDirection>;

export function createBreakoutPaddleMovementState(): BreakoutPaddleMovementState {
  return createHeldDirectionMovementState(BREAKOUT_PADDLE_MOVEMENT_DIRECTIONS);
}

export const getBreakoutPaddleMovementKey = createHeldDirectionMovementKeyGetter({
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
});

export function pressBreakoutPaddleMovementKey(
  state: BreakoutPaddleMovementState,
  movementKey: BreakoutPaddleMovementKey,
) {
  return pressHeldDirectionMovementKey(state, movementKey);
}

export function releaseBreakoutPaddleMovementKey(
  state: BreakoutPaddleMovementState,
  movementKey: BreakoutPaddleMovementKey,
) {
  return releaseHeldDirectionMovementKey(state, movementKey);
}

export function resetBreakoutPaddleMovementState(state: BreakoutPaddleMovementState) {
  resetHeldDirectionMovementState(state);
}
