import {
  ASTEROIDS_SHIP_EXPLOSION_TICKS,
  SHIP_FRICTION,
  SHIP_MAX_SPEED,
  SHIP_RADIUS,
  SHIP_THRUST,
  SHIP_TURN_DEGREES,
} from "./constants";
import {
  getAngleVector,
  limitVelocity,
  normalizeAngle,
  wrapCoordinate,
} from "./geometry";
import type {
  AsteroidsControlInput,
  AsteroidsGameState,
  AsteroidsShipOwnedState,
  AsteroidsShip,
  AsteroidsShipExplosion,
} from "./types";

export function advanceShip(
  game: Pick<AsteroidsGameState, "boardHeight" | "boardWidth"> &
    Pick<AsteroidsShipOwnedState, "engineSpeedMultiplier" | "ship">,
  controls: AsteroidsControlInput,
): AsteroidsShip {
  const shouldRotateLeft = controls.rotateLeft === true && controls.rotateRight !== true;
  const shouldRotateRight = controls.rotateRight === true && controls.rotateLeft !== true;
  let angle = game.ship.angle;

  if (shouldRotateLeft) {
    angle -= SHIP_TURN_DEGREES;
  } else if (shouldRotateRight) {
    angle += SHIP_TURN_DEGREES;
  }

  const heading = getAngleVector(angle);
  const acceleratedVelocity =
    controls.thrust === true
      ? {
          x: game.ship.velocity.x + heading.x * getShipThrust(game),
          y: game.ship.velocity.y + heading.y * getShipThrust(game),
        }
      : game.ship.velocity;
  const velocity = limitVelocity(
    {
      x: acceleratedVelocity.x * SHIP_FRICTION,
      y: acceleratedVelocity.y * SHIP_FRICTION,
    },
    getShipMaxSpeed(game),
  );

  return {
    ...game.ship,
    angle: normalizeAngle(angle),
    isThrusting: controls.thrust === true,
    velocity,
    x: wrapCoordinate(game.ship.x + velocity.x, game.boardWidth),
    y: wrapCoordinate(game.ship.y + velocity.y, game.boardHeight),
  };
}

function getShipMaxSpeed(game: Pick<AsteroidsShipOwnedState, "engineSpeedMultiplier">) {
  return SHIP_MAX_SPEED * game.engineSpeedMultiplier;
}

function getShipThrust(game: Pick<AsteroidsShipOwnedState, "engineSpeedMultiplier">) {
  return SHIP_THRUST * game.engineSpeedMultiplier;
}

export function createInitialAsteroidsShipOwnedState(
  boardWidth: number,
  boardHeight: number,
): AsteroidsShipOwnedState {
  return {
    bulletSpeedMultiplier: 1,
    bullets: [],
    engineSpeedMultiplier: 1,
    respawnInvulnerabilityTicks: 0,
    ship: createCenteredShip(boardWidth, boardHeight),
    shipExplosion: null,
    shotCooldownTicks: 0,
    shotIntervalMultiplier: 1,
  };
}

export function getAsteroidsShipOwnedState(
  game: AsteroidsShipOwnedState,
): AsteroidsShipOwnedState {
  return {
    bulletSpeedMultiplier: game.bulletSpeedMultiplier,
    bullets: game.bullets,
    engineSpeedMultiplier: game.engineSpeedMultiplier,
    respawnInvulnerabilityTicks: game.respawnInvulnerabilityTicks,
    ship: game.ship,
    shipExplosion: game.shipExplosion,
    shotCooldownTicks: game.shotCooldownTicks,
    shotIntervalMultiplier: game.shotIntervalMultiplier,
  };
}

export function applyAsteroidsShipOwnedState(
  game: AsteroidsGameState,
  shipState: AsteroidsShipOwnedState,
): AsteroidsGameState {
  return {
    ...game,
    bulletSpeedMultiplier: shipState.bulletSpeedMultiplier,
    bullets: shipState.bullets,
    engineSpeedMultiplier: shipState.engineSpeedMultiplier,
    respawnInvulnerabilityTicks: shipState.respawnInvulnerabilityTicks,
    ship: shipState.ship,
    shipExplosion: shipState.shipExplosion,
    shotCooldownTicks: shipState.shotCooldownTicks,
    shotIntervalMultiplier: shipState.shotIntervalMultiplier,
  };
}

export function createShipExplosion(ship: AsteroidsShip): AsteroidsShipExplosion {
  return {
    durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
    radius: ship.radius,
    ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
    x: ship.x,
    y: ship.y,
  };
}

export function createCenteredShip(boardWidth: number, boardHeight: number): AsteroidsShip {
  return {
    angle: -90,
    isThrusting: false,
    radius: SHIP_RADIUS,
    velocity: { x: 0, y: 0 },
    x: boardWidth / 2,
    y: boardHeight / 2,
  };
}
