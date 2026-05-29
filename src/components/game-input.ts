import { useCallback, useEffect, useMemo } from "react";

type GameKeyboardEventType = "keydown" | "keyup";

type GameKeyboardEventTarget = {
  addEventListener(type: GameKeyboardEventType, listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: GameKeyboardEventType, listener: (event: KeyboardEvent) => void): void;
};

type GameWindowBlurTarget = {
  addEventListener(type: "blur", listener: (event: Event) => void): void;
  removeEventListener(type: "blur", listener: (event: Event) => void): void;
};

type GameKeyboardGuardOptions = {
  hasPendingLeaderboardEntry?: boolean;
  isHelpVisible?: boolean;
};

export type HeldDirectionMovementKey<Direction extends string> = {
  direction: Direction;
  key: string;
};

export type HeldDirectionMovementState<Direction extends string> = {
  direction: Direction | null;
  directions: readonly Direction[];
  heldKeys: Record<Direction, Set<string>>;
  lastDirection: Direction | null;
};

type HeldDirectionMovementResult<Direction extends string> = {
  direction: Direction;
  shouldMoveImmediately: boolean;
};

type ReleasedHeldDirectionMovementResult<Direction extends string> = {
  direction: Direction | null;
  handled: boolean;
};

export type HeldDirectionMovementKeyMap<Direction extends string> = Record<
  Direction,
  readonly string[]
>;

export type HeldDirectionMovementTimers = {
  clearInterval(intervalId: number): void;
  setInterval(listener: () => void, intervalMs: number): number;
};

export type HeldDirectionMovementController<Direction extends string> = {
  beginMovement(movementKey: HeldDirectionMovementKey<Direction>): void;
  endMovement(movementKey: HeldDirectionMovementKey<Direction>): boolean;
  resetMovement(): void;
  state: HeldDirectionMovementState<Direction>;
};

type HeldDirectionMovementControllerOptions<Direction extends string> = {
  intervalMs: number;
  move(direction: Direction): void;
  state: HeldDirectionMovementState<Direction>;
  timers?: HeldDirectionMovementTimers;
};

type HeldDirectionMovementControllerHookOptions<Direction extends string> = {
  createState(): HeldDirectionMovementState<Direction>;
  intervalMs: number;
  isMovementDisabled?: boolean;
  move(direction: Direction): void;
  timers?: HeldDirectionMovementTimers;
};

function getDefaultHeldDirectionMovementTimers(): HeldDirectionMovementTimers {
  return {
    clearInterval(intervalId) {
      window.clearInterval(intervalId);
    },
    setInterval(listener, intervalMs) {
      return window.setInterval(listener, intervalMs);
    },
  };
}

function normalizeHeldDirectionMovementKey(key: string) {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function createHeldDirectionMovementState<Direction extends string>(
  directions: readonly Direction[],
): HeldDirectionMovementState<Direction> {
  const heldKeys = {} as Record<Direction, Set<string>>;

  directions.forEach((direction) => {
    heldKeys[direction] = new Set<string>();
  });

  return {
    direction: null,
    directions,
    heldKeys,
    lastDirection: null,
  };
}

export function createHeldDirectionMovementKeyGetter<Direction extends string>(
  keyMap: HeldDirectionMovementKeyMap<Direction>,
) {
  const movementKeys = new Map<string, Direction>();

  (Object.keys(keyMap) as Direction[]).forEach((direction) => {
    keyMap[direction].forEach((key) => {
      movementKeys.set(normalizeHeldDirectionMovementKey(key), direction);
    });
  });

  return function getHeldDirectionMovementKey(
    key: string,
  ): HeldDirectionMovementKey<Direction> | null {
    const normalizedKey = normalizeHeldDirectionMovementKey(key);
    const direction = movementKeys.get(normalizedKey);

    if (direction === undefined) {
      return null;
    }

    return { direction, key: normalizedKey };
  };
}

export function pressHeldDirectionMovementKey<Direction extends string>(
  state: HeldDirectionMovementState<Direction>,
  { direction, key }: HeldDirectionMovementKey<Direction>,
): HeldDirectionMovementResult<Direction> {
  const wasAlreadyHeld = state.heldKeys[direction].has(key);

  state.heldKeys[direction].add(key);
  state.lastDirection = direction;
  state.direction = direction;

  return {
    direction,
    shouldMoveImmediately: !wasAlreadyHeld,
  };
}

export function releaseHeldDirectionMovementKey<Direction extends string>(
  state: HeldDirectionMovementState<Direction>,
  { direction, key }: HeldDirectionMovementKey<Direction>,
): ReleasedHeldDirectionMovementResult<Direction> {
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
    state.directions.find(
      (candidate) => candidate !== direction && state.heldKeys[candidate].size > 0,
    ) ?? null;

  state.lastDirection = fallbackDirection;
  state.direction = fallbackDirection;

  return {
    direction: fallbackDirection,
    handled: true,
  };
}

export function resetHeldDirectionMovementState<Direction extends string>(
  state: HeldDirectionMovementState<Direction>,
) {
  state.directions.forEach((direction) => {
    state.heldKeys[direction].clear();
  });

  state.lastDirection = null;
  state.direction = null;
}

export function createHeldDirectionMovementController<Direction extends string>({
  intervalMs,
  move,
  state,
  timers = getDefaultHeldDirectionMovementTimers(),
}: HeldDirectionMovementControllerOptions<Direction>): HeldDirectionMovementController<Direction> {
  let movementIntervalId: number | null = null;

  function stopMovementLoop() {
    if (movementIntervalId === null) {
      return;
    }

    timers.clearInterval(movementIntervalId);
    movementIntervalId = null;
  }

  function startMovementLoop(direction: Direction) {
    state.direction = direction;

    if (movementIntervalId !== null) {
      return;
    }

    movementIntervalId = timers.setInterval(() => {
      const currentDirection = state.direction;

      if (currentDirection !== null) {
        move(currentDirection);
      }
    }, intervalMs);
  }

  return {
    beginMovement(movementKey) {
      const movement = pressHeldDirectionMovementKey(state, movementKey);

      startMovementLoop(movement.direction);

      if (movement.shouldMoveImmediately) {
        move(movement.direction);
      }
    },
    endMovement(movementKey) {
      const movement = releaseHeldDirectionMovementKey(state, movementKey);

      if (!movement.handled) {
        return false;
      }

      if (movement.direction === null) {
        stopMovementLoop();
      } else {
        startMovementLoop(movement.direction);
      }

      return true;
    },
    resetMovement() {
      resetHeldDirectionMovementState(state);
      stopMovementLoop();
    },
    state,
  };
}

export function registerHeldDirectionMovementBlurReset<Direction extends string>(
  controller: Pick<HeldDirectionMovementController<Direction>, "resetMovement">,
  target: GameWindowBlurTarget = window,
) {
  const resetMovement = () => {
    controller.resetMovement();
  };

  target.addEventListener("blur", resetMovement);

  return () => {
    target.removeEventListener("blur", resetMovement);
    resetMovement();
  };
}

export function useHeldDirectionMovementController<Direction extends string>({
  createState,
  intervalMs,
  isMovementDisabled = false,
  move,
  timers,
}: HeldDirectionMovementControllerHookOptions<Direction>) {
  const controller = useMemo(
    () =>
      createHeldDirectionMovementController({
        intervalMs,
        move,
        state: createState(),
        timers,
      }),
    [createState, intervalMs, move, timers],
  );

  useEffect(() => {
    if (isMovementDisabled) {
      controller.resetMovement();
    }
  }, [controller, isMovementDisabled]);

  useEffect(() => registerHeldDirectionMovementBlurReset(controller), [controller]);

  const beginMovement = useCallback(
    (movementKey: HeldDirectionMovementKey<Direction>) => {
      controller.beginMovement(movementKey);
    },
    [controller],
  );

  const endMovement = useCallback(
    (movementKey: HeldDirectionMovementKey<Direction>) => {
      return controller.endMovement(movementKey);
    },
    [controller],
  );

  const resetMovement = useCallback(() => {
    controller.resetMovement();
  }, [controller]);

  return {
    beginMovement,
    endMovement,
    resetMovement,
    state: controller.state,
  };
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "SELECT" ||
    target.tagName === "TEXTAREA"
  );
}

export function shouldIgnoreGameKeyDown(
  event: Pick<KeyboardEvent, "target">,
  { hasPendingLeaderboardEntry = false, isHelpVisible = false }: GameKeyboardGuardOptions = {},
) {
  return isHelpVisible || hasPendingLeaderboardEntry || isTypingTarget(event.target);
}

export function isGamePauseKey(key: string) {
  return key === "p" || key === "P";
}

export function registerGameKeyDown(
  listener: (event: KeyboardEvent) => void,
  target: GameKeyboardEventTarget = window,
) {
  target.addEventListener("keydown", listener);

  return () => target.removeEventListener("keydown", listener);
}

export function registerGameKeyUp(
  listener: (event: KeyboardEvent) => void,
  target: GameKeyboardEventTarget = window,
) {
  target.addEventListener("keyup", listener);

  return () => target.removeEventListener("keyup", listener);
}
