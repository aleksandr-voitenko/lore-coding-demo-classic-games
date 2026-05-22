type GameKeyboardEventTarget = {
  addEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: KeyboardEvent) => void): void;
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

export function registerGameKeyDown(
  listener: (event: KeyboardEvent) => void,
  target: GameKeyboardEventTarget = window,
) {
  target.addEventListener("keydown", listener);

  return () => target.removeEventListener("keydown", listener);
}
