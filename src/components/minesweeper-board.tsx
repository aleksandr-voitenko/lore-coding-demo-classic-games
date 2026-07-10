"use client";

import { BombIcon, FlagIcon } from "lucide-react";
import {
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

import {
  clampMinesweeperBoardFocusPosition,
  getMinesweeperBoardFocusCellId,
  getMinesweeperBoardFocusNavigationTarget,
  type MinesweeperBoardFocusPosition,
} from "./minesweeper-board-focus";
import {
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
  const [focusPosition, setFocusPosition] = useState<MinesweeperBoardFocusPosition>({
    x: 0,
    y: 0,
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const isDisabled =
    isInputDisabled || game.status === "lost" || game.status === "won";
  const activeFocusPosition = clampMinesweeperBoardFocusPosition(
    focusPosition,
    game.width,
    game.height,
  );
  const activeCellId = getMinesweeperBoardFocusCellId(activeFocusPosition);
  const rows = Array.from({ length: game.height }, (_, rowIndex) =>
    game.cells.slice(rowIndex * game.width, (rowIndex + 1) * game.width),
  );

  function activateCell(position: MinesweeperBoardFocusPosition) {
    setFocusPosition(position);
  }

  function moveFocus(position: MinesweeperBoardFocusPosition) {
    const targetPosition = clampMinesweeperBoardFocusPosition(
      position,
      game.width,
      game.height,
    );
    const targetCellId = getMinesweeperBoardFocusCellId(targetPosition);

    setFocusPosition(targetPosition);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`[data-cell-id="${targetCellId}"]`)
      ?.focus();
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-md border border-[var(--minesweeper-board-border)] bg-[var(--minesweeper-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--minesweeper-board)_24%,transparent)]"
      onPointerMove={onTrackPointerMove}
      style={{ aspectRatio: `${game.width} / ${game.height}` }}
    >
      <div
        aria-label={`Minesweeper board. Field ${game.width} by ${game.height}. ${game.mineCount} mines. ${game.flagCount} flags. ${game.revealedSafeCellCount} safe cells revealed. ${statusLabel}.`}
        aria-colcount={game.width}
        aria-rowcount={game.height}
        className="grid size-full gap-px rounded-[0.375rem] bg-[var(--minesweeper-grid)] p-px"
        data-testid="minesweeper-board"
        ref={gridRef}
        role="grid"
        style={{
          gridTemplateRows: `repeat(${game.height}, minmax(0, 1fr))`,
        }}
      >
        {rows.map((row, rowIndex) => (
          <div
            className="grid min-h-0 min-w-0 gap-px"
            key={rowIndex}
            role="row"
            style={{
              gridTemplateColumns: `repeat(${game.width}, minmax(0, 1fr))`,
            }}
          >
            {row.map((cell) => (
              <div className="min-h-0 min-w-0" key={cell.id} role="gridcell">
                <MinesweeperCellButton
                  cell={cell}
                  disabled={isDisabled}
                  isActive={cell.id === activeCellId}
                  isFlagMode={isFlagMode}
                  onActivateCell={activateCell}
                  onMoveFocus={moveFocus}
                  onRevealCell={onRevealCell}
                  onToggleFlag={onToggleFlag}
                  boardHeight={game.height}
                  boardWidth={game.width}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {children}
    </div>
  );
}

type MinesweeperCellButtonProps = {
  boardHeight: number;
  boardWidth: number;
  cell: MinesweeperCell;
  disabled: boolean;
  isActive: boolean;
  isFlagMode: boolean;
  onActivateCell: (position: MinesweeperBoardFocusPosition) => void;
  onMoveFocus: (position: MinesweeperBoardFocusPosition) => void;
  onRevealCell: (cellId: string, event?: MouseEvent<HTMLButtonElement>) => void;
  onToggleFlag: (cellId: string, event?: MouseEvent<HTMLButtonElement>) => void;
};

function MinesweeperCellButton({
  boardHeight,
  boardWidth,
  cell,
  disabled,
  isActive,
  isFlagMode,
  onActivateCell,
  onMoveFocus,
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
      return;
    }

    const targetPosition = getMinesweeperBoardFocusNavigationTarget({
      ctrlKey: event.ctrlKey,
      height: boardHeight,
      key: event.key,
      position: cell,
      width: boardWidth,
    });

    if (targetPosition === null) {
      return;
    }

    event.preventDefault();
    onMoveFocus(targetPosition);
  }

  return (
    <button
      aria-label={getCellAriaLabel(cell)}
      className={cn(
        "flex size-full min-h-0 min-w-0 items-center justify-center border font-mono text-sm font-black leading-none transition sm:text-base",
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
      onFocus={() => onActivateCell(cell)}
      onKeyDown={handleKeyDown}
      onPointerDown={() => onActivateCell(cell)}
      tabIndex={disabled || !isActive ? -1 : 0}
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
