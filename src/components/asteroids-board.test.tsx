import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AsteroidsBoard } from "./asteroids-board";
import { expectMarkup, getMarkupAttribute } from "./game-board-test-utils";
import {
  ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
  ASTEROIDS_SHIP_EXPLOSION_TICKS,
  ASTEROIDS_TICK_DELAY_MS,
  createInitialAsteroidsGame,
  type AsteroidsPowerUpKind,
} from "@/lib/asteroids-game-engine";
import { createInitialAsteroidsMultiplayerGame } from "@/lib/asteroids-multiplayer";

function getExpectedAsteroidsPowerUpLabel(kind: AsteroidsPowerUpKind) {
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

describe("AsteroidsBoard", () => {
  it("renders Asteroids vector entities and score summary", () => {
    const game = createInitialAsteroidsGame();
    const markup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...game,
          bullets: [
            {
              id: "bullet-test",
              radius: 2.5,
              ttl: 20,
              velocity: { x: 0, y: -8 },
              x: 320,
              y: 220,
            },
          ],
          saucer: {
            id: "saucer-test",
            kind: "small",
            radius: 12,
            shotCooldownTicks: 20,
            velocity: { x: -1.8, y: 0 },
            x: 260,
            y: 120,
          },
          saucerBullets: [
            {
              id: "saucer-shot-test",
              radius: 2.5,
              ttl: 20,
              velocity: { x: 4.4, y: 0 },
              x: 280,
              y: 120,
            },
          ],
          score: 120,
          ship: {
            ...game.ship,
            isThrusting: true,
          },
          status: "running",
          wave: 2,
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="asteroids-board"',
      "Asteroids board. Field 800 by 600. Score 120. Lives 3. Wave 2. 4 asteroids remaining. Running. Small saucer active.",
      'data-testid="asteroids-asteroid"',
      'data-testid="asteroids-bullet"',
      'data-testid="asteroids-saucer"',
      'data-testid="asteroids-saucer-shot"',
      'data-saucer-kind="small"',
      'data-saucer-points="1000"',
      'data-testid="asteroids-ship"',
      "<polygon",
    ]);
    expect(markup.match(/data-testid="asteroids-ship"/g)).toHaveLength(1);
    expect(markup).not.toContain("data-ship-id=");
    expect(markup).not.toContain("Ship A active.");
  });

  it("renders Asteroids power-up vector icons and board labels", () => {
    const game = createInitialAsteroidsGame();
    const powerUpKinds: AsteroidsPowerUpKind[] = [
      "shield",
      "bullet-speed",
      "shot-interval",
      "bonus-score",
      "engine-speed",
    ];

    for (const kind of powerUpKinds) {
      const markup = renderToStaticMarkup(
        <AsteroidsBoard
          game={{
            ...game,
            powerUp: {
              id: `power-up-${kind}`,
              kind,
              radius: 12,
              x: 320,
              y: 220,
            },
            status: "running",
          }}
          statusLabel="Running"
        />,
      );

      expectMarkup(markup, [
        'data-testid="asteroids-power-up"',
        `data-power-up-kind="${kind}"`,
        'data-testid="asteroids-power-up-icon"',
        `${getExpectedAsteroidsPowerUpLabel(kind)} power-up active.`,
      ]);
    }
  });

  it("renders Asteroids pickup feedback text", () => {
    const game = createInitialAsteroidsGame();
    const markup = renderToStaticMarkup(
      <AsteroidsBoard
        game={game}
        pickupFeedbacks={[
          {
            ageTicks: 3,
            durationTicks: 45,
            id: "pickup-feedback-test",
            kind: "engine-speed",
            label: "+engine speed",
            x: 320,
            y: 220,
          },
        ]}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="asteroids-pickup-feedback"',
      'data-pickup-feedback-kind="engine-speed"',
      "+engine speed",
      'font-size="15"',
      'paint-order="stroke"',
    ]);
    expect(Number(getMarkupAttribute(markup, "asteroids-pickup-feedback", "opacity"))).toBeLessThan(
      1,
    );
  });

  it("renders Asteroids shield and ship explosion states", () => {
    const game = createInitialAsteroidsGame();
    const shieldWarningBlinkIntervalTicks = Math.ceil(120 / ASTEROIDS_TICK_DELAY_MS);
    const shieldMarkup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...game,
          respawnInvulnerabilityTicks: ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
          status: "running",
        }}
        statusLabel="Running"
      />,
    );
    const steadyShieldMarkup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...game,
          respawnInvulnerabilityTicks: ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS - 1,
          status: "running",
        }}
        statusLabel="Running"
      />,
    );
    const dimWarningShieldMarkup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...game,
          respawnInvulnerabilityTicks: 1,
          status: "running",
        }}
        statusLabel="Running"
      />,
    );
    const brightWarningShieldMarkup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...game,
          respawnInvulnerabilityTicks: shieldWarningBlinkIntervalTicks + 1,
          status: "running",
        }}
        statusLabel="Running"
      />,
    );
    const explosionMarkup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...game,
          shipExplosion: {
            durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
            radius: game.ship.radius,
            ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
            x: game.ship.x,
            y: game.ship.y,
          },
          status: "running",
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(shieldMarkup, [
      "Shield active.",
      'data-testid="asteroids-ship"',
      'data-testid="asteroids-ship-shield"',
    ]);
    expect(getMarkupAttribute(steadyShieldMarkup, "asteroids-ship-shield", "r")).toBe(
      getMarkupAttribute(shieldMarkup, "asteroids-ship-shield", "r"),
    );
    expect(getMarkupAttribute(steadyShieldMarkup, "asteroids-ship-shield", "opacity")).toBe(
      getMarkupAttribute(shieldMarkup, "asteroids-ship-shield", "opacity"),
    );
    expect(
      Number(getMarkupAttribute(dimWarningShieldMarkup, "asteroids-ship-shield", "opacity")),
    ).toBeLessThan(
      Number(getMarkupAttribute(brightWarningShieldMarkup, "asteroids-ship-shield", "opacity")),
    );
    expect(getMarkupAttribute(dimWarningShieldMarkup, "asteroids-ship-shield", "r")).toBe(
      getMarkupAttribute(brightWarningShieldMarkup, "asteroids-ship-shield", "r"),
    );
    expectMarkup(explosionMarkup, [
      "Ship exploding.",
      'data-testid="asteroids-ship-explosion"',
    ]);
    expect(explosionMarkup).not.toContain('data-testid="asteroids-ship"');
  });

  it("renders multiplayer ship render states with per-seat bullets", () => {
    const soloGame = createInitialAsteroidsGame();
    const multiplayerGame = createInitialAsteroidsMultiplayerGame();
    const shipA = multiplayerGame.ships["ship-a"];
    const shipB = multiplayerGame.ships["ship-b"];
    const markup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...soloGame,
          bullets: [
            {
              id: "solo-bullet",
              radius: 2.5,
              ttl: 20,
              velocity: { x: 0, y: -8 },
              x: 420,
              y: 220,
            },
          ],
          status: "running",
        }}
        shipRenderStates={[
          {
            ...shipA,
            bullets: [
              {
                id: "ship-a-bullet",
                radius: 2.5,
                ttl: 20,
                velocity: { x: 0, y: -8 },
                x: shipA.ship.x,
                y: shipA.ship.y - 26,
              },
            ],
            id: "ship-a",
            label: "Ship A",
            ship: {
              ...shipA.ship,
              isThrusting: true,
            },
          },
          {
            ...shipB,
            bullets: [
              {
                id: "ship-b-bullet",
                radius: 2.5,
                ttl: 20,
                velocity: { x: 0, y: -8 },
                x: shipB.ship.x,
                y: shipB.ship.y - 26,
              },
            ],
            id: "ship-b",
            label: "Ship B",
          },
        ]}
        statusLabel="Running"
      />,
    );

    expect(markup.match(/data-testid="asteroids-ship"/g)).toHaveLength(2);
    expect(markup.match(/data-testid="asteroids-bullet"/g)).toHaveLength(2);
    expectMarkup(markup, [
      "Ship A active. Ship B active.",
      'data-ship-id="ship-a"',
      'data-ship-label="Ship A"',
      'data-ship-id="ship-b"',
      'data-ship-label="Ship B"',
      'data-testid="asteroids-ship"',
      'data-testid="asteroids-bullet"',
      "fill-[var(--asteroids-thrust)]",
    ]);
  });

  it("renders multiplayer shield and explosion states by ship seat", () => {
    const soloGame = createInitialAsteroidsGame();
    const multiplayerGame = createInitialAsteroidsMultiplayerGame();
    const shipA = multiplayerGame.ships["ship-a"];
    const shipB = multiplayerGame.ships["ship-b"];
    const markup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...soloGame,
          status: "running",
        }}
        shipRenderStates={[
          {
            ...shipA,
            id: "ship-a",
            label: "Ship A",
            respawnInvulnerabilityTicks: ASTEROIDS_RESPAWN_INVULNERABILITY_TICKS,
          },
          {
            ...shipB,
            id: "ship-b",
            label: "Ship B",
            shipExplosion: {
              durationTicks: ASTEROIDS_SHIP_EXPLOSION_TICKS,
              radius: shipB.ship.radius,
              ticksRemaining: ASTEROIDS_SHIP_EXPLOSION_TICKS,
              x: shipB.ship.x,
              y: shipB.ship.y,
            },
          },
        ]}
        statusLabel="Running"
      />,
    );

    expect(markup.match(/data-testid="asteroids-ship"/g)).toHaveLength(1);
    expectMarkup(markup, [
      "Ship A shield active. Ship B exploding.",
      'data-testid="asteroids-ship-shield"',
      'data-testid="asteroids-ship-explosion"',
      'data-ship-id="ship-a"',
      'data-ship-id="ship-b"',
    ]);
  });

  it("renders Asteroids hit sparks as fading small particles", () => {
    const game = createInitialAsteroidsGame();
    const markup = renderToStaticMarkup(
      <AsteroidsBoard
        game={game}
        hitSparks={[
          {
            ageTicks: 4,
            durationTicks: 20,
            id: "spark-test",
            particles: [
              {
                angle: 0,
                color: "bullet",
                length: 2.4,
                radius: 0.9,
                travelDistance: 12,
              },
              {
                angle: Math.PI / 2,
                color: "thrust",
                length: 2.1,
                radius: 0.74,
                travelDistance: 10,
              },
            ],
            x: 320,
            y: 220,
          },
        ]}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="asteroids-hit-spark"',
      'stroke="color-mix(in_oklch,var(--asteroids-bullet)_88%,var(--asteroids-board-text))"',
      'stroke="var(--asteroids-thrust)"',
      'stroke-linecap="round"',
    ]);
    expect(Number(getMarkupAttribute(markup, "asteroids-hit-spark", "opacity"))).toBeLessThan(
      0.86,
    );
    expect(markup).toContain('stroke-width="0.8496"');
    expect(markup).toContain('stroke-width="0.69856"');
  });
});
