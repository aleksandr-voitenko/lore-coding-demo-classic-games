export type BreakoutPaddleMovementDirection = "left" | "right";

export type BreakoutPaddleMovementKey = {
  direction: BreakoutPaddleMovementDirection;
  key: string;
};

export type BreakoutPaddleMovementState = {
  direction: BreakoutPaddleMovementDirection | null;
  heldKeys: Record<BreakoutPaddleMovementDirection, Set<string>>;
  lastDirection: BreakoutPaddleMovementDirection | null;
};

export function createBreakoutPaddleMovementState(): BreakoutPaddleMovementState {
  return {
    direction: null,
    heldKeys: {
      left: new Set<string>(),
      right: new Set<string>(),
    },
    lastDirection: null,
  };
}

export function getBreakoutPaddleMovementKey(key: string): BreakoutPaddleMovementKey | null {
  const normalizedKey = key.length === 1 ? key.toLowerCase() : key;

  if (normalizedKey === "ArrowLeft" || normalizedKey === "a") {
    return { direction: "left", key: normalizedKey };
  }

  if (normalizedKey === "ArrowRight" || normalizedKey === "d") {
    return { direction: "right", key: normalizedKey };
  }

  return null;
}

export function pressBreakoutPaddleMovementKey(
  state: BreakoutPaddleMovementState,
  { direction, key }: BreakoutPaddleMovementKey,
): {
  direction: BreakoutPaddleMovementDirection;
  shouldMoveImmediately: boolean;
} {
  const wasAlreadyHeld = state.heldKeys[direction].has(key);

  state.heldKeys[direction].add(key);
  state.lastDirection = direction;
  state.direction = direction;

  return {
    direction,
    shouldMoveImmediately: !wasAlreadyHeld,
  };
}

export function releaseBreakoutPaddleMovementKey(
  state: BreakoutPaddleMovementState,
  { direction, key }: BreakoutPaddleMovementKey,
): {
  direction: BreakoutPaddleMovementDirection | null;
  handled: boolean;
} {
  if (!state.heldKeys[direction].has(key)) {
    return {
      direction: state.direction,
      handled: false,
    };
  }

  state.heldKeys[direction].delete(key);

  if (state.heldKeys[direction].size > 0 || state.lastDirection !== direction) {
    return {
      direction: state.direction,
      handled: true,
    };
  }

  const fallbackDirection =
    direction === "left"
      ? state.heldKeys.right.size > 0
        ? "right"
        : null
      : state.heldKeys.left.size > 0
        ? "left"
        : null;

  state.lastDirection = fallbackDirection;
  state.direction = fallbackDirection;

  return {
    direction: fallbackDirection,
    handled: true,
  };
}

export function resetBreakoutPaddleMovementState(state: BreakoutPaddleMovementState) {
  state.heldKeys.left.clear();
  state.heldKeys.right.clear();
  state.lastDirection = null;
  state.direction = null;
}
