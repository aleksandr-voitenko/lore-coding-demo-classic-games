export type MinesweeperBoardFocusPosition = {
  x: number;
  y: number;
};

type MinesweeperBoardFocusNavigation = {
  ctrlKey: boolean;
  height: number;
  key: string;
  position: MinesweeperBoardFocusPosition;
  width: number;
};

export function clampMinesweeperBoardFocusPosition(
  position: MinesweeperBoardFocusPosition,
  width: number,
  height: number,
): MinesweeperBoardFocusPosition {
  return {
    x: Math.min(Math.max(position.x, 0), width - 1),
    y: Math.min(Math.max(position.y, 0), height - 1),
  };
}

export function getMinesweeperBoardFocusCellId(
  position: MinesweeperBoardFocusPosition,
) {
  return `${position.x}:${position.y}`;
}

export function getMinesweeperBoardFocusNavigationTarget({
  ctrlKey,
  height,
  key,
  position,
  width,
}: MinesweeperBoardFocusNavigation): MinesweeperBoardFocusPosition | null {
  let target: MinesweeperBoardFocusPosition;

  switch (key) {
    case "ArrowDown":
      target = { x: position.x, y: position.y + 1 };
      break;
    case "ArrowLeft":
      target = { x: position.x - 1, y: position.y };
      break;
    case "ArrowRight":
      target = { x: position.x + 1, y: position.y };
      break;
    case "ArrowUp":
      target = { x: position.x, y: position.y - 1 };
      break;
    case "End":
      target = {
        x: width - 1,
        y: ctrlKey ? height - 1 : position.y,
      };
      break;
    case "Home":
      target = {
        x: 0,
        y: ctrlKey ? 0 : position.y,
      };
      break;
    default:
      return null;
  }

  return clampMinesweeperBoardFocusPosition(target, width, height);
}
