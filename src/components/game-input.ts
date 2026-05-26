type GameKeyboardEventType = "keydown" | "keyup";

type GameKeyboardEventTarget = {
  addEventListener(type: GameKeyboardEventType, listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: GameKeyboardEventType, listener: (event: KeyboardEvent) => void): void;
};

type GameKeyboardGuardOptions = {
  hasPendingLeaderboardEntry?: boolean;
  isHelpVisible?: boolean;
};

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
