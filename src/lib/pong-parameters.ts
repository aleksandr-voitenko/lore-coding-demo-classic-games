export const PONG_BOARD_WIDTH = 420;
export const PONG_BOARD_HEIGHT = 560;
export const PONG_TARGET_SCORE = 5;
export const PONG_BOARD_SIZE_OPTIONS = [
  { height: 480, label: "360 x 480", width: 360 },
  { height: 560, label: "420 x 560", width: 420 },
  { height: 640, label: "480 x 640", width: 480 },
] as const;
export const PONG_TARGET_SCORE_OPTIONS = [3, 5, 7] as const;
