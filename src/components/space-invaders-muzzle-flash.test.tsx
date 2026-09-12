import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpaceInvadersBoard } from "./space-invaders-board";
import {
  advanceSpaceInvadersGame,
  advanceSpaceInvadersTicks,
  createInvaderShotFixture,
  createRunningGame,
  fireFromOnlyInvader,
  getSpaceInvadersTickDelay,
  pauseSpaceInvadersGame,
  withOnlyActiveInvader,
  type SpaceInvadersGameState,
} from "@/lib/space-invaders-game-engine.test-helpers";

function renderBoard(game: SpaceInvadersGameState) {
  return renderToStaticMarkup(
    <SpaceInvadersBoard game={game} statusLabel={game.status} />,
  );
}

function firingAlienIds(game: SpaceInvadersGameState) {
  return [...renderBoard(game).matchAll(/data-muzzle-flash-source="([^"]+)"/g)]
    .map((match) => match[1]);
}

describe("Space Invaders muzzle flashes", () => {
  it("identifies the firing alien, pauses with play, and expires after the brief discharge", () => {
    const { advanced: fired, shooter } = fireFromOnlyInvader(4);

    expect(fired.invaderShots).toHaveLength(1);
    expect(firingAlienIds(fired)).toEqual([shooter.id]);
    const fading = advanceSpaceInvadersTicks(fired, 5);
    expect(firingAlienIds(fading)).toEqual([shooter.id]);
    expect(renderBoard(fading)).toContain("animation-delay:-170ms");

    const paused = pauseSpaceInvadersGame(fading);
    expect(renderBoard(advanceSpaceInvadersTicks(paused, 50))).toBe(renderBoard(paused));
    expect(firingAlienIds(advanceSpaceInvadersGame(fading))).toEqual([]);
    expect(advanceSpaceInvadersGame(fading).invaderShots).toHaveLength(1);
  });

  it("shows one flash for a scatter volley and a fresh flash for each burst shot", () => {
    const scatter = fireFromOnlyInvader(2);
    expect(scatter.advanced.invaderShots).toHaveLength(3);
    expect(firingAlienIds(scatter.advanced)).toEqual([scatter.shooter.id]);

    const burst = fireFromOnlyInvader(1);
    expect(firingAlienIds(burst.advanced)).toEqual([burst.shooter.id]);
    const beforeNextShot = advanceSpaceInvadersTicks(
      burst.advanced,
      Math.round(1_000 / getSpaceInvadersTickDelay()) - 1,
    );
    expect(firingAlienIds(beforeNextShot)).toEqual([]);
    const nextShot = advanceSpaceInvadersGame(beforeNextShot);
    expect(nextShot.nextInvaderShotId).toBe(burst.advanced.nextInvaderShotId + 1);
    expect(firingAlienIds(nextShot)).toEqual([burst.shooter.id]);
    expect(renderBoard(nextShot)).toContain("animation-delay:0ms");
  });

  it("waits for counterfire to leave the weapon instead of flashing during its windup", () => {
    const game = createRunningGame({ invaderShotCooldownTicks: 0 });
    const shooter = { ...game.invaders[0]!, kind: "revenge" as const };
    let fired = advanceSpaceInvadersGame(withOnlyActiveInvader(game, shooter));
    const initialShotY = fired.invaderShots[0]!.y;

    for (let age = 0; age <= 2; age += 1) {
      expect(fired.invaderShots[0]).toMatchObject({
        ageTicks: age,
        kind: "counterfire",
        y: initialShotY,
      });
      expect(firingAlienIds(fired)).toEqual([]);
      fired = advanceSpaceInvadersGame(fired);
    }

    expect(fired.invaderShots[0]!.y).toBeGreaterThan(initialShotY);
    expect(firingAlienIds(fired)).toEqual([shooter.id]);
    expect(firingAlienIds(advanceSpaceInvadersTicks(fired, 6))).toEqual([]);
  });

  it("does not mark the source when projectiles split in flight or the alien is destroyed", () => {
    const game = createRunningGame();
    const source = game.invaders[0]!;
    const destroyed = { ...game.invaders[1]!, isActive: false };
    const shots = [
      createInvaderShotFixture({
        id: "commander-shard",
        kind: "commander-shard",
        sourceInvaderId: source.id,
      }),
      createInvaderShotFixture({
        id: "fork-fragment",
        kind: "splitter-fragment",
        sourceInvaderId: source.id,
      }),
      createInvaderShotFixture({
        id: "destroyed-source-shot",
        sourceInvaderId: destroyed.id,
      }),
      createInvaderShotFixture({
        id: "removed-source-shot",
        sourceInvaderId: "removed-alien",
      }),
    ];

    expect(firingAlienIds({
      ...game,
      invaders: [source, destroyed],
      invaderShots: shots,
    })).toEqual([]);
  });

  it("keeps shields and pending revenge warnings separate from muzzle flashes", () => {
    const game = createRunningGame({
      alienFreezeTicks: 10,
      invaderShotCooldownTicks: 1_000,
    });
    const bearer = { ...game.invaders[0]!, kind: "shield-bearer" as const };
    const target = { ...game.invaders[1]!, kind: "standard" as const };
    const primed = {
      ...game,
      invaders: [bearer, target],
      revengeVolleys: [{ invaderIds: [target.id], ticksRemaining: 1 }],
    };
    expect(firingAlienIds(primed)).toEqual([]);

    const fired = advanceSpaceInvadersGame(primed);
    expect(fired.invaderShots[0]!.sourceInvaderId).toBe(target.id);
    expect(firingAlienIds(fired)).toEqual([target.id]);
    expect(renderBoard(fired)).toContain('data-testid="space-invaders-invader-shield"');
    expect(renderBoard(fired)).not.toContain('data-testid="space-invaders-revenge-warning"');

    const stillWarned = { ...fired, revengeVolleys: primed.revengeVolleys };
    expect(firingAlienIds(stillWarned)).toEqual([target.id]);
    expect(renderBoard(stillWarned)).toContain('data-testid="space-invaders-revenge-warning"');
    expect(renderBoard(stillWarned)).toContain('data-testid="space-invaders-invader-shield"');
  });
});
