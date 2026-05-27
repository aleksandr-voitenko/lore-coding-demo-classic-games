import {
  createHeldDirectionMovementKeyGetter,
  createHeldDirectionMovementState,
  pressHeldDirectionMovementKey,
  releaseHeldDirectionMovementKey,
  resetHeldDirectionMovementState,
  type HeldDirectionMovementKey,
  type HeldDirectionMovementState,
} from "./game-input";

const SPACE_INVADERS_PLAYER_MOVEMENT_DIRECTIONS = ["left", "right"] as const;

export type SpaceInvadersPlayerMovementDirection =
  (typeof SPACE_INVADERS_PLAYER_MOVEMENT_DIRECTIONS)[number];

export type SpaceInvadersPlayerMovementKey =
  HeldDirectionMovementKey<SpaceInvadersPlayerMovementDirection>;

export type SpaceInvadersPlayerMovementState =
  HeldDirectionMovementState<SpaceInvadersPlayerMovementDirection>;

export function createSpaceInvadersPlayerMovementState(): SpaceInvadersPlayerMovementState {
  return createHeldDirectionMovementState(SPACE_INVADERS_PLAYER_MOVEMENT_DIRECTIONS);
}

export const getSpaceInvadersPlayerMovementKey = createHeldDirectionMovementKeyGetter({
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
});

export function pressSpaceInvadersPlayerMovementKey(
  state: SpaceInvadersPlayerMovementState,
  movementKey: SpaceInvadersPlayerMovementKey,
) {
  return pressHeldDirectionMovementKey(state, movementKey);
}

export function releaseSpaceInvadersPlayerMovementKey(
  state: SpaceInvadersPlayerMovementState,
  movementKey: SpaceInvadersPlayerMovementKey,
) {
  return releaseHeldDirectionMovementKey(state, movementKey);
}

export function resetSpaceInvadersPlayerMovementState(
  state: SpaceInvadersPlayerMovementState,
) {
  resetHeldDirectionMovementState(state);
}
