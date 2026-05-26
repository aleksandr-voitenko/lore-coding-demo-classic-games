"use client";

import { Gamepad2Icon, PlayIcon, TrophyIcon } from "lucide-react";
import Image from "next/image";
import { type ComponentType, type ReactNode, useCallback, useRef, useState } from "react";

import { BreakoutGame } from "@/components/breakout-game";
import { MinesweeperGame } from "@/components/minesweeper-game";
import { PongGame } from "@/components/pong-game";
import { SimonGame } from "@/components/simon-game";
import { SnakeGame } from "@/components/snake-game";
import { SpaceInvadersGame } from "@/components/space-invaders-game";
import { TetrisGame } from "@/components/tetris-game";
import { TwentyFortyEightGame } from "@/components/twenty-forty-eight-game";
import {
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_SIZE_OPTIONS,
  BREAKOUT_BOARD_WIDTH,
  BREAKOUT_LIVES_OPTIONS,
  BREAKOUT_STARTING_LIVES,
} from "@/lib/breakout-game-engine";
import {
  MINESWEEPER_BOARD_HEIGHT,
  MINESWEEPER_BOARD_SIZE_OPTIONS,
  MINESWEEPER_BOARD_WIDTH,
  MINESWEEPER_MINE_COUNT,
  MINESWEEPER_MINE_COUNT_OPTIONS,
} from "@/lib/minesweeper-game-engine";
import {
  PONG_BOARD_HEIGHT,
  PONG_BOARD_SIZE_OPTIONS,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
  PONG_TARGET_SCORE_OPTIONS,
} from "@/lib/pong-game-engine";
import {
  SIMON_DEFAULT_WIN_TARGET,
  SIMON_WIN_TARGET_OPTIONS,
} from "@/lib/simon-game-engine";
import {
  BOARD_SIZE_OPTIONS,
  DEFAULT_BOARD_SIZE,
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  normalizeBoardSize,
} from "@/lib/snake-game-engine";
import {
  SPACE_INVADERS_ALIEN_COUNT_OPTIONS,
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_SIZE_OPTIONS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_ROWS,
} from "@/lib/space-invaders-game-engine";
import {
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_SIZE_OPTIONS,
  TETRIS_BOARD_WIDTH,
  TETRIS_START_LEVEL,
  TETRIS_START_LEVEL_OPTIONS,
} from "@/lib/tetris-game-engine";
import {
  TWENTY_FORTY_EIGHT_BOARD_SIZE,
  TWENTY_FORTY_EIGHT_BOARD_SIZE_OPTIONS,
  TWENTY_FORTY_EIGHT_WIN_TILE,
  TWENTY_FORTY_EIGHT_WIN_TILE_OPTIONS,
} from "@/lib/twenty-forty-eight-game-engine";

type GameId =
  | "snake"
  | "tetris"
  | "breakout"
  | "minesweeper"
  | "space-invaders"
  | "twenty-forty-eight"
  | "pong"
  | "simon";

type PlayableGameProps = {
  initialAlienCount?: number;
  initialBoardHeight?: number;
  initialBoardSize?: number;
  initialBoardWidth?: number;
  initialLives?: number;
  initialMineCount?: number;
  initialStartLevel?: number;
  initialTargetScore?: number;
  initialWinTarget?: number;
  initialWinTile?: number;
  onBackToMenu: () => void;
};

type PlayableInitialProps = Omit<PlayableGameProps, "onBackToMenu">;

type BoardSizeOption = {
  height: number;
  label: string;
  width: number;
};

type GameParameterSelectOption = {
  label: string;
  value: string;
};

type GameParameterConfig = {
  ariaLabel?: string;
  defaultValue: string;
  label: string;
  normalizeValue?: (value: string) => string;
  options: readonly GameParameterSelectOption[];
  toInitialProps: (value: string) => PlayableInitialProps;
};

const GAME_PARAMETER_CONFIG = defineGameParameterConfig({
  "snake-board-size": {
    ariaLabel: `Field size. Selectable from ${MIN_BOARD_SIZE} by ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE} by ${MAX_BOARD_SIZE}.`,
    defaultValue: String(DEFAULT_BOARD_SIZE),
    label: "Field size",
    normalizeValue: (value) => String(normalizeBoardSize(Number(value))),
    options: BOARD_SIZE_OPTIONS.map((boardSize) => ({
      label: `${boardSize} x ${boardSize}`,
      value: String(boardSize),
    })),
    toInitialProps: (value) => ({
      initialBoardSize: normalizeBoardSize(Number(value)),
    }),
  },
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
  "minesweeper-board-size": createBoardSizeParameter({
    defaultSize: {
      height: MINESWEEPER_BOARD_HEIGHT,
      width: MINESWEEPER_BOARD_WIDTH,
    },
    label: "Board",
    options: MINESWEEPER_BOARD_SIZE_OPTIONS,
  }),
  "minesweeper-mines": {
    defaultValue: String(MINESWEEPER_MINE_COUNT),
    label: "Mines",
    options: createNumberSelectOptions(MINESWEEPER_MINE_COUNT_OPTIONS),
    toInitialProps: (value) => ({
      initialMineCount: Number(value),
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
  "simon-target": {
    defaultValue: String(SIMON_DEFAULT_WIN_TARGET),
    label: "Target",
    options: createNumberSelectOptions(SIMON_WIN_TARGET_OPTIONS),
    toInitialProps: (value) => ({
      initialWinTarget: Number(value),
    }),
  },
});

type GameParameterKind = keyof typeof GAME_PARAMETER_CONFIG;
type GameParameterValues = Record<GameParameterKind, string>;

type MenuViewport = {
  scrollX: number;
  scrollY: number;
};

type GameCard = {
  accentClassName: string;
  artwork: {
    height: number;
    loading?: "eager" | "lazy";
    priority?: boolean;
    src: string;
    width: number;
  };
  component: ComponentType<PlayableGameProps>;
  description: string;
  id: GameId;
  label: string;
  parameters: readonly GameParameterKind[];
};

const GAME_CARD_ARTWORK_VERSION = "ai-key-art-v2";

const GAME_CARDS: GameCard[] = [
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--snake-head),var(--snake-bonus-food),var(--snake-speed-food),var(--snake-slow-food),var(--snake-shrink-food))]",
    artwork: {
      height: 941,
      priority: true,
      src: "/images/snake-game-card.png",
      width: 1672,
    },
    component: SnakeGame,
    description: "A classic score chase with obstacles, timed food, and saved best runs.",
    id: "snake",
    label: "Classic Snake",
    parameters: ["snake-board-size"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--tetris-cyan),var(--tetris-yellow),var(--tetris-purple),var(--tetris-red))]",
    artwork: {
      height: 941,
      loading: "eager",
      src: "/images/tetris-game-card.png",
      width: 1672,
    },
    component: TetrisGame,
    description: "A falling-block survival game with line clears, scoring, and rising speed.",
    id: "tetris",
    label: "Classic Tetris",
    parameters: ["tetris-board-size", "tetris-start-level"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--breakout-red),var(--breakout-yellow),var(--breakout-green),var(--breakout-blue))]",
    artwork: {
      height: 941,
      loading: "eager",
      src: "/images/breakout-game-card.png",
      width: 1672,
    },
    component: BreakoutGame,
    description: "A paddle-and-ball brick breaker with lives, scoring, and wall clears.",
    id: "breakout",
    label: "Classic Breakout",
    parameters: ["breakout-board-size", "breakout-lives"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--minesweeper-flag),var(--minesweeper-one),var(--minesweeper-two),var(--minesweeper-three))]",
    artwork: {
      height: 941,
      loading: "eager",
      src: "/images/minesweeper-game-card.png",
      width: 1672,
    },
    component: MinesweeperGame,
    description: "A classic minefield puzzle with safe first clicks, flags, and flood reveals.",
    id: "minesweeper",
    label: "Classic Minesweeper",
    parameters: ["minesweeper-board-size", "minesweeper-mines"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--invaders-lime),var(--invaders-cyan),var(--invaders-magenta),var(--invaders-yellow))]",
    artwork: {
      height: 941,
      loading: "eager",
      src: "/images/space-invaders-game-card.png",
      width: 1672,
    },
    component: SpaceInvadersGame,
    description: "A cannon defense arcade game with marching invaders, shots, and scoring.",
    id: "space-invaders",
    label: "Classic Space Invaders",
    parameters: ["space-invaders-board-size", "space-invaders-aliens"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--twenty-tile-8),var(--twenty-tile-128),var(--twenty-tile-2048))]",
    artwork: {
      height: 941,
      loading: "eager",
      src: "/images/twenty-forty-eight-game-card.png",
      width: 1672,
    },
    component: TwentyFortyEightGame,
    description: "A sliding tile puzzle with merges, score chasing, and a 2048 goal tile.",
    id: "twenty-forty-eight",
    label: "Classic 2048",
    parameters: ["twenty-forty-eight-board-size", "twenty-forty-eight-goal"],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--pong-blue),var(--pong-ball),var(--pong-pink))]",
    artwork: {
      height: 941,
      loading: "eager",
      src: "/images/pong-game-card.png",
      width: 1672,
    },
    component: PongGame,
    description: "A paddle duel against a computer opponent with rebounds, rallies, and scoring.",
    id: "pong",
    label: "Classic Pong",
    parameters: ["pong-board-size", "pong-target"],
  },
  {
    accentClassName: "bg-[linear-gradient(90deg,#25a75a,#d73548,#f0bd38,#1d7ed0)]",
    artwork: {
      height: 941,
      loading: "eager",
      src: "/images/simon-game-card.png",
      width: 1672,
    },
    component: SimonGame,
    description: "A memory pattern game with four pads, growing sequences, and strict misses.",
    id: "simon",
    label: "Classic Simon",
    parameters: ["simon-target"],
  },
];

export function GameLauncher() {
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(null);
  const [parameterValues, setParameterValues] = useState<GameParameterValues>(() =>
    createDefaultParameterValues(),
  );
  const menuViewportRef = useRef<MenuViewport>({ scrollX: 0, scrollY: 0 });
  const shouldRestoreMenuViewportRef = useRef(false);

  const selectedGame = GAME_CARDS.find((game) => game.id === selectedGameId) ?? null;

  const selectGame = useCallback((gameId: GameId) => {
    menuViewportRef.current = {
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    };
    shouldRestoreMenuViewportRef.current = false;

    setSelectedGameId(gameId);
  }, []);

  const returnToMenu = useCallback(() => {
    shouldRestoreMenuViewportRef.current = true;
    setSelectedGameId(null);
  }, []);

  const restoreMenuViewport = useCallback((element: HTMLElement | null) => {
    if (element === null || !shouldRestoreMenuViewportRef.current) {
      return;
    }

    shouldRestoreMenuViewportRef.current = false;

    window.scrollTo(menuViewportRef.current.scrollX, menuViewportRef.current.scrollY);
  }, []);

  const updateParameterValue = useCallback((parameterKind: GameParameterKind, value: string) => {
    const parameter = GAME_PARAMETER_CONFIG[parameterKind];
    const normalizedValue = parameter.normalizeValue?.(value) ?? value;

    setParameterValues((currentValues) => ({
      ...currentValues,
      [parameterKind]: normalizedValue,
    }));
  }, []);

  if (selectedGame !== null) {
    const SelectedGame = selectedGame.component;
    const initialGameProps = createInitialGameProps(selectedGame, parameterValues);

    return (
      <SelectedGame
        {...initialGameProps}
        onBackToMenu={returnToMenu}
      />
    );
  }

  function getVersionedArtworkSrc(game: GameCard) {
    return `${game.artwork.src}?v=${GAME_CARD_ARTWORK_VERSION}`;
  }

  function renderGameParameter(game: GameCard, parameterKind: GameParameterKind) {
    const parameter = GAME_PARAMETER_CONFIG[parameterKind];
    const id = `${game.id}-${parameterKind}`;

    return (
      <GameParameterSelect
        ariaLabel={parameter.ariaLabel}
        id={id}
        key={parameterKind}
        label={parameter.label}
        onChange={(value) => updateParameterValue(parameterKind, value)}
        options={parameter.options}
        testId={parameterKind}
        value={parameterValues[parameterKind]}
      />
    );
  }

  return (
    <main
      className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8"
      data-testid="game-menu"
      ref={restoreMenuViewport}
    >
      <section className="mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-6xl flex-col justify-center gap-6">
        <header className="flex max-w-2xl items-center gap-4">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-[var(--snake-muted)] shadow-sm"
            aria-hidden="true"
          >
            <Gamepad2Icon className="size-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-black sm:text-4xl">
            Game Library
          </h1>
        </header>

        <div className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
          {GAME_CARDS.map((game) => (
            <GameCardArticle
              game={game}
              key={game.id}
              onSelectGame={() => selectGame(game.id)}
              renderGameParameter={renderGameParameter}
              versionedArtworkSrc={getVersionedArtworkSrc(game)}
            />
          ))}
        </div>

        <div className="flex items-center gap-2 text-sm font-medium text-[var(--snake-muted)]">
          <TrophyIcon className="size-4" aria-hidden="true" />
          <span>
            {GAME_CARDS.length === 1
              ? "1 game available"
              : `${GAME_CARDS.length} games available`}
          </span>
        </div>
      </section>
    </main>
  );
}

type GameCardArticleProps = {
  game: GameCard;
  onSelectGame: () => void;
  renderGameParameter: (game: GameCard, parameterKind: GameParameterKind) => ReactNode;
  versionedArtworkSrc: string;
};

function GameCardArticle({
  game,
  onSelectGame,
  renderGameParameter,
  versionedArtworkSrc,
}: GameCardArticleProps) {
  return (
    <article className="group flex min-h-72 w-full flex-col overflow-hidden rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--snake-head)_45%,var(--snake-border))] hover:shadow-[0_22px_70px_color-mix(in_oklch,var(--snake-board)_14%,transparent)] focus-within:border-[var(--snake-head)] focus-within:ring-3 focus-within:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]">
      <button
        aria-label={`Play ${game.label}`}
        className="flex flex-1 flex-col text-left focus-visible:outline-none"
        data-testid={`game-card-${game.id}`}
        onClick={onSelectGame}
        type="button"
      >
        <span className="relative block h-40 w-full overflow-hidden bg-[var(--snake-board)]">
          <span
            className={`absolute inset-x-0 top-0 h-1 ${game.accentClassName}`}
            aria-hidden="true"
          />
          <Image
            alt=""
            aria-hidden="true"
            className="scale-110 object-cover opacity-55 blur-[2px]"
            fill
            loading={game.artwork.loading}
            priority={game.artwork.priority}
            sizes="(min-width: 640px) 24rem, calc(100vw - 2rem)"
            src={versionedArtworkSrc}
            unoptimized
          />
          <span className="absolute inset-0 bg-[color-mix(in_oklch,var(--snake-board)_38%,transparent)]" />
          <span className="absolute inset-3 flex items-center justify-center">
            <Image
              alt=""
              aria-hidden="true"
              className="h-full w-auto rounded-md border border-[color-mix(in_oklch,var(--snake-board)_16%,white)] object-contain shadow-[0_18px_50px_color-mix(in_oklch,var(--snake-board)_34%,transparent)]"
              height={game.artwork.height}
              loading={game.artwork.loading}
              priority={game.artwork.priority}
              src={versionedArtworkSrc}
              unoptimized
              width={game.artwork.width}
            />
          </span>
        </span>

        <span className="flex flex-1 flex-col p-4 pb-0">
          <span className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-2xl font-semibold tracking-normal">
                {game.label}
              </span>
              <span className="text-sm font-medium text-[var(--snake-muted)]">
                {game.description}
              </span>
            </span>
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--snake-head)_16%,white)] text-[var(--snake-ink)] transition group-hover:bg-[var(--snake-head)]"
              aria-hidden="true"
            >
              <PlayIcon className="size-4" />
            </span>
          </span>
        </span>
      </button>

      <div className="mt-auto grid grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))] gap-2 p-4">
        {game.parameters.map((parameter) => renderGameParameter(game, parameter))}
      </div>
    </article>
  );
}

type GameParameterSelectProps = {
  ariaLabel?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: readonly {
    label: string;
    value: string;
  }[];
  testId: string;
  value: string;
};

function GameParameterSelect({
  ariaLabel,
  id,
  label,
  onChange,
  options,
  testId,
  value,
}: GameParameterSelectProps) {
  return (
    <div className="rounded-md border border-[var(--snake-border)] p-2">
      <label
        className="block text-[0.68rem] font-semibold uppercase tracking-normal text-[var(--snake-muted)]"
        htmlFor={id}
      >
        {label}
      </label>
      <select
        aria-label={ariaLabel ?? label}
        className="mt-1 h-8 w-full min-w-0 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-2 text-sm font-semibold text-[var(--snake-ink)] outline-none transition focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
        data-testid={testId}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function defineGameParameterConfig<const ParameterConfig extends Record<string, GameParameterConfig>>(
  parameterConfig: ParameterConfig,
): { readonly [ParameterKind in keyof ParameterConfig]: GameParameterConfig } {
  return parameterConfig;
}

function createDefaultParameterValues() {
  const values = {} as GameParameterValues;

  for (const parameterKind of Object.keys(GAME_PARAMETER_CONFIG) as GameParameterKind[]) {
    values[parameterKind] = GAME_PARAMETER_CONFIG[parameterKind].defaultValue;
  }

  return values;
}

function createInitialGameProps(game: GameCard, parameterValues: GameParameterValues) {
  return game.parameters.reduce<PlayableInitialProps>((initialProps, parameterKind) => {
    const parameter = GAME_PARAMETER_CONFIG[parameterKind];

    return {
      ...initialProps,
      ...parameter.toInitialProps(parameterValues[parameterKind]),
    };
  }, {});
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
