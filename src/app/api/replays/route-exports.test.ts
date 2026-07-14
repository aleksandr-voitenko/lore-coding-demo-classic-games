import { describe, expect, it } from "vitest";

import * as asteroidsReplayRoute from "./asteroids/route";
import * as asteroidsReplayRunRoute from "./asteroids/run/route";
import * as battleCityReplayRoute from "./battle-city/route";
import * as battleCityReplayRunRoute from "./battle-city/run/route";
import * as breakoutReplayRoute from "./breakout/route";
import * as breakoutReplayRunRoute from "./breakout/run/route";
import * as minesweeperReplayRoute from "./minesweeper/route";
import * as minesweeperReplayRunRoute from "./minesweeper/run/route";
import * as pongReplayRoute from "./pong/route";
import * as pongReplayRunRoute from "./pong/run/route";
import * as simonReplayRoute from "./simon/route";
import * as simonReplayRunRoute from "./simon/run/route";
import * as snakeReplayRoute from "./snake/route";
import * as snakeReplayRunRoute from "./snake/run/route";
import * as spaceInvadersReplayRoute from "./space-invaders/route";
import * as spaceInvadersReplayRunRoute from "./space-invaders/run/route";
import * as tetrisReplayRoute from "./tetris/route";
import * as tetrisReplayRunRoute from "./tetris/run/route";
import * as twentyFortyEightReplayRoute from "./twenty-forty-eight/route";
import * as twentyFortyEightReplayRunRoute from "./twenty-forty-eight/run/route";

const replayRouteEntries: Array<
  [name: string, routeModule: Record<string, unknown>, expectedExports: string[]]
> = [
  ["Asteroids replay", asteroidsReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Asteroids replay run", asteroidsReplayRunRoute, ["POST", "dynamic", "runtime"]],
  ["Tank Patrol replay", battleCityReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Tank Patrol replay run", battleCityReplayRunRoute, ["POST", "dynamic", "runtime"]],
  ["Breakout replay", breakoutReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Breakout replay run", breakoutReplayRunRoute, ["POST", "dynamic", "runtime"]],
  ["Minesweeper replay", minesweeperReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Minesweeper replay run", minesweeperReplayRunRoute, ["POST", "dynamic", "runtime"]],
  ["Pong replay", pongReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Pong replay run", pongReplayRunRoute, ["POST", "dynamic", "runtime"]],
  ["Simon replay", simonReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Simon replay run", simonReplayRunRoute, ["POST", "dynamic", "runtime"]],
  ["Snake replay", snakeReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Snake replay run", snakeReplayRunRoute, ["POST", "dynamic", "runtime"]],
  [
    "Space Invaders replay",
    spaceInvadersReplayRoute,
    ["GET", "POST", "dynamic", "runtime"],
  ],
  [
    "Space Invaders replay run",
    spaceInvadersReplayRunRoute,
    ["POST", "dynamic", "runtime"],
  ],
  ["Tetris replay", tetrisReplayRoute, ["GET", "POST", "dynamic", "runtime"]],
  ["Tetris replay run", tetrisReplayRunRoute, ["POST", "dynamic", "runtime"]],
  [
    "2048 replay",
    twentyFortyEightReplayRoute,
    ["GET", "POST", "dynamic", "runtime"],
  ],
  [
    "2048 replay run",
    twentyFortyEightReplayRunRoute,
    ["POST", "dynamic", "runtime"],
  ],
];

describe("replay route entry exports", () => {
  it.each(replayRouteEntries)(
    "%s exposes only supported Next.js route fields",
    (_name, routeModule, expectedExports) => {
      expect(Object.keys(routeModule).sort()).toEqual(expectedExports);
    },
  );
});
