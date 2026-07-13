import {
  createHeldDirectionMovementKeyGetter,
  createHeldDirectionMovementState,
  pressHeldDirectionMovementKey,
  releaseHeldDirectionMovementKey,
  resetHeldDirectionMovementState,
  type HeldDirectionMovementKey,
  type HeldDirectionMovementState,
} from "./game-input";

import type { BattleCityDirection } from "@/lib/battle-city-game-engine";

const BATTLE_CITY_PLAYER_MOVEMENT_DIRECTIONS = [
  "right",
  "left",
  "down",
  "up",
] as const satisfies readonly BattleCityDirection[];

export type BattleCityPlayerMovementKey = HeldDirectionMovementKey<BattleCityDirection>;

export type BattleCityPlayerMovementState = HeldDirectionMovementState<BattleCityDirection>;

export function createBattleCityPlayerMovementState(): BattleCityPlayerMovementState {
  return createHeldDirectionMovementState(BATTLE_CITY_PLAYER_MOVEMENT_DIRECTIONS);
}

export const getBattleCityPlayerMovementKey = createHeldDirectionMovementKeyGetter({
  down: ["ArrowDown", "s"],
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
  up: ["ArrowUp", "w"],
});

export function pressBattleCityPlayerMovementKey(
  state: BattleCityPlayerMovementState,
  movementKey: BattleCityPlayerMovementKey,
) {
  const result = pressHeldDirectionMovementKey(state, movementKey);
  const direction = getPrioritizedBattleCityDirection(state);
  state.direction = direction;
  state.lastDirection = direction;
  return {
    direction: direction ?? movementKey.direction,
    shouldMoveImmediately:
      result.shouldMoveImmediately && direction === movementKey.direction,
  };
}

export function releaseBattleCityPlayerMovementKey(
  state: BattleCityPlayerMovementState,
  movementKey: BattleCityPlayerMovementKey,
) {
  const result = releaseHeldDirectionMovementKey(state, movementKey);
  const direction = getPrioritizedBattleCityDirection(state);
  state.direction = direction;
  state.lastDirection = direction;
  return { ...result, direction };
}

export function resetBattleCityPlayerMovementState(
  state: BattleCityPlayerMovementState,
) {
  resetHeldDirectionMovementState(state);
}

function getPrioritizedBattleCityDirection(
  state: BattleCityPlayerMovementState,
): BattleCityDirection | null {
  return (
    state.directions.find(
      (direction) => state.heldKeys[direction].size > 0,
    ) ?? null
  );
}
