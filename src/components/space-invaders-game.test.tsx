import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getSpaceInvadersActivePowerUpKind,
  SPACE_INVADERS_HELP_SECTIONS,
  SpaceInvadersGame,
} from "./space-invaders-game";
import {
  createInitialSpaceInvadersGame,
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
} from "@/lib/space-invaders-game-engine";

describe("SpaceInvadersGame", () => {
  it("renders an empty power stat when no power-up is active", () => {
    const markup = renderToStaticMarkup(<SpaceInvadersGame />);

    expect(markup).toContain('data-testid="space-invaders-power"');
    expect(markup).toContain('data-testid="space-invaders-hit-streak"');
    expect(markup).toContain('data-testid="space-invaders-ufo-chain"');
    expect(markup).toContain('data-power-up-kind="none"');
    expect(markup).toContain('aria-label="No active power"');
    expect(markup).not.toContain(">None</dd>");
  });

  it("explains skill scoring bonuses in Help copy", () => {
    const helpItems = SPACE_INVADERS_HELP_SECTIONS.flatMap((section) => section.items ?? []);

    expect(helpItems).toEqual(
      expect.arrayContaining([
        `Clean hit streaks add ${SPACE_INVADERS_HIT_STREAK_BONUS_STEP} more points per hit after the first, up to ${SPACE_INVADERS_HIT_STREAK_BONUS_CAP}; missed shots and player hits reset the streak.`,
        `Destroying multiple invaders in one volley adds ${SPACE_INVADERS_MULTI_KILL_BONUSES[2]}, ${SPACE_INVADERS_MULTI_KILL_BONUSES[3]}, or ${SPACE_INVADERS_MULTI_KILL_BONUSES[4]} bonus points.`,
        `Consecutive UFO hits add ${SPACE_INVADERS_UFO_CHAIN_BONUS_STEP} more points per UFO after the first, up to ${SPACE_INVADERS_UFO_CHAIN_BONUS_CAP}; escaped UFOs reset the chain.`,
      ]),
    );
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
