import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameLauncher } from "./game-launcher";

describe("game launcher", () => {
  it("renders only configurable card parameters on the launch screen", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    expect(markup).toContain('data-testid="game-menu"');
    expect(markup).toContain('data-testid="snake-board-size"');
    expect(markup).toContain('data-testid="tetris-board-size"');
    expect(markup).toContain('data-testid="tetris-start-level"');
    expect(markup).toContain('data-testid="breakout-board-size"');
    expect(markup).toContain('data-testid="breakout-lives"');
    expect(markup).toContain('data-testid="minesweeper-board-size"');
    expect(markup).toContain('data-testid="minesweeper-mines"');
    expect(markup).toContain('data-testid="space-invaders-board-size"');
    expect(markup).toContain('data-testid="space-invaders-aliens"');
    expect(markup).toContain('data-testid="twenty-forty-eight-board-size"');
    expect(markup).toContain('data-testid="twenty-forty-eight-goal"');
    expect(markup).toContain('data-testid="pong-board-size"');
    expect(markup).toContain('data-testid="pong-target"');
    expect(markup).toContain('data-testid="simon-target"');

    expect(markup).not.toContain(">Mode<");
    expect(markup).not.toContain(">Records<");
    expect(markup).not.toContain(">Top 3<");
    expect(markup).not.toContain(">Pieces<");
    expect(markup).not.toContain(">Pads<");
  });
});
