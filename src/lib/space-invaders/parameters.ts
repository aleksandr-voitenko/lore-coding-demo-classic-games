export const SPACE_INVADERS_BOARD_WIDTH = 420;
export const SPACE_INVADERS_BOARD_HEIGHT = 560;
export const SPACE_INVADERS_COLUMNS = 10;
export const SPACE_INVADERS_ROWS = 5;
export const SPACE_INVADERS_BOARD_SIZE_OPTIONS = [
  { height: 560, label: "420 x 560", width: 420 },
  { height: 640, label: "480 x 640", width: 480 },
  { height: 720, label: "540 x 720", width: 540 },
] as const;
export const SPACE_INVADERS_ALIEN_COUNT_OPTIONS = [
  { alienCount: 24, columns: 8, label: "24", rows: 3 },
  { alienCount: 40, columns: 10, label: "40", rows: 4 },
  { alienCount: 50, columns: 10, label: "50", rows: 5 },
] as const;
