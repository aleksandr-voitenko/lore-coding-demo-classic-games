export const TETRIS_BOARD_WIDTH = 10;
export const TETRIS_BOARD_HEIGHT = 20;
export const TETRIS_START_LEVEL = 1;
export const TETRIS_BOARD_SIZE_OPTIONS = [
  { height: 18, label: "10 x 18", width: 10 },
  { height: 20, label: "10 x 20", width: 10 },
  { height: 22, label: "12 x 22", width: 12 },
] as const;
export const TETRIS_START_LEVEL_OPTIONS = [1, 3, 5] as const;
