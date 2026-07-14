import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BattleCityBoard } from "./battle-city-board";
import { expectMarkup } from "./game-board-test-utils";
import { BATTLE_CITY_BOARD_SIZE } from "@/lib/battle-city/constants";
import { BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS } from "@/lib/battle-city-game-engine";
import {
  BATTLE_CITY_TERRAIN_FRAGMENT_BITS,
  createBattleCityTerrainFragmentGrid,
} from "@/lib/battle-city/terrain-fragments";
import type {
  BattleCityEnemy,
  BattleCityEnemyType,
  BattleCityGameState,
  BattleCityPowerUpType,
  BattleCityTerrain,
} from "@/lib/battle-city/types";

function createTerrain(): BattleCityTerrain[][] {
  const terrain = Array.from({ length: BATTLE_CITY_BOARD_SIZE }, () =>
    Array.from(
      { length: BATTLE_CITY_BOARD_SIZE },
      (): BattleCityTerrain => "empty",
    ),
  );

  terrain[24]![12] = "headquarters";
  terrain[24]![13] = "headquarters";
  terrain[25]![12] = "headquarters";
  terrain[25]![13] = "headquarters";

  return terrain;
}

function createGame(
  overrides: Partial<BattleCityGameState> = {},
): BattleCityGameState {
  const terrain = overrides.terrain ?? createTerrain();
  return {
    activePowerUp: null,
    baseAlive: true,
    baseExplosionTicks: 0,
    bonusLifeAwarded: false,
    bullets: [],
    cycle: 1,
    destroyedEnemyCount: 0,
    difficulty: "★",
    enemies: [],
    enemySpawnCooldownTicks: 0,
    fortressTicks: 0,
    freezeTicks: 0,
    lives: 3,
    nextBulletId: 1,
    nextEnemyId: 1,
    nextPowerUpId: 1,
    player: {
      col: 8,
      direction: "up",
      iceSlideDirection: null,
      iceSlideStepsRemaining: 0,
      invulnerabilityTicks: 0,
      phase: "active",
      phaseTicks: 0,
      powerTier: 0,
      row: 24,
      shieldTicks: 0,
    },
    powerUpScorePopup: null,
    score: 0,
    spawnedEnemyCount: 0,
    stage: 1,
    stageBattleTicks: 0,
    stageKillCounts: { armor: 0, basic: 0, fast: 0, power: 0 },
    stageOutcome: null,
    stageResultTicks: 0,
    stageTransitionTicks: 0,
    status: "ready",
    terrain,
    terrainFragments:
      overrides.terrainFragments ?? createBattleCityTerrainFragmentGrid(terrain),
    tick: 0,
    totalEnemyCount: 20,
    ...overrides,
  };
}

function createEnemy(
  id: string,
  type: BattleCityEnemyType,
  overrides: Partial<BattleCityEnemy> = {},
): BattleCityEnemy {
  const maxHitPoints = type === "armor" ? 4 : 1;

  return {
    col: 0,
    destructionPoints: null,
    direction: "down",
    explosionTicks: 0,
    hasDroppedPowerUp: false,
    hitPoints: maxHitPoints,
    id,
    isCarrier: false,
    maxHitPoints,
    moveIntervalTicks: type === "fast" ? 1 : 2,
    movementPauseSteps: 0,
    movementTurnPending: false,
    row: 0,
    score: 100,
    slot: 5,
    spawnOrder: 1,
    spawnTicks: 0,
    type,
    ...overrides,
  };
}

function getOpeningTags(markup: string) {
  return markup.match(/<[a-z][^>]*>/g) ?? [];
}

function getOpeningTag(markup: string, fragments: string[]) {
  const openingTag = getOpeningTags(markup).find((tag) =>
    fragments.every((fragment) => tag.includes(fragment)),
  );

  expect(openingTag).toBeDefined();

  return openingTag!;
}

function getOpeningTagsByTestId(markup: string, testId: string) {
  return getOpeningTags(markup).filter((tag) =>
    tag.includes(`data-testid="${testId}"`),
  );
}

function getTestIdElementMarkup(markup: string, testId: string) {
  const openingTag = new RegExp(
    `<([a-z][\\w:-]*)\\b[^>]*data-testid="${testId}"[^>]*>`,
    "i",
  ).exec(markup);

  expect(openingTag).not.toBeNull();

  const tagName = openingTag![1]!;
  const sameTagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  let depth = 0;

  sameTagPattern.lastIndex = openingTag!.index;

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
      return markup.slice(openingTag!.index, sameTagPattern.lastIndex);
    }
  }

  throw new Error(`Expected rendered ${testId} element to close.`);
}

describe("BattleCityBoard", () => {
  it("crops terrain quadrants and keeps bonuses and UI above forest cover", () => {
    const terrain = createTerrain();

    terrain[0]![0] = "brick";
    terrain[0]![1] = "steel";
    terrain[1]![0] = "water";
    terrain[1]![1] = "ice";
    terrain[4]![5] = "forest";

    const markup = renderToStaticMarkup(
      <BattleCityBoard
        game={createGame({
          activePowerUp: {
            col: 5,
            id: "layered-power-up",
            row: 4,
            type: "star",
          },
          terrain,
        })}
      >
        <span data-testid="battle-city-test-overlay">Overlay</span>
      </BattleCityBoard>,
    );
    const terrainCases = [
      [0, 0, "brick", "terrain-brick.png", "0% 0%"],
      [0, 1, "steel", "terrain-steel.png", "100% 0%"],
      [1, 0, "water", "terrain-water-0.png", "0% 100%"],
      [1, 1, "ice", "terrain-ice.png", "100% 100%"],
      [4, 5, "forest", "terrain-forest.png", "100% 0%"],
    ] as const;

    for (const [row, col, type, asset, backgroundPosition] of terrainCases) {
      const cell = getOpeningTag(markup, [
        `data-col="${col}"`,
        `data-row="${row}"`,
        `data-terrain="${type}"`,
      ]);

      if (type === "brick" || type === "steel") {
        expect(cell).toContain('data-fragment-mask="15"');
        expect(markup).toContain(
          `/images/battle-city/${asset}?v=modern-v1`,
        );
        expect(markup).toContain(`background-position:${backgroundPosition}`);
      } else {
        const texturedLayer =
          type === "water"
            ? getOpeningTag(markup, ['data-water-frame="0"'])
            : cell;

        expect(texturedLayer).toContain(
          `/images/battle-city/${asset}?v=modern-v1`,
        );
        expect(texturedLayer).toContain(
          `background-position:${backgroundPosition}`,
        );
        expect(texturedLayer).toContain("background-size:200% 200%");
      }
    }

    const underlayIndex = markup.indexOf(
      'data-testid="battle-city-terrain-underlay"',
    );
    const headquartersIndex = markup.indexOf(
      'data-testid="battle-city-headquarters"',
    );
    const entityIndex = markup.indexOf('data-testid="battle-city-entity-layer"');
    const forestIndex = markup.indexOf(
      'data-testid="battle-city-forest-overlay"',
    );
    const powerUpOverlayIndex = markup.indexOf(
      'data-testid="battle-city-power-up-overlay"',
    );
    const overlayIndex = markup.indexOf('data-testid="battle-city-overlay-layer"');
    const boardImageMarkup = getTestIdElementMarkup(markup, "battle-city-board");
    const entityMarkup = getTestIdElementMarkup(
      markup,
      "battle-city-entity-layer",
    );
    const powerUpOverlayMarkup = getTestIdElementMarkup(
      markup,
      "battle-city-power-up-overlay",
    );

    expect(underlayIndex).toBeLessThan(headquartersIndex);
    expect(headquartersIndex).toBeLessThan(entityIndex);
    expect(entityIndex).toBeLessThan(forestIndex);
    expect(forestIndex).toBeLessThan(powerUpOverlayIndex);
    expect(powerUpOverlayIndex).toBeLessThan(overlayIndex);
    expect(
      getOpeningTag(markup, [
        'data-testid="battle-city-power-up-overlay"',
      ]),
    ).toContain("z-[45]");
    expect(entityMarkup).not.toContain('data-testid="battle-city-power-up"');
    expect(powerUpOverlayMarkup).toContain(
      'data-testid="battle-city-power-up"',
    );
    expect(markup.slice(underlayIndex, entityIndex)).not.toContain(
      'data-terrain="forest"',
    );
    expect(markup.match(/data-terrain-fragment=/g)).toHaveLength(8);
    expect(boardImageMarkup).not.toContain(
      'data-testid="battle-city-test-overlay"',
    );
    expectMarkup(markup, [
      "relative aspect-square w-full",
      'data-headquarters-state="intact"',
      'data-testid="battle-city-overlay-layer"',
      'class="absolute inset-0 z-50"',
      'data-testid="battle-city-test-overlay"',
      "/images/battle-city/headquarters-intact.png?v=modern-v1",
    ]);
  });

  it("keeps both water frames mounted while switching them on the original 32-frame cadence", () => {
    const terrain = createTerrain();

    terrain[1]![0] = "water";

    const firstFrame = renderToStaticMarkup(
      <BattleCityBoard game={createGame({ terrain, tick: 31 })} />,
    );
    const secondFrame = renderToStaticMarkup(
      <BattleCityBoard game={createGame({ terrain, tick: 32 })} />,
    );

    for (const markup of [firstFrame, secondFrame]) {
      expect(markup).toContain(
        "/images/battle-city/terrain-water-0.png?v=modern-v1",
      );
      expect(markup).toContain(
        "/images/battle-city/terrain-water-1.png?v=modern-v1",
      );
    }

    const firstFrame0 = getOpeningTag(firstFrame, ['data-water-frame="0"']);
    const firstFrame1 = getOpeningTag(firstFrame, ['data-water-frame="1"']);
    const secondFrame0 = getOpeningTag(secondFrame, ['data-water-frame="0"']);
    const secondFrame1 = getOpeningTag(secondFrame, ['data-water-frame="1"']);

    expect(firstFrame0).toContain('data-active="true"');
    expect(firstFrame0).toContain("opacity-100");
    expect(firstFrame1).toContain('data-active="false"');
    expect(firstFrame1).toContain("opacity-0");
    expect(secondFrame0).toContain('data-active="false"');
    expect(secondFrame0).toContain("opacity-0");
    expect(secondFrame1).toContain('data-active="true"');
    expect(secondFrame1).toContain("opacity-100");
  });

  it("renders directional tank assets, damage, carrier, spawn, shield, and bullet states", () => {
    const game = createGame();
    const markup = renderToStaticMarkup(
      <BattleCityBoard
        game={{
          ...game,
          bullets: [
            {
              canDestroySteel: true,
              col: 10.625,
              direction: "up",
              id: "player-bullet",
              impactTicks: 0,
              isNewborn: false,
              owner: "player",
              row: 10.375,
              slot: 0,
              speed: 0.5,
              strength: 2,
            },
            {
              canDestroySteel: false,
              col: 16,
              direction: "left",
              id: "enemy-bullet",
              impactTicks: 5,
              isNewborn: false,
              owner: "enemy",
              row: 8,
              slot: 5,
              speed: 0.25,
              strength: 1,
            },
          ],
          cycle: 2,
          destroyedEnemyCount: 11,
          enemies: [
            createEnemy("enemy-basic", "basic", {
              direction: "up",
              hasDroppedPowerUp: true,
              isCarrier: true,
            }),
            createEnemy("enemy-fast", "fast", {
              col: 12,
              direction: "right",
              spawnOrder: 2,
            }),
            createEnemy("enemy-power", "power", {
              col: 24,
              direction: "down",
              spawnOrder: 3,
            }),
            createEnemy("enemy-armor", "armor", {
              col: 6,
              direction: "left",
              hitPoints: 2,
              isCarrier: true,
              row: 8,
              spawnOrder: 4,
              spawnTicks: 5,
            }),
          ],
          lives: 2,
          player: {
            ...game.player,
            direction: "right",
            powerTier: 3,
            shieldTicks: 40,
          },
          score: 1_234,
          spawnedEnemyCount: 11,
          stage: 7,
          status: "stage-clear",
        }}
      />,
    );
    const player = getOpeningTag(markup, [
      'data-testid="battle-city-player"',
    ]);
    const enemyTags = getOpeningTagsByTestId(markup, "battle-city-enemy");
    const droppedCarrier = enemyTags.find((tag) =>
      tag.includes('data-enemy-type="basic"'),
    );
    const spawningCarrier = enemyTags.find((tag) =>
      tag.includes('data-enemy-type="armor"'),
    );
    const bulletTags = getOpeningTagsByTestId(markup, "battle-city-bullet");

    expect(player).toContain('data-direction="right"');
    expect(player).toContain('data-power-tier="3"');
    expect(markup).not.toContain('data-testid="battle-city-player-power"');
    expect(enemyTags).toHaveLength(4);
    expect(droppedCarrier).toContain('data-carrier="true"');
    expect(droppedCarrier).toContain('data-carrier-active="false"');
    expect(droppedCarrier).not.toContain("ring-red-500");
    expect(spawningCarrier).toContain('data-carrier-active="false"');
    expect(spawningCarrier).toContain('data-hit-points="2"');
    expect(spawningCarrier).toContain('data-max-hit-points="4"');
    expect(spawningCarrier).toContain('data-palette-id="2"');
    expect(spawningCarrier).toContain('data-spawning="true"');
    expect(spawningCarrier).not.toContain("ring-red-500");
    expect(spawningCarrier).not.toContain("filter:");
    expect(bulletTags).toHaveLength(2);
    expect(bulletTags[0]).toContain('data-can-destroy-steel="true"');
    expect(bulletTags[0]).toContain('data-direction="up"');
    expect(bulletTags[0]).toContain('data-owner="player"');
    expect(bulletTags[0]).toContain('data-col="10.625"');
    expect(bulletTags[0]).toContain('data-row="10.375"');
    expect(bulletTags[0]).toContain('data-slot="0"');
    expect(bulletTags[0]).toContain('data-strength="2"');
    expect(bulletTags[0]).toContain("transform:translate(-50%, -50%)");
    expect(bulletTags[0]).toContain("width:1.9230769230769231%");
    expect(bulletTags[1]).toContain('data-can-destroy-steel="false"');
    expect(bulletTags[1]).toContain('data-direction="left"');
    expect(bulletTags[1]).toContain('data-impact-phase="2"');
    expect(bulletTags[1]).toContain('data-impact-ticks="5"');
    expect(bulletTags[1]).toContain('data-owner="enemy"');
    expect(bulletTags[1]).toContain('data-slot="5"');
    expectMarkup(markup, [
      "Tank Patrol board. Stage 42. Score 1234. Reserve lives 1. Power tier 3 of 3. 9 reinforcements waiting. Headquarters intact. Stage clear.",
      "/images/battle-city/tank-player-tier-3.png?v=modern-v1",
      "/images/battle-city/tank-enemy-basic.png?v=modern-v1",
      "/images/battle-city/tank-enemy-fast.png?v=modern-v1",
      "/images/battle-city/tank-enemy-power.png?v=modern-v1",
      "/images/battle-city/tank-enemy-armor.png?v=modern-v1",
      "transform:rotate(0deg)",
      "transform:rotate(90deg)",
      "transform:rotate(180deg)",
      "transform:rotate(270deg)",
      'data-shield-source="helmet"',
      'data-shield-expiring="true"',
      'data-testid="battle-city-player-shield"',
      "battle-city-shield-effect",
      'data-testid="battle-city-enemy-spawn"',
      'data-testid="battle-city-bullet-impact"',
      "/images/battle-city/effect-spawn.png?v=modern-v1",
      "/images/battle-city/projectile.png?v=modern-v1",
      "/images/battle-city/effect-bullet-impact.png?v=modern-v1",
    ]);
  });

  it("renders a restrained shield layer and only warns during its final clock count", () => {
    const renderShield = (
      shieldTicks: number,
      invulnerabilityTicks = 0,
    ) => {
      const game = createGame();
      const markup = renderToStaticMarkup(
        <BattleCityBoard
          game={{
            ...game,
            player: {
              ...game.player,
              invulnerabilityTicks,
              shieldTicks,
            },
          }}
        />,
      );

      return {
        markup,
        player: getOpeningTag(markup, [
          'data-testid="battle-city-player"',
        ]),
        shield: getOpeningTag(markup, [
          'data-testid="battle-city-player-shield"',
        ]),
      };
    };

    const steadyHelmet = renderShield(65);
    const expiringHelmet = renderShield(64);
    const expiringSpawnProtection = renderShield(0, 64);

    expect(steadyHelmet.player).not.toContain("animate-pulse");
    expect(steadyHelmet.shield).toContain("battle-city-shield-effect");
    expect(steadyHelmet.shield).toContain('data-shield-expiring="false"');
    expect(steadyHelmet.shield).toContain('data-shield-source="helmet"');
    expect(steadyHelmet.markup).not.toContain("effect-shield.png");
    expect(expiringHelmet.shield).toContain('data-shield-expiring="true"');
    expect(expiringSpawnProtection.player).not.toContain("animate-pulse");
    expect(expiringSpawnProtection.shield).toContain(
      'data-shield-expiring="true"',
    );
    expect(expiringSpawnProtection.shield).toContain(
      'data-shield-source="spawn"',
    );
  });

  it("flashes the active carrier sprite texture without drawing a frame", () => {
    const carrier = createEnemy("carrier", "fast", { isCarrier: true });
    const renderCarrier = (
      tick: number,
      overrides: Partial<BattleCityEnemy> = {},
    ) =>
      getTestIdElementMarkup(
        renderToStaticMarkup(
          <BattleCityBoard
            game={createGame({
              enemies: [{ ...carrier, ...overrides }],
              tick,
            })}
          />,
        ),
        "battle-city-enemy",
      );

    const firstNormalFrame = renderCarrier(0);
    const finalNormalFrame = renderCarrier(7);
    const firstTintedFrame = renderCarrier(8);
    const finalTintedFrame = renderCarrier(15);
    const nextNormalFrame = renderCarrier(16);
    const droppedCarrier = renderCarrier(0, { hasDroppedPowerUp: true });
    const explodingCarrier = renderCarrier(0, { explosionTicks: 4 });
    const spawningCarrier = renderCarrier(8, { spawnTicks: 4 });

    expect(firstTintedFrame).not.toContain("ring-red-500");
    expect(firstTintedFrame).toContain("battle-city-carrier-texture");
    expect(firstTintedFrame).toContain("battle-city-carrier-texture--flash");
    expect(finalTintedFrame).toContain("battle-city-carrier-texture--flash");
    expect(firstNormalFrame).toContain("battle-city-carrier-texture");
    expect(firstNormalFrame).not.toContain("battle-city-carrier-texture--flash");
    expect(finalNormalFrame).not.toContain("battle-city-carrier-texture--flash");
    expect(nextNormalFrame).not.toContain("battle-city-carrier-texture--flash");
    expect(droppedCarrier).not.toContain("battle-city-carrier-texture");
    expect(explodingCarrier).not.toContain("battle-city-carrier-texture");
    expect(spawningCarrier).not.toContain("battle-city-carrier-texture");
  });

  it("uses the original armor damage palettes and carrier override cadence", () => {
    const renderEnemy = (
      enemy: BattleCityEnemy,
      tick: number,
    ) =>
      getTestIdElementMarkup(
        renderToStaticMarkup(
          <BattleCityBoard game={createGame({ enemies: [enemy], tick })} />,
        ),
        "battle-city-enemy",
      );
    const getPaletteId = (markup: string) =>
      getOpeningTag(markup, ['data-testid="battle-city-enemy"']).match(
        /data-palette-id="(\d)"/,
      )?.[1];

    const armorPaletteCases = [
      { hitPoints: 4, tick: 0, paletteId: "1" },
      { hitPoints: 4, tick: 1, paletteId: "2" },
      { hitPoints: 3, tick: 0, paletteId: "0" },
      { hitPoints: 3, tick: 1, paletteId: "2" },
      { hitPoints: 2, tick: 0, paletteId: "0" },
      { hitPoints: 2, tick: 1, paletteId: "1" },
      { hitPoints: 1, tick: 0, paletteId: "2" },
      { hitPoints: 1, tick: 1, paletteId: "2" },
    ] as const;

    for (const { hitPoints, paletteId, tick } of armorPaletteCases) {
      const markup = renderEnemy(
        createEnemy(`armor-${hitPoints}-${tick}`, "armor", { hitPoints }),
        tick,
      );

      expect(getPaletteId(markup)).toBe(paletteId);
      expect(markup).toContain(`battle-city-enemy-palette--${paletteId}`);
    }

    const armorCarrier = createEnemy("armor-carrier", "armor", {
      hitPoints: 4,
      isCarrier: true,
    });
    const fastCarrier = createEnemy("fast-carrier", "fast", {
      isCarrier: true,
    });

    expect(getPaletteId(renderEnemy(fastCarrier, 0))).toBe("2");
    expect(getPaletteId(renderEnemy(fastCarrier, 7))).toBe("2");
    expect(getPaletteId(renderEnemy(fastCarrier, 8))).toBe("3");
    expect(getPaletteId(renderEnemy(fastCarrier, 15))).toBe("3");
    expect(getPaletteId(renderEnemy(armorCarrier, 0))).toBe("2");
    expect(getPaletteId(renderEnemy(armorCarrier, 8))).toBe("3");
    expect(
      getPaletteId(renderEnemy({ ...armorCarrier, spawnTicks: 4 }, 8)),
    ).toBe("2");
  });

  it("hides spawning tanks behind the original repeated 14-step spark cadence", () => {
    const spawnCases = [
      [28, "ad"],
      [27, "ad"],
      [26, "a9"],
      [24, "a5"],
      [22, "a1"],
      [19, "a5"],
      [17, "a9"],
      [15, "ad"],
      [14, "ad"],
      [1, "ad"],
    ] as const;

    for (const [spawnTicks, expectedTile] of spawnCases) {
      const markup = getTestIdElementMarkup(
        renderToStaticMarkup(
          <BattleCityBoard
            game={createGame({
              enemies: [
                createEnemy(`spawn-${spawnTicks}`, "basic", { spawnTicks }),
              ],
            })}
          />,
        ),
        "battle-city-enemy",
      );

      expect(markup).toContain('data-testid="battle-city-enemy-spawn"');
      expect(markup).toContain(`data-spawn-tile="${expectedTile}"`);
      expect(markup).toContain("opacity-0");
      expect(markup).not.toContain("animate-ping");
    }

    const playerSpawn = getTestIdElementMarkup(
      renderToStaticMarkup(
        <BattleCityBoard
          game={createGame({
            player: {
              ...createGame().player,
              phase: "spawning",
              phaseTicks: 28,
            },
          })}
        />,
      ),
      "battle-city-player",
    );

    expect(playerSpawn).toContain(
      'data-testid="battle-city-player-spawn"',
    );
    expect(playerSpawn).toContain('data-spawn-tile="ad"');
    expect(playerSpawn).toContain(
      "/images/battle-city/effect-spawn.png?v=modern-v1",
    );
    expect(playerSpawn).toContain("opacity-0");
  });

  it("renders partial walls and multi-frame tank explosions", () => {
    const terrain = createTerrain();
    terrain[5]![7] = "brick";
    const terrainFragments = createBattleCityTerrainFragmentGrid(terrain);
    terrainFragments[5]![7] =
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["top-left"] |
      BATTLE_CITY_TERRAIN_FRAGMENT_BITS["bottom-right"];
    const game = createGame({ terrain, terrainFragments });
    const markup = renderToStaticMarkup(
      <BattleCityBoard
        game={{
          ...game,
          enemies: [
            createEnemy("exploding-enemy", "basic", {
              explosionTicks: 20,
              hitPoints: 0,
            }),
          ],
          player: {
            ...game.player,
            phase: "exploding",
            phaseTicks: 12,
          },
          status: "running",
        }}
      />,
    );

    expect(markup.match(/data-terrain-fragment=/g)).toHaveLength(2);
    expectMarkup(markup, [
      'data-fragment-mask="9"',
      'data-terrain-fragment="top-left"',
      'data-terrain-fragment="bottom-right"',
      'data-player-phase="exploding"',
      'data-explosion-ticks="12"',
      'data-explosion-ticks="20"',
    ]);
    expect(markup.match(/data-testid="battle-city-tank-explosion"/g)).toHaveLength(
      2,
    );
    expect(markup).toContain('data-explosion-frame="f5"');
    expect(markup).toContain('data-explosion-frame="e"');
    expect(markup).toContain(
      "/images/battle-city/effect-tank-explosion.png?v=modern-v1",
    );
    expect(markup).not.toContain("animate-ping");
  });

  it("shows six point-popup states after a shot-killed enemy explosion", () => {
    const renderDestruction = (
      explosionTicks: number,
      destructionPoints: number | null,
    ) =>
      renderToStaticMarkup(
        <BattleCityBoard
          game={createGame({
            enemies: [
              createEnemy("destroyed-enemy", "power", {
                destructionPoints,
                explosionTicks,
                hitPoints: 0,
                score: 300,
              }),
            ],
          })}
        />,
      );

    const finalExplosionState = renderDestruction(7, 300);
    const firstPointState = renderDestruction(6, 300);
    const finalPointState = renderDestruction(1, 300);
    const grenadeTailState = renderDestruction(6, null);

    expect(finalExplosionState).toContain(
      'data-testid="battle-city-tank-explosion"',
    );
    expect(finalExplosionState).not.toContain(
      'data-testid="battle-city-enemy-points"',
    );
    expect(firstPointState).not.toContain(
      'data-testid="battle-city-tank-explosion"',
    );
    expect(firstPointState).toContain(
      'data-testid="battle-city-enemy-points"',
    );
    expect(firstPointState).toContain('data-point-tile="c1"');
    expect(firstPointState).toContain(">300</span>");
    expect(finalPointState).toContain(
      'data-testid="battle-city-enemy-points"',
    );
    expect(grenadeTailState).toContain(
      'data-testid="battle-city-tank-explosion"',
    );
    expect(grenadeTailState).not.toContain(
      'data-testid="battle-city-enemy-points"',
    );
  });

  it("maps every power-up type to its semantic asset and renders the clock effect", () => {
    const assets = {
      clock: "power-up-timer.png",
      grenade: "power-up-grenade.png",
      helmet: "power-up-helmet.png",
      shovel: "power-up-shovel.png",
      star: "power-up-star.png",
      tank: "power-up-tank.png",
    } as const satisfies Record<BattleCityPowerUpType, string>;

    for (const [type, asset] of Object.entries(assets) as [
      BattleCityPowerUpType,
      string,
    ][]) {
      const markup = renderToStaticMarkup(
        <BattleCityBoard
          game={createGame({
            activePowerUp: {
              col: 6,
              id: `power-up-${type}`,
              row: 8,
              type,
            },
            freezeTicks: type === "clock" ? 75 : 0,
            status: "running",
          })}
        />,
      );

      expectMarkup(markup, [
        `data-power-up="${type}"`,
        `/images/battle-city/${asset}?v=modern-v1`,
      ]);

      if (type === "clock") {
        expectMarkup(markup, [
          'data-testid="battle-city-freeze-effect"',
          'data-ticks-remaining="75"',
        ]);
      } else {
        expect(markup).not.toContain(
          'data-testid="battle-city-freeze-effect"',
        );
      }
    }
  });

  it("renders the collected power-up's 500-point marker at its original position", () => {
    const markup = renderToStaticMarkup(
      <BattleCityBoard
        game={createGame({
          powerUpScorePopup: { col: 6, row: 8, ticks: 50 },
          status: "running",
        })}
      />,
    );

    const popup = getOpeningTag(markup, [
      'data-testid="battle-city-power-up-points"',
    ]);

    expect(popup).toContain('data-points="500"');
    expect(popup).toContain('data-point-tile="3b"');
    expect(popup).toContain('data-ticks-remaining="50"');
    expect(popup).toContain("left:23.076923076923077%");
    expect(popup).toContain("top:30.76923076923077%");
    expect(markup).toContain(">500</span>");
    expect(
      getTestIdElementMarkup(markup, "battle-city-power-up-overlay"),
    ).toContain('data-testid="battle-city-power-up-points"');
    expect(
      getTestIdElementMarkup(markup, "battle-city-entity-layer"),
    ).not.toContain('data-testid="battle-city-power-up-points"');
  });

  it("renders a destroyed headquarters and the exact lost-state summary", () => {
    const game = createGame();
    const markup = renderToStaticMarkup(
      <BattleCityBoard
        game={{
          ...game,
          baseAlive: false,
          baseExplosionTicks: 20,
          cycle: 3,
          destroyedEnemyCount: 20,
          lives: 0,
          player: {
            ...game.player,
            invulnerabilityTicks: 10,
          },
          score: 9_999,
          spawnedEnemyCount: 20,
          stage: 35,
          status: "lost",
        }}
      />,
    );

    expectMarkup(markup, [
      'data-testid="battle-city-board"',
      'role="img"',
      "Tank Patrol board. Stage 35. Score 9999. Reserve lives 0. Power tier 0 of 3. 0 reinforcements waiting. Headquarters destroyed. Game over.",
      'data-headquarters-state="destroyed"',
      'data-explosion-ticks="20"',
      'data-testid="battle-city-tank-explosion"',
      'data-shield-source="spawn"',
      "/images/battle-city/headquarters-destroyed.png?v=modern-v1",
      "/images/battle-city/effect-tank-explosion.png?v=modern-v1",
    ]);
    expect(markup).not.toContain("headquarters-intact.png");
  });

  it("keeps an eliminated multiplayer tank absent without a permanent explosion", () => {
    const game = createGame();
    const markup = renderToStaticMarkup(
      <BattleCityBoard
        game={{
          ...game,
          player2: {
            ...game.player,
            col: 16,
            phase: "inactive",
            phaseTicks: 0,
          },
          player2BonusLifeAwarded: false,
          player2Lives: 1,
          player2Score: 800,
          player2StageKillCounts: {
            armor: 0,
            basic: 1,
            fast: 0,
            power: 0,
          },
          stageKillLeaderBonusAwarded: false,
        }}
      />,
    );
    const player2 = getTestIdElementMarkup(markup, "battle-city-player-2");

    expect(player2).toContain('data-player-phase="inactive"');
    expect(player2).toContain("opacity-0");
    expect(player2).not.toContain('data-testid="battle-city-tank-explosion"');
    expect(markup).toContain(
      "Player 2 score 800. Reserve lives 1. Power tier 0 of 3.",
    );
  });

  it("blinks a friendly-fire-stunned tank on the original eight-frame phase", () => {
    const game = createGame();
    const renderPlayer2 = (tick: number) => {
      const markup = renderToStaticMarkup(
        <BattleCityBoard
          game={{
            ...game,
            player2: {
              ...game.player,
              col: 16,
              movementStunTicks: 200,
            },
            player2BonusLifeAwarded: false,
            player2Lives: 3,
            player2Score: 0,
            player2StageKillCounts: {
              armor: 0,
              basic: 0,
              fast: 0,
              power: 0,
            },
            stageKillLeaderBonusAwarded: false,
            tick,
          }}
        />,
      );

      return getTestIdElementMarkup(markup, "battle-city-player-2");
    };

    expect(renderPlayer2(0)).not.toContain("opacity-0");
    expect(renderPlayer2(7)).not.toContain("opacity-0");
    expect(renderPlayer2(8)).toContain("opacity-0");
    expect(renderPlayer2(15)).toContain("opacity-0");
    expect(renderPlayer2(16)).not.toContain("opacity-0");
  });

  it("slides the timed individual game-over message in from the eliminated side", () => {
    const renderMessage = (
      playerId: "player1" | "player2",
      movementPixels: number,
      ticksRemaining: number,
    ) => {
      const markup = renderToStaticMarkup(
        <BattleCityBoard
          game={createGame({
            playerGameOverMessage: {
              movementPixels,
              playerId,
              ticksRemaining,
            },
          })}
        />,
      );

      return getTestIdElementMarkup(
        markup,
        "battle-city-player-game-over-message",
      );
    };

    const player1Start = renderMessage(
      "player1",
      1,
      BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS,
    );
    const player1End = renderMessage(
      "player1",
      48,
      145,
    );
    const player2Start = renderMessage(
      "player2",
      1,
      BATTLE_CITY_PLAYER_GAME_OVER_MESSAGE_TICKS,
    );
    const player2End = renderMessage(
      "player2",
      48,
      145,
    );

    expect(player1Start).toContain('data-col="1.125"');
    expect(player1End).toContain('data-col="7"');
    expect(player2Start).toContain('data-col="20.875"');
    expect(player2End).toContain('data-col="15"');
    expect(player1Start).toContain("top:92.3076923076923%");
    expect(player1Start).not.toContain("transform:");
    expect(player2Start).not.toContain("transform:");
    expect(player1Start).toContain(">GAME OVER</span>");
  });
});
