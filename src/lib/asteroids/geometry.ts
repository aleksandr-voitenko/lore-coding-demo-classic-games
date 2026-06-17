import type { AsteroidsPoint, AsteroidsRandom } from "./types";

export function getRandomRange(
  random: AsteroidsRandom | undefined,
  minimum: number,
  maximum: number,
) {
  if (random === undefined) {
    return 1;
  }

  return minimum + random() * (maximum - minimum);
}

export function moveWrappedEntity<
  Entity extends { velocity: AsteroidsPoint; x: number; y: number },
>(entity: Entity, boardWidth: number, boardHeight: number): Entity {
  return {
    ...entity,
    x: wrapCoordinate(entity.x + entity.velocity.x, boardWidth),
    y: wrapCoordinate(entity.y + entity.velocity.y, boardHeight),
  };
}

export function entitiesCollideWrapped(
  first: { radius: number; x: number; y: number },
  second: { radius: number; x: number; y: number },
  boardWidth: number,
  boardHeight: number,
) {
  const dx = getWrappedDistance(first.x, second.x, boardWidth);
  const dy = getWrappedDistance(first.y, second.y, boardHeight);
  const radius = first.radius + second.radius;

  return dx * dx + dy * dy <= radius * radius;
}

export function entitiesCollide(
  first: { radius: number; x: number; y: number },
  second: { radius: number; x: number; y: number },
) {
  const dx = first.x - second.x;
  const dy = first.y - second.y;
  const radius = first.radius + second.radius;

  return dx * dx + dy * dy <= radius * radius;
}

function getWrappedDistance(first: number, second: number, limit: number) {
  const directDistance = Math.abs(first - second);

  return Math.min(directDistance, limit - directDistance);
}

export function getWrappedDelta(first: number, second: number, limit: number) {
  const directDelta = second - first;

  if (Math.abs(directDelta) <= limit / 2) {
    return directDelta;
  }

  return directDelta - Math.sign(directDelta) * limit;
}

export function getAngleVector(angle: number): AsteroidsPoint {
  const radians = (angle * Math.PI) / 180;

  return {
    x: Math.cos(radians),
    y: Math.sin(radians),
  };
}

export function getPointAtAngle(
  origin: { x: number; y: number },
  angle: number,
  distance: number,
): AsteroidsPoint {
  return {
    x: origin.x + Math.cos(angle) * distance,
    y: origin.y + Math.sin(angle) * distance,
  };
}

export function limitVelocity(velocity: AsteroidsPoint, maxSpeed: number): AsteroidsPoint {
  const speed = Math.hypot(velocity.x, velocity.y);

  if (speed <= maxSpeed) {
    return velocity;
  }

  const scale = maxSpeed / speed;

  return {
    x: velocity.x * scale,
    y: velocity.y * scale,
  };
}

export function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

export function wrapCoordinate(value: number, limit: number) {
  if (value < 0) {
    return value + limit;
  }

  if (value >= limit) {
    return value - limit;
  }

  return value;
}
