import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  SPACE_INVADERS_HELP_SECTIONS,
  SpaceInvadersGame,
} from "./space-invaders-game";
import {
  SPACE_INVADERS_HIT_STREAK_BONUS_CAP,
  SPACE_INVADERS_HIT_STREAK_BONUS_STEP,
  SPACE_INVADERS_MULTI_KILL_BONUSES,
  SPACE_INVADERS_UFO_CHAIN_BONUS_CAP,
  SPACE_INVADERS_UFO_CHAIN_BONUS_STEP,
} from "@/lib/space-invaders-game-engine";

describe("SpaceInvadersGame", () => {
  it("renders score and health in the board HUD instead of the stats strip", () => {
    const markup = renderToStaticMarkup(<SpaceInvadersGame />);

    expect(markup).toContain('data-testid="space-invaders-score-hud"');
    expect(markup).toContain('data-testid="space-invaders-health-hud"');
    expect(markup.indexOf('data-testid="space-invaders-score-hud"')).toBeLessThan(
      markup.indexOf('data-testid="space-invaders-health-hud"'),
    );
    expect(markup).toContain('data-testid="space-invaders-score"');
    expect(markup).toContain('data-testid="space-invaders-lives"');
    expect(markup).toContain("/images/space-invaders/hud-score.png?v=sprite-art-v2");
    expect(markup).toContain("/images/space-invaders/hud-health.png?v=sprite-art-v2");
    expect(markup).not.toContain('data-testid="game-sidebar"');
    expect(markup).not.toContain('data-testid="space-invaders-power"');
    expect(markup).not.toContain('data-testid="space-invaders-remaining"');
    expect(markup).not.toContain('data-testid="space-invaders-hit-streak"');
    expect(markup).not.toContain('data-testid="space-invaders-ufo-chain"');
    expect(markup).not.toContain('data-testid="space-invaders-speed"');
  });

  it("launches latest replay mode without live game controls", () => {
    const markup = renderToStaticMarkup(
      <SpaceInvadersGame onBackToMenu={() => undefined} replayMode="latest" />,
    );

    expect(markup).toContain('data-testid="space-invaders-replay-status"');
    expect(markup).toContain("Loading Space Invaders replay");
    expect(markup).not.toContain('data-testid="space-invaders-status"');
    expect(markup).not.toContain('data-testid="space-invaders-start-button"');
    expect(markup).not.toContain('data-testid="space-invaders-save-replay-button"');
  });

  it("explains skill scoring bonuses in Help copy", () => {
    const helpItems = SPACE_INVADERS_HELP_SECTIONS.flatMap((section) => section.items ?? []);

    expect(helpItems).toEqual(
      expect.arrayContaining([
        `Clean hit streaks add ${SPACE_INVADERS_HIT_STREAK_BONUS_STEP} more points per hit after the first, up to ${SPACE_INVADERS_HIT_STREAK_BONUS_CAP}; missed shots and player hits reset the streak.`,
        `Destroying multiple invaders in one volley adds ${SPACE_INVADERS_MULTI_KILL_BONUSES[2]}, ${SPACE_INVADERS_MULTI_KILL_BONUSES[3]}, or ${SPACE_INVADERS_MULTI_KILL_BONUSES[4]} bonus points.`,
        `Consecutive UFO hits add ${SPACE_INVADERS_UFO_CHAIN_BONUS_STEP} more points per UFO after the first, up to ${SPACE_INVADERS_UFO_CHAIN_BONUS_CAP}; escaped UFOs reset the chain.`,
        "When fewer than half the aliens remain, the marching formation speeds up gradually until the final formation alien moves at 1.5x speed.",
        "Shield Bearers glow cyan and protect nearby active aliens; destroy the bearer or use Piercing to punch through the shield.",
        "Revenge Aliens glow red, fire fast counterfire shots toward your position, and mark up to five random formation aliens with a red aura when destroyed; after two seconds, each marked alien fires one shot.",
        "Splitter Aliens fire magenta fork shots and split into two smaller fragments when destroyed; fragments dive like Divers, do not shoot, do not drop bonuses, and still count as invaders.",
        "Armored Aliens take three hits to destroy; non-lethal hits change their armor and keep clean streaks alive while their wide armor-wave shots move straight down.",
        "Standard invader rows fire tracking bolts, delayed bursts, scatter bursts, needles, or lasers; Divers use their original row shot, while Shield Bearers fire bottom-row lasers.",
      ]),
    );
  });
});
