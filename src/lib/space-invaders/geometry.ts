export type SpaceInvadersRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function rectanglesIntersect(first: SpaceInvadersRect, second: SpaceInvadersRect) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

export function getEntityCenterX(entity: { width: number; x: number }) {
  return entity.x + entity.width / 2;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeSpaceInvadersDimension(
  value: number,
  fallback: number,
  minimum: number,
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.floor(value));
}
