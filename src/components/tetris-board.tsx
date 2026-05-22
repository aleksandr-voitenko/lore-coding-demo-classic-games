"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import {
  createTetrisBoardCells,
  renderTetrisBoard,
  type TetrominoKind,
  type TetrisGameState,
} from "@/lib/tetris-game-engine";
import { cn } from "@/lib/utils";

type TetrisBoardProps = {
  children?: ReactNode;
  game: TetrisGameState;
  statusLabel: string;
};

export const tetrominoCellClassNames: Record<TetrominoKind, string> = {
  I: "bg-[var(--tetris-cyan)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-cyan)_32%,transparent)]",
  J: "bg-[var(--tetris-blue)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-blue)_32%,transparent)]",
  L: "bg-[var(--tetris-orange)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-orange)_32%,transparent)]",
  O: "bg-[var(--tetris-yellow)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-yellow)_32%,transparent)]",
  S: "bg-[var(--tetris-green)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-green)_32%,transparent)]",
  T: "bg-[var(--tetris-purple)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-purple)_32%,transparent)]",
  Z: "bg-[var(--tetris-red)] shadow-[inset_0_-2px_0_color-mix(in_oklch,black_18%,transparent),0_0_16px_color-mix(in_oklch,var(--tetris-red)_32%,transparent)]",
};

export function TetrisBoard({ children, game, statusLabel }: TetrisBoardProps) {
  const boardCells = useMemo(
    () => createTetrisBoardCells(game.boardWidth, game.boardHeight),
    [game.boardHeight, game.boardWidth],
  );
  const renderedBoard = useMemo(() => renderTetrisBoard(game), [game]);

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--tetris-board-border)] bg-[var(--tetris-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--tetris-board)_26%,transparent)]"
      style={{ aspectRatio: `${game.boardWidth} / ${game.boardHeight}` }}
    >
      <div
        aria-label={`Tetris board. Field ${game.boardWidth} by ${game.boardHeight}. Score ${game.score}. Lines ${game.lines}. Level ${game.level}. ${statusLabel}.`}
        className="grid size-full gap-px rounded-[0.375rem] bg-[var(--tetris-grid)] p-px"
        data-testid="tetris-board"
        role="img"
        style={{
          gridTemplateColumns: `repeat(${game.boardWidth}, minmax(0, 1fr))`,
        }}
      >
        {boardCells.map((cell) => {
          const cellKind = renderedBoard[cell.y]?.[cell.x] ?? null;

          return (
            <span
              aria-hidden="true"
              className={cn(
                "aspect-square rounded-[0.16rem] bg-[var(--tetris-board-cell)] transition-colors",
                cellKind && tetrominoCellClassNames[cellKind],
              )}
              key={`${cell.x}:${cell.y}`}
            />
          );
        })}
      </div>

      {children}
    </div>
  );
}
