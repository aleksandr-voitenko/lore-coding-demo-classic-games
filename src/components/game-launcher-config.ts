import {
  ASTEROIDS_DEFAULT_DIFFICULTY,
  ASTEROIDS_DIFFICULTY_OPTIONS,
  normalizeAsteroidsDifficulty,
  type AsteroidsDifficulty,
} from "@/lib/asteroids/parameters";
import {
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_SIZE_OPTIONS,
  BREAKOUT_BOARD_WIDTH,
  BREAKOUT_LIVES_OPTIONS,
  BREAKOUT_STARTING_LIVES,
} from "@/lib/breakout-parameters";
import {
  MINESWEEPER_DEFAULT_DIFFICULTY,
  MINESWEEPER_DIFFICULTY_OPTIONS,
  normalizeMinesweeperDifficulty,
  type MinesweeperDifficulty,
} from "@/lib/minesweeper-parameters";
import {
  PONG_BOARD_HEIGHT,
  PONG_BOARD_SIZE_OPTIONS,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
  PONG_TARGET_SCORE_OPTIONS,
} from "@/lib/pong-parameters";
import {
  SIMON_DEFAULT_DIFFICULTY,
  SIMON_DIFFICULTY_OPTIONS,
  normalizeSimonDifficulty,
  type SimonDifficulty,
} from "@/lib/simon-parameters";
import {
  SPACE_INVADERS_ALIEN_COUNT_OPTIONS,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_SIZE_OPTIONS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_ROWS,
} from "@/lib/space-invaders/parameters";
import {
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_SIZE_OPTIONS,
  TETRIS_BOARD_WIDTH,
  TETRIS_START_LEVEL,
  TETRIS_START_LEVEL_OPTIONS,
} from "@/lib/tetris-parameters";
import {
  TWENTY_FORTY_EIGHT_BOARD_SIZE,
  TWENTY_FORTY_EIGHT_BOARD_SIZE_OPTIONS,
  TWENTY_FORTY_EIGHT_WIN_TILE,
  TWENTY_FORTY_EIGHT_WIN_TILE_OPTIONS,
} from "@/lib/twenty-forty-eight-parameters";
import {
  getGameCatalogArtwork,
  getGameCatalogEntry,
  getVersionedGameCatalogArtworkSrc,
  type GameCatalogArtwork,
  type GameId,
} from "@/lib/game-catalog";

export type { GameId } from "@/lib/game-catalog";

type GameDifficulty = AsteroidsDifficulty | MinesweeperDifficulty | SimonDifficulty;

export type PlayableGameProps = {
  initialAlienCount?: number;
  initialBoardHeight?: number;
  initialBoardSize?: number;
  initialBoardWidth?: number;
  initialDifficulty?: GameDifficulty;
  initialLives?: number;
  initialStartLevel?: number;
  initialTargetScore?: number;
  initialWinTile?: number;
  onBackToMenu: () => void;
  onReplayBackToProfile?: () => void;
  replayMode?: "latest";
};

export type PlayableInitialProps = Omit<PlayableGameProps, "onBackToMenu">;

type BoardSizeOption = {
  height: number;
  label: string;
  width: number;
};

export type GameParameterSelectOption = {
  label: string;
  value: string;
};

export type GameParameterConfig = {
  ariaLabel?: string;
  defaultValue: string;
  label: string;
  normalizeValue?: (value: string) => string;
  options: readonly GameParameterSelectOption[];
  toInitialProps: (value: string) => PlayableInitialProps;
};

export const GAME_PARAMETER_CONFIG = defineGameParameterConfig({
  "tetris-board-size": createBoardSizeParameter({
    defaultSize: {
      height: TETRIS_BOARD_HEIGHT,
      width: TETRIS_BOARD_WIDTH,
    },
    label: "Board",
    options: TETRIS_BOARD_SIZE_OPTIONS,
  }),
  "tetris-start-level": {
    defaultValue: String(TETRIS_START_LEVEL),
    label: "Level",
    options: createNumberSelectOptions(TETRIS_START_LEVEL_OPTIONS),
    toInitialProps: (value) => ({
      initialStartLevel: Number(value),
    }),
  },
  "breakout-board-size": createBoardSizeParameter({
    defaultSize: {
      height: BREAKOUT_BOARD_HEIGHT,
      width: BREAKOUT_BOARD_WIDTH,
    },
    label: "Board",
    options: BREAKOUT_BOARD_SIZE_OPTIONS,
  }),
  "breakout-lives": {
    defaultValue: String(BREAKOUT_STARTING_LIVES),
    label: "Lives",
    options: createNumberSelectOptions(BREAKOUT_LIVES_OPTIONS),
    toInitialProps: (value) => ({
      initialLives: Number(value),
    }),
  },
  "minesweeper-difficulty": {
    defaultValue: MINESWEEPER_DEFAULT_DIFFICULTY,
    label: "Difficulty",
    normalizeValue: normalizeMinesweeperDifficulty,
    options: MINESWEEPER_DIFFICULTY_OPTIONS.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    toInitialProps: (value) => ({
      initialDifficulty: normalizeMinesweeperDifficulty(value),
    }),
  },
  "space-invaders-board-size": createBoardSizeParameter({
    defaultSize: {
      height: SPACE_INVADERS_BOARD_HEIGHT,
      width: SPACE_INVADERS_BOARD_WIDTH,
    },
    label: "Board",
    options: SPACE_INVADERS_BOARD_SIZE_OPTIONS,
  }),
  "space-invaders-aliens": {
    defaultValue: String(SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS),
    label: "Aliens",
    options: SPACE_INVADERS_ALIEN_COUNT_OPTIONS.map((option) => ({
      label: option.label,
      value: String(option.alienCount),
    })),
    toInitialProps: (value) => ({
      initialAlienCount: Number(value),
    }),
  },
  "twenty-forty-eight-board-size": {
    defaultValue: String(TWENTY_FORTY_EIGHT_BOARD_SIZE),
    label: "Board",
    options: createSquareSizeSelectOptions(TWENTY_FORTY_EIGHT_BOARD_SIZE_OPTIONS),
    toInitialProps: (value) => ({
      initialBoardSize: Number(value),
    }),
  },
  "twenty-forty-eight-goal": {
    defaultValue: String(TWENTY_FORTY_EIGHT_WIN_TILE),
    label: "Goal",
    options: createNumberSelectOptions(TWENTY_FORTY_EIGHT_WIN_TILE_OPTIONS),
    toInitialProps: (value) => ({
      initialWinTile: Number(value),
    }),
  },
  "pong-board-size": createBoardSizeParameter({
    defaultSize: {
      height: PONG_BOARD_HEIGHT,
      width: PONG_BOARD_WIDTH,
    },
    label: "Board",
    options: PONG_BOARD_SIZE_OPTIONS,
  }),
  "pong-target": {
    defaultValue: String(PONG_TARGET_SCORE),
    label: "Target",
    options: createNumberSelectOptions(PONG_TARGET_SCORE_OPTIONS),
    toInitialProps: (value) => ({
      initialTargetScore: Number(value),
    }),
  },
  "simon-difficulty": {
    defaultValue: SIMON_DEFAULT_DIFFICULTY,
    label: "Difficulty",
    normalizeValue: normalizeSimonDifficulty,
    options: SIMON_DIFFICULTY_OPTIONS.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    toInitialProps: (value) => ({
      initialDifficulty: normalizeSimonDifficulty(value),
    }),
  },
  "asteroids-difficulty": {
    defaultValue: ASTEROIDS_DEFAULT_DIFFICULTY,
    label: "Difficulty",
    normalizeValue: normalizeAsteroidsDifficulty,
    options: ASTEROIDS_DIFFICULTY_OPTIONS.map((option) => ({
      label: option.label,
      value: option.value,
    })),
    toInitialProps: (value) => ({
      initialDifficulty: normalizeAsteroidsDifficulty(value),
    }),
  },
});

export type GameParameterKind = keyof typeof GAME_PARAMETER_CONFIG;
export type GameParameterValues = Record<GameParameterKind, string>;

export type GameCard = {
  accentClassName: string;
  artwork: GameCatalogArtwork & {
    loading?: "eager" | "lazy";
    priority?: boolean;
  };
  description: string;
  id: GameId;
  label: string;
  parameters: readonly GameParameterKind[];
};

const snakeCatalogEntry = getGameCatalogEntry("snake");
const tetrisCatalogEntry = getGameCatalogEntry("tetris");
const breakoutCatalogEntry = getGameCatalogEntry("breakout");
const minesweeperCatalogEntry = getGameCatalogEntry("minesweeper");
const spaceInvadersCatalogEntry = getGameCatalogEntry("space-invaders");
const twentyFortyEightCatalogEntry = getGameCatalogEntry("twenty-forty-eight");
const pongCatalogEntry = getGameCatalogEntry("pong");
const simonCatalogEntry = getGameCatalogEntry("simon");
const asteroidsCatalogEntry = getGameCatalogEntry("asteroids");

export const GAME_CARDS: readonly GameCard[] = [
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--snake-head),var(--snake-bonus-food),var(--snake-speed-food),var(--snake-slow-food),var(--snake-shrink-food))]",
    artwork: {
      ...getGameCatalogArtwork("snake"),
      priority: true,
    },
    description: "A score chase through growing rooms with keys, doors, obstacles, and timed food.",
    id: snakeCatalogEntry.id,
    label: snakeCatalogEntry.label,
    parameters: [],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--tetris-cyan),var(--tetris-yellow),var(--tetris-purple),var(--tetris-red))]",
    artwork: {
      ...getGameCatalogArtwork("tetris"),
      loading: "eager",
    },
    description: "A falling-block survival game with line clears, scoring, and rising speed.",
    id: tetrisCatalogEntry.id,
    label: tetrisCatalogEntry.label,
    parameters: ["tetris-board-size", "tetris-start-level"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--breakout-red),var(--breakout-yellow),var(--breakout-green),var(--breakout-blue))]",
    artwork: {
      ...getGameCatalogArtwork("breakout"),
      loading: "eager",
    },
    description: "A paddle-and-ball brick breaker with lives, scoring, and wall clears.",
    id: breakoutCatalogEntry.id,
    label: breakoutCatalogEntry.label,
    parameters: ["breakout-board-size", "breakout-lives"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--minesweeper-flag),var(--minesweeper-one),var(--minesweeper-two),var(--minesweeper-three))]",
    artwork: {
      ...getGameCatalogArtwork("minesweeper"),
      loading: "eager",
    },
    description: "A classic minefield puzzle with safe first clicks, flags, and flood reveals.",
    id: minesweeperCatalogEntry.id,
    label: minesweeperCatalogEntry.label,
    parameters: ["minesweeper-difficulty"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--invaders-lime),var(--invaders-cyan),var(--invaders-magenta),var(--invaders-yellow))]",
    artwork: {
      ...getGameCatalogArtwork("space-invaders"),
      loading: "eager",
    },
    description: "A cannon defense arcade game with marching invaders, shots, and scoring.",
    id: spaceInvadersCatalogEntry.id,
    label: spaceInvadersCatalogEntry.label,
    parameters: ["space-invaders-board-size", "space-invaders-aliens"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--twenty-tile-8),var(--twenty-tile-128),var(--twenty-tile-2048))]",
    artwork: {
      ...getGameCatalogArtwork("twenty-forty-eight"),
      loading: "eager",
    },
    description: "A sliding tile puzzle with merges, score chasing, and a 2048 goal tile.",
    id: twentyFortyEightCatalogEntry.id,
    label: twentyFortyEightCatalogEntry.label,
    parameters: ["twenty-forty-eight-board-size", "twenty-forty-eight-goal"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--pong-blue),var(--pong-ball),var(--pong-pink))]",
    artwork: {
      ...getGameCatalogArtwork("pong"),
      loading: "eager",
    },
    description: "A paddle duel against a computer opponent with rebounds, rallies, and scoring.",
    id: pongCatalogEntry.id,
    label: pongCatalogEntry.label,
    parameters: ["pong-board-size", "pong-target"],
  },
  {
    accentClassName: "bg-[linear-gradient(90deg,#25a75a,#d73548,#f0bd38,#1d7ed0)]",
    artwork: {
      ...getGameCatalogArtwork("simon"),
      loading: "eager",
    },
    description: "A memory pattern game with four pads, growing sequences, and strict misses.",
    id: simonCatalogEntry.id,
    label: simonCatalogEntry.label,
    parameters: ["simon-difficulty"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--asteroids-ship),var(--asteroids-bullet),var(--asteroids-asteroid))]",
    artwork: {
      ...getGameCatalogArtwork("asteroids"),
      loading: "eager",
    },
    description: "A vector space survival game with thrust, wraparound, rocks, and waves.",
    id: asteroidsCatalogEntry.id,
    label: asteroidsCatalogEntry.label,
    parameters: ["asteroids-difficulty"],
  },
];

export function createDefaultParameterValues() {
  const values = {} as GameParameterValues;

  for (const parameterKind of Object.keys(GAME_PARAMETER_CONFIG) as GameParameterKind[]) {
    values[parameterKind] = GAME_PARAMETER_CONFIG[parameterKind].defaultValue;
  }

  return values;
}

export function createInitialGameProps(game: GameCard, parameterValues: GameParameterValues) {
  return game.parameters.reduce<PlayableInitialProps>((initialProps, parameterKind) => {
    const parameter = GAME_PARAMETER_CONFIG[parameterKind];

    return {
      ...initialProps,
      ...parameter.toInitialProps(parameterValues[parameterKind]),
    };
  }, {});
}

export function getVersionedGameArtworkSrc(game: GameCard) {
  return getVersionedGameCatalogArtworkSrc(game.artwork);
}

function defineGameParameterConfig<const ParameterConfig extends Record<string, GameParameterConfig>>(
  parameterConfig: ParameterConfig,
): { readonly [ParameterKind in keyof ParameterConfig]: GameParameterConfig } {
  return parameterConfig;
}

function createBoardSizeParameter({
  defaultSize,
  label,
  options,
}: {
  defaultSize: Pick<BoardSizeOption, "height" | "width">;
  label: string;
  options: readonly BoardSizeOption[];
}): GameParameterConfig {
  const fallback = {
    height: defaultSize.height,
    label: `${defaultSize.width} x ${defaultSize.height}`,
    width: defaultSize.width,
  };

  return {
    defaultValue: getBoardSizeKey(defaultSize),
    label,
    options: createBoardSizeSelectOptions(options),
    toInitialProps: (value) => {
      const boardSize = getBoardSizeOption(options, value, fallback);

      return {
        initialBoardHeight: boardSize.height,
        initialBoardWidth: boardSize.width,
      };
    },
  };
}

function createSquareSizeSelectOptions(options: readonly number[]) {
  return options.map((option) => ({
    label: `${option} x ${option}`,
    value: String(option),
  }));
}

function createNumberSelectOptions(options: readonly number[]) {
  return options.map((option) => ({
    label: String(option),
    value: String(option),
  }));
}

function getBoardSizeKey(option: Pick<BoardSizeOption, "height" | "width">) {
  return `${option.width}x${option.height}`;
}

function getBoardSizeOption(
  options: readonly BoardSizeOption[],
  selectedKey: string,
  fallback: BoardSizeOption,
) {
  return options.find((option) => getBoardSizeKey(option) === selectedKey) ?? fallback;
}

function createBoardSizeSelectOptions(options: readonly BoardSizeOption[]) {
  return options.map((option) => ({
    label: option.label,
    value: getBoardSizeKey(option),
  }));
}
