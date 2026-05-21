export type GameHelpFlowState = {
  isHelpVisible: boolean;
  shouldResumeOnClose: boolean;
};

export type GameHelpFlowEffect = "pause" | "resume" | null;

export type GameHelpFlowTransition = {
  effect: GameHelpFlowEffect;
  state: GameHelpFlowState;
};

export type GameMenuExitFlowState = {
  isAbandonDialogVisible: boolean;
  shouldResumeOnCancel: boolean;
};

export type GameMenuExitFlowEffect = "back" | "pause" | "resume" | null;

export type GameMenuExitFlowTransition = {
  effect: GameMenuExitFlowEffect;
  state: GameMenuExitFlowState;
};

type RequestGameMenuExitOptions = {
  isDisabled?: boolean;
  isGameStarted: boolean;
  shouldPauseBeforeConfirm?: boolean;
};

export const initialGameHelpFlowState: GameHelpFlowState = {
  isHelpVisible: false,
  shouldResumeOnClose: false,
};

export const initialGameMenuExitFlowState: GameMenuExitFlowState = {
  isAbandonDialogVisible: false,
  shouldResumeOnCancel: false,
};

export function openGameHelpFlow(
  state: GameHelpFlowState,
  isGameActive = false,
): GameHelpFlowTransition {
  if (state.isHelpVisible) {
    return { effect: null, state };
  }

  return {
    effect: isGameActive ? "pause" : null,
    state: {
      isHelpVisible: true,
      shouldResumeOnClose: isGameActive,
    },
  };
}

export function closeGameHelpFlow(state: GameHelpFlowState): GameHelpFlowTransition {
  return {
    effect: state.shouldResumeOnClose ? "resume" : null,
    state: {
      isHelpVisible: false,
      shouldResumeOnClose: false,
    },
  };
}

export function requestGameMenuExitFlow(
  state: GameMenuExitFlowState,
  {
    isDisabled = false,
    isGameStarted,
    shouldPauseBeforeConfirm = false,
  }: RequestGameMenuExitOptions,
): GameMenuExitFlowTransition {
  if (isDisabled || state.isAbandonDialogVisible) {
    return { effect: null, state };
  }

  if (!isGameStarted) {
    return {
      effect: "back",
      state,
    };
  }

  return {
    effect: shouldPauseBeforeConfirm ? "pause" : null,
    state: {
      isAbandonDialogVisible: true,
      shouldResumeOnCancel: shouldPauseBeforeConfirm,
    },
  };
}

export function cancelGameMenuExitFlow(
  state: GameMenuExitFlowState,
): GameMenuExitFlowTransition {
  return {
    effect: state.shouldResumeOnCancel ? "resume" : null,
    state: {
      isAbandonDialogVisible: false,
      shouldResumeOnCancel: false,
    },
  };
}

export function confirmGameMenuExitFlow(): GameMenuExitFlowTransition {
  return {
    effect: "back",
    state: {
      isAbandonDialogVisible: false,
      shouldResumeOnCancel: false,
    },
  };
}
