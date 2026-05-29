export const ASTEROIDS_CONTROL_DIRECTIONS = [
  "rotate-left",
  "rotate-right",
  "thrust",
] as const;

export type AsteroidsControlDirection = (typeof ASTEROIDS_CONTROL_DIRECTIONS)[number];

export type AsteroidsControlKey = {
  direction: AsteroidsControlDirection;
  key: string;
};

export type AsteroidsControlState = {
  heldKeys: Record<AsteroidsControlDirection, Set<string>>;
};

const ASTEROIDS_CONTROL_KEY_MAP: Record<AsteroidsControlDirection, readonly string[]> = {
  "rotate-left": ["ArrowLeft", "a"],
  "rotate-right": ["ArrowRight", "d"],
  thrust: ["ArrowUp", "w"],
};

function normalizeAsteroidsControlKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function createAsteroidsControlState(): AsteroidsControlState {
  return {
    heldKeys: ASTEROIDS_CONTROL_DIRECTIONS.reduce(
      (heldKeys, direction) => ({
        ...heldKeys,
        [direction]: new Set<string>(),
      }),
      {} as Record<AsteroidsControlDirection, Set<string>>,
    ),
  };
}

export function getAsteroidsControlKey(key: string): AsteroidsControlKey | null {
  const normalizedKey = normalizeAsteroidsControlKey(key);

  for (const direction of ASTEROIDS_CONTROL_DIRECTIONS) {
    if (ASTEROIDS_CONTROL_KEY_MAP[direction].includes(normalizedKey)) {
      return { direction, key: normalizedKey };
    }
  }

  return null;
}

export function pressAsteroidsControlKey(
  state: AsteroidsControlState,
  { direction, key }: AsteroidsControlKey,
) {
  state.heldKeys[direction].add(key);
}

export function releaseAsteroidsControlKey(
  state: AsteroidsControlState,
  { direction, key }: AsteroidsControlKey,
) {
  if (!state.heldKeys[direction].has(key)) {
    return false;
  }

  state.heldKeys[direction].delete(key);
  return true;
}

export function resetAsteroidsControlState(state: AsteroidsControlState) {
  ASTEROIDS_CONTROL_DIRECTIONS.forEach((direction) => {
    state.heldKeys[direction].clear();
  });
}

export function getAsteroidsControlInput(state: AsteroidsControlState) {
  return {
    rotateLeft: state.heldKeys["rotate-left"].size > 0,
    rotateRight: state.heldKeys["rotate-right"].size > 0,
    thrust: state.heldKeys.thrust.size > 0,
  };
}
