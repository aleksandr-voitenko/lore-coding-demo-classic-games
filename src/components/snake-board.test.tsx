import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";

import { SnakeBoard } from "./snake-board";
import { expectMarkup } from "./game-board-test-utils";
import { createInitialGame } from "@/lib/snake-game-engine";

describe("SnakeBoard", () => {
  it("renders Snake board state, timed food labels, feedback, and overlays", () => {
    const game = {
      ...createInitialGame({ boardSize: 11 }),
      bonusFood: {
        expiresAt: 1_000,
        position: { x: 4, y: 4 },
      },
      door: {
        isOpen: false,
        position: { x: 9, y: 9 },
      },
      food: { x: 5, y: 5 },
      key: { x: 9, y: 8 },
      level: 2,
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
      "Snake board. Level 2. Field 11 by 11. Score 7. Running. 2 obstacle blocks. Exit door closed. Door key available. Yellow apple active. Purple diamond active. Blue triangle active. Cyan hexagon active.",
      'data-testid="snake-food-feedback"',
      'data-testid="snake-overlay"',
      'data-testid="snake-door-closed"',
      'data-testid="snake-door-key"',
      "/images/snake/floor-cell.png?v=sprite-art-v11",
      "/images/snake/snake-head.png?v=sprite-art-v11",
      "/images/snake/snake-body-straight.png?v=sprite-art-v11",
      "/images/snake/snake-body-corner.png?v=sprite-art-v11",
      "/images/snake/snake-tail.png?v=sprite-art-v11",
      "/images/snake/door-closed.png?v=sprite-art-v11",
      "/images/snake/door-key.png?v=sprite-art-v11",
      "/images/snake/food-red-apple.png?v=sprite-art-v11",
      "/images/snake/food-yellow-apple.png?v=sprite-art-v11",
      "/images/snake/food-purple-diamond.png?v=sprite-art-v11",
      "/images/snake/food-blue-triangle.png?v=sprite-art-v11",
      "/images/snake/food-cyan-hexagon.png?v=sprite-art-v11",
      "/images/snake/obstacle-stone-a.png?v=sprite-art-v11",
      "/images/snake/obstacle-stone-b.png?v=sprite-art-v11",
      "transform:rotate(90deg)",
    ]);

    const openDoorMarkup = renderToStaticMarkup(
      <SnakeBoard
        foodFeedbacks={[]}
        game={{
          ...game,
          door: {
            isOpen: true,
            position: { x: 9, y: 9 },
          },
          key: null,
        }}
        onFoodFeedbackAnimationEnd={vi.fn()}
        statusLabel="Running"
      />,
    );

    expectMarkup(openDoorMarkup, [
      "Exit door open.",
      'data-testid="snake-door-open"',
      "/images/snake/door-open.png?v=sprite-art-v11",
    ]);
  });
});
