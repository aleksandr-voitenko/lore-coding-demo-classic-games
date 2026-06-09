import {
  getTetrominoPreviewCells,
  type TetrominoKind,
} from "@/lib/tetris-game-engine";
import { cn } from "@/lib/utils";

import { tetrominoCellClassNames } from "./tetris-board";

const TETRIS_PREVIEW_CANVAS_CELLS = 4;
const TETRIS_PREVIEW_GAP_PERCENT = 3;
const TETRIS_PREVIEW_CELL_SIZE_PERCENT =
  (100 - TETRIS_PREVIEW_GAP_PERCENT * (TETRIS_PREVIEW_CANVAS_CELLS - 1)) /
  TETRIS_PREVIEW_CANVAS_CELLS;

type TetrisPreviewBlock = {
  key: string;
  leftPercent: number;
  topPercent: number;
};

function createCenteredPreviewBlocks(kind: TetrominoKind): TetrisPreviewBlock[] {
  const cells = getTetrominoPreviewCells(kind);
  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const widthPercent =
    width * TETRIS_PREVIEW_CELL_SIZE_PERCENT + (width - 1) * TETRIS_PREVIEW_GAP_PERCENT;
  const heightPercent =
    height * TETRIS_PREVIEW_CELL_SIZE_PERCENT + (height - 1) * TETRIS_PREVIEW_GAP_PERCENT;
  const offsetXPercent = (100 - widthPercent) / 2;
  const offsetYPercent = (100 - heightPercent) / 2;
  const stepPercent = TETRIS_PREVIEW_CELL_SIZE_PERCENT + TETRIS_PREVIEW_GAP_PERCENT;

  return cells.map((cell) => {
    const x = cell.x - minX;
    const y = cell.y - minY;

    return {
      key: `${x}:${y}`,
      leftPercent: offsetXPercent + x * stepPercent,
      topPercent: offsetYPercent + y * stepPercent,
    };
  });
}

export function TetrisNextPiecePreview({
  kind,
  testId = "tetris-next-piece",
}: {
  kind: TetrominoKind;
  testId?: string;
}) {
  const previewBlocks = createCenteredPreviewBlocks(kind);

  return (
    <div
      aria-label={`Next piece ${kind}`}
      className="relative aspect-square overflow-hidden rounded-[0.375rem] bg-[var(--tetris-board)] p-1"
      data-testid={testId}
      role="img"
    >
      <div aria-hidden="true" className="relative size-full">
        {previewBlocks.map((block) => (
          <span
            className={cn("absolute rounded-[0.16rem]", tetrominoCellClassNames[kind])}
            key={block.key}
            style={{
              height: `${TETRIS_PREVIEW_CELL_SIZE_PERCENT}%`,
              left: `${block.leftPercent}%`,
              top: `${block.topPercent}%`,
              width: `${TETRIS_PREVIEW_CELL_SIZE_PERCENT}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
