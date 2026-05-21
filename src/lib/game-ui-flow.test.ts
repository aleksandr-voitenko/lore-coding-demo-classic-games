import { describe, expect, it } from "vitest";

import {
  cancelGameMenuExitFlow,
  closeGameHelpFlow,
  confirmGameMenuExitFlow,
  initialGameHelpFlowState,
  initialGameMenuExitFlowState,
  openGameHelpFlow,
  requestGameMenuExitFlow,
  type GameHelpFlowState,
  type GameMenuExitFlowState,
} from "./game-ui-flow";

describe("game help flow", () => {
  it("opens help without pausing when the game is inactive", () => {
    expect(openGameHelpFlow(initialGameHelpFlowState, false)).toEqual({
      effect: null,
      state: {
        isHelpVisible: true,
        shouldResumeOnClose: false,
      },
    });
  });

  it("pauses active games on open and resumes only when the help flow caused the pause", () => {
    const opened = openGameHelpFlow(initialGameHelpFlowState, true);
    const closed = closeGameHelpFlow(opened.state);

    expect(opened).toEqual({
      effect: "pause",
      state: {
        isHelpVisible: true,
        shouldResumeOnClose: true,
      },
    });
    expect(closed).toEqual({
      effect: "resume",
      state: initialGameHelpFlowState,
    });
  });

  it("ignores duplicate open requests while help is already visible", () => {
    const visibleState: GameHelpFlowState = {
      isHelpVisible: true,
      shouldResumeOnClose: true,
    };

    expect(openGameHelpFlow(visibleState, true)).toEqual({
      effect: null,
      state: visibleState,
    });
  });
});

describe("game menu exit flow", () => {
  it("returns directly to the menu for games that have not started", () => {
    expect(
      requestGameMenuExitFlow(initialGameMenuExitFlowState, {
        isGameStarted: false,
        shouldPauseBeforeConfirm: true,
      }),
    ).toEqual({
      effect: "back",
      state: initialGameMenuExitFlowState,
    });
  });

  it("opens the abandon dialog for started games without pausing turn-based games", () => {
    expect(
      requestGameMenuExitFlow(initialGameMenuExitFlowState, {
        isGameStarted: true,
      }),
    ).toEqual({
      effect: null,
      state: {
        isAbandonDialogVisible: true,
        shouldResumeOnCancel: false,
      },
    });
  });

  it("pauses realtime games before confirm and resumes on cancel", () => {
    const requested = requestGameMenuExitFlow(initialGameMenuExitFlowState, {
      isGameStarted: true,
      shouldPauseBeforeConfirm: true,
    });
    const canceled = cancelGameMenuExitFlow(requested.state);

    expect(requested).toEqual({
      effect: "pause",
      state: {
        isAbandonDialogVisible: true,
        shouldResumeOnCancel: true,
      },
    });
    expect(canceled).toEqual({
      effect: "resume",
      state: initialGameMenuExitFlowState,
    });
  });

  it("confirms abandon by closing dialog and returning to the menu without resuming", () => {
    expect(confirmGameMenuExitFlow()).toEqual({
      effect: "back",
      state: initialGameMenuExitFlowState,
    });
  });

  it("ignores disabled requests and duplicate requests while the dialog is visible", () => {
    const dialogState: GameMenuExitFlowState = {
      isAbandonDialogVisible: true,
      shouldResumeOnCancel: true,
    };

    expect(
      requestGameMenuExitFlow(initialGameMenuExitFlowState, {
        isDisabled: true,
        isGameStarted: true,
        shouldPauseBeforeConfirm: true,
      }),
    ).toEqual({
      effect: null,
      state: initialGameMenuExitFlowState,
    });
    expect(
      requestGameMenuExitFlow(dialogState, {
        isGameStarted: true,
        shouldPauseBeforeConfirm: true,
      }),
    ).toEqual({
      effect: null,
      state: dialogState,
    });
  });
});
