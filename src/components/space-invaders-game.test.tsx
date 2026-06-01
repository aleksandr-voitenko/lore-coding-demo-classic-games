import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getSpaceInvadersActivePowerUpKind,
  SpaceInvadersGame,
} from "./space-invaders-game";
import { createInitialSpaceInvadersGame } from "@/lib/space-invaders-game-engine";

describe("SpaceInvadersGame", () => {
  it("renders an empty power stat when no power-up is active", () => {
    const markup = renderToStaticMarkup(<SpaceInvadersGame />);

    expect(markup).toContain('data-testid="space-invaders-power"');
    expect(markup).toContain('data-power-up-kind="none"');
    expect(markup).toContain('aria-label="No active power"');
    expect(markup).not.toContain(">None</dd>");
  });

  it("selects the active power-up kind for the status icon", () => {
    const game = createInitialSpaceInvadersGame();

    expect(getSpaceInvadersActivePowerUpKind(game)).toBeNull();
    expect(
      getSpaceInvadersActivePowerUpKind({
        ...game,
        playerShieldTicks: 10,
      }),
    ).toBe("shield");
    expect(
      getSpaceInvadersActivePowerUpKind({
        ...game,
        alienFreezeTicks: 10,
        playerShieldTicks: 10,
      }),
    ).toBe("freeze");
    expect(
      getSpaceInvadersActivePowerUpKind({
        ...game,
        alienFreezeTicks: 10,
        pendingShotPowerUp: "piercing-laser",
        playerShieldTicks: 10,
      }),
    ).toBe("piercing-laser");
  });
});
