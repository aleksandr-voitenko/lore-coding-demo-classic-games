import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpaceInvadersBoard } from "./space-invaders-board";
import { expectMarkup } from "./game-board-test-utils";
import {
  createInitialSpaceInvadersGame,
  SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
} from "@/lib/space-invaders-game-engine";
import {
  createInitialSpaceInvadersMultiplayerGame,
  SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS,
} from "@/lib/space-invaders-multiplayer";

describe("SpaceInvadersBoard", () => {
  it("renders Space Invaders formation, player shot, and remaining count", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const revengeAuraTarget = game.invaders[1]!;
    const splitterAlien = game.invaders.find((invader) => invader.kind === "splitter")!;
    const armoredHitPointsById = new Map(
      game.invaders
        .filter((invader) => invader.kind === "armored")
        .map((invader, index) => [invader.id, (index + 1) as 1 | 2 | 3]),
    );
    const splitterFragment = {
      ...splitterAlien,
      height: splitterAlien.height * 0.7,
      id: "splitter-fragment-test",
      kind: "splitter-fragment" as const,
      width: splitterAlien.width * 0.7,
      x: 302,
      y: 214,
    };
    const markup = renderToStaticMarkup(
      <SpaceInvadersBoard
        game={{
          ...game,
          invaders: [
            ...game.invaders.map((invader, index) => ({
              ...invader,
              hitPoints: armoredHitPointsById.get(invader.id) ?? invader.hitPoints,
              isActive: index !== 0,
            })),
            splitterFragment,
          ],
          playerShots: [
            {
              height: 14,
              id: "player-shot-test",
              kind: "burst",
              velocityX: 0,
              velocityY: -16,
              width: 4,
              x: 200,
              y: 450,
            },
            {
              height: 14,
              id: "player-piercing-shot-test",
              kind: "piercing",
              velocityX: 0,
              velocityY: -16,
              width: 4,
              x: 214,
              y: 450,
            },
          ],
          powerUps: [
            {
              height: SPACE_INVADERS_POWER_UP_SIZE,
              id: "power-up-bonus-score",
              kind: "bonus-score",
              velocityY: 4.8,
              width: SPACE_INVADERS_POWER_UP_SIZE,
              x: 160,
              y: 420,
            },
            {
              height: SPACE_INVADERS_POWER_UP_SIZE,
              id: "power-up-burst-shot",
              kind: "burst-shot",
              velocityY: 4.8,
              width: SPACE_INVADERS_POWER_UP_SIZE,
              x: 180,
              y: 420,
            },
            {
              height: SPACE_INVADERS_POWER_UP_SIZE,
              id: "power-up-extra-life",
              kind: "extra-life",
              velocityY: 4.8,
              width: SPACE_INVADERS_POWER_UP_SIZE,
              x: 200,
              y: 420,
            },
            {
              height: SPACE_INVADERS_POWER_UP_SIZE,
              id: "power-up-freeze",
              kind: "freeze",
              velocityY: 4.8,
              width: SPACE_INVADERS_POWER_UP_SIZE,
              x: 220,
              y: 420,
            },
            {
              height: SPACE_INVADERS_POWER_UP_SIZE,
              id: "power-up-piercing",
              kind: "piercing-laser",
              velocityY: 4.8,
              width: SPACE_INVADERS_POWER_UP_SIZE,
              x: 240,
              y: 420,
            },
            {
              height: SPACE_INVADERS_POWER_UP_SIZE,
              id: "power-up-shield",
              kind: "shield",
              velocityY: 4.8,
              width: SPACE_INVADERS_POWER_UP_SIZE,
              x: 260,
              y: 420,
            },
            {
              height: SPACE_INVADERS_POWER_UP_SIZE,
              id: "power-up-shotgun-shot",
              kind: "shotgun-shot",
              velocityY: 4.8,
              width: SPACE_INVADERS_POWER_UP_SIZE,
              x: 280,
              y: 420,
            },
          ],
          invaderShots: [
            {
              ageTicks: 0,
              height: 34,
              id: "invader-shot-test",
              kind: "needle",
              sourceColumn: 4,
              sourceInvaderId: "3:4",
              sourceRow: 3,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 4.9,
              width: 4.8,
              x: 170,
              y: 240,
            },
            {
              ageTicks: 0,
              height: 20,
              id: "invader-shot-standard",
              kind: "standard",
              sourceColumn: 7,
              sourceInvaderId: "4:7",
              sourceRow: 4,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 3.2,
              width: 10,
              x: 180,
              y: 248,
            },
            {
              ageTicks: 0,
              height: 24,
              id: "invader-shot-commander",
              kind: "commander",
              sourceColumn: 6,
              sourceInvaderId: "0:6",
              sourceRow: 0,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 2.35,
              width: 8,
              x: 194,
              y: 248,
            },
            {
              ageTicks: 0,
              height: 12,
              id: "invader-shot-commander-shard",
              kind: "commander-shard",
              sourceColumn: 6,
              sourceInvaderId: "0:6",
              sourceRow: 0,
              ttlTicks: null,
              velocityX: -0.45,
              velocityY: 2.35 * 0.8,
              width: 4,
              x: 200,
              y: 248,
            },
            {
              ageTicks: 0,
              height: 12,
              id: "invader-shot-scatter",
              kind: "scatter",
              sourceColumn: 2,
              sourceInvaderId: "2:2",
              sourceRow: 2,
              ttlTicks: 96,
              velocityX: 1.25,
              velocityY: 2.8,
              width: 12,
              x: 202,
              y: 252,
            },
            {
              ageTicks: 0,
              height: 21.6,
              id: "invader-shot-burst",
              kind: "burst",
              sourceColumn: 3,
              sourceInvaderId: "1:3",
              sourceRow: 1,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 3.45,
              width: 8.4,
              x: 212,
              y: 254,
            },
            {
              ageTicks: 3,
              height: 9.1,
              id: "invader-shot-counterfire",
              kind: "counterfire",
              sourceColumn: 8,
              sourceInvaderId: "1:8",
              sourceRow: 1,
              ttlTicks: null,
              velocityX: 1.6,
              velocityY: 5.3 * 1.15,
              width: 20.8,
              x: 226,
              y: 254,
            },
            {
              ageTicks: 0,
              height: 16.8,
              id: "invader-shot-splitter-fork",
              kind: "splitter-fork",
              sourceColumn: 4,
              sourceInvaderId: "1:4",
              sourceRow: 1,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 5.4,
              width: 10.8,
              x: 242,
              y: 254,
            },
            {
              ageTicks: 0,
              height: 12.9,
              id: "invader-shot-splitter-fragment-left",
              kind: "splitter-fragment",
              sourceColumn: 4,
              sourceInvaderId: "1:4",
              sourceRow: 1,
              ttlTicks: null,
              velocityX: -1.35,
              velocityY: 3.4,
              width: 9,
              x: 254,
              y: 254,
            },
            {
              ageTicks: 0,
              height: 12.9,
              id: "invader-shot-splitter-fragment-right",
              kind: "splitter-fragment",
              sourceColumn: 4,
              sourceInvaderId: "1:4",
              sourceRow: 1,
              ttlTicks: null,
              velocityX: 1.35,
              velocityY: 3.4,
              width: 9,
              x: 258,
              y: 254,
            },
            {
              ageTicks: 0,
              height: 14,
              id: "invader-shot-armor-wave",
              kind: "armor-wave",
              sourceColumn: 5,
              sourceInvaderId: "1:5",
              sourceRow: 1,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 2.15 * 0.85,
              width: 56,
              x: 188,
              y: 260,
            },
            {
              ageTicks: 0,
              height: 18,
              id: "invader-shot-mine",
              kind: "mine",
              sourceColumn: 6,
              sourceInvaderId: "1:6",
              sourceRow: 1,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 1.55,
              width: 18,
              x: 248,
              y: 264,
            },
          ],
          revengeVolleys: [
            {
              invaderIds: [revengeAuraTarget.id],
              ticksRemaining: 18,
            },
          ],
          explosions: [
            {
              ageTicks: 0,
              height: 60,
              id: "explosion-test",
              kind: "ufo",
              ttlTicks: 12,
              variant: 3,
              width: 84,
              x: 160,
              y: 20,
            },
            {
              ageTicks: 0,
              height: 18,
              id: "projectile-explosion-test",
              kind: "projectile",
              ttlTicks: 12,
              variant: 2,
              width: 20,
              x: 190,
              y: 260,
            },
            {
              ageTicks: 0,
              height: 18,
              id: "shield-explosion-test",
              kind: "shield",
              ttlTicks: 12,
              variant: 1,
              width: 20,
              x: 200,
              y: 270,
            },
            {
              ageTicks: 0,
              height: 90,
              id: "mine-explosion-test",
              kind: "mine",
              ttlTicks: 12,
              variant: 4,
              width: 90,
              x: 210,
              y: 260,
            },
          ],
          scorePopups: [
            {
              ageTicks: 0,
              height: 22,
              id: "score-popup-test",
              points: 30,
              scoreScale: 1.24,
              ttlTicks: SPACE_INVADERS_SCORE_POPUP_TICKS,
              width: 32,
              x: 42,
              y: 72,
            },
          ],
          status: "running",
          ufo: {
            ...game.ufo,
            isActive: true,
            points: 150,
            x: 178,
            y: 36,
          },
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="space-invaders-board-frame"',
      'data-testid="space-invaders-board"',
      "Space Invaders board. Field 420 by 560. Score 0. Lives 3. 50 invaders remaining. 7 power ups falling. Running.",
      'data-testid="space-invaders-score-hud"',
      'data-testid="space-invaders-score"',
      'data-testid="space-invaders-health-hud"',
      'data-testid="space-invaders-lives"',
      'data-testid="space-invaders-invader"',
      'data-invader-kind="diver"',
      'data-invader-kind="shield-bearer"',
      'data-invader-kind="revenge"',
      'data-invader-revenge-aura="true"',
      'data-invader-kind="splitter"',
      'data-invader-kind="splitter-fragment"',
      'data-invader-kind="armored"',
      'data-invader-kind="mine-layer"',
      'data-invader-hit-points="1"',
      'data-invader-hit-points="2"',
      'data-invader-hit-points="3"',
      'data-invader-shielded="true"',
      'data-testid="space-invaders-invader-shield"',
      "space-invaders-invader-shield",
      'data-testid="space-invaders-revenge-aura"',
      "space-invaders-revenge-aura",
      'data-testid="space-invaders-shield-bearer-blip"',
      'data-testid="space-invaders-player-shot"',
      'data-player-shot-kind="burst"',
      'data-player-shot-kind="piercing"',
      'data-testid="space-invaders-invader-shot"',
      'data-shot-kind="needle"',
      'data-shot-kind="standard"',
      'data-shot-kind="commander"',
      'data-shot-kind="commander-shard"',
      'data-shot-kind="scatter"',
      'data-shot-kind="burst"',
      'data-shot-kind="counterfire"',
      'data-shot-kind="splitter-fork"',
      'data-shot-kind="splitter-fragment"',
      'data-shot-kind="armor-wave"',
      'data-shot-kind="mine"',
      'data-testid="space-invaders-power-up"',
      'data-power-up-kind="bonus-score"',
      'data-power-up-kind="burst-shot"',
      'data-power-up-kind="extra-life"',
      'data-power-up-kind="freeze"',
      'data-power-up-kind="piercing-laser"',
      'data-power-up-kind="shield"',
      'data-power-up-kind="shotgun-shot"',
      'data-testid="space-invaders-explosion"',
      'data-explosion-kind="ufo"',
      'data-explosion-kind="projectile"',
      'data-explosion-kind="shield"',
      'data-explosion-kind="mine"',
      'data-explosion-variant="3"',
      'data-explosion-variant="2"',
      'data-explosion-variant="1"',
      'data-explosion-variant="4"',
      "space-invaders-explosion--ufo",
      "space-invaders-explosion--projectile",
      "space-invaders-explosion--shield",
      "space-invaders-explosion--mine",
      "space-invaders-explosion__sprite--3",
      "space-invaders-explosion__sprite--2",
      "space-invaders-explosion__sprite--1",
      "space-invaders-explosion__sprite--4",
      'data-testid="space-invaders-score-popup"',
      'data-score-popup-points="30"',
      'data-score-popup-scale="1.24"',
      "space-invaders-score-popup__text",
      "font-size:0.8928rem",
      "+30",
      'data-testid="space-invaders-ufo"',
      'data-ufo-points="150"',
      'data-testid="space-invaders-player"',
      "/images/space-invaders/background.png?v=sprite-art-v2",
      "/images/space-invaders/hud-health.png?v=sprite-art-v2",
      "/images/space-invaders/hud-score.png?v=sprite-art-v2",
      "/images/space-invaders/alien-purple.png?v=sprite-art-v2",
      "/images/space-invaders/alien-shield-bearer.png?v=sprite-art-v2",
      "/images/space-invaders/alien-revenge-alien.png?v=sprite-art-v2",
      "/images/space-invaders/alien-splitter.png?v=sprite-art-v2",
      "/images/space-invaders/alien-armored-1.png?v=sprite-art-v2",
      "/images/space-invaders/alien-armored-2.png?v=sprite-art-v2",
      "/images/space-invaders/alien-armored-3.png?v=sprite-art-v2",
      "/images/space-invaders/alien-mine-layer.png?v=sprite-art-v2",
      "/images/space-invaders/explosion-3.png?v=sprite-art-v2",
      "/images/space-invaders/explosion-2.png?v=sprite-art-v2",
      "/images/space-invaders/explosion-shield.png?v=sprite-art-v2",
      "/images/space-invaders/explosion-4.png?v=sprite-art-v2",
      "/images/space-invaders/ufo.png?v=sprite-art-v2",
      "/images/space-invaders/player-shot.png?v=sprite-art-v2",
      "/images/space-invaders/player-piercing-shot.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-needle.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-standard.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-commander.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-scatter.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-burst.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-counterfire.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-splitter-fork.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-splitter-fragment.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-armor-wave.png?v=sprite-art-v2",
      "/images/space-invaders/invader-shot-mine.png?v=sprite-art-v2",
      "/images/space-invaders/power-up-bonus-score.png?v=sprite-art-v2",
      "/images/space-invaders/power-up-burst-shot.png?v=sprite-art-v2",
      "/images/space-invaders/power-up-extra-life.png?v=sprite-art-v2",
      "/images/space-invaders/power-up-freeze.png?v=sprite-art-v2",
      "/images/space-invaders/power-up-piercing-laser.png?v=sprite-art-v2",
      "/images/space-invaders/power-up-shield.png?v=sprite-art-v2",
      "/images/space-invaders/power-up-shotgun-shot.png?v=sprite-art-v2",
      "/images/space-invaders/player-ship.png?v=sprite-art-v2",
      "transform:translate3d(",
    ]);
    expect(markup.match(/invader-shot-commander\.png\?v=sprite-art-v2/g)).toHaveLength(
      2,
    );
    expect(markup.match(/scaleX\(-1\)/g)).toHaveLength(1);
  });

  it("renders Space Invaders shield tethers from bearers to shielded divers", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shieldBearer = game.invaders.find(
      (invader) => invader.kind === "shield-bearer" && invader.column < 10,
    )!;
    const targetDiver = {
      ...game.invaders.find(
        (invader) =>
          invader.row === shieldBearer.row &&
          invader.column === shieldBearer.column + 1,
      )!,
      isDiving: true,
      kind: "diver" as const,
      y: shieldBearer.y + 220,
    };
    const markup = renderToStaticMarkup(
      <SpaceInvadersBoard
        game={{
          ...game,
          invaders: game.invaders.map((invader) => {
            if (invader.id === shieldBearer.id) {
              return shieldBearer;
            }

            if (invader.id === targetDiver.id) {
              return targetDiver;
            }

            return {
              ...invader,
              isActive: false,
            };
          }),
          status: "running",
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="space-invaders-shield-tethers"',
      'data-testid="space-invaders-shield-tether"',
      `data-shield-source-id="${shieldBearer.id}"`,
      `data-shield-target-id="${targetDiver.id}"`,
      "space-invaders-shield-tether__glow",
      "space-invaders-shield-tether__core",
      'data-invader-kind="diver"',
      'data-invader-shielded="true"',
      'data-testid="space-invaders-invader-shield"',
    ]);
  });

  it("renders Space Invaders shield tethers from bearers to shielded Splitter fragments", () => {
    const game = createInitialSpaceInvadersGame({ random: () => 0 });
    const shieldBearer = game.invaders.find(
      (invader) => invader.kind === "shield-bearer" && invader.column < 10,
    )!;
    const targetFragment = {
      ...game.invaders.find(
        (invader) =>
          invader.row === shieldBearer.row &&
          invader.column === shieldBearer.column + 1,
      )!,
      height: shieldBearer.height * 0.7,
      isDiving: true,
      kind: "splitter-fragment" as const,
      width: shieldBearer.width * 0.7,
      y: shieldBearer.y + 220,
    };
    const markup = renderToStaticMarkup(
      <SpaceInvadersBoard
        game={{
          ...game,
          invaders: game.invaders.map((invader) => {
            if (invader.id === shieldBearer.id) {
              return shieldBearer;
            }

            if (invader.id === targetFragment.id) {
              return targetFragment;
            }

            return {
              ...invader,
              isActive: false,
            };
          }),
          status: "running",
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="space-invaders-shield-tethers"',
      'data-testid="space-invaders-shield-tether"',
      `data-shield-source-id="${shieldBearer.id}"`,
      `data-shield-target-id="${targetFragment.id}"`,
      'data-invader-kind="splitter-fragment"',
      'data-invader-shielded="true"',
      'data-testid="space-invaders-invader-shield"',
    ]);
  });

  it("renders Space Invaders respawn shields and hides respawning players", () => {
    const game = createInitialSpaceInvadersGame();
    const steadyShieldMarkup = renderToStaticMarkup(
      <SpaceInvadersBoard
        game={{
          ...game,
          playerShieldTicks: SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS + 1,
          status: "running",
        }}
        statusLabel="Running"
      />,
    );
    const flashingShieldMarkup = renderToStaticMarkup(
      <SpaceInvadersBoard
        game={{
          ...game,
          playerShieldTicks: SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
          status: "running",
        }}
        statusLabel="Running"
      />,
    );
    const respawningMarkup = renderToStaticMarkup(
      <SpaceInvadersBoard
        game={{
          ...game,
          playerRespawnTicks: 1,
          status: "running",
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(steadyShieldMarkup, [
      'data-testid="space-invaders-player-shield"',
      'data-shield-flashing="false"',
      "space-invaders-player-shield__surface",
      'data-testid="space-invaders-player"',
      "transform:translate3d(",
    ]);
    expect(steadyShieldMarkup).not.toContain(
      "space-invaders-player-shield__surface--flashing",
    );
    expectMarkup(flashingShieldMarkup, [
      'data-testid="space-invaders-player-shield"',
      'data-shield-flashing="true"',
      "space-invaders-player-shield__surface--flashing",
      'data-testid="space-invaders-player"',
      "transform:translate3d(",
    ]);
    expect(respawningMarkup).not.toContain('data-testid="space-invaders-player"');
    expect(respawningMarkup).not.toContain(
      'data-testid="space-invaders-player-shield"',
    );
  });

  it("renders multiplayer ships, per-ship shots, and shields", () => {
    const game = createInitialSpaceInvadersMultiplayerGame();
    const shipA = game.ships["ship-a"];
    const shipB = game.ships["ship-b"];
    const multiplayerGame = {
      ...game,
      ships: {
        "ship-a": {
          ...shipA,
          playerShieldTicks: SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS + 1,
        },
        "ship-b": {
          ...shipB,
          playerShots: [
            {
              height: 14,
              id: "ship-b-shot",
              kind: "standard" as const,
              velocityX: 0,
              velocityY: -16,
              width: 4,
              x: shipB.player.x + shipB.player.width / 2,
              y: shipB.player.y - 16,
            },
          ],
        },
      },
      status: "running" as const,
    };
    const markup = renderToStaticMarkup(
      <SpaceInvadersBoard
        fillViewport={false}
        game={multiplayerGame}
        ships={SPACE_INVADERS_MULTIPLAYER_SHIP_SEATS.map((seat) => {
          const ship = multiplayerGame.ships[seat];

          return {
            id: seat,
            isActive: ship.isActive,
            player: ship.player,
            playerRespawnTicks: ship.playerRespawnTicks,
            playerShieldTicks: ship.playerShieldTicks,
            playerShots: ship.playerShots,
          };
        })}
        statusLabel="Running"
      />,
    );

    expect(markup.match(/data-testid="space-invaders-player"/g)).toHaveLength(2);
    expect(markup).toContain('data-ship-id="ship-a"');
    expect(markup).toContain('data-ship-id="ship-b"');
    expect(markup).toContain('data-testid="space-invaders-player-shield"');
    expect(markup).toContain('data-testid="space-invaders-player-shot"');
    expect(markup).toContain('data-player-shot-kind="standard"');
    expect(markup).not.toContain("h-svh");
  });
});
