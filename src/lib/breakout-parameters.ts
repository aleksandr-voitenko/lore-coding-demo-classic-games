export const BREAKOUT_BOARD_WIDTH = 420;
export const BREAKOUT_BOARD_HEIGHT = 560;
export const BREAKOUT_STARTING_LIVES = 3;
export const BREAKOUT_BOARD_SIZE_OPTIONS = [
  { height: 480, label: "360 x 480", width: 360 },
  { height: 560, label: "420 x 560", width: 420 },
  { height: 640, label: "480 x 640", width: 480 },
] as const;
export const BREAKOUT_LIVES_OPTIONS = [2, 3, 5] as const;
