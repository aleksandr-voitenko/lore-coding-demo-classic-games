import type {
  BattleCityPosition,
  BattleCityPowerUpType,
  BattleCityRandom,
} from "./types";
import { BATTLE_CITY_POWER_UP_COLLISION_DISTANCE } from "./constants";

const BATTLE_CITY_POWER_UP_COORDINATES = [3, 9, 15, 21] as const;
export const BATTLE_CITY_POWER_UP_POSITIONS: readonly BattleCityPosition[] =
  BATTLE_CITY_POWER_UP_COORDINATES.flatMap((row) =>
    BATTLE_CITY_POWER_UP_COORDINATES.map((col) => ({ col, row })),
  );

// This order is the ROM lookup table: star and grenade each occupy two of its
// eight entries, while the other four power-ups occupy one entry apiece.
export const BATTLE_CITY_WEIGHTED_POWER_UP_TYPES = [
  "helmet",
  "clock",
  "shovel",
  "star",
  "grenade",
  "tank",
  "grenade",
  "star",
] as const satisfies readonly BattleCityPowerUpType[];

export type BattleCityPowerUpSelection = BattleCityPosition & {
  type: BattleCityPowerUpType;
};

export function selectBattleCityPowerUpType(
  random: BattleCityRandom,
): BattleCityPowerUpType {
  return BATTLE_CITY_WEIGHTED_POWER_UP_TYPES[
    randomIndex(BATTLE_CITY_WEIGHTED_POWER_UP_TYPES.length, random)
  ];
}

export function selectBattleCityPowerUpPosition(
  player: BattleCityPosition | readonly BattleCityPosition[],
  random: BattleCityRandom,
): BattleCityPosition {
  const players = Array.isArray(player) ? player : [player];
  // The hardware RNG cannot get stuck on one value, but injected random
  // sources can. Keep rerolls bounded, then scan the canonical table so this
  // selector stays deterministic and total for the active 2x2 player tanks.
  for (
    let attempt = 0;
    attempt < BATTLE_CITY_POWER_UP_POSITIONS.length;
    attempt += 1
  ) {
    const candidate = selectRandomPowerUpPosition(random);
    if (
      players.every(
        (currentPlayer) =>
          !battleCityPowerUpWithinTankRange(candidate, currentPlayer),
      )
    ) {
      return candidate;
    }
  }

  for (const candidate of BATTLE_CITY_POWER_UP_POSITIONS) {
    if (
      players.every(
        (currentPlayer) =>
          !battleCityPowerUpWithinTankRange(candidate, currentPlayer),
      )
    ) {
      return { ...candidate };
    }
  }

  throw new Error(
    "A 2x2 player unexpectedly overlaps every canonical Battle City power-up position.",
  );
}

export function selectBattleCityPowerUp(
  player: BattleCityPosition | readonly BattleCityPosition[],
  random: BattleCityRandom,
): BattleCityPowerUpSelection {
  return {
    ...selectBattleCityPowerUpPosition(player, random),
    type: selectBattleCityPowerUpType(random),
  };
}

function selectRandomPowerUpPosition(
  random: BattleCityRandom,
): BattleCityPosition {
  // The ROM rolls X and Y separately, in that order.
  return {
    col: BATTLE_CITY_POWER_UP_COORDINATES[
      randomIndex(BATTLE_CITY_POWER_UP_COORDINATES.length, random)
    ],
    row: BATTLE_CITY_POWER_UP_COORDINATES[
      randomIndex(BATTLE_CITY_POWER_UP_COORDINATES.length, random)
    ],
  };
}

export function battleCityPowerUpWithinTankRange(
  first: BattleCityPosition,
  second: BattleCityPosition,
): boolean {
  return (
    Math.abs(first.row - second.row) < BATTLE_CITY_POWER_UP_COLLISION_DISTANCE &&
    Math.abs(first.col - second.col) < BATTLE_CITY_POWER_UP_COLLISION_DISTANCE
  );
}

function randomIndex(length: number, random: BattleCityRandom): number {
  return Math.floor(normalizeRandom(random()) * length);
}

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(0.999_999_999, Math.max(0, value));
}
