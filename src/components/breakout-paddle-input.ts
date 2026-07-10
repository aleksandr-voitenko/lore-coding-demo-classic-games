import {
  createHeldDirectionMovementKeyGetter,
  createHeldDirectionMovementState,
  type HeldDirectionMovementState,
} from "./game-input";

const BREAKOUT_PADDLE_MOVEMENT_DIRECTIONS = ["left", "right"] as const;

export type BreakoutPaddleMovementDirection =
  (typeof BREAKOUT_PADDLE_MOVEMENT_DIRECTIONS)[number];

export type BreakoutPaddleMovementState =
  HeldDirectionMovementState<BreakoutPaddleMovementDirection>;

export function createBreakoutPaddleMovementState(): BreakoutPaddleMovementState {
  return createHeldDirectionMovementState(BREAKOUT_PADDLE_MOVEMENT_DIRECTIONS);
}

export const getBreakoutPaddleMovementKey = createHeldDirectionMovementKeyGetter({
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
});
