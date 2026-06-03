"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";

import type { GameId, PlayableGameProps } from "@/components/game-launcher-config";

export const PLAYABLE_GAME_COMPONENTS = {
  asteroids: dynamic<PlayableGameProps>(() =>
    import("@/components/asteroids-game").then((module) => module.AsteroidsGame),
  ),
  breakout: dynamic<PlayableGameProps>(() =>
    import("@/components/breakout-game").then((module) => module.BreakoutGame),
  ),
  minesweeper: dynamic<PlayableGameProps>(() =>
    import("@/components/minesweeper-game").then((module) => module.MinesweeperGame),
  ),
  pong: dynamic<PlayableGameProps>(() =>
    import("@/components/pong-game").then((module) => module.PongGame),
  ),
  simon: dynamic<PlayableGameProps>(() =>
    import("@/components/simon-game").then((module) => module.SimonGame),
  ),
  snake: dynamic<PlayableGameProps>(() =>
    import("@/components/snake-game").then((module) => module.SnakeGame),
  ),
  "space-invaders": dynamic<PlayableGameProps>(() =>
    import("@/components/space-invaders-game").then(
      (module) => module.SpaceInvadersGame,
    ),
  ),
  tetris: dynamic<PlayableGameProps>(() =>
    import("@/components/tetris-game").then((module) => module.TetrisGame),
  ),
  "twenty-forty-eight": dynamic<PlayableGameProps>(() =>
    import("@/components/twenty-forty-eight-game").then(
      (module) => module.TwentyFortyEightGame,
    ),
  ),
} satisfies Readonly<Record<GameId, ComponentType<PlayableGameProps>>>;
