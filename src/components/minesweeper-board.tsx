"use client";

import { BombIcon, FlagIcon } from "lucide-react";
import type { KeyboardEvent, MouseEvent, PointerEvent, ReactNode } from "react";

import {
  MINESWEEPER_BOARD_HEIGHT,
  MINESWEEPER_BOARD_WIDTH,
  type MinesweeperCell,
  type MinesweeperGameState,
} from "@/lib/minesweeper-game-engine";
import { cn } from "@/lib/utils";

type MinesweeperBoardProps = {
  children?: ReactNode;
  game: MinesweeperGameState;
  isFlagMode: boolean;
  isInputDisabled?: boolean;
  onRevealCell: (cellId: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onTrackPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onToggleFlag: (cellId: string, event?: MouseEvent<HTMLButtonElement>) => void;
  statusLabel: string;
};

const adjacentMineClassNames = [
  "",
  "text-[var(--minesweeper-one)]",
  "text-[var(--minesweeper-two)]",
  "text-[var(--minesweeper-three)]",
  "text-[var(--minesweeper-four)]",
  "text-[var(--minesweeper-five)]",
  "text-[var(--minesweeper-six)]",
  "text-[var(--minesweeper-seven)]",
  "text-[var(--minesweeper-eight)]",
] as const;

export function MinesweeperBoard({
  children,
  game,
  isFlagMode,
  isInputDisabled = false,
  onRevealCell,
  onTrackPointerMove,
  onToggleFlag,
  statusLabel,
}: MinesweeperBoardProps) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-[var(--minesweeper-board-border)] bg-[var(--minesweeper-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--minesweeper-board)_24%,transparent)]"
      onPointerMove={onTrackPointerMove}
      style={{ aspectRatio: `${game.width} / ${game.height}` }}
    >
      <div
        aria-label={`Minesweeper board. Field ${game.width} by ${game.height}. ${game.mineCount} mines. ${game.flagCount} flags. ${game.revealedSafeCellCount} safe cells revealed. ${statusLabel}.`}
        className="grid size-full gap-px rounded-[0.375rem] bg-[var(--minesweeper-grid)] p-px"
        data-testid="minesweeper-board"
        role="group"
        style={{
          gridTemplateColumns: `repeat(${game.width}, minmax(0, 1fr))`,
        }}
      >
        {game.cells.map((cell) => (
          <MinesweeperCellButton
            cell={cell}
            disabled={isInputDisabled || game.status === "lost" || game.status === "won"}
            isFlagMode={isFlagMode}
            key={cell.id}
            onRevealCell={onRevealCell}
            onToggleFlag={onToggleFlag}
          />
        ))}
      </div>

      {children}
    </div>
  );
}

type MinesweeperCellButtonProps = {
  cell: MinesweeperCell;
  disabled: boolean;
  isFlagMode: boolean;
  onRevealCell: (cellId: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onToggleFlag: (cellId: string, event?: MouseEvent<HTMLButtonElement>) => void;
};

function MinesweeperCellButton({
  cell,
  disabled,
  isFlagMode,
  onRevealCell,
  onToggleFlag,
}: MinesweeperCellButtonProps) {
  const isCovered = !cell.isRevealed;

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    if (isFlagMode) {
      onToggleFlag(cell.id, event);
      return;
    }

    onRevealCell(cell.id, event);
  }

  function handleContextMenu(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    onToggleFlag(cell.id, event);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "f" || event.key === "F") {
      event.preventDefault();
      onToggleFlag(cell.id);
    }
  }

  return (
    <button
      aria-label={getCellAriaLabel(cell)}
      className={cn(
        "flex aspect-square min-h-0 min-w-0 items-center justify-center border font-mono text-sm font-black leading-none transition sm:text-base",
        "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--minesweeper-focus)]",
        isCovered &&
          "border-[color-mix(in_oklch,var(--minesweeper-covered-edge)_76%,black)] bg-[var(--minesweeper-covered)] text-[var(--minesweeper-ink)] shadow-[inset_2px_2px_0_color-mix(in_oklch,white_68%,transparent),inset_-2px_-2px_0_color-mix(in_oklch,black_22%,transparent)] hover:bg-[color-mix(in_oklch,var(--minesweeper-covered)_84%,white)]",
        !isCovered &&
          "border-[color-mix(in_oklch,var(--minesweeper-grid)_70%,white)] bg-[var(--minesweeper-revealed)] shadow-[inset_0_1px_0_color-mix(in_oklch,white_54%,transparent)]",
        cell.isRevealed &&
          cell.isMine &&
          "bg-[var(--minesweeper-mine-hit)] text-[var(--minesweeper-mine-hit-text)]",
        cell.isRevealed &&
          !cell.isMine &&
          cell.adjacentMines > 0 &&
          adjacentMineClassNames[cell.adjacentMines],
      )}
      data-cell-id={cell.id}
      data-testid={`minesweeper-cell-${cell.id}`}
      disabled={disabled}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onKeyDown={handleKeyDown}
      type="button"
    >
      {cell.isRevealed && cell.isMine ? (
        <BombIcon className="size-[58%]" aria-hidden="true" />
      ) : cell.isFlagged ? (
        <FlagIcon className="size-[54%] fill-[var(--minesweeper-flag)] text-[var(--minesweeper-flag)]" aria-hidden="true" />
      ) : cell.isRevealed && cell.adjacentMines > 0 ? (
        cell.adjacentMines
      ) : null}
    </button>
  );
}

function getCellAriaLabel(cell: MinesweeperCell) {
  const position = `Column ${cell.x + 1}, row ${cell.y + 1}`;

  if (cell.isFlagged && !cell.isRevealed) {
    return `${position}. Flagged.`;
  }

  if (!cell.isRevealed) {
    return `${position}. Covered.`;
  }

  if (cell.isMine) {
    return `${position}. Mine revealed.`;
  }

  if (cell.adjacentMines === 0) {
    return `${position}. Empty.`;
  }

  return `${position}. ${cell.adjacentMines} adjacent mines.`;
}

export function MinesweeperStartPreview() {
  return (
    <div
      className="grid grid-cols-5 gap-1 rounded-md border border-[color-mix(in_oklch,var(--minesweeper-board-text)_18%,transparent)] bg-[color-mix(in_oklch,var(--minesweeper-board)_70%,transparent)] p-2"
      aria-hidden="true"
    >
      {Array.from({ length: 25 }, (_, index) => {
        const isFlag = index === 7;
        const isMine = index === 18;
        const number = index === 11 ? 2 : index === 12 ? 1 : null;

        return (
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded-[0.16rem] border text-xs font-black",
              "border-[color-mix(in_oklch,var(--minesweeper-grid)_70%,white)] bg-[var(--minesweeper-covered)]",
              number && "bg-[var(--minesweeper-revealed)]",
            )}
            key={index}
          >
            {isFlag ? (
              <FlagIcon className="size-3 fill-[var(--minesweeper-flag)] text-[var(--minesweeper-flag)]" />
            ) : isMine ? (
              <BombIcon className="size-3 text-[var(--minesweeper-mine)]" />
            ) : (
              number
            )}
          </span>
        );
      })}
    </div>
  );
}

export const minesweeperBoardSizeLabel = `${MINESWEEPER_BOARD_WIDTH} x ${MINESWEEPER_BOARD_HEIGHT}`;
