"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";

import {
  createBoardCells,
  getActiveTimedFoodEntries,
  getPointKey,
  type Direction,
  type GameState,
  type Point,
  type TimedFoodKind,
} from "@/lib/snake-game-engine";
import type { FoodFeedback } from "@/lib/snake-food-feedback";
import { cn } from "@/lib/utils";

type BoardCellType = "food" | "obstacle" | TimedFoodKind;

type BoardCellRender = {
  className: string;
  rotationDeg?: number;
  src: string;
  testId: string;
};

type SnakeBoardProps = {
  children?: ReactNode;
  foodFeedbacks: FoodFeedback[];
  game: GameState;
  onFoodFeedbackAnimationEnd: (id: number) => void;
  statusLabel: string;
};

const SNAKE_ASSET_VERSION = "sprite-art-v11";
const SNAKE_ASSET_ROOT = "/images/snake";

function getSnakeAssetSrc(fileName: string) {
  return `${SNAKE_ASSET_ROOT}/${fileName}.png?v=${SNAKE_ASSET_VERSION}`;
}

export const snakeSpriteSources = {
  bodyCorner: getSnakeAssetSrc("snake-body-corner"),
  bodyStraight: getSnakeAssetSrc("snake-body-straight"),
  floorCell: getSnakeAssetSrc("floor-cell"),
  foodBlueTriangle: getSnakeAssetSrc("food-blue-triangle"),
  foodCyanHexagon: getSnakeAssetSrc("food-cyan-hexagon"),
  foodPurpleDiamond: getSnakeAssetSrc("food-purple-diamond"),
  foodRedApple: getSnakeAssetSrc("food-red-apple"),
  foodYellowApple: getSnakeAssetSrc("food-yellow-apple"),
  head: getSnakeAssetSrc("snake-head"),
  obstacleStoneA: getSnakeAssetSrc("obstacle-stone-a"),
  obstacleStoneB: getSnakeAssetSrc("obstacle-stone-b"),
  tail: getSnakeAssetSrc("snake-tail"),
} as const;

const cellBackgroundStyle: CSSProperties = {
  backgroundImage: `url("${snakeSpriteSources.floorCell}")`,
};

const oppositeDirections: Record<Direction, Direction> = {
  down: "up",
  left: "right",
  right: "left",
  up: "down",
};

const headRotationDeg: Record<Direction, number> = {
  down: 180,
  left: -90,
  right: 90,
  up: 0,
};

const tailRotationDeg: Record<Direction, number> = {
  down: 0,
  left: 90,
  right: -90,
  up: 180,
};

const foodSpriteSources: Record<BoardCellType, string> = {
  bonusFood: snakeSpriteSources.foodYellowApple,
  food: snakeSpriteSources.foodRedApple,
  obstacle: snakeSpriteSources.obstacleStoneA,
  shrinkFood: snakeSpriteSources.foodCyanHexagon,
  slowFood: snakeSpriteSources.foodBlueTriangle,
  speedFood: snakeSpriteSources.foodPurpleDiamond,
};

const cellSpriteClassNames: Record<BoardCellType, string> = {
  bonusFood:
    "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--snake-bonus-food)_62%,transparent)]",
  food: "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--snake-food)_54%,transparent)]",
  obstacle: "drop-shadow-[0_7px_10px_color-mix(in_oklch,black_30%,transparent)]",
  shrinkFood:
    "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--snake-shrink-food)_62%,transparent)]",
  slowFood:
    "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--snake-slow-food)_62%,transparent)]",
  speedFood:
    "drop-shadow-[0_0_14px_color-mix(in_oklch,var(--snake-speed-food)_62%,transparent)]",
};

function getDirectionBetween(from: Point, to: Point): Direction | null {
  if (to.x === from.x + 1 && to.y === from.y) {
    return "right";
  }

  if (to.x === from.x - 1 && to.y === from.y) {
    return "left";
  }

  if (to.y === from.y + 1 && to.x === from.x) {
    return "down";
  }

  if (to.y === from.y - 1 && to.x === from.x) {
    return "up";
  }

  return null;
}

function getStraightRotation(firstDirection: Direction, secondDirection: Direction) {
  return firstDirection === "up" ||
    firstDirection === "down" ||
    secondDirection === "up" ||
    secondDirection === "down"
    ? 0
    : 90;
}

function getCornerRotation(firstDirection: Direction, secondDirection: Direction) {
  const directions = new Set([firstDirection, secondDirection]);

  if (directions.has("right") && directions.has("down")) {
    return 0;
  }

  if (directions.has("right") && directions.has("up")) {
    return -90;
  }

  if (directions.has("left") && directions.has("up")) {
    return 180;
  }

  return 90;
}

function createSnakeSegmentRender({
  direction,
  index,
  snake,
}: {
  direction: Direction;
  index: number;
  snake: Point[];
}): BoardCellRender {
  const segment = snake[index];

  if (index === 0) {
    return {
      className:
        "drop-shadow-[0_0_10px_color-mix(in_oklch,var(--snake-head)_46%,transparent)]",
      rotationDeg: headRotationDeg[direction],
      src: snakeSpriteSources.head,
      testId: "snake-head",
    };
  }

  const previousSegment = snake[index - 1];

  if (index === snake.length - 1 || snake[index + 1] === undefined) {
    const connectionDirection = getDirectionBetween(segment, previousSegment) ?? "left";

    return {
      className: "drop-shadow-[0_3px_5px_color-mix(in_oklch,black_26%,transparent)]",
      rotationDeg: tailRotationDeg[oppositeDirections[connectionDirection]],
      src: snakeSpriteSources.tail,
      testId: "snake-tail",
    };
  }

  const nextSegment = snake[index + 1];
  const firstDirection = getDirectionBetween(segment, previousSegment);
  const secondDirection = getDirectionBetween(segment, nextSegment);

  if (firstDirection === null || secondDirection === null) {
    return {
      className: "drop-shadow-[0_3px_5px_color-mix(in_oklch,black_26%,transparent)]",
      src: snakeSpriteSources.bodyStraight,
      testId: "snake-body",
    };
  }

  const isStraight = oppositeDirections[firstDirection] === secondDirection;

  return {
    className: "drop-shadow-[0_3px_5px_color-mix(in_oklch,black_26%,transparent)]",
    rotationDeg: isStraight
      ? getStraightRotation(firstDirection, secondDirection)
      : getCornerRotation(firstDirection, secondDirection),
    src: isStraight ? snakeSpriteSources.bodyStraight : snakeSpriteSources.bodyCorner,
    testId: isStraight ? "snake-body" : "snake-corner",
  };
}

function createCellRender(cellType: BoardCellType, cell: Point): BoardCellRender {
  const isObstacle = cellType === "obstacle";

  return {
    className: cellSpriteClassNames[cellType],
    src:
      isObstacle && (cell.x + cell.y) % 2 === 1
        ? snakeSpriteSources.obstacleStoneB
        : foodSpriteSources[cellType],
    testId: isObstacle ? "snake-obstacle" : "snake-food",
  };
}

function getSpriteStyle({ rotationDeg = 0, src }: BoardCellRender): CSSProperties {
  return {
    backgroundImage: `url("${src}")`,
    transform: rotationDeg === 0 ? undefined : `rotate(${rotationDeg}deg)`,
  };
}

export function SnakeBoard({
  children,
  foodFeedbacks,
  game,
  onFoodFeedbackAnimationEnd,
  statusLabel,
}: SnakeBoardProps) {
  const boardCells = useMemo(() => createBoardCells(game.boardSize), [game.boardSize]);
  const activeTimedFoodEntries = useMemo(
    () =>
      getActiveTimedFoodEntries({
        bonusFood: game.bonusFood,
        shrinkFood: game.shrinkFood,
        slowFood: game.slowFood,
        speedFood: game.speedFood,
      }),
    [game.bonusFood, game.shrinkFood, game.slowFood, game.speedFood],
  );
  const activeTimedFoodLabel = activeTimedFoodEntries
    .map(({ rule }) => ` ${rule.label} active.`)
    .join("");

  const occupiedCells = useMemo(() => {
    const cells = new Map<string, BoardCellRender>();

    game.obstacles.forEach((obstacle) => {
      cells.set(getPointKey(obstacle), createCellRender("obstacle", obstacle));
    });
    if (game.food !== null) {
      cells.set(getPointKey(game.food), createCellRender("food", game.food));
    }
    activeTimedFoodEntries.forEach(({ kind, timedFood }) => {
      cells.set(getPointKey(timedFood.position), createCellRender(kind, timedFood.position));
    });
    game.snake.forEach((segment, index) => {
      cells.set(
        getPointKey(segment),
        createSnakeSegmentRender({
          direction: game.direction,
          index,
          snake: game.snake,
        }),
      );
    });

    return cells;
  }, [activeTimedFoodEntries, game.direction, game.food, game.obstacles, game.snake]);

  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-[var(--snake-board-border)] bg-[var(--snake-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--snake-board)_24%,transparent)]">
      <div
        aria-label={`Snake board. Field ${game.boardSize} by ${game.boardSize}. Score ${game.score}. ${statusLabel}.${
          game.obstacles.length === 0 ? "" : ` ${game.obstacles.length} obstacle blocks.`
        }${activeTimedFoodLabel}`}
        className="grid size-full gap-px rounded-[0.375rem] bg-[var(--snake-grid)] p-px"
        data-testid="snake-board"
        role="img"
        style={{
          gridTemplateColumns: `repeat(${game.boardSize}, minmax(0, 1fr))`,
        }}
      >
        {boardCells.map((cell) => {
          const cellRender = occupiedCells.get(getPointKey(cell));

          return (
            <span
              aria-hidden="true"
              className={cn(
                "relative aspect-square overflow-visible rounded-[0.18rem] bg-[var(--snake-board-cell)] bg-cover bg-center bg-no-repeat transition-colors",
              )}
              key={getPointKey(cell)}
              style={cellBackgroundStyle}
            >
              {cellRender ? (
                <span
                  className={cn(
                    "absolute inset-0 bg-contain bg-center bg-no-repeat",
                    cellRender.className,
                  )}
                  data-testid={cellRender.testId}
                  style={getSpriteStyle(cellRender)}
                />
              ) : null}
            </span>
          );
        })}
      </div>

      {game.status === "running" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-2 overflow-hidden rounded-[0.375rem]"
        >
          {foodFeedbacks.map((feedback) => (
            <div
              className="snake-food-feedback absolute z-10 flex min-w-12 flex-col items-center justify-center gap-0.5 rounded-md border border-[color-mix(in_oklch,var(--snake-board-text)_28%,transparent)] bg-[color-mix(in_oklch,var(--snake-board)_80%,transparent)] px-2 py-1 text-center text-sm font-black leading-none text-[var(--snake-board-text)] shadow-[0_10px_24px_color-mix(in_oklch,var(--snake-board)_38%,transparent)] backdrop-blur-[1px]"
              data-testid="snake-food-feedback"
              key={feedback.id}
              onAnimationEnd={() => onFoodFeedbackAnimationEnd(feedback.id)}
              style={{
                left: `${((feedback.position.x + 0.5) / game.boardSize) * 100}%`,
                top: `${((feedback.position.y + 0.5) / game.boardSize) * 100}%`,
              }}
            >
              {feedback.lines.map((line, index) => (
                <span className="whitespace-nowrap" key={`${feedback.id}-${index}`}>
                  {line}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {children}
    </div>
  );
}
