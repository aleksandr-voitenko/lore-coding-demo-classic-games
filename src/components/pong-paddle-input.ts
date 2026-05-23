export type PongPaddleMovementDirection = "up" | "down";

export type PongPaddleMovementKey = {
  direction: PongPaddleMovementDirection;
  key: string;
};

export type PongPaddleMovementState = {
  direction: PongPaddleMovementDirection | null;
  heldKeys: Record<PongPaddleMovementDirection, Set<string>>;
  lastDirection: PongPaddleMovementDirection | null;
};

export function createPongPaddleMovementState(): PongPaddleMovementState {
  return {
    direction: null,
    heldKeys: {
      down: new Set<string>(),
      up: new Set<string>(),
    },
    lastDirection: null,
  };
}

export function getPongPaddleMovementKey(key: string): PongPaddleMovementKey | null {
  const normalizedKey = key.length === 1 ? key.toLowerCase() : key;

  if (normalizedKey === "ArrowUp" || normalizedKey === "w") {
    return { direction: "up", key: normalizedKey };
  }

  if (normalizedKey === "ArrowDown" || normalizedKey === "s") {
    return { direction: "down", key: normalizedKey };
  }

  return null;
}

export function pressPongPaddleMovementKey(
  state: PongPaddleMovementState,
  { direction, key }: PongPaddleMovementKey,
): {
  direction: PongPaddleMovementDirection;
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

export function releasePongPaddleMovementKey(
  state: PongPaddleMovementState,
  { direction, key }: PongPaddleMovementKey,
): {
  direction: PongPaddleMovementDirection | null;
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
    direction === "up"
      ? state.heldKeys.down.size > 0
        ? "down"
        : null
      : state.heldKeys.up.size > 0
        ? "up"
        : null;

  state.lastDirection = fallbackDirection;
  state.direction = fallbackDirection;

  return {
    direction: fallbackDirection,
    handled: true,
  };
}

export function resetPongPaddleMovementState(state: PongPaddleMovementState) {
  state.heldKeys.down.clear();
  state.heldKeys.up.clear();
  state.lastDirection = null;
  state.direction = null;
}
