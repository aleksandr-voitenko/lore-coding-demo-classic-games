import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import { GAME_CATALOG } from "@/lib/game-catalog";

import { GameLauncher, createLauncherPrivateRoomSettings } from "./game-launcher";
import { GAME_CARDS, createDefaultParameterValues } from "./game-launcher-config";
import { PLAYABLE_GAME_COMPONENTS } from "./game-launcher-playables";

const PRIVATE_ROOM_HOSTABLE_GAME_IDS = ["pong", "space-invaders"] as const;

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
    defaultLabel: "Easy",
    defaultValue: "easy",
    label: "Difficulty",
    testId: "minesweeper-difficulty",
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
    expect(markup).toContain('data-testid="global-leaderboard-open-button"');
    expect(markup).toContain("Leaderboards");

    for (const parameter of EXPECTED_PARAMETER_SELECTS) {
      expect(markup).toContain('data-testid="' + parameter.testId + '"');
    }

    expect(markup).not.toContain('data-testid="snake-board-size"');
    expect(markup).not.toContain(">Mode<");
    expect(markup).not.toContain(">Records<");
    expect(markup).not.toContain(">Top 3<");
    expect(markup).not.toContain(">Pieces<");
    expect(markup).not.toContain(">Pads<");
    expect(markup).not.toContain('data-testid="minesweeper-board-size"');
    expect(markup).not.toContain('data-testid="minesweeper-mines"');
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

    expect(getSelectMarkup(markup, "minesweeper-difficulty").match(/<option/g)).toHaveLength(3);
  });

  it("shows signed-out prompts for hostable private-room games", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    for (const gameId of PRIVATE_ROOM_HOSTABLE_GAME_IDS) {
      const hostButtonMarkup = getButtonMarkup(markup, `private-room-host-${gameId}-button`);
      const statusMarkup = getParagraphMarkup(markup, `private-room-host-${gameId}-status`);

      expect(hostButtonMarkup).toContain('disabled=""');
      expect(hostButtonMarkup).toContain("Sign in to host");
      expect(statusMarkup).toContain("Account required");
    }

    for (const game of GAME_CARDS) {
      if (PRIVATE_ROOM_HOSTABLE_GAME_IDS.some((gameId) => gameId === game.id)) {
        continue;
      }

      expect(markup).not.toContain(`data-testid="private-room-host-${game.id}-button"`);
      expect(markup).not.toContain(`data-testid="private-room-host-${game.id}-status"`);
    }
  });

  it("enables hostable private-room games for signed-in users", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <GameLauncher />
      </CurrentUserProvider>,
    );

    for (const gameId of PRIVATE_ROOM_HOSTABLE_GAME_IDS) {
      const hostButtonMarkup = getButtonMarkup(markup, `private-room-host-${gameId}-button`);
      const statusMarkup = getParagraphMarkup(markup, `private-room-host-${gameId}-status`);

      expect(hostButtonMarkup).not.toContain('disabled=""');
      expect(hostButtonMarkup).toContain("Host room");
      expect(statusMarkup).toContain("Private room");
    }
  });

  it("creates Space Invaders private-room settings from selected launcher parameters", () => {
    const spaceInvaders = GAME_CARDS.find((game) => game.id === "space-invaders");

    if (spaceInvaders === undefined) {
      throw new Error("Space Invaders launcher card is missing.");
    }

    const parameterValues = {
      ...createDefaultParameterValues(),
      "space-invaders-board-size": "480x640",
      "space-invaders-aliens": "24",
    };

    expect(createLauncherPrivateRoomSettings(spaceInvaders, parameterValues)).toEqual({
      gameId: "space-invaders",
      parameters: {
        "space-invaders-aliens": "24",
        "space-invaders-board-size": "480x640",
      },
    });
  });

  it("renders the room lobby instead of the launcher grid when a room code is present", () => {
    const markup = renderToStaticMarkup(<GameLauncher initialRoomCode="pong-1" />);

    expect(markup).toContain('data-testid="multiplayer-room-lobby"');
    expect(markup).toContain('data-testid="multiplayer-room-loading"');
    expect(markup).toContain("PONG-1");
    expect(markup).not.toContain('data-testid="game-menu"');
  });

  it("keeps unsupported room params in the lobby with a clear error", () => {
    const markup = renderToStaticMarkup(<GameLauncher initialRoomCode="bad code" />);

    expect(markup).toContain('data-testid="multiplayer-room-lobby"');
    expect(markup).toContain('data-testid="multiplayer-room-error"');
    expect(markup).toContain("Room code is not supported.");
    expect(markup).not.toContain('data-testid="game-menu"');
  });
});

function getSelectMarkup(markup: string, testId: string) {
  const selectMatch = markup.match(
    new RegExp('<select(?=[^>]*data-testid="' + testId + '")[\\s\\S]*?</select>'),
  );

  expect(selectMatch).not.toBeNull();

  return selectMatch?.[0] ?? "";
}

function getButtonMarkup(markup: string, testId: string) {
  const elementMatch = markup.match(
    new RegExp('<button(?=[^>]*data-testid="' + testId + '")[\\s\\S]*?</button>'),
  );

  expect(elementMatch).not.toBeNull();

  return elementMatch?.[0] ?? "";
}

function getParagraphMarkup(markup: string, testId: string) {
  const elementMatch = markup.match(
    new RegExp('<p(?=[^>]*data-testid="' + testId + '")[\\s\\S]*?</p>'),
  );

  expect(elementMatch).not.toBeNull();

  return elementMatch?.[0] ?? "";
}
