import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AsteroidsBoard } from "./asteroids-board";
import { BreakoutBoard } from "./breakout-board";
import { MinesweeperBoard, MinesweeperStartPreview } from "./minesweeper-board";
import { PongBoard } from "./pong-board";
import { SimonBoard } from "./simon-board";
import { SnakeBoard } from "./snake-board";
import { SpaceInvadersBoard } from "./space-invaders-board";
import { TetrisBoard } from "./tetris-board";
import { TwentyFortyEightBoard } from "./twenty-forty-eight-board";
import { createInitialBreakoutGame } from "@/lib/breakout-game-engine";
import { createInitialAsteroidsGame } from "@/lib/asteroids-game-engine";
import { createInitialMinesweeperGame } from "@/lib/minesweeper-game-engine";
import { createInitialPongGame } from "@/lib/pong-game-engine";
import { createInitialSimonGame } from "@/lib/simon-game-engine";
import { createInitialGame } from "@/lib/snake-game-engine";
import {
  createInitialSpaceInvadersGame,
  SPACE_INVADERS_PLAYER_SHIELD_FLASH_TICKS,
  SPACE_INVADERS_POWER_UP_SIZE,
  SPACE_INVADERS_SCORE_POPUP_TICKS,
} from "@/lib/space-invaders-game-engine";
import { createInitialTetrisGame } from "@/lib/tetris-game-engine";
import type { TwentyFortyEightGameState } from "@/lib/twenty-forty-eight-game-engine";

function expectMarkup(markup: string, fragments: string[]) {
  fragments.forEach((fragment) => {
    expect(markup).toContain(fragment);
  });
}

describe("game board renderers", () => {
  it("renders Snake board state, timed food labels, feedback, and overlays", () => {
    const game = {
      ...createInitialGame({ boardSize: 11 }),
      bonusFood: {
        expiresAt: 1_000,
        position: { x: 4, y: 4 },
      },
      food: { x: 5, y: 5 },
      obstacles: [
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ],
      score: 7,
      shrinkFood: {
        expiresAt: 1_000,
        position: { x: 8, y: 4 },
      },
      slowFood: {
        expiresAt: 1_000,
        position: { x: 7, y: 4 },
      },
      snake: [
        { x: 3, y: 3 },
        { x: 2, y: 3 },
        { x: 2, y: 4 },
        { x: 2, y: 5 },
      ],
      speedFood: {
        expiresAt: 1_000,
        position: { x: 6, y: 4 },
      },
      status: "running" as const,
    };
    const markup = renderToStaticMarkup(
      <SnakeBoard
        foodFeedbacks={[{ id: 1, lines: ["+1"], position: { x: 5, y: 5 } }]}
        game={game}
        onFoodFeedbackAnimationEnd={vi.fn()}
        statusLabel="Running"
      >
        <span data-testid="snake-overlay">Overlay</span>
      </SnakeBoard>,
    );

    expectMarkup(markup, [
      'data-testid="snake-board"',
      "Snake board. Field 11 by 11. Score 7. Running. 2 obstacle blocks. Yellow apple active. Purple diamond active. Blue triangle active. Cyan hexagon active.",
      'data-testid="snake-food-feedback"',
      'data-testid="snake-overlay"',
      "/images/snake/floor-cell.png?v=sprite-art-v11",
      "/images/snake/snake-head.png?v=sprite-art-v11",
      "/images/snake/snake-body-straight.png?v=sprite-art-v11",
      "/images/snake/snake-body-corner.png?v=sprite-art-v11",
      "/images/snake/snake-tail.png?v=sprite-art-v11",
      "/images/snake/food-red-apple.png?v=sprite-art-v11",
      "/images/snake/food-yellow-apple.png?v=sprite-art-v11",
      "/images/snake/food-purple-diamond.png?v=sprite-art-v11",
      "/images/snake/food-blue-triangle.png?v=sprite-art-v11",
      "/images/snake/food-cyan-hexagon.png?v=sprite-art-v11",
      "/images/snake/obstacle-stone-a.png?v=sprite-art-v11",
      "/images/snake/obstacle-stone-b.png?v=sprite-art-v11",
      "transform:rotate(90deg)",
    ]);
  });

  it("renders Tetris board state with its accessible score summary", () => {
    const game = createInitialTetrisGame({ random: () => 0 });
    const markup = renderToStaticMarkup(
      <TetrisBoard game={game} statusLabel="Ready">
        <span data-testid="tetris-overlay">Start</span>
      </TetrisBoard>,
    );

    expectMarkup(markup, [
      'data-testid="tetris-board"',
      "Tetris board. Field 10 by 20. Score 0. Lines 0. Level 1. Ready.",
      'data-testid="tetris-overlay"',
    ]);
  });

  it("renders Breakout ball, paddle, and active brick count", () => {
    const game = createInitialBreakoutGame();
    const markup = renderToStaticMarkup(
      <BreakoutBoard
        game={{
          ...game,
          bricks: game.bricks.map((brick, index) => ({
            ...brick,
            isActive: index !== 0,
          })),
          status: "running",
        }}
        statusLabel="Running"
      />,
    );

    expectMarkup(markup, [
      'data-testid="breakout-board"',
      "Breakout board. Field 420 by 560. Score 0. Lives 3. 49 bricks remaining. Running.",
      'data-testid="breakout-brick"',
      'data-testid="breakout-ball"',
      'data-testid="breakout-paddle"',
    ]);
  });

  it("renders Minesweeper covered, flagged, numbered, empty, and mine cells", () => {
    const initialGame = createInitialMinesweeperGame({ height: 3, mineCount: 1, width: 3 });
    const game = {
      ...initialGame,
      cells: initialGame.cells.map((cell) => {
        if (cell.id === "0:0") {
          return { ...cell, isFlagged: true };
        }

        if (cell.id === "1:0") {
          return { ...cell, adjacentMines: 2, isRevealed: true };
        }

        if (cell.id === "2:0") {
          return { ...cell, isMine: true, isRevealed: true };
        }

        if (cell.id === "0:1") {
          return { ...cell, isRevealed: true };
        }

        return cell;
      }),
      flagCount: 1,
      minefieldStatus: "placed" as const,
      revealedSafeCellCount: 2,
      status: "running" as const,
    };
    const markup = renderToStaticMarkup(
      <MinesweeperBoard
        game={game}
        isFlagMode={false}
        onRevealCell={vi.fn()}
        onToggleFlag={vi.fn()}
        statusLabel="Running"
      />,
    );
    const previewMarkup = renderToStaticMarkup(<MinesweeperStartPreview />);

    expectMarkup(markup, [
      'data-testid="minesweeper-board"',
      "Minesweeper board. Field 3 by 3. 1 mines. 1 flags. 2 safe cells revealed. Running.",
      "Column 1, row 1. Flagged.",
      "Column 2, row 1. 2 adjacent mines.",
      "Column 3, row 1. Mine revealed.",
      "Column 1, row 2. Empty.",
    ]);
    expect(previewMarkup).toContain("grid-cols-5");
  });

  it("renders Space Invaders formation, player shot, and remaining count", () => {
    const game = createInitialSpaceInvadersGame();
    const markup = renderToStaticMarkup(
      <SpaceInvadersBoard
        game={{
          ...game,
          invaders: game.invaders.map((invader, index) => ({
            ...invader,
            isActive: index !== 0,
          })),
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
              height: 24,
              id: "invader-shot-test",
              kind: "needle",
              sourceColumn: 4,
              sourceInvaderId: "3:4",
              sourceRow: 3,
              ttlTicks: null,
              velocityX: 0,
              velocityY: 4.9,
              width: 3,
              x: 170,
              y: 240,
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
          ],
          scorePopups: [
            {
              ageTicks: 0,
              height: 22,
              id: "score-popup-test",
              points: 30,
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
      'data-testid="space-invaders-board"',
      "Space Invaders board. Field 420 by 560. Score 0. Lives 3. 54 invaders remaining. 7 power ups falling. Running.",
      'data-testid="space-invaders-invader"',
      'data-invader-kind="diver"',
      'data-testid="space-invaders-player-shot"',
      'data-player-shot-kind="burst"',
      'data-player-shot-kind="piercing"',
      'data-testid="space-invaders-invader-shot"',
      'data-shot-kind="needle"',
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
      'data-explosion-variant="3"',
      "space-invaders-explosion--ufo",
      "space-invaders-explosion__sprite--3",
      'data-testid="space-invaders-score-popup"',
      'data-score-popup-points="30"',
      "space-invaders-score-popup__text",
      "+30",
      'data-testid="space-invaders-ufo"',
      'data-ufo-points="150"',
      'data-testid="space-invaders-player"',
      "/images/space-invaders/background.png?v=sprite-art-v2",
      "/images/space-invaders/alien-purple.png?v=sprite-art-v2",
      "/images/space-invaders/explosion-3.png?v=sprite-art-v2",
      "/images/space-invaders/ufo.png?v=sprite-art-v2",
      "/images/space-invaders/player-shot.png?v=sprite-art-v2",
      "/images/space-invaders/player-piercing-shot.png?v=sprite-art-v2",
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

  it("renders Pong ball, paddles, and score target", () => {
    const game = createInitialPongGame();
    const markup = renderToStaticMarkup(<PongBoard game={game} statusLabel="Ready" />);

    expectMarkup(markup, [
      'data-testid="pong-board"',
      "Pong board. Field 420 by 560. Score 1000. Player 0. Computer 0. First to 5. Ready.",
      'data-testid="pong-ball"',
      'data-testid="pong-player-paddle"',
      'data-testid="pong-cpu-paddle"',
    ]);
  });

  it("renders 2048 cells with known, large, and fallback tile values", () => {
    const game: TwentyFortyEightGameState = {
      bestScore: 256,
      boardSize: 4,
      moveCount: 3,
      nextTileId: 4,
      score: 128,
      status: "running",
      tiles: [
        { id: "tile-1", value: 2, x: 0, y: 0 },
        { id: "tile-2", value: 128, x: 1, y: 0 },
        { id: "tile-3", value: 4096, x: 2, y: 0 },
      ],
      winTile: 2048,
    };
    const markup = renderToStaticMarkup(
      <TwentyFortyEightBoard game={game} statusLabel="Running" />,
    );

    expectMarkup(markup, [
      'data-testid="twenty-forty-eight-board"',
      "2048 board. Field 4 by 4. Score 128. Best 256. Top tile 4096. Goal 2048. Running.",
      'data-testid="twenty-forty-eight-tile-2"',
      'data-testid="twenty-forty-eight-tile-128"',
      'data-testid="twenty-forty-eight-tile-4096"',
      "Column 4, row 1. Empty.",
    ]);
  });

  it("renders Simon pads with active input state and labels", () => {
    const game = {
      ...createInitialSimonGame({ winTarget: 4 }),
      activePad: "red" as const,
      round: 2,
      score: 1,
      sequence: ["red" as const],
      status: "input" as const,
    };
    const markup = renderToStaticMarkup(
      <SimonBoard game={game} onPadPress={vi.fn()} statusLabel="Repeat" />,
    );

    expectMarkup(markup, [
      'data-testid="simon-board"',
      "Simon board. Round 2. Score 1. Target 4. Repeat.",
      'data-testid="simon-pad-green"',
      'data-testid="simon-pad-red"',
      "border-white/95",
      "brightness-125",
      "inset_0_0_0_4px_rgba(255,255,255,0.94)",
      "Red pad. Key 2 or W.",
      ">2</div>",
    ]);
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
      "Asteroids board. Field 640 by 480. Score 120. Lives 3. Wave 2. 6 asteroids remaining. Running.",
      'data-testid="asteroids-asteroid"',
      'data-testid="asteroids-bullet"',
      'data-testid="asteroids-ship"',
      "<polygon",
    ]);
  });
});
