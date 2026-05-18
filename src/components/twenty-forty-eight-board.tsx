"use client";

import type { ReactNode } from "react";

import {
  createTwentyFortyEightBoardCells,
  getTwentyFortyEightTileAt,
  getTwentyFortyEightTopTile,
  TWENTY_FORTY_EIGHT_BOARD_SIZE,
  type TwentyFortyEightGameState,
  type TwentyFortyEightTile,
} from "@/lib/twenty-forty-eight-game-engine";
import { cn } from "@/lib/utils";

type TwentyFortyEightBoardProps = {
  children?: ReactNode;
  game: TwentyFortyEightGameState;
  statusLabel: string;
};

const boardCells = createTwentyFortyEightBoardCells();

const tileClassNames: Record<number, string> = {
  2: "bg-[var(--twenty-tile-2)] text-[var(--twenty-tile-dark)]",
  4: "bg-[var(--twenty-tile-4)] text-[var(--twenty-tile-dark)]",
  8: "bg-[var(--twenty-tile-8)] text-[var(--twenty-tile-light)]",
  16: "bg-[var(--twenty-tile-16)] text-[var(--twenty-tile-light)]",
  32: "bg-[var(--twenty-tile-32)] text-[var(--twenty-tile-light)]",
  64: "bg-[var(--twenty-tile-64)] text-[var(--twenty-tile-light)]",
  128: "bg-[var(--twenty-tile-128)] text-[var(--twenty-tile-light)]",
  256: "bg-[var(--twenty-tile-256)] text-[var(--twenty-tile-light)]",
  512: "bg-[var(--twenty-tile-512)] text-[var(--twenty-tile-light)]",
  1024: "bg-[var(--twenty-tile-1024)] text-[var(--twenty-tile-light)]",
  2048: "bg-[var(--twenty-tile-2048)] text-[var(--twenty-tile-light)]",
};

export function TwentyFortyEightBoard({
  children,
  game,
  statusLabel,
}: TwentyFortyEightBoardProps) {
  const topTile = getTwentyFortyEightTopTile(game);

  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-[var(--twenty-board-border)] bg-[var(--twenty-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--twenty-board)_24%,transparent)]">
      <div
        aria-label={`2048 board. Field ${TWENTY_FORTY_EIGHT_BOARD_SIZE} by ${TWENTY_FORTY_EIGHT_BOARD_SIZE}. Score ${game.score}. Best ${game.bestScore}. Top tile ${topTile}. ${statusLabel}.`}
        aria-colcount={TWENTY_FORTY_EIGHT_BOARD_SIZE}
        aria-rowcount={TWENTY_FORTY_EIGHT_BOARD_SIZE}
        className="grid size-full gap-2 rounded-[0.375rem] bg-[var(--twenty-grid)] p-2"
        data-testid="twenty-forty-eight-board"
        role="grid"
        style={{
          gridTemplateColumns: `repeat(${TWENTY_FORTY_EIGHT_BOARD_SIZE}, minmax(0, 1fr))`,
        }}
      >
        {boardCells.map((cell) => {
          const tile = getTwentyFortyEightTileAt(game, cell.x, cell.y);

          return (
            <span
              aria-label={getCellAriaLabel(cell.x, cell.y, tile)}
              aria-rowindex={cell.y + 1}
              aria-colindex={cell.x + 1}
              className="flex aspect-square min-h-0 min-w-0 items-center justify-center rounded-[0.28rem] bg-[var(--twenty-empty)]"
              data-testid={`twenty-forty-eight-cell-${cell.x}:${cell.y}`}
              key={`${cell.x}:${cell.y}`}
              role="gridcell"
            >
              {tile ? (
                <span
                  className={cn(
                    "flex size-full items-center justify-center rounded-[0.28rem] border border-[color-mix(in_oklch,white_22%,transparent)] font-mono font-black leading-none shadow-[inset_0_-3px_0_color-mix(in_oklch,black_14%,transparent)] transition-colors",
                    getTileClassName(tile.value),
                    getTileTextClassName(tile.value),
                  )}
                  data-testid={`twenty-forty-eight-tile-${tile.value}`}
                >
                  {tile.value}
                </span>
              ) : null}
            </span>
          );
        })}
      </div>

      {children}
    </div>
  );
}

function getTileClassName(value: number) {
  return tileClassNames[value] ?? "bg-[var(--twenty-tile-super)] text-[var(--twenty-tile-light)]";
}

function getTileTextClassName(value: number) {
  if (value >= 1024) {
    return "text-2xl sm:text-3xl";
  }

  if (value >= 128) {
    return "text-3xl sm:text-4xl";
  }

  return "text-4xl sm:text-5xl";
}

function getCellAriaLabel(x: number, y: number, tile: TwentyFortyEightTile | null) {
  const position = `Column ${x + 1}, row ${y + 1}`;

  if (!tile) {
    return `${position}. Empty.`;
  }

  return `${position}. Tile ${tile.value}.`;
}

export const twentyFortyEightBoardSizeLabel = `${TWENTY_FORTY_EIGHT_BOARD_SIZE} x ${TWENTY_FORTY_EIGHT_BOARD_SIZE}`;
