import {
  ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS,
  ASTEROIDS_TICK_DELAY_MS,
  type AsteroidsGameState,
  type AsteroidsPowerUpKind,
} from "@/lib/asteroids-game-engine";

export type AsteroidsPickupFeedback = {
  ageTicks: number;
  durationTicks: number;
  id: string;
  kind: AsteroidsPowerUpKind;
  label: string;
  x: number;
  y: number;
};

type CreateAsteroidsPickupFeedbacksOptions = {
  nextGame: AsteroidsGameState;
  nextId: number;
  previousGame: AsteroidsGameState;
};

const PICKUP_FEEDBACK_DURATION_TICKS = Math.ceil(720 / ASTEROIDS_TICK_DELAY_MS);

export function createAsteroidsPickupFeedbacks({
  nextGame,
  nextId,
  previousGame,
}: CreateAsteroidsPickupFeedbacksOptions) {
  const powerUp = previousGame.powerUp;

  if (
    powerUp === null ||
    nextGame.powerUp !== null ||
    nextGame.status === "lost"
  ) {
    return {
      feedbacks: [] satisfies AsteroidsPickupFeedback[],
      nextId,
    };
  }

  return {
    feedbacks: [
      {
        ageTicks: 0,
        durationTicks: PICKUP_FEEDBACK_DURATION_TICKS,
        id: `pickup-feedback-${nextId}`,
        kind: powerUp.kind,
        label: getAsteroidsPickupFeedbackLabel(powerUp.kind),
        x: powerUp.x,
        y: powerUp.y,
      },
    ],
    nextId: nextId + 1,
  };
}

export function advanceAsteroidsPickupFeedbacks(
  feedbacks: AsteroidsPickupFeedback[],
) {
  return feedbacks
    .map((feedback) => ({
      ...feedback,
      ageTicks: feedback.ageTicks + 1,
    }))
    .filter((feedback) => feedback.ageTicks < feedback.durationTicks);
}

function getAsteroidsPickupFeedbackLabel(kind: AsteroidsPowerUpKind) {
  switch (kind) {
    case "bonus-score":
      return `+${ASTEROIDS_BONUS_SCORE_POWER_UP_POINTS}`;
    case "bullet-speed":
      return "+bullet speed";
    case "engine-speed":
      return "+engine speed";
    case "shield":
      return "+shield";
    case "shot-interval":
      return "+fire rate";
  }
}
