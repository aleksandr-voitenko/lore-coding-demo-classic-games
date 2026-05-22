"use client";

import { useCallback, useEffect, useState } from "react";

import {
  cancelGameMenuExitFlow,
  closeGameHelpFlow,
  confirmGameMenuExitFlow,
  initialGameHelpFlowState,
  initialGameMenuExitFlowState,
  openGameHelpFlow,
  requestGameMenuExitFlow,
  type GameHelpFlowEffect,
  type GameMenuExitFlowEffect,
} from "@/lib/game-ui-flow";

type UseGameHelpScreenOptions = {
  isGameActive?: boolean;
  onPauseGame?: () => void;
  onResumeGame?: () => void;
};

type UseGameEscapeToMenuOptions = {
  isDisabled?: boolean;
  isGameStarted: boolean;
  onBackToMenu?: () => void;
  onPauseGame?: () => void;
  onResumeGame?: () => void;
  shouldPauseBeforeConfirm?: boolean;
};

export function useGameHelpScreen({
  isGameActive = false,
  onPauseGame,
  onResumeGame,
}: UseGameHelpScreenOptions = {}) {
  const [helpFlow, setHelpFlow] = useState(initialGameHelpFlowState);

  const applyHelpEffect = useCallback(
    (effect: GameHelpFlowEffect) => {
      if (effect === "pause") {
        onPauseGame?.();
      }

      if (effect === "resume") {
        onResumeGame?.();
      }
    },
    [onPauseGame, onResumeGame],
  );

  const openHelp = useCallback(() => {
    const transition = openGameHelpFlow(helpFlow, isGameActive);

    setHelpFlow(transition.state);
    applyHelpEffect(transition.effect);
  }, [applyHelpEffect, helpFlow, isGameActive]);

  const closeHelp = useCallback(() => {
    const transition = closeGameHelpFlow(helpFlow);

    setHelpFlow(transition.state);
    applyHelpEffect(transition.effect);
  }, [applyHelpEffect, helpFlow]);

  return {
    closeHelp,
    isHelpVisible: helpFlow.isHelpVisible,
    openHelp,
  };
}

export function useGameEscapeToMenu({
  isDisabled = false,
  isGameStarted,
  onBackToMenu,
  onPauseGame,
  onResumeGame,
  shouldPauseBeforeConfirm = false,
}: UseGameEscapeToMenuOptions) {
  const [menuExitFlow, setMenuExitFlow] = useState(initialGameMenuExitFlowState);

  const applyMenuExitEffect = useCallback(
    (effect: GameMenuExitFlowEffect) => {
      if (effect === "back") {
        onBackToMenu?.();
      }

      if (effect === "pause") {
        onPauseGame?.();
      }

      if (effect === "resume") {
        onResumeGame?.();
      }
    },
    [onBackToMenu, onPauseGame, onResumeGame],
  );

  const cancelAbandon = useCallback(() => {
    const transition = cancelGameMenuExitFlow(menuExitFlow);

    setMenuExitFlow(transition.state);
    applyMenuExitEffect(transition.effect);
  }, [applyMenuExitEffect, menuExitFlow]);

  const confirmAbandon = useCallback(() => {
    const transition = confirmGameMenuExitFlow();

    setMenuExitFlow(transition.state);
    applyMenuExitEffect(transition.effect);
  }, [applyMenuExitEffect]);

  const requestBackToMenu = useCallback(() => {
    if (!onBackToMenu) {
      return;
    }

    const transition = requestGameMenuExitFlow(menuExitFlow, {
      isDisabled,
      isGameStarted,
      shouldPauseBeforeConfirm,
    });

    setMenuExitFlow(transition.state);
    applyMenuExitEffect(transition.effect);
  }, [
    applyMenuExitEffect,
    isDisabled,
    isGameStarted,
    menuExitFlow,
    onBackToMenu,
    shouldPauseBeforeConfirm,
  ]);

  useEffect(() => {
    if (!onBackToMenu || isDisabled || menuExitFlow.isAbandonDialogVisible) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      requestBackToMenu();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDisabled, menuExitFlow.isAbandonDialogVisible, onBackToMenu, requestBackToMenu]);

  return {
    abandonDialogProps: menuExitFlow.isAbandonDialogVisible
      ? {
          onCancel: cancelAbandon,
          onConfirm: confirmAbandon,
        }
      : null,
    requestBackToMenu: onBackToMenu ? requestBackToMenu : undefined,
  };
}
