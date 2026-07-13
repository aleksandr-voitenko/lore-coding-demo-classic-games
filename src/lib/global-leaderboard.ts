import {
  ASTEROIDS_DEFAULT_DIFFICULTY,
  ASTEROIDS_DIFFICULTY_OPTIONS,
} from "@/lib/asteroids/parameters";
import {
  BREAKOUT_BOARD_HEIGHT,
  BREAKOUT_BOARD_WIDTH,
  BREAKOUT_STARTING_LIVES,
} from "@/lib/breakout-parameters";
import { getGameCatalogEntry, type GameId } from "@/lib/game-catalog";
import {
  createGameLeaderboardKey,
  fetchLeaderboard,
  LEADERBOARD_LIMIT,
  type LeaderboardEntry,
  type LeaderboardSortDirection,
} from "@/lib/leaderboard";
import {
  MINESWEEPER_DEFAULT_DIFFICULTY,
  MINESWEEPER_DIFFICULTY_OPTIONS,
} from "@/lib/minesweeper-parameters";
import {
  PONG_BOARD_HEIGHT,
  PONG_BOARD_WIDTH,
  PONG_TARGET_SCORE,
} from "@/lib/pong-parameters";
import {
  SIMON_DEFAULT_DIFFICULTY,
  SIMON_DIFFICULTY_OPTIONS,
} from "@/lib/simon-parameters";
import {
  SPACE_INVADERS_BOARD_HEIGHT,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_ROWS,
} from "@/lib/space-invaders/parameters";
import {
  TETRIS_BOARD_HEIGHT,
  TETRIS_BOARD_WIDTH,
  TETRIS_START_LEVEL,
} from "@/lib/tetris-parameters";
import {
  TWENTY_FORTY_EIGHT_BOARD_SIZE,
  TWENTY_FORTY_EIGHT_WIN_TILE,
} from "@/lib/twenty-forty-eight-parameters";

export type GlobalLeaderboardMetric = "score" | "time";

export type GlobalLeaderboardTarget = {
  gameId: GameId;
  leaderboardKey: string;
  metric: GlobalLeaderboardMetric;
  sortDirection: LeaderboardSortDirection;
  variantLabel: string;
};

export type GlobalLeaderboardSnapshot = {
  entries: LeaderboardEntry[];
  loadFailed: boolean;
  target: GlobalLeaderboardTarget;
};

function formatBoardSize(width: number, height: number) {
  return `${width} x ${height}`;
}

function getDifficultyLabel<const Difficulty extends string>(
  options: readonly { label: string; value: Difficulty }[],
  difficulty: Difficulty,
) {
  return options.find((option) => option.value === difficulty)?.label ?? difficulty;
}

export const GLOBAL_LEADERBOARD_TARGETS = [
  {
    gameId: "snake",
    leaderboardKey: createGameLeaderboardKey("snake", [
      { name: "mode", value: "levels" },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: "Levels mode",
  },
  {
    gameId: "tetris",
    leaderboardKey: createGameLeaderboardKey("tetris", [
      { name: "board", value: `${TETRIS_BOARD_WIDTH}x${TETRIS_BOARD_HEIGHT}` },
      { name: "level", value: TETRIS_START_LEVEL },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: `${formatBoardSize(TETRIS_BOARD_WIDTH, TETRIS_BOARD_HEIGHT)}, level ${TETRIS_START_LEVEL}`,
  },
  {
    gameId: "breakout",
    leaderboardKey: createGameLeaderboardKey("breakout", [
      { name: "board", value: `${BREAKOUT_BOARD_WIDTH}x${BREAKOUT_BOARD_HEIGHT}` },
      { name: "lives", value: BREAKOUT_STARTING_LIVES },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: `${formatBoardSize(BREAKOUT_BOARD_WIDTH, BREAKOUT_BOARD_HEIGHT)}, ${BREAKOUT_STARTING_LIVES} lives`,
  },
  {
    gameId: "minesweeper",
    leaderboardKey: createGameLeaderboardKey("minesweeper", [
      { name: "difficulty", value: MINESWEEPER_DEFAULT_DIFFICULTY },
    ]),
    metric: "time",
    sortDirection: "asc",
    variantLabel: `${getDifficultyLabel(MINESWEEPER_DIFFICULTY_OPTIONS, MINESWEEPER_DEFAULT_DIFFICULTY)} difficulty`,
  },
  {
    gameId: "space-invaders",
    leaderboardKey: createGameLeaderboardKey("space-invaders", [
      { name: "board", value: `${SPACE_INVADERS_BOARD_WIDTH}x${SPACE_INVADERS_BOARD_HEIGHT}` },
      { name: "aliens", value: SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: `${formatBoardSize(SPACE_INVADERS_BOARD_WIDTH, SPACE_INVADERS_BOARD_HEIGHT)}, ${SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS} aliens`,
  },
  {
    gameId: "twenty-forty-eight",
    leaderboardKey: createGameLeaderboardKey("twenty-forty-eight", [
      { name: "board", value: TWENTY_FORTY_EIGHT_BOARD_SIZE },
      { name: "goal", value: TWENTY_FORTY_EIGHT_WIN_TILE },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: `${TWENTY_FORTY_EIGHT_BOARD_SIZE} x ${TWENTY_FORTY_EIGHT_BOARD_SIZE}, ${TWENTY_FORTY_EIGHT_WIN_TILE} goal`,
  },
  {
    gameId: "pong",
    leaderboardKey: createGameLeaderboardKey("pong", [
      { name: "board", value: `${PONG_BOARD_WIDTH}x${PONG_BOARD_HEIGHT}` },
      { name: "target", value: PONG_TARGET_SCORE },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: `${formatBoardSize(PONG_BOARD_WIDTH, PONG_BOARD_HEIGHT)}, target ${PONG_TARGET_SCORE}`,
  },
  {
    gameId: "simon",
    leaderboardKey: createGameLeaderboardKey("simon", [
      { name: "difficulty", value: SIMON_DEFAULT_DIFFICULTY },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: `${getDifficultyLabel(SIMON_DIFFICULTY_OPTIONS, SIMON_DEFAULT_DIFFICULTY)} difficulty`,
  },
  {
    gameId: "asteroids",
    leaderboardKey: createGameLeaderboardKey("asteroids", [
      { name: "difficulty", value: ASTEROIDS_DEFAULT_DIFFICULTY },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: `${getDifficultyLabel(ASTEROIDS_DIFFICULTY_OPTIONS, ASTEROIDS_DEFAULT_DIFFICULTY)} difficulty`,
  },
  {
    gameId: "battle-city",
    leaderboardKey: createGameLeaderboardKey("battle-city", [
      { name: "mode", value: "campaign" },
    ]),
    metric: "score",
    sortDirection: "desc",
    variantLabel: "classic campaign",
  },
] as const satisfies readonly GlobalLeaderboardTarget[];

function formatElapsedTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function getGlobalLeaderboardGameLabel(target: Pick<GlobalLeaderboardTarget, "gameId">) {
  return getGameCatalogEntry(target.gameId).label;
}

export function formatGlobalLeaderboardScore(
  target: Pick<GlobalLeaderboardTarget, "metric">,
  score: number,
) {
  return target.metric === "time"
    ? formatElapsedTime(score)
    : score.toLocaleString("en-US");
}

export function createGlobalLeaderboardSlots(entries: readonly LeaderboardEntry[]) {
  return Array.from({ length: LEADERBOARD_LIMIT }, (_, index) => entries[index] ?? null);
}

export async function fetchGlobalLeaderboards(
  targets: readonly GlobalLeaderboardTarget[] = GLOBAL_LEADERBOARD_TARGETS,
): Promise<GlobalLeaderboardSnapshot[]> {
  return Promise.all(
    targets.map(async (target) => {
      try {
        return {
          entries: await fetchLeaderboard({
            leaderboardKey: target.leaderboardKey,
            sortDirection: target.sortDirection,
          }),
          loadFailed: false,
          target,
        };
      } catch {
        return {
          entries: [],
          loadFailed: true,
          target,
        };
      }
    }),
  );
}
