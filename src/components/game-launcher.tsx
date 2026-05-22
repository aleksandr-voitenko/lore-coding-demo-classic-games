"use client";

import { Gamepad2Icon, PlayIcon, TrophyIcon } from "lucide-react";
import Image from "next/image";
import { type ComponentType, useCallback, useState } from "react";

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

type GameParameterKind =
  | "snake-board-size"
  | "tetris-board-size"
  | "tetris-start-level"
  | "breakout-board-size"
  | "breakout-lives"
  | "minesweeper-board-size"
  | "minesweeper-mines"
  | "space-invaders-board-size"
  | "space-invaders-aliens"
  | "twenty-forty-eight-board-size"
  | "twenty-forty-eight-goal"
  | "pong-board-size"
  | "pong-target"
  | "simon-target";

type GameCardParameter = {
  kind: GameParameterKind;
  label: string;
};

type GameCard = {
  accentClassName: string;
  artwork: {
    height: number;
    loading?: "eager" | "lazy";
    priority?: boolean;
    src: string;
    unoptimized?: boolean;
    width: number;
  };
  component: ComponentType<PlayableGameProps>;
  description: string;
  id: GameId;
  label: string;
  parameters: GameCardParameter[];
};

type BoardSizeOption = {
  height: number;
  label: string;
  width: number;
};

const GAME_CARDS: GameCard[] = [
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--snake-head),var(--snake-bonus-food),var(--snake-speed-food),var(--snake-slow-food),var(--snake-shrink-food))]",
    artwork: {
      height: 249,
      priority: true,
      src: "/images/snake-game-card.png",
      width: 250,
    },
    component: SnakeGame,
    description: "A classic score chase with obstacles, timed food, and saved best runs.",
    id: "snake",
    label: "Classic Snake",
    parameters: [{ kind: "snake-board-size", label: "Field size" }],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--tetris-cyan),var(--tetris-yellow),var(--tetris-purple),var(--tetris-red))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/tetris-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: TetrisGame,
    description: "A falling-block survival game with line clears, scoring, and rising speed.",
    id: "tetris",
    label: "Classic Tetris",
    parameters: [
      { kind: "tetris-board-size", label: "Board" },
      { kind: "tetris-start-level", label: "Level" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--breakout-red),var(--breakout-yellow),var(--breakout-green),var(--breakout-blue))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/breakout-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: BreakoutGame,
    description: "A paddle-and-ball brick breaker with lives, scoring, and wall clears.",
    id: "breakout",
    label: "Classic Breakout",
    parameters: [
      { kind: "breakout-board-size", label: "Board" },
      { kind: "breakout-lives", label: "Lives" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--minesweeper-flag),var(--minesweeper-one),var(--minesweeper-two),var(--minesweeper-three))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/minesweeper-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: MinesweeperGame,
    description: "A classic minefield puzzle with safe first clicks, flags, and flood reveals.",
    id: "minesweeper",
    label: "Classic Minesweeper",
    parameters: [
      { kind: "minesweeper-board-size", label: "Board" },
      { kind: "minesweeper-mines", label: "Mines" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--invaders-lime),var(--invaders-cyan),var(--invaders-magenta),var(--invaders-yellow))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/space-invaders-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: SpaceInvadersGame,
    description: "A cannon defense arcade game with marching invaders, shots, and scoring.",
    id: "space-invaders",
    label: "Classic Space Invaders",
    parameters: [
      { kind: "space-invaders-board-size", label: "Board" },
      { kind: "space-invaders-aliens", label: "Aliens" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--twenty-tile-8),var(--twenty-tile-128),var(--twenty-tile-2048))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/twenty-forty-eight-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: TwentyFortyEightGame,
    description: "A sliding tile puzzle with merges, score chasing, and a 2048 goal tile.",
    id: "twenty-forty-eight",
    label: "Classic 2048",
    parameters: [
      { kind: "twenty-forty-eight-board-size", label: "Board" },
      { kind: "twenty-forty-eight-goal", label: "Goal" },
    ],
  },
  {
    accentClassName:
      "bg-[linear-gradient(90deg,var(--pong-blue),var(--pong-ball),var(--pong-pink))]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/pong-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: PongGame,
    description: "A paddle duel against a CPU opponent with rebounds, rallies, and scoring.",
    id: "pong",
    label: "Classic Pong",
    parameters: [
      { kind: "pong-board-size", label: "Board" },
      { kind: "pong-target", label: "Target" },
    ],
  },
  {
    accentClassName: "bg-[linear-gradient(90deg,#25a75a,#d73548,#f0bd38,#1d7ed0)]",
    artwork: {
      height: 250,
      loading: "eager",
      src: "/images/simon-game-card.svg",
      unoptimized: true,
      width: 250,
    },
    component: SimonGame,
    description: "A memory pattern game with four pads, growing sequences, and strict misses.",
    id: "simon",
    label: "Classic Simon",
    parameters: [{ kind: "simon-target", label: "Target" }],
  },
];

export function GameLauncher() {
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(null);
  const [snakeBoardSize, setSnakeBoardSize] = useState(DEFAULT_BOARD_SIZE);
  const [tetrisBoardSizeKey, setTetrisBoardSizeKey] = useState(
    getBoardSizeKey({ height: TETRIS_BOARD_HEIGHT, width: TETRIS_BOARD_WIDTH }),
  );
  const [tetrisStartLevel, setTetrisStartLevel] = useState(TETRIS_START_LEVEL);
  const [breakoutBoardSizeKey, setBreakoutBoardSizeKey] = useState(
    getBoardSizeKey({ height: BREAKOUT_BOARD_HEIGHT, width: BREAKOUT_BOARD_WIDTH }),
  );
  const [breakoutLives, setBreakoutLives] = useState(BREAKOUT_STARTING_LIVES);
  const [minesweeperBoardSizeKey, setMinesweeperBoardSizeKey] = useState(
    getBoardSizeKey({ height: MINESWEEPER_BOARD_HEIGHT, width: MINESWEEPER_BOARD_WIDTH }),
  );
  const [minesweeperMineCount, setMinesweeperMineCount] = useState(MINESWEEPER_MINE_COUNT);
  const [spaceInvadersBoardSizeKey, setSpaceInvadersBoardSizeKey] = useState(
    getBoardSizeKey({
      height: SPACE_INVADERS_BOARD_HEIGHT,
      width: SPACE_INVADERS_BOARD_WIDTH,
    }),
  );
  const [spaceInvadersAlienCount, setSpaceInvadersAlienCount] = useState(
    SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
  );
  const [twentyFortyEightBoardSize, setTwentyFortyEightBoardSize] = useState(
    TWENTY_FORTY_EIGHT_BOARD_SIZE,
  );
  const [twentyFortyEightGoal, setTwentyFortyEightGoal] = useState(
    TWENTY_FORTY_EIGHT_WIN_TILE,
  );
  const [pongBoardSizeKey, setPongBoardSizeKey] = useState(
    getBoardSizeKey({ height: PONG_BOARD_HEIGHT, width: PONG_BOARD_WIDTH }),
  );
  const [pongTargetScore, setPongTargetScore] = useState(PONG_TARGET_SCORE);
  const [simonWinTarget, setSimonWinTarget] = useState(SIMON_DEFAULT_WIN_TARGET);

  const selectedGame = GAME_CARDS.find((game) => game.id === selectedGameId) ?? null;
  const tetrisBoardSize = getBoardSizeOption(TETRIS_BOARD_SIZE_OPTIONS, tetrisBoardSizeKey, {
    height: TETRIS_BOARD_HEIGHT,
    label: `${TETRIS_BOARD_WIDTH} x ${TETRIS_BOARD_HEIGHT}`,
    width: TETRIS_BOARD_WIDTH,
  });
  const breakoutBoardSize = getBoardSizeOption(BREAKOUT_BOARD_SIZE_OPTIONS, breakoutBoardSizeKey, {
    height: BREAKOUT_BOARD_HEIGHT,
    label: `${BREAKOUT_BOARD_WIDTH} x ${BREAKOUT_BOARD_HEIGHT}`,
    width: BREAKOUT_BOARD_WIDTH,
  });
  const minesweeperBoardSize = getBoardSizeOption(
    MINESWEEPER_BOARD_SIZE_OPTIONS,
    minesweeperBoardSizeKey,
    {
      height: MINESWEEPER_BOARD_HEIGHT,
      label: `${MINESWEEPER_BOARD_WIDTH} x ${MINESWEEPER_BOARD_HEIGHT}`,
      width: MINESWEEPER_BOARD_WIDTH,
    },
  );
  const spaceInvadersBoardSize = getBoardSizeOption(
    SPACE_INVADERS_BOARD_SIZE_OPTIONS,
    spaceInvadersBoardSizeKey,
    {
      height: SPACE_INVADERS_BOARD_HEIGHT,
      label: `${SPACE_INVADERS_BOARD_WIDTH} x ${SPACE_INVADERS_BOARD_HEIGHT}`,
      width: SPACE_INVADERS_BOARD_WIDTH,
    },
  );
  const pongBoardSize = getBoardSizeOption(PONG_BOARD_SIZE_OPTIONS, pongBoardSizeKey, {
    height: PONG_BOARD_HEIGHT,
    label: `${PONG_BOARD_WIDTH} x ${PONG_BOARD_HEIGHT}`,
    width: PONG_BOARD_WIDTH,
  });

  const returnToMenu = useCallback(() => {
    setSelectedGameId(null);
  }, []);

  if (selectedGame !== null) {
    const SelectedGame = selectedGame.component;
    let initialGameProps: Omit<PlayableGameProps, "onBackToMenu"> = {};

    if (selectedGame.id === "snake") {
      initialGameProps = {
        initialBoardSize: snakeBoardSize,
      };
    } else if (selectedGame.id === "tetris") {
      initialGameProps = {
        initialBoardHeight: tetrisBoardSize.height,
        initialBoardWidth: tetrisBoardSize.width,
        initialStartLevel: tetrisStartLevel,
      };
    } else if (selectedGame.id === "breakout") {
      initialGameProps = {
        initialBoardHeight: breakoutBoardSize.height,
        initialBoardWidth: breakoutBoardSize.width,
        initialLives: breakoutLives,
      };
    } else if (selectedGame.id === "minesweeper") {
      initialGameProps = {
        initialBoardHeight: minesweeperBoardSize.height,
        initialBoardWidth: minesweeperBoardSize.width,
        initialMineCount: minesweeperMineCount,
      };
    } else if (selectedGame.id === "space-invaders") {
      initialGameProps = {
        initialAlienCount: spaceInvadersAlienCount,
        initialBoardHeight: spaceInvadersBoardSize.height,
        initialBoardWidth: spaceInvadersBoardSize.width,
      };
    } else if (selectedGame.id === "twenty-forty-eight") {
      initialGameProps = {
        initialBoardSize: twentyFortyEightBoardSize,
        initialWinTile: twentyFortyEightGoal,
      };
    } else if (selectedGame.id === "pong") {
      initialGameProps = {
        initialBoardHeight: pongBoardSize.height,
        initialBoardWidth: pongBoardSize.width,
        initialTargetScore: pongTargetScore,
      };
    } else if (selectedGame.id === "simon") {
      initialGameProps = {
        initialWinTarget: simonWinTarget,
      };
    }

    return (
      <SelectedGame
        {...initialGameProps}
        onBackToMenu={returnToMenu}
      />
    );
  }

  function renderGameParameter(game: GameCard, parameter: GameCardParameter) {
    const id = `${game.id}-${parameter.kind}`;

    switch (parameter.kind) {
      case "snake-board-size":
        return (
          <GameParameterSelect
            ariaLabel={`Field size. Selectable from ${MIN_BOARD_SIZE} by ${MIN_BOARD_SIZE} to ${MAX_BOARD_SIZE} by ${MAX_BOARD_SIZE}.`}
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setSnakeBoardSize(normalizeBoardSize(Number(value)))}
            options={BOARD_SIZE_OPTIONS.map((boardSize) => ({
              label: `${boardSize} x ${boardSize}`,
              value: String(boardSize),
            }))}
            testId={parameter.kind}
            value={String(snakeBoardSize)}
          />
        );
      case "tetris-board-size":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={setTetrisBoardSizeKey}
            options={createBoardSizeSelectOptions(TETRIS_BOARD_SIZE_OPTIONS)}
            testId={parameter.kind}
            value={tetrisBoardSizeKey}
          />
        );
      case "tetris-start-level":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setTetrisStartLevel(Number(value))}
            options={TETRIS_START_LEVEL_OPTIONS.map((level) => ({
              label: String(level),
              value: String(level),
            }))}
            testId={parameter.kind}
            value={String(tetrisStartLevel)}
          />
        );
      case "breakout-board-size":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={setBreakoutBoardSizeKey}
            options={createBoardSizeSelectOptions(BREAKOUT_BOARD_SIZE_OPTIONS)}
            testId={parameter.kind}
            value={breakoutBoardSizeKey}
          />
        );
      case "breakout-lives":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setBreakoutLives(Number(value))}
            options={BREAKOUT_LIVES_OPTIONS.map((lives) => ({
              label: String(lives),
              value: String(lives),
            }))}
            testId={parameter.kind}
            value={String(breakoutLives)}
          />
        );
      case "minesweeper-board-size":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={setMinesweeperBoardSizeKey}
            options={createBoardSizeSelectOptions(MINESWEEPER_BOARD_SIZE_OPTIONS)}
            testId={parameter.kind}
            value={minesweeperBoardSizeKey}
          />
        );
      case "minesweeper-mines":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setMinesweeperMineCount(Number(value))}
            options={MINESWEEPER_MINE_COUNT_OPTIONS.map((mineCount) => ({
              label: String(mineCount),
              value: String(mineCount),
            }))}
            testId={parameter.kind}
            value={String(minesweeperMineCount)}
          />
        );
      case "space-invaders-board-size":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={setSpaceInvadersBoardSizeKey}
            options={createBoardSizeSelectOptions(SPACE_INVADERS_BOARD_SIZE_OPTIONS)}
            testId={parameter.kind}
            value={spaceInvadersBoardSizeKey}
          />
        );
      case "space-invaders-aliens":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setSpaceInvadersAlienCount(Number(value))}
            options={SPACE_INVADERS_ALIEN_COUNT_OPTIONS.map((option) => ({
              label: option.label,
              value: String(option.alienCount),
            }))}
            testId={parameter.kind}
            value={String(spaceInvadersAlienCount)}
          />
        );
      case "twenty-forty-eight-board-size":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setTwentyFortyEightBoardSize(Number(value))}
            options={TWENTY_FORTY_EIGHT_BOARD_SIZE_OPTIONS.map((boardSize) => ({
              label: `${boardSize} x ${boardSize}`,
              value: String(boardSize),
            }))}
            testId={parameter.kind}
            value={String(twentyFortyEightBoardSize)}
          />
        );
      case "twenty-forty-eight-goal":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setTwentyFortyEightGoal(Number(value))}
            options={TWENTY_FORTY_EIGHT_WIN_TILE_OPTIONS.map((goal) => ({
              label: String(goal),
              value: String(goal),
            }))}
            testId={parameter.kind}
            value={String(twentyFortyEightGoal)}
          />
        );
      case "pong-board-size":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={setPongBoardSizeKey}
            options={createBoardSizeSelectOptions(PONG_BOARD_SIZE_OPTIONS)}
            testId={parameter.kind}
            value={pongBoardSizeKey}
          />
        );
      case "pong-target":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setPongTargetScore(Number(value))}
            options={PONG_TARGET_SCORE_OPTIONS.map((target) => ({
              label: String(target),
              value: String(target),
            }))}
            testId={parameter.kind}
            value={String(pongTargetScore)}
          />
        );
      case "simon-target":
        return (
          <GameParameterSelect
            id={id}
            key={parameter.kind}
            label={parameter.label}
            onChange={(value) => setSimonWinTarget(Number(value))}
            options={SIMON_WIN_TARGET_OPTIONS.map((target) => ({
              label: String(target),
              value: String(target),
            }))}
            testId={parameter.kind}
            value={String(simonWinTarget)}
          />
        );
    }
  }

  return (
    <main
      className="min-h-svh bg-[var(--snake-page)] px-4 py-6 text-[var(--snake-ink)] sm:px-6 lg:py-8"
      data-testid="game-menu"
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
            <article
              className="group flex min-h-72 w-full flex-col overflow-hidden rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color-mix(in_oklch,var(--snake-head)_45%,var(--snake-border))] hover:shadow-[0_22px_70px_color-mix(in_oklch,var(--snake-board)_14%,transparent)] focus-within:border-[var(--snake-head)] focus-within:ring-3 focus-within:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
              key={game.id}
            >
              <button
                aria-label={`Play ${game.label}`}
                className="flex flex-1 flex-col text-left focus-visible:outline-none"
                data-testid={`game-card-${game.id}`}
                onClick={() => setSelectedGameId(game.id)}
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
                    src={game.artwork.src}
                    unoptimized={game.artwork.unoptimized}
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
                      src={game.artwork.src}
                      unoptimized={game.artwork.unoptimized}
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

type GameParameterSelectProps = {
  ariaLabel?: string;
  id: string;
  label: string;
  onChange: (value: string) => void;
  options: Array<{
    label: string;
    value: string;
  }>;
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
