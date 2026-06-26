import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  PrivateRoomParticipant,
  PrivateRoomSeat,
} from "@/lib/multiplayer/room";

import { expectMarkup } from "./game-board-test-utils";
import {
  MultiplayerActiveRoomShell,
  getMultiplayerActiveRoomParticipantSeat,
} from "./multiplayer-active-room-shell";

const ACTIVE_PARTICIPANT = {
  displayName: "Ada",
  id: "host-participant",
  role: "host",
  userId: "user-1",
} satisfies PrivateRoomParticipant;

const OBSERVER_PARTICIPANT = {
  displayName: "Grace",
  id: "observer-participant",
  role: "observer",
  userId: null,
} satisfies PrivateRoomParticipant;

const ROOM_SEATS = [
  {
    id: "left",
    label: "Left Paddle",
    occupiedByParticipantId: "host-participant",
    required: true,
  },
  {
    id: "right",
    label: "Right Paddle",
    occupiedByParticipantId: null,
    required: true,
  },
] satisfies PrivateRoomSeat[];

describe("MultiplayerActiveRoomShell", () => {
  it("renders active room layout slots and a seated participant role", () => {
    const activeSeat = getMultiplayerActiveRoomParticipantSeat(
      ROOM_SEATS,
      ACTIVE_PARTICIPANT.id,
    );
    const markup = renderToStaticMarkup(
      <MultiplayerActiveRoomShell
        activeParticipant={ACTIVE_PARTICIPANT}
        activeSeat={activeSeat}
        board={<div data-testid="shared-board">Board</div>}
        boardFrameMaxWidth="32rem"
        boardFrameTestId="shared-board-frame"
        lifecycleControls={<div data-testid="shared-lifecycle-controls">Host</div>}
        readOnlyTestId="shared-readonly"
        roleLabelTestId="shared-role"
        rootTestId="shared-active-room"
        sidePanels={[
          {
            content: <div data-testid="shared-status-panel-content">Status</div>,
            id: "status",
            testId: "shared-status-panel",
          },
        ]}
      />,
    );

    expectMarkup(markup, [
      'data-testid="shared-active-room"',
      'data-testid="shared-board-frame"',
      'data-testid="shared-board"',
      'data-testid="shared-status-panel"',
      'data-testid="shared-status-panel-content"',
      'data-testid="shared-role"',
      "Ada · Left Paddle",
      'data-testid="shared-lifecycle-controls"',
      "max-width:32rem",
    ]);
    expect(markup).not.toContain('data-testid="shared-readonly"');
  });

  it("renders observer and guest read-only role states", () => {
    const observerMarkup = renderToStaticMarkup(
      <MultiplayerActiveRoomShell
        activeParticipant={OBSERVER_PARTICIPANT}
        activeSeat={null}
        board={<div />}
        readOnlyTestId="shared-readonly"
        roleLabelTestId="shared-role"
        rootTestId="shared-active-room"
      />,
    );
    const guestMarkup = renderToStaticMarkup(
      <MultiplayerActiveRoomShell
        activeParticipant={null}
        activeSeat={null}
        board={<div />}
        readOnlyTestId="shared-readonly"
        roleLabelTestId="shared-role"
        rootTestId="shared-active-room"
      />,
    );

    expectMarkup(observerMarkup, [
      "Grace · Observer",
      'data-testid="shared-readonly"',
      "Observer view",
    ]);
    expectMarkup(guestMarkup, [
      "Guest · Observer",
      'data-testid="shared-readonly"',
      "Watching read-only",
    ]);
  });

  it("selects the active participant seat from room seats", () => {
    expect(
      getMultiplayerActiveRoomParticipantSeat(
        ROOM_SEATS,
        ACTIVE_PARTICIPANT.id,
      ),
    ).toEqual(ROOM_SEATS[0]);
    expect(
      getMultiplayerActiveRoomParticipantSeat(
        ROOM_SEATS,
        OBSERVER_PARTICIPANT.id,
      ),
    ).toBeNull();
    expect(getMultiplayerActiveRoomParticipantSeat(ROOM_SEATS, null)).toBeNull();
  });
});
