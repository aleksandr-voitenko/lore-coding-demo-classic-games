import {
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_PIXEL_STEP,
  BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE,
} from "./constants";
import { battleCityTerrainFragmentsIntersectAabb } from "./terrain-fragments";
import type {
  BattleCityBullet,
  BattleCityDirection,
  BattleCityPosition,
  BattleCityTerrain,
} from "./types";

export const DIRECTION_DELTAS: Readonly<
  Record<BattleCityDirection, BattleCityPosition>
> = {
  down: { col: 0, row: 1 },
  left: { col: -1, row: 0 },
  right: { col: 1, row: 0 },
  up: { col: 0, row: -1 },
};

const BATTLE_CITY_TANK_SIZE = 2;
export const POSITION_EPSILON = 1e-9;

export function getMuzzlePosition(
  tank: BattleCityPosition & { direction: BattleCityDirection },
): BattleCityPosition {
  switch (tank.direction) {
    case "up":
      return { row: tank.row, col: tank.col + 1 };
    case "right":
      return { row: tank.row + 1, col: tank.col + BATTLE_CITY_TANK_SIZE };
    case "down":
      return { row: tank.row + BATTLE_CITY_TANK_SIZE, col: tank.col + 1 };
    case "left":
      return { row: tank.row + 1, col: tank.col };
  }
}

export function isTankPositionOpen(
  terrain: BattleCityTerrain[][],
  terrainFragments: number[][],
  row: number,
  col: number,
  occupied: BattleCityPosition[],
): boolean {
  if (
    row < -POSITION_EPSILON ||
    col < -POSITION_EPSILON ||
    row + BATTLE_CITY_TANK_SIZE > BATTLE_CITY_BOARD_SIZE + POSITION_EPSILON ||
    col + BATTLE_CITY_TANK_SIZE > BATTLE_CITY_BOARD_SIZE + POSITION_EPSILON
  ) {
    return false;
  }
  const rows = getOverlappedTerrainRange(row, BATTLE_CITY_TANK_SIZE);
  const cols = getOverlappedTerrainRange(col, BATTLE_CITY_TANK_SIZE);
  const tankBounds = {
    bottom: row + BATTLE_CITY_TANK_SIZE,
    left: col,
    right: col + BATTLE_CITY_TANK_SIZE,
    top: row,
  };
  for (
    let terrainRow = rows.minimum;
    terrainRow <= rows.maximum;
    terrainRow += 1
  ) {
    for (
      let terrainCol = cols.minimum;
      terrainCol <= cols.maximum;
      terrainCol += 1
    ) {
      const terrainType = terrain[terrainRow]![terrainCol]!;
      if (terrainType === "brick" || terrainType === "steel") {
        if (
          battleCityTerrainFragmentsIntersectAabb(
            terrainFragments[terrainRow]![terrainCol]!,
            terrainRow,
            terrainCol,
            tankBounds,
          )
        ) {
          return false;
        }
      } else if (!isTankPassableTerrain(terrainType)) {
        return false;
      }
    }
  }
  return !occupied.some((position) => tanksIntersect({ row, col }, position));
}

function isTankPassableTerrain(terrain: BattleCityTerrain): boolean {
  return terrain === "empty" || terrain === "forest" || terrain === "ice";
}

export function tankTouchesTerrain(
  terrain: BattleCityTerrain[][],
  row: number,
  col: number,
  target: BattleCityTerrain,
): boolean {
  const rows = getOverlappedTerrainRange(row, BATTLE_CITY_TANK_SIZE);
  const cols = getOverlappedTerrainRange(col, BATTLE_CITY_TANK_SIZE);
  for (
    let terrainRow = rows.minimum;
    terrainRow <= rows.maximum;
    terrainRow += 1
  ) {
    for (
      let terrainCol = cols.minimum;
      terrainCol <= cols.maximum;
      terrainCol += 1
    ) {
      if (terrain[terrainRow]![terrainCol] === target) {
        return true;
      }
    }
  }
  return false;
}

function tanksIntersect(
  first: BattleCityPosition,
  second: BattleCityPosition,
): boolean {
  return (
    first.row < second.row + BATTLE_CITY_TANK_SIZE &&
    first.row + BATTLE_CITY_TANK_SIZE > second.row &&
    first.col < second.col + BATTLE_CITY_TANK_SIZE &&
    first.col + BATTLE_CITY_TANK_SIZE > second.col
  );
}

export function bulletHitsTank(
  bullet: BattleCityBullet,
  tank: BattleCityPosition,
): boolean {
  const tankCenterRow = tank.row + BATTLE_CITY_TANK_SIZE / 2;
  const tankCenterCol = tank.col + BATTLE_CITY_TANK_SIZE / 2;
  return (
    Math.abs(bullet.row - tankCenterRow) <
      BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE &&
    Math.abs(bullet.col - tankCenterCol) <
      BATTLE_CITY_TANK_BULLET_COLLISION_DISTANCE
  );
}

export function moveTankByDistance(
  terrain: BattleCityTerrain[][],
  terrainFragments: number[][],
  start: BattleCityPosition,
  direction: BattleCityDirection,
  distance: number,
  occupied: BattleCityPosition[],
): BattleCityPosition {
  const delta = DIRECTION_DELTAS[direction];
  let position = { ...start };
  let remaining = distance;

  while (remaining > POSITION_EPSILON) {
    const step = Math.min(BATTLE_CITY_PIXEL_STEP, remaining);
    const candidate = {
      col: normalizeCoordinate(position.col + delta.col * step),
      row: normalizeCoordinate(position.row + delta.row * step),
    };
    if (
      !isTankPositionOpen(
        terrain,
        terrainFragments,
        candidate.row,
        candidate.col,
        [],
      ) ||
      !doesTankMoveAvoidOccupied(position, candidate, occupied)
    ) {
      break;
    }
    position = candidate;
    remaining -= step;
  }

  return position;
}

function doesTankMoveAvoidOccupied(
  current: BattleCityPosition,
  candidate: BattleCityPosition,
  occupied: BattleCityPosition[],
): boolean {
  return occupied.every((other) => {
    const currentOverlap = getTankOverlapArea(current, other);
    const candidateOverlap = getTankOverlapArea(candidate, other);
    return currentOverlap > POSITION_EPSILON
      ? candidateOverlap < currentOverlap - POSITION_EPSILON
      : candidateOverlap <= POSITION_EPSILON;
  });
}

function getTankOverlapArea(
  first: BattleCityPosition,
  second: BattleCityPosition,
): number {
  const overlapWidth = Math.max(
    0,
    Math.min(
      first.col + BATTLE_CITY_TANK_SIZE,
      second.col + BATTLE_CITY_TANK_SIZE,
    ) - Math.max(first.col, second.col),
  );
  const overlapHeight = Math.max(
    0,
    Math.min(
      first.row + BATTLE_CITY_TANK_SIZE,
      second.row + BATTLE_CITY_TANK_SIZE,
    ) - Math.max(first.row, second.row),
  );
  return overlapWidth * overlapHeight;
}

export function getTankDirectionLaneSnapCandidates(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): BattleCityPosition[] {
  const preferred = snapTankToDirectionLane(position, direction);
  const laneCoordinate =
    direction === "up" || direction === "down"
      ? position.col
      : position.row;
  if (!isHalfCoordinate(laneCoordinate)) {
    return [preferred];
  }
  const lowerLane = Math.floor(laneCoordinate);
  const fallback =
    direction === "up" || direction === "down"
      ? { ...position, col: lowerLane }
      : { ...position, row: lowerLane };
  return positionsEqual(preferred, fallback)
    ? [preferred]
    : [preferred, fallback];
}

function snapTankToDirectionLane(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): BattleCityPosition {
  return direction === "up" || direction === "down"
    ? { ...position, col: Math.floor(position.col + 0.5) }
    : { ...position, row: Math.floor(position.row + 0.5) };
}

export function tankIsAlignedToDirectionLane(
  position: BattleCityPosition,
  direction: BattleCityDirection,
): boolean {
  return direction === "up" || direction === "down"
    ? isWholeCoordinate(position.col)
    : isWholeCoordinate(position.row);
}

export function tankIsAlignedToTerrainGrid(
  position: BattleCityPosition,
): boolean {
  return isWholeCoordinate(position.row) && isWholeCoordinate(position.col);
}

function isWholeCoordinate(value: number): boolean {
  return Math.abs(value - Math.round(value)) <= POSITION_EPSILON;
}

function isHalfCoordinate(value: number): boolean {
  return (
    Math.abs(value - (Math.floor(value) + 0.5)) <= POSITION_EPSILON
  );
}

function getOverlappedTerrainRange(start: number, size: number) {
  return {
    maximum: Math.ceil(start + size - POSITION_EPSILON) - 1,
    minimum: Math.floor(start + POSITION_EPSILON),
  };
}

export function positionsEqual(
  first: BattleCityPosition,
  second: BattleCityPosition,
): boolean {
  return (
    Math.abs(first.row - second.row) <= POSITION_EPSILON &&
    Math.abs(first.col - second.col) <= POSITION_EPSILON
  );
}

export function normalizeCoordinate(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000;
}

export function isPointInsideBoard(row: number, col: number): boolean {
  return (
    row >= 0 &&
    row < BATTLE_CITY_BOARD_SIZE &&
    col >= 0 &&
    col < BATTLE_CITY_BOARD_SIZE
  );
}

export function isMuzzlePositionValid(row: number, col: number): boolean {
  // The NES creates an outward shell on the leading edge even when that
  // coordinate is the bottom or right playfield boundary. Its first movement
  // step then removes it, matching the equivalent top and left edge shots.
  return (
    row >= 0 &&
    row <= BATTLE_CITY_BOARD_SIZE &&
    col >= 0 &&
    col <= BATTLE_CITY_BOARD_SIZE
  );
}

export function isInsideBoard(row: number, col: number): boolean {
  return (
    row >= 0 &&
    row < BATTLE_CITY_BOARD_SIZE &&
    col >= 0 &&
    col < BATTLE_CITY_BOARD_SIZE
  );
}
