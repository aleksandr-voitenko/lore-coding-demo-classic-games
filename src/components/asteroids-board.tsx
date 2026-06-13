"use client";

import type { CSSProperties, ReactNode } from "react";

import type { AsteroidsHitSpark, AsteroidsHitSparkColor } from "@/components/asteroids-hit-sparks";
import type { AsteroidsPickupFeedback } from "@/components/asteroids-pickup-feedback";
import {
  ASTEROIDS_TICK_DELAY_MS,
  type Asteroid,
  type AsteroidsGameState,
  type AsteroidsPowerUp,
  type AsteroidsPowerUpKind,
  type AsteroidsSaucer,
  getAsteroidsSaucerScore,
  type AsteroidsShip,
  type AsteroidsShipExplosion,
} from "@/lib/asteroids-game-engine";
import { cn } from "@/lib/utils";

type AsteroidsBoardProps = {
  children?: ReactNode;
  game: AsteroidsGameState;
  hitSparks?: AsteroidsHitSpark[];
  pickupFeedbacks?: AsteroidsPickupFeedback[];
  statusLabel: string;
};

type RenderPosition = {
  x: number;
  y: number;
};

const SHIP_EXPLOSION_RAYS = Array.from(
  { length: 10 },
  (_, index) => (index / 10) * Math.PI * 2,
);
const SHIP_SHIELD_BLINK_INTERVAL_TICKS = Math.ceil(120 / ASTEROIDS_TICK_DELAY_MS);
const SHIP_SHIELD_WARNING_TICKS = Math.ceil(1_000 / ASTEROIDS_TICK_DELAY_MS);
const SHIP_SHIELD_RADIUS_MULTIPLIER = 1.82;
const SHIP_SHIELD_READY_OPACITY = 0.68;
const SHIP_SHIELD_BLINK_DIM_OPACITY = 0.18;
const SHIP_SHIELD_BLINK_BRIGHT_OPACITY = 0.82;

const asteroidsBoardBackgroundStyle: CSSProperties = {
  background:
    "radial-gradient(circle at 18% 22%, color-mix(in_oklch,var(--asteroids-star)_82%,transparent) 0 1px, transparent 1.5px), radial-gradient(circle at 78% 18%, color-mix(in_oklch,var(--asteroids-star)_68%,transparent) 0 1px, transparent 1.5px), radial-gradient(circle at 64% 72%, color-mix(in_oklch,var(--asteroids-star)_72%,transparent) 0 1px, transparent 1.5px), linear-gradient(180deg, color-mix(in_oklch,var(--asteroids-board)_92%,black), var(--asteroids-board))",
  backgroundSize: "140px 140px, 190px 190px, 170px 170px, auto",
  containerType: "size",
};

export function AsteroidsBoard({
  children,
  game,
  hitSparks = [],
  pickupFeedbacks = [],
  statusLabel,
}: AsteroidsBoardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--asteroids-board-border)] bg-[var(--asteroids-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--asteroids-board)_28%,transparent)]"
      style={{ aspectRatio: `${game.boardWidth} / ${game.boardHeight}` }}
    >
      <div
        aria-label={`Asteroids board. Field ${game.boardWidth} by ${game.boardHeight}. Score ${game.score}. Lives ${game.lives}. Wave ${game.wave}. ${game.asteroids.length} asteroids remaining. ${statusLabel}.${getShipStateLabel(game)}${getSaucerStateLabel(game)}${getPowerUpStateLabel(game)}`}
        className="relative size-full overflow-hidden rounded-[0.375rem] bg-[var(--asteroids-board)] text-[var(--asteroids-board-text)]"
        data-testid="asteroids-board"
        role="img"
        style={asteroidsBoardBackgroundStyle}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full"
          preserveAspectRatio="none"
          viewBox={`0 0 ${game.boardWidth} ${game.boardHeight}`}
        >
          <defs>
            <filter id="asteroids-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <line
            className="stroke-[color-mix(in_oklch,var(--asteroids-board-text)_18%,transparent)]"
            strokeDasharray="2 12"
            strokeLinecap="round"
            strokeWidth="1"
            x1="0"
            x2={game.boardWidth}
            y1={game.boardHeight / 2}
            y2={game.boardHeight / 2}
          />
          <line
            className="stroke-[color-mix(in_oklch,var(--asteroids-board-text)_12%,transparent)]"
            strokeDasharray="2 14"
            strokeLinecap="round"
            strokeWidth="1"
            x1={game.boardWidth / 2}
            x2={game.boardWidth / 2}
            y1="0"
            y2={game.boardHeight}
          />

          {game.asteroids.flatMap((asteroid) =>
            getWrappedRenderPositions({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              radius: asteroid.radius,
              x: asteroid.x,
              y: asteroid.y,
            }).map((position) => (
              <polygon
                className="fill-[color-mix(in_oklch,var(--asteroids-asteroid)_10%,transparent)] stroke-[var(--asteroids-asteroid)] drop-shadow-[0_0_9px_color-mix(in_oklch,var(--asteroids-asteroid)_42%,transparent)]"
                data-testid={position.x === asteroid.x && position.y === asteroid.y ? "asteroids-asteroid" : undefined}
                filter="url(#asteroids-glow)"
                key={`${asteroid.id}:${position.x}:${position.y}`}
                points={getAsteroidPolygonPoints(asteroid, position)}
                strokeLinejoin="round"
                strokeWidth={getAsteroidStrokeWidth(asteroid)}
              />
            )),
          )}

          {game.bullets.flatMap((bullet) =>
            getWrappedRenderPositions({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              radius: bullet.radius,
              x: bullet.x,
              y: bullet.y,
            }).map((position) => (
              <circle
                className="fill-[var(--asteroids-bullet)] drop-shadow-[0_0_8px_color-mix(in_oklch,var(--asteroids-bullet)_72%,transparent)]"
                data-testid={position.x === bullet.x && position.y === bullet.y ? "asteroids-bullet" : undefined}
                key={`${bullet.id}:${position.x}:${position.y}`}
                r={bullet.radius}
                cx={position.x}
                cy={position.y}
              />
            )),
          )}

          {game.saucerBullets.flatMap((bullet) =>
            getWrappedRenderPositions({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              radius: bullet.radius,
              x: bullet.x,
              y: bullet.y,
            }).map((position) => (
              <circle
                className="fill-[var(--asteroids-saucer-shot)] drop-shadow-[0_0_8px_color-mix(in_oklch,var(--asteroids-saucer-shot)_72%,transparent)]"
                data-testid={position.x === bullet.x && position.y === bullet.y ? "asteroids-saucer-shot" : undefined}
                key={`${bullet.id}:${position.x}:${position.y}`}
                r={bullet.radius}
                cx={position.x}
                cy={position.y}
              />
            )),
          )}

          {game.powerUp === null
            ? null
            : getWrappedRenderPositions({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                radius: game.powerUp.radius,
                x: game.powerUp.x,
                y: game.powerUp.y,
              }).map((position) => (
                <PowerUp
                  isPrimary={position.x === game.powerUp!.x && position.y === game.powerUp!.y}
                  key={`${game.powerUp!.id}:${position.x}:${position.y}`}
                  position={position}
                  powerUp={game.powerUp!}
                />
              ))}

          {hitSparks.flatMap((spark) =>
            getWrappedRenderPositions({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              radius: getHitSparkWrapRadius(spark),
              x: spark.x,
              y: spark.y,
            }).map((position) => (
              <HitSparkBurst
                isPrimary={position.x === spark.x && position.y === spark.y}
                key={`${spark.id}:${position.x}:${position.y}`}
                position={position}
                spark={spark}
              />
            )),
          )}

          {pickupFeedbacks.flatMap((feedback) =>
            getWrappedRenderPositions({
              boardHeight: game.boardHeight,
              boardWidth: game.boardWidth,
              radius: getPickupFeedbackWrapRadius(feedback),
              x: feedback.x,
              y: feedback.y,
            }).map((position) => (
              <PickupFeedback
                feedback={feedback}
                isPrimary={position.x === feedback.x && position.y === feedback.y}
                key={`${feedback.id}:${position.x}:${position.y}`}
                position={position}
              />
            )),
          )}

          {game.saucer === null ? null : <Saucer saucer={game.saucer} />}

          {game.shipExplosion === null
            ? null
            : getWrappedRenderPositions({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                radius: game.shipExplosion.radius * 5,
                x: game.shipExplosion.x,
                y: game.shipExplosion.y,
              }).map((position) => (
                <ShipExplosion
                  explosion={game.shipExplosion!}
                  isPrimary={position.x === game.shipExplosion!.x && position.y === game.shipExplosion!.y}
                  key={`ship-explosion:${position.x}:${position.y}`}
                  position={position}
                />
              ))}

          {game.shipExplosion !== null || game.status === "lost"
            ? null
            : getWrappedRenderPositions({
                boardHeight: game.boardHeight,
                boardWidth: game.boardWidth,
                radius: game.ship.radius * 1.9,
                x: game.ship.x,
                y: game.ship.y,
              }).map((position) => (
                <g
                  className={cn(
                    "stroke-[var(--asteroids-ship)] drop-shadow-[0_0_12px_color-mix(in_oklch,var(--asteroids-ship)_62%,transparent)]",
                    game.respawnInvulnerabilityTicks > 0 && "opacity-80",
                  )}
                  data-testid={position.x === game.ship.x && position.y === game.ship.y ? "asteroids-ship" : undefined}
                  filter="url(#asteroids-glow)"
                  key={`ship:${position.x}:${position.y}`}
                >
                  {game.respawnInvulnerabilityTicks > 0 ? (
                    <circle
                      className="fill-none stroke-[color-mix(in_oklch,var(--asteroids-bullet)_78%,var(--asteroids-ship))] drop-shadow-[0_0_16px_color-mix(in_oklch,var(--asteroids-bullet)_70%,transparent)]"
                      cx={position.x}
                      cy={position.y}
                      data-testid={position.x === game.ship.x && position.y === game.ship.y ? "asteroids-ship-shield" : undefined}
                      opacity={getShipShieldOpacity(game.respawnInvulnerabilityTicks)}
                      r={getShipShieldRadius(game.ship)}
                      strokeDasharray="6 8"
                      strokeLinecap="round"
                      strokeWidth="2.5"
                    />
                  ) : null}
                  <polygon
                    className="fill-[color-mix(in_oklch,var(--asteroids-ship)_10%,transparent)]"
                    points={getShipPolygonPoints(game.ship, position)}
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                  />
                  {game.ship.isThrusting ? (
                    <polygon
                      className="fill-[var(--asteroids-thrust)] stroke-[var(--asteroids-thrust)]"
                      points={getShipFlamePoints(game.ship, position)}
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  ) : null}
                </g>
              ))}
        </svg>

        {children}
      </div>
    </div>
  );
}

function Saucer({ saucer }: { saucer: AsteroidsSaucer }) {
  const bodyRadiusX = saucer.radius * 1.72;
  const bodyRadiusY = saucer.radius * 0.46;
  const domeRadiusX = saucer.radius * 0.82;
  const domeHeight = saucer.radius * 0.72;
  const rimY = saucer.y + bodyRadiusY * 0.18;

  return (
    <g
      className="stroke-[var(--asteroids-saucer)] drop-shadow-[0_0_13px_color-mix(in_oklch,var(--asteroids-saucer)_58%,transparent)]"
      data-saucer-kind={saucer.kind}
      data-saucer-points={getAsteroidsSaucerScore(saucer.kind)}
      data-testid="asteroids-saucer"
      filter="url(#asteroids-glow)"
    >
      <path
        className="fill-[color-mix(in_oklch,var(--asteroids-saucer)_16%,transparent)]"
        d={[
          `M ${saucer.x - domeRadiusX} ${saucer.y - bodyRadiusY * 0.28}`,
          `Q ${saucer.x} ${saucer.y - domeHeight}`,
          `${saucer.x + domeRadiusX} ${saucer.y - bodyRadiusY * 0.28}`,
        ].join(" ")}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
      />
      <ellipse
        className="fill-[color-mix(in_oklch,var(--asteroids-saucer)_10%,transparent)]"
        cx={saucer.x}
        cy={saucer.y}
        rx={bodyRadiusX}
        ry={bodyRadiusY}
        strokeLinejoin="round"
        strokeWidth="2.4"
      />
      <line
        className="stroke-[color-mix(in_oklch,var(--asteroids-saucer)_78%,var(--asteroids-board-text))]"
        strokeLinecap="round"
        strokeWidth="1.7"
        x1={saucer.x - bodyRadiusX * 0.62}
        x2={saucer.x + bodyRadiusX * 0.62}
        y1={rimY}
        y2={rimY}
      />
    </g>
  );
}

function PowerUp({
  isPrimary,
  position,
  powerUp,
}: {
  isPrimary: boolean;
  position: RenderPosition;
  powerUp: AsteroidsPowerUp;
}) {
  const color = getPowerUpColor(powerUp.kind);

  return (
    <g
      data-power-up-kind={powerUp.kind}
      data-power-up-label={getAsteroidsPowerUpLabel(powerUp.kind)}
      data-testid={isPrimary ? "asteroids-power-up" : undefined}
      filter="url(#asteroids-glow)"
    >
      <circle
        cx={position.x}
        cy={position.y}
        fill={`color-mix(in_oklch,${color}_14%,transparent)`}
        r={powerUp.radius}
        stroke={color}
        strokeDasharray="3 5"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <circle
        cx={position.x}
        cy={position.y}
        fill="none"
        opacity="0.48"
        r={powerUp.radius * 1.28}
        stroke={color}
        strokeWidth="1"
      />
      <g data-testid={isPrimary ? "asteroids-power-up-icon" : undefined}>
        <PowerUpIcon color={color} kind={powerUp.kind} position={position} radius={powerUp.radius} />
      </g>
    </g>
  );
}

function PowerUpIcon({
  color,
  kind,
  position,
  radius,
}: {
  color: string;
  kind: AsteroidsPowerUpKind;
  position: RenderPosition;
  radius: number;
}) {
  switch (kind) {
    case "bonus-score":
      return (
        <>
          <polygon
            fill={`color-mix(in_oklch,${color}_22%,transparent)`}
            points={getPowerUpStarPoints(position, radius * 0.62, radius * 0.27)}
            stroke={color}
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <line
            stroke={color}
            strokeLinecap="round"
            strokeWidth="1.8"
            x1={position.x - radius * 0.23}
            x2={position.x + radius * 0.23}
            y1={position.y}
            y2={position.y}
          />
          <line
            stroke={color}
            strokeLinecap="round"
            strokeWidth="1.8"
            x1={position.x}
            x2={position.x}
            y1={position.y - radius * 0.23}
            y2={position.y + radius * 0.23}
          />
        </>
      );
    case "bullet-speed":
      return (
        <>
          <line
            stroke={color}
            strokeLinecap="round"
            strokeWidth="2.2"
            x1={position.x - radius * 0.52}
            x2={position.x + radius * 0.46}
            y1={position.y}
            y2={position.y}
          />
          <polyline
            fill="none"
            points={`${position.x + radius * 0.08},${position.y - radius * 0.46} ${position.x + radius * 0.54},${position.y} ${position.x + radius * 0.08},${position.y + radius * 0.46}`}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
          <polyline
            fill="none"
            opacity="0.7"
            points={`${position.x - radius * 0.36},${position.y - radius * 0.36} ${position.x + radius * 0.02},${position.y} ${position.x - radius * 0.36},${position.y + radius * 0.36}`}
            stroke={color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </>
      );
    case "engine-speed":
      return (
        <>
          <path
            d={[
              `M ${position.x} ${position.y - radius * 0.7}`,
              `C ${position.x + radius * 0.5} ${position.y - radius * 0.16}`,
              `${position.x + radius * 0.32} ${position.y + radius * 0.48}`,
              `${position.x} ${position.y + radius * 0.7}`,
              `C ${position.x - radius * 0.34} ${position.y + radius * 0.4}`,
              `${position.x - radius * 0.48} ${position.y - radius * 0.14}`,
              `${position.x} ${position.y - radius * 0.7}`,
            ].join(" ")}
            fill={`color-mix(in_oklch,${color}_28%,transparent)`}
            stroke={color}
            strokeLinejoin="round"
            strokeWidth="1.9"
          />
          <path
            d={[
              `M ${position.x} ${position.y - radius * 0.24}`,
              `C ${position.x + radius * 0.22} ${position.y + radius * 0.1}`,
              `${position.x + radius * 0.12} ${position.y + radius * 0.42}`,
              `${position.x} ${position.y + radius * 0.54}`,
              `C ${position.x - radius * 0.14} ${position.y + radius * 0.3}`,
              `${position.x - radius * 0.15} ${position.y + radius * 0.02}`,
              `${position.x} ${position.y - radius * 0.24}`,
            ].join(" ")}
            fill={color}
            opacity="0.82"
          />
        </>
      );
    case "shield":
      return (
        <path
          d={[
            `M ${position.x} ${position.y - radius * 0.68}`,
            `L ${position.x + radius * 0.52} ${position.y - radius * 0.42}`,
            `L ${position.x + radius * 0.42} ${position.y + radius * 0.18}`,
            `Q ${position.x} ${position.y + radius * 0.68}`,
            `${position.x - radius * 0.42} ${position.y + radius * 0.18}`,
            `L ${position.x - radius * 0.52} ${position.y - radius * 0.42}`,
            "Z",
          ].join(" ")}
          fill={`color-mix(in_oklch,${color}_18%,transparent)`}
          stroke={color}
          strokeLinejoin="round"
          strokeWidth="2"
        />
      );
    case "shot-interval":
      return (
        <>
          <circle
            cx={position.x}
            cy={position.y}
            fill="none"
            r={radius * 0.56}
            stroke={color}
            strokeWidth="1.8"
          />
          <path
            d={[
              `M ${position.x} ${position.y}`,
              `L ${position.x} ${position.y - radius * 0.34}`,
              `M ${position.x} ${position.y}`,
              `L ${position.x + radius * 0.34} ${position.y}`,
            ].join(" ")}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth="2"
          />
          <path
            d={[
              `M ${position.x + radius * 0.2} ${position.y - radius * 0.66}`,
              `Q ${position.x + radius * 0.68} ${position.y - radius * 0.48}`,
              `${position.x + radius * 0.62} ${position.y + radius * 0.02}`,
            ].join(" ")}
            fill="none"
            stroke={color}
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </>
      );
  }
}

function HitSparkBurst({
  isPrimary,
  position,
  spark,
}: {
  isPrimary: boolean;
  position: RenderPosition;
  spark: AsteroidsHitSpark;
}) {
  const progress = Math.min(1, spark.ageTicks / spark.durationTicks);
  const easedProgress = 1 - (1 - progress) * (1 - progress);
  const opacity = Math.max(0, 0.96 - progress * 0.96);

  return (
    <g
      className="drop-shadow-[0_0_7px_color-mix(in_oklch,var(--asteroids-bullet)_58%,transparent)]"
      data-testid={isPrimary ? "asteroids-hit-spark" : undefined}
      opacity={opacity}
    >
      {spark.particles.map((particle, index) => {
        const distance = particle.travelDistance * (0.16 + easedProgress * 0.84);
        const end = getPointAtAngle(position, particle.angle, distance);
        const start = getPointAtAngle(
          position,
          particle.angle,
          Math.max(0, distance - particle.length * (1 - progress * 0.22)),
        );

        return (
          <line
            key={`${spark.id}:particle:${index}`}
            stroke={getHitSparkStroke(particle.color)}
            strokeLinecap="round"
            strokeWidth={Math.max(0.35, particle.radius * (1 - progress * 0.28))}
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        );
      })}
    </g>
  );
}

function PickupFeedback({
  feedback,
  isPrimary,
  position,
}: {
  feedback: AsteroidsPickupFeedback;
  isPrimary: boolean;
  position: RenderPosition;
}) {
  const progress = Math.min(1, feedback.ageTicks / feedback.durationTicks);
  const yOffset = -18 - progress * 16;
  const opacity = Math.max(0, 1 - progress);

  return (
    <g
      data-pickup-feedback-kind={feedback.kind}
      data-testid={isPrimary ? "asteroids-pickup-feedback" : undefined}
      opacity={opacity}
      transform={`translate(0 ${yOffset})`}
    >
      <text
        dominantBaseline="middle"
        fill={getPowerUpColor(feedback.kind)}
        fontFamily="var(--font-geist-mono), monospace"
        fontSize="15"
        fontWeight="700"
        paintOrder="stroke"
        stroke="var(--asteroids-board)"
        strokeLinejoin="round"
        strokeWidth="4"
        textAnchor="middle"
        x={position.x}
        y={position.y}
      >
        {feedback.label}
      </text>
    </g>
  );
}

function ShipExplosion({
  explosion,
  isPrimary,
  position,
}: {
  explosion: AsteroidsShipExplosion;
  isPrimary: boolean;
  position: RenderPosition;
}) {
  const progress = getShipExplosionProgress(explosion);
  const opacity = Math.max(0.08, 1 - progress * 0.92);
  const coreRadius = explosion.radius * (0.6 + progress * 1.5);
  const shockwaveRadius = explosion.radius * (1.1 + progress * 4.2);
  const rayStartRadius = explosion.radius * (0.7 + progress * 0.85);
  const rayEndRadius = explosion.radius * (1.7 + progress * 4.1);

  return (
    <g
      className="drop-shadow-[0_0_18px_color-mix(in_oklch,var(--asteroids-thrust)_78%,transparent)]"
      data-testid={isPrimary ? "asteroids-ship-explosion" : undefined}
    >
      <circle
        className="fill-[color-mix(in_oklch,var(--asteroids-thrust)_28%,transparent)] stroke-[var(--asteroids-thrust)]"
        cx={position.x}
        cy={position.y}
        opacity={opacity}
        r={coreRadius}
        strokeWidth="2.5"
      />
      <circle
        className="fill-none stroke-[color-mix(in_oklch,var(--asteroids-bullet)_78%,var(--asteroids-thrust))]"
        cx={position.x}
        cy={position.y}
        opacity={Math.max(0.06, 0.72 - progress * 0.66)}
        r={shockwaveRadius}
        strokeDasharray="5 9"
        strokeLinecap="round"
        strokeWidth="2"
      />
      {SHIP_EXPLOSION_RAYS.map((angle, index) => {
        const start = getPointAtAngle(position, angle, rayStartRadius);
        const end = getPointAtAngle(position, angle, rayEndRadius);

        return (
          <line
            className="stroke-[color-mix(in_oklch,var(--asteroids-thrust)_88%,var(--asteroids-bullet))]"
            key={`ray:${index}`}
            opacity={Math.max(0.05, 0.82 - progress * 0.76)}
            strokeLinecap="round"
            strokeWidth="2"
            x1={start.x}
            x2={end.x}
            y1={start.y}
            y2={end.y}
          />
        );
      })}
    </g>
  );
}

function getWrappedRenderPositions({
  boardHeight,
  boardWidth,
  radius,
  x,
  y,
}: {
  boardHeight: number;
  boardWidth: number;
  radius: number;
  x: number;
  y: number;
}): RenderPosition[] {
  const xOffsets = [0];
  const yOffsets = [0];

  if (x < radius) {
    xOffsets.push(boardWidth);
  } else if (x > boardWidth - radius) {
    xOffsets.push(-boardWidth);
  }

  if (y < radius) {
    yOffsets.push(boardHeight);
  } else if (y > boardHeight - radius) {
    yOffsets.push(-boardHeight);
  }

  return xOffsets.flatMap((xOffset) =>
    yOffsets.map((yOffset) => ({
      x: x + xOffset,
      y: y + yOffset,
    })),
  );
}

function getShipStateLabel(game: AsteroidsGameState) {
  if (game.shipExplosion !== null) {
    return " Ship exploding.";
  }

  if (game.respawnInvulnerabilityTicks > 0 && game.status === "running") {
    return " Shield active.";
  }

  return "";
}

function getSaucerStateLabel(game: AsteroidsGameState) {
  if (game.saucer === null) {
    return "";
  }

  return ` ${game.saucer.kind === "small" ? "Small" : "Large"} saucer active.`;
}

function getPowerUpStateLabel(game: AsteroidsGameState) {
  if (game.powerUp === null) {
    return "";
  }

  return ` ${getAsteroidsPowerUpLabel(game.powerUp.kind)} power-up active.`;
}

function getAsteroidsPowerUpLabel(kind: AsteroidsPowerUpKind) {
  switch (kind) {
    case "bonus-score":
      return "Bonus score";
    case "bullet-speed":
      return "Bullet speed";
    case "engine-speed":
      return "Engine speed";
    case "shield":
      return "Shield";
    case "shot-interval":
      return "Shot interval";
  }
}

function getPowerUpColor(kind: AsteroidsPowerUpKind) {
  switch (kind) {
    case "bonus-score":
      return "var(--asteroids-saucer-shot)";
    case "bullet-speed":
      return "var(--asteroids-bullet)";
    case "engine-speed":
      return "var(--asteroids-thrust)";
    case "shield":
      return "var(--asteroids-ship)";
    case "shot-interval":
      return "var(--asteroids-saucer)";
  }
}

function getPowerUpStarPoints(
  position: RenderPosition,
  outerRadius: number,
  innerRadius: number,
) {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index / 10) * Math.PI * 2;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;

    return `${position.x + Math.cos(angle) * radius},${position.y + Math.sin(angle) * radius}`;
  }).join(" ");
}

function getShipShieldRadius(ship: AsteroidsShip) {
  return ship.radius * SHIP_SHIELD_RADIUS_MULTIPLIER;
}

function getShipShieldOpacity(ticksRemaining: number) {
  if (ticksRemaining > SHIP_SHIELD_WARNING_TICKS) {
    return SHIP_SHIELD_READY_OPACITY;
  }

  const blinkPhase = Math.floor(ticksRemaining / SHIP_SHIELD_BLINK_INTERVAL_TICKS);

  return blinkPhase % 2 === 0
    ? SHIP_SHIELD_BLINK_DIM_OPACITY
    : SHIP_SHIELD_BLINK_BRIGHT_OPACITY;
}

function getShipExplosionProgress(explosion: AsteroidsShipExplosion) {
  return Math.min(
    1,
    Math.max(0, 1 - explosion.ticksRemaining / explosion.durationTicks),
  );
}

function getHitSparkWrapRadius(spark: AsteroidsHitSpark) {
  return spark.particles.reduce(
    (maxRadius, particle) =>
      Math.max(maxRadius, particle.travelDistance + particle.length),
    0,
  );
}

function getPickupFeedbackWrapRadius(feedback: AsteroidsPickupFeedback) {
  return Math.max(46, feedback.label.length * 5.8);
}

function getHitSparkStroke(color: AsteroidsHitSparkColor) {
  if (color === "saucerShot") {
    return "var(--asteroids-saucer-shot)";
  }

  if (color === "thrust") {
    return "var(--asteroids-thrust)";
  }

  if (color === "ship") {
    return "var(--asteroids-ship)";
  }

  return "color-mix(in_oklch,var(--asteroids-bullet)_88%,var(--asteroids-board-text))";
}

function getAsteroidPolygonPoints(asteroid: Asteroid, position: RenderPosition) {
  return asteroid.shape
    .map((radiusMultiplier, index) => {
      const angle = (index / asteroid.shape.length) * Math.PI * 2;
      const radius = asteroid.radius * radiusMultiplier;

      return `${position.x + Math.cos(angle) * radius},${position.y + Math.sin(angle) * radius}`;
    })
    .join(" ");
}

function getShipPolygonPoints(ship: AsteroidsShip, position: RenderPosition) {
  const angle = (ship.angle * Math.PI) / 180;
  const nose = getPointAtAngle(position, angle, ship.radius * 1.42);
  const leftWing = getPointAtAngle(position, angle + 2.44, ship.radius * 1.06);
  const rear = getPointAtAngle(position, angle + Math.PI, ship.radius * 0.42);
  const rightWing = getPointAtAngle(position, angle - 2.44, ship.radius * 1.06);

  return [nose, leftWing, rear, rightWing].map(formatPoint).join(" ");
}

function getShipFlamePoints(ship: AsteroidsShip, position: RenderPosition) {
  const angle = (ship.angle * Math.PI) / 180;
  const rear = getPointAtAngle(position, angle + Math.PI, ship.radius * 0.58);
  const left = getPointAtAngle(position, angle + 2.74, ship.radius * 0.58);
  const right = getPointAtAngle(position, angle - 2.74, ship.radius * 0.58);
  const flame = getPointAtAngle(position, angle + Math.PI, ship.radius * 1.36);

  return [left, flame, right, rear].map(formatPoint).join(" ");
}

function getPointAtAngle(position: RenderPosition, angle: number, distance: number) {
  return {
    x: position.x + Math.cos(angle) * distance,
    y: position.y + Math.sin(angle) * distance,
  };
}

function formatPoint(point: RenderPosition) {
  return `${point.x},${point.y}`;
}

function getAsteroidStrokeWidth(asteroid: Asteroid) {
  if (asteroid.size === "large") {
    return 2.3;
  }

  if (asteroid.size === "medium") {
    return 2;
  }

  return 1.7;
}
