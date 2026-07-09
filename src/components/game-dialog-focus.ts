"use client";

import { useCallback, useRef } from "react";

export function useGameDialogReturnFocus() {
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );

  const restoreReturnFocus = useCallback(() => {
    const returnFocusElement = returnFocusRef.current;
    const ownerWindow = returnFocusElement?.ownerDocument.defaultView;

    if (!returnFocusElement || !ownerWindow) {
      return;
    }

    // Game action openers stay disabled until the parent Help/abandon flow closes,
    // so Base UI cannot always restore them before the controlled dialog unmounts.
    ownerWindow.requestAnimationFrame(() => {
      const activeElement = returnFocusElement.ownerDocument.activeElement;
      const hasIntentionalFocus =
        activeElement !== null &&
        activeElement !== returnFocusElement.ownerDocument.body &&
        activeElement !== returnFocusElement.ownerDocument.documentElement &&
        activeElement !== returnFocusElement;
      const isDisabled =
        (returnFocusElement instanceof HTMLButtonElement && returnFocusElement.disabled) ||
        returnFocusElement.getAttribute("aria-disabled") === "true";

      if (
        hasIntentionalFocus ||
        !returnFocusElement.isConnected ||
        isDisabled ||
        returnFocusElement.closest("[inert]") !== null ||
        returnFocusElement.tabIndex < 0 ||
        returnFocusElement.getClientRects().length === 0
      ) {
        return;
      }

      returnFocusElement.focus();
    });
  }, []);

  return { restoreReturnFocus, returnFocusRef };
}
