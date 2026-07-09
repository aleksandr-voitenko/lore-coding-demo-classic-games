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

function getRoleImageMarkup(markup: string) {
  const openingTag = /<([a-z][\w:-]*)\b[^>]*\brole="img"[^>]*>/i.exec(markup);

  if (openingTag === null) {
    throw new Error("Expected rendered markup to contain an element with role=img.");
  }

  const tagName = openingTag[1]!;
  const sameTagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  let depth = 0;

  sameTagPattern.lastIndex = openingTag.index;

  for (
    let tag = sameTagPattern.exec(markup);
    tag !== null;
    tag = sameTagPattern.exec(markup)
  ) {
    if (tag[0].startsWith("</")) {
      depth -= 1;
    } else if (!tag[0].endsWith("/>")) {
      depth += 1;
    }

    if (depth === 0) {
      return markup.slice(openingTag.index, sameTagPattern.lastIndex);
    }
  }

  throw new Error(`Expected rendered role=img <${tagName}> element to close.`);
}

describe("AsteroidsBoard", () => {
  it("keeps overlay actions outside the board image semantics", () => {
    const game = createInitialAsteroidsGame();
    const actionLabels = ["Start", "Resume", "New game", "Back"];
    const markup = renderToStaticMarkup(
      <AsteroidsBoard game={game} statusLabel="Ready">
        {actionLabels.map((label) => (
          <button key={label} type="button">
            {label}
          </button>
        ))}
      </AsteroidsBoard>,
    );
    const boardImageMarkup = getRoleImageMarkup(markup);

    expect(boardImageMarkup).toContain('data-testid="asteroids-board"');

    for (const label of actionLabels) {
      expect(markup).toContain(`<button type="button">${label}</button>`);
      expect(boardImageMarkup).not.toContain(`>${label}</button>`);
    }
  });

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

  it("labels empty and inactive multiplayer ship render states", () => {
    const soloGame = createInitialAsteroidsGame();
    const multiplayerGame = createInitialAsteroidsMultiplayerGame();
    const emptyMarkup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...soloGame,
          status: "running",
        }}
        shipRenderStates={[]}
        statusLabel="Running"
      />,
    );
    const lostMarkup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...soloGame,
          status: "lost",
        }}
        shipRenderStates={[
          {
            ...multiplayerGame.ships["ship-a"],
            id: "ship-a",
            label: "Ship A",
          },
          {
            ...multiplayerGame.ships["ship-b"],
            id: "ship-b",
            isActive: false,
            label: "Ship B",
          },
        ]}
        statusLabel="Lost"
      />,
    );

    expectMarkup(emptyMarkup, ["No ships active."]);
    expect(emptyMarkup).not.toContain('data-testid="asteroids-ship"');
    expectMarkup(lostMarkup, [
      "Ship A inactive. Ship B inactive.",
      "Lost.",
    ]);
    expect(lostMarkup).not.toContain('data-testid="asteroids-ship"');
  });

  it("renders wrapped multiplayer edge entities with primary test ids", () => {
    const soloGame = createInitialAsteroidsGame();
    const multiplayerGame = createInitialAsteroidsMultiplayerGame();
    const shipA = multiplayerGame.ships["ship-a"];
    const markup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...soloGame,
          asteroids: [
            {
              id: "edge-asteroid",
              radius: 18,
              shape: [1, 0.9, 1.08, 0.84, 1.03, 0.92],
              size: "small",
              velocity: { x: 0, y: 0 },
              x: 4,
              y: soloGame.boardHeight - 4,
            },
            {
              id: "medium-asteroid",
              radius: 26,
              shape: [1, 0.9, 1.08, 0.84, 1.03, 0.92],
              size: "medium",
              velocity: { x: 0, y: 0 },
              x: 300,
              y: 300,
            },
          ],
          powerUp: {
            id: "edge-power-up",
            kind: "shot-interval",
            radius: 12,
            x: soloGame.boardWidth - 3,
            y: 3,
          },
          saucerBullets: [
            {
              id: "edge-saucer-shot",
              radius: 2.5,
              ttl: 20,
              velocity: { x: 0, y: 0 },
              x: 2,
              y: 2,
            },
          ],
          status: "running",
        }}
        hitSparks={[
          {
            ageTicks: 1,
            durationTicks: 20,
            id: "edge-spark",
            particles: [
              {
                angle: Math.PI,
                color: "ship",
                length: 4,
                radius: 1,
                travelDistance: 60,
              },
            ],
            x: 2,
            y: soloGame.boardHeight - 2,
          },
        ]}
        pickupFeedbacks={[
          {
            ageTicks: 1,
            durationTicks: 20,
            id: "edge-feedback",
            kind: "shield",
            label: "+shield",
            x: soloGame.boardWidth - 2,
            y: soloGame.boardHeight - 2,
          },
        ]}
        shipRenderStates={[
          {
            ...shipA,
            bullets: [
              {
                id: "edge-ship-shot",
                radius: 2.5,
                ttl: 20,
                velocity: { x: 0, y: 0 },
                x: soloGame.boardWidth - 2,
                y: soloGame.boardHeight - 2,
              },
            ],
            id: "ship-a",
            label: "Ship A",
            ship: {
              ...shipA.ship,
              x: 2,
              y: 2,
            },
          },
        ]}
        statusLabel="Running"
      />,
    );

    expect(markup).toContain('cx="802"');
    expect(markup).toContain('cy="602"');
    expect(markup).toContain('cx="-3"');
    expect(markup).toContain('cy="603"');
    expect(markup).toContain('cx="-2"');
    expect(markup).toContain('cy="-2"');
    expect(markup.match(/data-testid="asteroids-asteroid"/g)).toHaveLength(2);
    expect(markup.match(/data-testid="asteroids-bullet"/g)).toHaveLength(1);
    expect(markup.match(/data-testid="asteroids-saucer-shot"/g)).toHaveLength(1);
    expect(markup.match(/data-testid="asteroids-ship"/g)).toHaveLength(1);
    expect(markup.match(/data-testid="asteroids-power-up"/g)).toHaveLength(1);
    expect(markup.match(/data-testid="asteroids-hit-spark"/g)).toHaveLength(1);
    expect(markup.match(/data-testid="asteroids-pickup-feedback"/g)).toHaveLength(1);
    expectMarkup(markup, [
      "Ship A active.",
      'stroke="var(--asteroids-ship)"',
      "Shot interval power-up active.",
    ]);
  });

  it("renders fallback multiplayer labels and large saucer status text", () => {
    const soloGame = createInitialAsteroidsGame();
    const multiplayerGame = createInitialAsteroidsMultiplayerGame();
    const markup = renderToStaticMarkup(
      <AsteroidsBoard
        game={{
          ...soloGame,
          saucer: {
            id: "large-saucer",
            kind: "large",
            radius: 18,
            shotCooldownTicks: 20,
            velocity: { x: 0, y: 0 },
            x: 320,
            y: 160,
          },
          status: "running",
        }}
        shipRenderStates={[
          {
            ...multiplayerGame.ships["ship-a"],
            id: "ship-a",
          },
        ]}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      "ship-a active.",
      "Large saucer active.",
      'data-saucer-kind="large"',
      'data-saucer-points="200"',
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
              {
                angle: Math.PI,
                color: "saucerShot",
                length: 2.2,
                radius: 0.82,
                travelDistance: 11,
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
      'stroke="var(--asteroids-saucer-shot)"',
      'stroke-linecap="round"',
    ]);
    expect(Number(getMarkupAttribute(markup, "asteroids-hit-spark", "opacity"))).toBeLessThan(
      0.86,
    );
    expect(markup).toContain('stroke-width="0.8496"');
    expect(markup).toContain('stroke-width="0.69856"');
  });
});
