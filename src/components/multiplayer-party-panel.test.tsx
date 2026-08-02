import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PrivateRoom } from "@/lib/multiplayer/room";

import { expectMarkup } from "./game-board-test-utils";
import {
  MultiplayerPartyPanel,
  getMultiplayerPartyPanelViewModel,
} from "./multiplayer-party-panel";

const BASE_ROOM = {
  code: "PARTY-1",
  hostParticipantId: "host",
  matchId: 2,
  nextMatchParticipantIds: [],
  observerLimit: 3,
  participants: [
    {
      displayName: "Ada",
      id: "host",
      role: "host",
      userId: "user-1",
    },
    {
      displayName: "Grace",
      id: "player",
      role: "player",
      userId: "user-2",
    },
    {
      displayName: "Lin",
      id: "watcher-1",
      role: "observer",
      userId: "user-3",
    },
    {
      displayName: "Katherine",
      id: "watcher-2",
      role: "observer",
      userId: null,
    },
  ],
  seats: [
    {
      id: "left",
      label: "Left Paddle",
      occupiedByParticipantId: "host",
      required: true,
    },
    {
      id: "right",
      label: "Right Paddle",
      occupiedByParticipantId: "player",
      required: true,
    },
  ],
  settings: {
    gameId: "pong",
  },
  status: "running",
} satisfies PrivateRoom;

function createPanel(room: PrivateRoom, activeParticipantId: string | null) {
  return (
    <MultiplayerPartyPanel
      activeParticipantId={activeParticipantId}
      onCancelNextMatch={vi.fn()}
      onJoinGame={vi.fn()}
      onJoinNextMatch={vi.fn()}
      onLeaveParty={vi.fn()}
      onWatchInstead={vi.fn()}
      room={room}
    />
  );
}

describe("getMultiplayerPartyPanelViewModel", () => {
  it("derives players and watchers from seats while keeping host ownership separate", () => {
    const watchingHostRoom = {
      ...BASE_ROOM,
      nextMatchParticipantIds: ["watcher-2", "host"],
      seats: [
        {
          ...BASE_ROOM.seats[0],
          occupiedByParticipantId: "player",
        },
        {
          ...BASE_ROOM.seats[1],
          occupiedByParticipantId: null,
        },
      ],
      status: "finished",
    } satisfies PrivateRoom;

    const model = getMultiplayerPartyPanelViewModel(watchingHostRoom, "host");

    expect(model.playerSlots).toEqual([
      {
        participant: {
          displayName: "Grace",
          id: "player",
          isCurrent: false,
          isHost: false,
        },
        seatId: "left",
        seatLabel: "Left Paddle",
        slotNumber: 1,
      },
      {
        participant: null,
        seatId: "right",
        seatLabel: "Right Paddle",
        slotNumber: 2,
      },
    ]);
    expect(model.watchers.map(({ id, isHost }) => ({ id, isHost }))).toEqual([
      { id: "host", isHost: true },
      { id: "watcher-1", isHost: false },
      { id: "watcher-2", isHost: false },
    ]);
    expect(
      model.nextMatchQueue.map(({ participant, position }) => ({
        id: participant.id,
        position,
      })),
    ).toEqual([
      { id: "watcher-2", position: 1 },
      { id: "host", position: 2 },
    ]);
    expect(model.activeQueuePosition).toBe(2);
    expect(model.membershipAction).toEqual({
      disabledReason: null,
      type: "cancel-next",
    });
  });

  it.each([
    {
      expected: { disabledReason: null, type: "join-next" },
      name: "offers an active watcher the next-match queue",
      participantId: "watcher-1",
      room: BASE_ROOM,
    },
    {
      expected: {
        disabledReason: null,
        seatId: "right",
        type: "join-game",
      },
      name: "offers an open between-match player slot",
      participantId: "watcher-1",
      room: {
        ...BASE_ROOM,
        seats: [
          BASE_ROOM.seats[0],
          { ...BASE_ROOM.seats[1], occupiedByParticipantId: null },
        ],
        status: "lobby",
      } satisfies PrivateRoom,
    },
    {
      expected: { disabledReason: null, type: "join-next" },
      name: "preserves queue priority when a between-match seat is open",
      participantId: "watcher-1",
      room: {
        ...BASE_ROOM,
        nextMatchParticipantIds: ["watcher-2"],
        seats: [
          BASE_ROOM.seats[0],
          { ...BASE_ROOM.seats[1], occupiedByParticipantId: null },
        ],
        status: "finished",
      } satisfies PrivateRoom,
    },
    {
      expected: {
        disabledReason: null,
        seatId: "left",
        type: "watch-instead",
      },
      name: "lets a player watch instead between matches",
      participantId: "host",
      room: { ...BASE_ROOM, status: "finished" } satisfies PrivateRoom,
    },
    {
      expected: null,
      name: "does not let a player abandon a running seat",
      participantId: "host",
      room: BASE_ROOM,
    },
  ])("$name", ({ expected, participantId, room }) => {
    expect(
      getMultiplayerPartyPanelViewModel(room, participantId).membershipAction,
    ).toEqual(expected);
  });

  it("disables switching to watch when the observer limit is full", () => {
    const watcherFullRoom = {
      ...BASE_ROOM,
      observerLimit: 2,
      status: "lobby",
    } satisfies PrivateRoom;

    expect(
      getMultiplayerPartyPanelViewModel(watcherFullRoom, "host")
        .membershipAction,
    ).toEqual({
      disabledReason: "Watching is full (2 of 2).",
      seatId: "left",
      type: "watch-instead",
    });
  });
});

describe("MultiplayerPartyPanel", () => {
  it("renders semantic roster sections, queue order, and a watching host badge", () => {
    const room = {
      ...BASE_ROOM,
      nextMatchParticipantIds: ["watcher-2", "host"],
      seats: [
        {
          ...BASE_ROOM.seats[0],
          occupiedByParticipantId: "player",
        },
        {
          ...BASE_ROOM.seats[1],
          occupiedByParticipantId: null,
        },
      ],
      status: "finished",
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(createPanel(room, "host"));

    expectMarkup(markup, [
      'data-testid="multiplayer-party-panel"',
      ">Players</h3>",
      'data-testid="multiplayer-party-player-1"',
      "Player 1",
      "Grace",
      'data-testid="multiplayer-party-player-2"',
      "Open",
      ">Watching</h3>",
      'data-testid="multiplayer-party-watcher-count"',
      'aria-label="3 of 3 watcher places used"',
      'data-testid="multiplayer-party-watcher-host"',
      "Host",
      ">Next match</h3>",
      'data-testid="multiplayer-party-next-match"',
      'data-testid="multiplayer-party-next-watcher-2"',
      'value="1"',
      'data-testid="multiplayer-party-next-host"',
      'value="2"',
      'data-testid="multiplayer-party-queue-position"',
      'role="status"',
      "Waiting for next match · Position 2",
      "Ada · Watching · Host",
      'data-testid="multiplayer-party-cancel-next-button"',
      "Cancel request",
      'data-testid="multiplayer-party-leave-button"',
    ]);
    expect(markup.indexOf("Katherine")).toBeLessThan(markup.lastIndexOf("Ada"));
  });

  it("renders empty states without membership actions for a visitor", () => {
    const room = {
      ...BASE_ROOM,
      participants: BASE_ROOM.participants.slice(0, 2),
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(createPanel(room, null));

    expectMarkup(markup, [
      'data-testid="multiplayer-party-watchers-empty"',
      "No one watching.",
      'data-testid="multiplayer-party-next-match-empty"',
      "No one waiting.",
    ]);
    expect(markup).not.toContain('data-testid="multiplayer-party-actions"');
    expect(markup).not.toContain('data-testid="multiplayer-party-leave-button"');
  });

  it.each([
    {
      activeParticipantId: "watcher-1",
      buttonTestId: "multiplayer-party-join-next-button",
      label: "Join next match",
      room: BASE_ROOM,
    },
    {
      activeParticipantId: "watcher-1",
      buttonTestId: "multiplayer-party-join-game-button",
      label: "Join game",
      room: {
        ...BASE_ROOM,
        seats: [
          BASE_ROOM.seats[0],
          { ...BASE_ROOM.seats[1], occupiedByParticipantId: null },
        ],
        status: "finished",
      } satisfies PrivateRoom,
    },
    {
      activeParticipantId: "host",
      buttonTestId: "multiplayer-party-watch-instead-button",
      label: "Watch instead",
      room: { ...BASE_ROOM, status: "lobby" } satisfies PrivateRoom,
    },
  ])("renders the $label action when status permits it", ({
    activeParticipantId,
    buttonTestId,
    label,
    room,
  }) => {
    const markup = renderToStaticMarkup(createPanel(room, activeParticipantId));

    expectMarkup(markup, [`data-testid="${buttonTestId}"`, `>${label}</button>`]);
  });

  it("describes and disables a capacity-blocked action", () => {
    const room = {
      ...BASE_ROOM,
      observerLimit: 2,
      status: "lobby",
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(createPanel(room, "host"));

    expectMarkup(markup, [
      'data-testid="multiplayer-party-action-description"',
      "Watching is full (2 of 2).",
      'data-testid="multiplayer-party-watch-instead-button"',
      "disabled=\"\"",
      "aria-describedby=",
    ]);
  });

  it("associates disabled party actions with the live connection status", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerPartyPanel
        activeParticipantId="watcher-1"
        actionsDisabled
        actionsDisabledDescriptionId="room-connection-status"
        onCancelNextMatch={vi.fn()}
        onJoinGame={vi.fn()}
        onJoinNextMatch={vi.fn()}
        onLeaveParty={vi.fn()}
        onWatchInstead={vi.fn()}
        room={BASE_ROOM}
      />,
    );

    expect(markup.match(/aria-describedby="room-connection-status"/g)).toHaveLength(
      2,
    );
    expect(markup.match(/\sdisabled=""/g)).toHaveLength(2);
  });

  it("renders Join next match instead of Join game behind an existing queue", () => {
    const room = {
      ...BASE_ROOM,
      nextMatchParticipantIds: ["watcher-2"],
      seats: [
        BASE_ROOM.seats[0],
        { ...BASE_ROOM.seats[1], occupiedByParticipantId: null },
      ],
      status: "finished",
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(createPanel(room, "watcher-1"));

    expectMarkup(markup, [
      'data-testid="multiplayer-party-next-watcher-2"',
      'value="1"',
      'data-testid="multiplayer-party-join-next-button"',
      "Join next match",
    ]);
    expect(markup).not.toContain(
      'data-testid="multiplayer-party-join-game-button"',
    );
  });
});
