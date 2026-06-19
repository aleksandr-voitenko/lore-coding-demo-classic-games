export type MinesweeperDifficulty = "easy" | "medium" | "hard";

export const MINESWEEPER_BOARD_WIDTH = 9;
export const MINESWEEPER_BOARD_HEIGHT = 9;
export const MINESWEEPER_MINE_COUNT = 10;
export const MINESWEEPER_DEFAULT_DIFFICULTY = "easy" satisfies MinesweeperDifficulty;
export const MINESWEEPER_DIFFICULTY_SETTINGS = {
  easy: {
    height: MINESWEEPER_BOARD_HEIGHT,
    label: "Easy",
    mineCount: MINESWEEPER_MINE_COUNT,
    width: MINESWEEPER_BOARD_WIDTH,
  },
  hard: {
    height: 16,
    label: "Hard",
    mineCount: 99,
    width: 30,
  },
  medium: {
    height: 16,
    label: "Medium",
    mineCount: 40,
    width: 16,
  },
} as const satisfies Record<
  MinesweeperDifficulty,
  {
    height: number;
    label: string;
    mineCount: number;
    width: number;
  }
>;
export const MINESWEEPER_DIFFICULTY_OPTIONS = [
  { label: MINESWEEPER_DIFFICULTY_SETTINGS.easy.label, value: "easy" },
  { label: MINESWEEPER_DIFFICULTY_SETTINGS.medium.label, value: "medium" },
  { label: MINESWEEPER_DIFFICULTY_SETTINGS.hard.label, value: "hard" },
] as const satisfies readonly { label: string; value: MinesweeperDifficulty }[];

export function normalizeMinesweeperDifficulty(value: unknown): MinesweeperDifficulty {
  return (
    MINESWEEPER_DIFFICULTY_OPTIONS.find((option) => option.value === value)?.value ??
    MINESWEEPER_DEFAULT_DIFFICULTY
  );
}

export function getMinesweeperDifficultySettings(difficulty: MinesweeperDifficulty) {
  return MINESWEEPER_DIFFICULTY_SETTINGS[difficulty];
}
