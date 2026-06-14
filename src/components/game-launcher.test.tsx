import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GAME_CATALOG } from "@/lib/game-catalog";

import { GameLauncher } from "./game-launcher";
import { GAME_CARDS } from "./game-launcher-config";
import { PLAYABLE_GAME_COMPONENTS } from "./game-launcher-playables";

const EXPECTED_PARAMETER_SELECTS = [
  {
    defaultLabel: "10 x 20",
    defaultValue: "10x20",
    label: "Board",
    testId: "tetris-board-size",
  },
  {
    defaultLabel: "1",
    defaultValue: "1",
    label: "Level",
    testId: "tetris-start-level",
  },
  {
    defaultLabel: "420 x 560",
    defaultValue: "420x560",
    label: "Board",
    testId: "breakout-board-size",
  },
  {
    defaultLabel: "3",
    defaultValue: "3",
    label: "Lives",
    testId: "breakout-lives",
  },
  {
    defaultLabel: "9 x 9",
    defaultValue: "9x9",
    label: "Board",
    testId: "minesweeper-board-size",
  },
  {
    defaultLabel: "10",
    defaultValue: "10",
    label: "Mines",
    testId: "minesweeper-mines",
  },
  {
    defaultLabel: "420 x 560",
    defaultValue: "420x560",
    label: "Board",
    testId: "space-invaders-board-size",
  },
  {
    defaultLabel: "50",
    defaultValue: "50",
    label: "Aliens",
    testId: "space-invaders-aliens",
  },
  {
    defaultLabel: "4 x 4",
    defaultValue: "4",
    label: "Board",
    testId: "twenty-forty-eight-board-size",
  },
  {
    defaultLabel: "2048",
    defaultValue: "2048",
    label: "Goal",
    testId: "twenty-forty-eight-goal",
  },
  {
    defaultLabel: "420 x 560",
    defaultValue: "420x560",
    label: "Board",
    testId: "pong-board-size",
  },
  {
    defaultLabel: "5",
    defaultValue: "5",
    label: "Target",
    testId: "pong-target",
  },
  {
    defaultLabel: "Medium",
    defaultValue: "medium",
    label: "Difficulty",
    testId: "simon-difficulty",
  },
  {
    defaultLabel: "Medium",
    defaultValue: "medium",
    label: "Difficulty",
    testId: "asteroids-difficulty",
  },
] as const;

describe("game launcher", () => {
  it("uses the shared game catalog ids and labels for launcher cards", () => {
    expect(GAME_CARDS.map(({ id, label }) => ({ id, label }))).toEqual(GAME_CATALOG);
  });

  it("keeps a lazy playable component for every launcher card", () => {
    expect(Object.keys(PLAYABLE_GAME_COMPONENTS).sort()).toEqual(
      GAME_CARDS.map((game) => game.id).sort(),
    );
  });

  it("renders only configurable card parameters on the launch screen", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    expect(markup).toContain('data-testid="game-menu"');

    for (const parameter of EXPECTED_PARAMETER_SELECTS) {
      expect(markup).toContain('data-testid="' + parameter.testId + '"');
    }

    expect(markup).not.toContain('data-testid="snake-board-size"');
    expect(markup).not.toContain(">Mode<");
    expect(markup).not.toContain(">Records<");
    expect(markup).not.toContain(">Top 3<");
    expect(markup).not.toContain(">Pieces<");
    expect(markup).not.toContain(">Pads<");
    expect(markup).not.toContain('data-testid="simon-target"');
  });

  it("preserves launcher parameter labels and defaults", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    for (const parameter of EXPECTED_PARAMETER_SELECTS) {
      const selectMarkup = getSelectMarkup(markup, parameter.testId);

      expect(markup).toContain(">" + parameter.label + "</label>");
      expect(selectMarkup).toContain(
        'value="' + parameter.defaultValue + '" selected="">' + parameter.defaultLabel,
      );
    }
  });
});

function getSelectMarkup(markup: string, testId: string) {
  const selectMatch = markup.match(
    new RegExp('<select(?=[^>]*data-testid="' + testId + '")[\\s\\S]*?</select>'),
  );

  expect(selectMatch).not.toBeNull();

  return selectMatch?.[0] ?? "";
}
