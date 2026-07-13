import type {
  BattleCityDirection,
  BattleCityPosition,
  BattleCityTerrain,
} from "./types";

export const BATTLE_CITY_TERRAIN_FRAGMENT_SIZE = 1 / 2;
export const BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK = 0;
export const BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK = 0b1111;

export const BATTLE_CITY_TERRAIN_FRAGMENT_BITS = {
  "top-left": 0b0001,
  "top-right": 0b0010,
  "bottom-left": 0b0100,
  "bottom-right": 0b1000,
} as const;

export type BattleCityTerrainFragment =
  keyof typeof BATTLE_CITY_TERRAIN_FRAGMENT_BITS;

export type BattleCityTerrainFragmentMask = number;

export type BattleCityTerrainFragmentGrid =
  BattleCityTerrainFragmentMask[][];

export type BattleCityAabb = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type BattleCityTerrainFragmentImpact = {
  bit: (typeof BATTLE_CITY_TERRAIN_FRAGMENT_BITS)[BattleCityTerrainFragment];
  cellCol: number;
  cellRow: number;
  fragment: BattleCityTerrainFragment;
};

export type BattleCityTerrainBulletImpact = BattleCityPosition & {
  direction: BattleCityDirection;
  isMaximumPower: boolean;
};

export type BattleCityTerrainBulletImpactResult = {
  cells: BattleCityTerrainBulletImpactCell[];
  didChange: boolean;
  didCollide: boolean;
  fragments: BattleCityTerrainFragmentGrid;
  impact: BattleCityTerrainFragmentImpact;
  impacts: BattleCityTerrainFragmentImpact[];
  nextMask: BattleCityTerrainFragmentMask;
  previousMask: BattleCityTerrainFragmentMask;
};

export type BattleCityTerrainBulletImpactCell = {
  cellCol: number;
  cellRow: number;
  nextMask: BattleCityTerrainFragmentMask;
  previousMask: BattleCityTerrainFragmentMask;
};

type BattleCityDestructibleTerrain = Extract<
  BattleCityTerrain,
  "brick" | "steel"
>;

const DIRECTION_DELTAS: Readonly<
  Record<BattleCityDirection, BattleCityPosition>
> = {
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
  up: { col: 0, row: -1 },
};

// A point on a cell edge belongs to the cell the shell is entering. The nudge
// is far smaller than the one-pixel (1/8-cell) simulation step.
const IMPACT_DIRECTION_EPSILON = 1e-9;

// The ROM probes the 16-pixel-wide impact face at the shell coordinate and
// at +4, -1, and -5 pixels perpendicular to travel. Each paired outer probe
// runs only when its primary probe hit an ordinary brick; steel, headquarters,
// and maximum-power primary impacts terminate that pair immediately.
const WALL_IMPACT_PROBE_OFFSET_PAIRS = [
  [0, 1 / 2],
  [-1 / 8, -5 / 8],
] as const;

export function createBattleCityTerrainFragmentGrid(
  terrain: readonly (readonly BattleCityTerrain[])[],
): BattleCityTerrainFragmentGrid {
  return terrain.map((row) =>
    row.map((cell) =>
      cell === "brick" || cell === "steel"
        ? BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK
        : BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
    ),
  );
}

export function getBattleCityTerrainFragmentImpact(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): BattleCityTerrainFragmentImpact {
  const delta = DIRECTION_DELTAS[direction];
  const sampleRow = position.row + delta.row * IMPACT_DIRECTION_EPSILON;
  const sampleCol = position.col + delta.col * IMPACT_DIRECTION_EPSILON;
  const cellRow = Math.floor(sampleRow);
  const cellCol = Math.floor(sampleCol);
  const verticalHalf =
    sampleRow - cellRow < BATTLE_CITY_TERRAIN_FRAGMENT_SIZE
      ? "top"
      : "bottom";
  const horizontalHalf =
    sampleCol - cellCol < BATTLE_CITY_TERRAIN_FRAGMENT_SIZE
      ? "left"
      : "right";
  const fragment = `${verticalHalf}-${horizontalHalf}` as BattleCityTerrainFragment;

  return {
    bit: BATTLE_CITY_TERRAIN_FRAGMENT_BITS[fragment],
    cellCol,
    cellRow,
    fragment,
  };
}

function getBattleCityTerrainFragmentImpactPairs(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): Array<
  readonly [BattleCityTerrainFragmentImpact, BattleCityTerrainFragmentImpact]
> {
  const isVertical = direction === "up" || direction === "down";
  return WALL_IMPACT_PROBE_OFFSET_PAIRS.map((offsets) =>
    offsets.map((offset) =>
      getBattleCityTerrainFragmentImpact(
        {
          col: position.col + (isVertical ? offset : 0),
          row: position.row + (isVertical ? 0 : offset),
        },
        direction,
      ),
    ) as [BattleCityTerrainFragmentImpact, BattleCityTerrainFragmentImpact],
  );
}

export function applyBattleCityTerrainFragmentImpact(
  mask: BattleCityTerrainFragmentMask,
  terrain: BattleCityDestructibleTerrain,
  impact: BattleCityTerrainFragmentImpact,
  isMaximumPower: boolean,
): BattleCityTerrainFragmentMask {
  const normalizedMask = normalizeBattleCityTerrainFragmentMask(mask);
  if ((normalizedMask & impact.bit) === 0) {
    return normalizedMask;
  }
  if (isMaximumPower) {
    return BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK;
  }
  if (terrain === "steel") {
    return normalizedMask;
  }
  return normalizedMask & ~impact.bit;
}

export function applyBattleCityTerrainBulletImpact(
  fragments: readonly (readonly BattleCityTerrainFragmentMask[])[],
  terrain: readonly (readonly BattleCityTerrain[])[],
  bullet: BattleCityTerrainBulletImpact,
): BattleCityTerrainBulletImpactResult {
  const impactPairs = getBattleCityTerrainFragmentImpactPairs(
    bullet,
    bullet.direction,
  );
  const impact = impactPairs[0]![0];
  const impacts: BattleCityTerrainFragmentImpact[] = [];
  const nextFragments = fragments.map((row) => [...row]);
  const cellStates = new Map<
    string,
    BattleCityTerrainBulletImpactCell & { didCollide: boolean }
  >();

  for (const [primaryImpact, secondaryImpact] of impactPairs) {
    if (
      !terrainProbeCollides(
        terrain,
        nextFragments,
        primaryImpact,
      )
    ) {
      continue;
    }
    const primaryTerrain =
      terrain[primaryImpact.cellRow]?.[primaryImpact.cellCol];
    const probedImpacts =
      primaryTerrain === "brick" && !bullet.isMaximumPower
        ? [primaryImpact, secondaryImpact]
        : [primaryImpact];
    impacts.push(...probedImpacts);

    for (const currentImpact of probedImpacts) {
      const terrainCell =
        terrain[currentImpact.cellRow]?.[currentImpact.cellCol];
      if (terrainCell !== "brick" && terrainCell !== "steel") {
        continue;
      }
      const key = `${currentImpact.cellRow}:${currentImpact.cellCol}`;
      const existing = cellStates.get(key);
      const previousMask =
        existing?.previousMask ??
        normalizeBattleCityTerrainFragmentMask(
          fragments[currentImpact.cellRow]?.[currentImpact.cellCol] ??
            BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
        );
      const currentMask =
        existing?.nextMask ??
        normalizeBattleCityTerrainFragmentMask(
          nextFragments[currentImpact.cellRow]?.[currentImpact.cellCol] ??
            BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
        );
      const didCollide = (currentMask & currentImpact.bit) !== 0;
      const nextMask = didCollide
        ? applyBattleCityTerrainFragmentImpact(
            currentMask,
            terrainCell,
            currentImpact,
            bullet.isMaximumPower,
          )
        : currentMask;

      cellStates.set(key, {
        cellCol: currentImpact.cellCol,
        cellRow: currentImpact.cellRow,
        didCollide: (existing?.didCollide ?? false) || didCollide,
        nextMask,
        previousMask,
      });
      nextFragments[currentImpact.cellRow]![currentImpact.cellCol] = nextMask;
    }
  }

  const cells = [...cellStates.values()]
    .filter(({ didCollide }) => didCollide)
    .map(({ cellCol, cellRow, nextMask, previousMask }) => ({
      cellCol,
      cellRow,
      nextMask,
      previousMask,
    }));
  const primaryCell = cellStates.get(`${impact.cellRow}:${impact.cellCol}`);
  const previousMask =
    primaryCell?.previousMask ??
    normalizeBattleCityTerrainFragmentMask(
      fragments[impact.cellRow]?.[impact.cellCol] ??
        BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
    );
  const nextMask = primaryCell?.nextMask ?? previousMask;

  return {
    cells,
    didChange: cells.some(
      (cell) => cell.nextMask !== cell.previousMask,
    ),
    didCollide: cells.length > 0,
    fragments: nextFragments,
    impact,
    impacts,
    nextMask,
    previousMask,
  };
}

function terrainProbeCollides(
  terrain: readonly (readonly BattleCityTerrain[])[],
  fragments: readonly (readonly BattleCityTerrainFragmentMask[])[],
  impact: BattleCityTerrainFragmentImpact,
): boolean {
  const terrainCell = terrain[impact.cellRow]?.[impact.cellCol];
  if (terrainCell === "headquarters") {
    return true;
  }
  if (terrainCell !== "brick" && terrainCell !== "steel") {
    return false;
  }
  const mask = normalizeBattleCityTerrainFragmentMask(
    fragments[impact.cellRow]?.[impact.cellCol] ??
      BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK,
  );
  return (mask & impact.bit) !== 0;
}

export function getBattleCityTerrainFragmentBounds(
  cellRow: number,
  cellCol: number,
  fragment: BattleCityTerrainFragment,
): BattleCityAabb {
  const isBottom = fragment.startsWith("bottom");
  const isRight = fragment.endsWith("right");
  const top = cellRow + (isBottom ? BATTLE_CITY_TERRAIN_FRAGMENT_SIZE : 0);
  const left = cellCol + (isRight ? BATTLE_CITY_TERRAIN_FRAGMENT_SIZE : 0);

  return {
    bottom: top + BATTLE_CITY_TERRAIN_FRAGMENT_SIZE,
    left,
    right: left + BATTLE_CITY_TERRAIN_FRAGMENT_SIZE,
    top,
  };
}

export function getBattleCityTerrainFragmentsIntersectingAabb(
  mask: BattleCityTerrainFragmentMask,
  cellRow: number,
  cellCol: number,
  aabb: BattleCityAabb,
): BattleCityTerrainFragment[] {
  const normalizedMask = normalizeBattleCityTerrainFragmentMask(mask);
  return (Object.keys(BATTLE_CITY_TERRAIN_FRAGMENT_BITS) as BattleCityTerrainFragment[])
    .filter((fragment) => {
      const bit = BATTLE_CITY_TERRAIN_FRAGMENT_BITS[fragment];
      return (
        (normalizedMask & bit) !== 0 &&
        aabbsIntersect(
          getBattleCityTerrainFragmentBounds(cellRow, cellCol, fragment),
          aabb,
        )
      );
    });
}

export function battleCityTerrainFragmentsIntersectAabb(
  mask: BattleCityTerrainFragmentMask,
  cellRow: number,
  cellCol: number,
  aabb: BattleCityAabb,
): boolean {
  return (
    getBattleCityTerrainFragmentsIntersectingAabb(
      mask,
      cellRow,
      cellCol,
      aabb,
    ).length > 0
  );
}

export function hasBattleCityTerrainFragments(
  mask: BattleCityTerrainFragmentMask,
): boolean {
  return (
    normalizeBattleCityTerrainFragmentMask(mask) !==
    BATTLE_CITY_EMPTY_TERRAIN_FRAGMENT_MASK
  );
}

function normalizeBattleCityTerrainFragmentMask(
  mask: BattleCityTerrainFragmentMask,
): BattleCityTerrainFragmentMask {
  return mask & BATTLE_CITY_FULL_TERRAIN_FRAGMENT_MASK;
}

function aabbsIntersect(first: BattleCityAabb, second: BattleCityAabb): boolean {
  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}
