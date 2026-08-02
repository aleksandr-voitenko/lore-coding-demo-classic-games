import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import { MULTIPLAYER_GAME_IDS } from "@/lib/multiplayer/game-registry";
import type { PrivateRoom } from "@/lib/multiplayer/room";
import type { MultiplayerRoomGameSnapshot } from "@/lib/multiplayer/protocol";
import {
  createInitialPongGame,
  startPongGame,
} from "@/lib/pong-game-engine";
import type { PongMultiplayerGameSnapshot } from "@/lib/pong-multiplayer";

import { getMultiplayerRoomGameRenderer } from "./multiplayer-room-game-registry";
import {
  MultiplayerRoomLobby,
  getMultiplayerRoomConnectionErrorState,
  getPrivateRoomShareLink,
  selectFreshMultiplayerRoomSnapshot,
} from "./multiplayer-room-lobby";
import { MultiplayerRoomTransportError } from "./multiplayer-room-transport";
import type { SocialPartyInviteControlsProps } from "./social-party-invite-controls";

const PONG_ROOM: PrivateRoom = {
  code: "PONG-1",
  hostParticipantId: "host-participant",
  matchId: 1,
  nextMatchParticipantIds: [],
  observerLimit: 8,
  participants: [
    {
      displayName: "Ada",
      id: "host-participant",
      role: "host",
      userId: "user-1",
    },
    {
      displayName: "Grace",
      id: "guest-participant",
      role: "observer",
      userId: null,
    },
  ],
  seats: [
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
  ],
  settings: {
    gameId: "pong",
    parameters: {
      "pong-board-size": "420x560",
      "pong-target": "5",
    },
  },
  status: "lobby",
};

const ACTIVE_PONG_ROOM: PrivateRoom = {
  ...PONG_ROOM,
  participants: PONG_ROOM.participants.map((participant) =>
    participant.id === "guest-participant"
      ? {
          ...participant,
          role: "player",
        }
      : participant,
  ),
  seats: PONG_ROOM.seats.map((seat) =>
    seat.id === "right"
      ? {
          ...seat,
          occupiedByParticipantId: "guest-participant",
        }
      : seat,
  ),
  status: "running",
};

const ACTIVE_SNAKE_ROOM: PrivateRoom = {
  ...ACTIVE_PONG_ROOM,
  settings: {
    gameId: "snake",
  },
};

const RUNNING_PONG_GAME = {
  gameId: "pong",
  heldInputs: {},
  matchId: 1,
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: startPongGame(createInitialPongGame()),
} satisfies PongMultiplayerGameSnapshot;

const RUNNING_SNAKE_GAME = {
  gameId: "snake",
  matchId: 1,
  seq: 1,
  serverTimeMs: 1_000,
  snapshot: {},
} satisfies MultiplayerRoomGameSnapshot<"snake", Record<string, never>>;

function TestSocialPartyInviteControls({
  room,
}: SocialPartyInviteControlsProps) {
  return (
    <section data-testid="test-social-party-invite-controls">
      Invite friends to {room.settings.gameId}
    </section>
  );
}

function getTestElementOpeningTag(markup: string, testId: string) {
  const match = markup.match(
    new RegExp(`<[^>]+data-testid="${testId}"[^>]*>`),
  );

  expect(match).not.toBeNull();

  return match![0];
}

function expectTestButtonDisabled(
  markup: string,
  testId: string,
  expected: boolean,
) {
  expect(
    /\sdisabled=""/.test(getTestElementOpeningTag(markup, testId)),
  ).toBe(expected);
}

describe("multiplayer room lobby", () => {
  it("renders loaded room details, the party roster, and host controls", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialParticipantId="host-participant"
          initialRoom={PONG_ROOM}
          initialRoomCode="PONG-1"
          onBackToLibrary={vi.fn()}
          socialCenterTrigger={
            <button data-testid="social-center-trigger" type="button">
              Friends
            </button>
          }
          socialPartyInviteControls={TestSocialPartyInviteControls}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="multiplayer-room-lobby"');
    const roomHeading = getTestElementOpeningTag(
      markup,
      "multiplayer-room-heading",
    );

    expect(roomHeading).toContain('tabindex="-1"');
    expect(roomHeading).toContain("focus:ring-3");
    expect(markup).toContain('data-testid="multiplayer-room-game"');
    expect(markup).toContain("Pong");
    expect(markup).toContain('data-testid="multiplayer-room-status"');
    expect(markup).toContain("Lobby");
    expect(markup).toContain("/?room=PONG-1");
    expect(markup).toContain("420 x 560");
    expect(markup).toContain('data-testid="multiplayer-room-seat-left"');
    expect(markup).toContain('data-testid="multiplayer-party-panel"');
    expect(markup).toContain('data-testid="multiplayer-party-player-1"');
    expect(markup).toContain('data-testid="multiplayer-party-watcher-guest-participant"');
    expect(markup).toContain('data-testid="multiplayer-party-watch-instead-button"');
    expect(markup).toContain('data-testid="multiplayer-party-leave-button"');
    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
    expect(markup).toContain('data-testid="multiplayer-room-start-button"');
    expect(markup).toContain('data-testid="multiplayer-room-next-game-select"');
    expect(markup).toContain('data-testid="multiplayer-room-replace-match-button"');
    expect(markup).toContain('data-testid="social-center-trigger"');
    expect(markup).toContain(
      'data-testid="test-social-party-invite-controls"',
    );
    expect(markup).toContain("Private Party");
  });

  it("uses the requested room code for invite copy even before matching room data arrives", () => {
    const staleRoom = {
      ...PONG_ROOM,
      code: "OLDROOM1",
    };
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialParticipantId="host-participant"
          initialRoom={staleRoom}
          initialRoomCode="44FE068B"
          onBackToLibrary={vi.fn()}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain("/?room=44FE068B");
    expect(markup).not.toContain("/?room=OLDROOM1");
  });

  it("renders the guest display-name join form before the visitor has a participant", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialRoom={PONG_ROOM}
        initialRoomCode="PONG-1"
        onBackToLibrary={vi.fn()}
        socialPartyInviteControls={TestSocialPartyInviteControls}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-join-form"');
    expect(markup).toContain('data-testid="multiplayer-room-display-name-input"');
    expect(markup).toContain('data-testid="multiplayer-room-join-button"');
    expect(markup).toContain('data-testid="multiplayer-room-watch-button"');
    expect(markup).toContain("Join game");
    expect(markup).toContain('data-testid="multiplayer-party-panel"');
    expect(markup).not.toContain('data-testid="multiplayer-room-host-controls"');
    expect(markup).not.toContain(
      'data-testid="test-social-party-invite-controls"',
    );
  });

  it("keeps friend invitation controls hidden from a signed-in non-host member", () => {
    const memberRoom = {
      ...PONG_ROOM,
      participants: PONG_ROOM.participants.map((participant) =>
        participant.id === "guest-participant"
          ? { ...participant, userId: "user-2" }
          : participant,
      ),
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(
      <CurrentUserProvider
        initialUser={{ displayName: "Grace", id: "user-2" }}
      >
        <MultiplayerRoomLobby
          initialParticipantId="guest-participant"
          initialRoom={memberRoom}
          initialRoomCode="PONG-1"
          onBackToLibrary={vi.fn()}
          socialPartyInviteControls={TestSocialPartyInviteControls}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="multiplayer-party-panel"');
    expect(markup).not.toContain(
      'data-testid="test-social-party-invite-controls"',
    );
  });

  it("explains the open player slot while live actions wait for the room stream", () => {
    const room = {
      ...PONG_ROOM,
      observerLimit: 1,
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialRoom={room}
        initialRoomCode="PONG-1"
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-watcher-limit"');
    expect(markup).toContain(
      "Watching is full, but you can join the open player slot.",
    );
    expect(markup).toMatch(
      /aria-describedby="[^"]+" data-testid="multiplayer-room-join-button"/,
    );
    expect(markup).toMatch(
      /aria-describedby="[^"]+" data-testid="multiplayer-room-watch-button"/,
    );
    expect(markup).toContain('id="multiplayer-room-connection-status"');
    expect(markup).toContain("Preparing the live party connection.");
    expectTestButtonDisabled(markup, "multiplayer-room-join-button", true);
    expectTestButtonDisabled(markup, "multiplayer-room-watch-button", true);
  });

  it("does not let a new guest bypass a full watcher queue for an open next-match slot", () => {
    const room = {
      ...PONG_ROOM,
      nextMatchParticipantIds: ["guest-participant"],
      observerLimit: 1,
      status: "finished",
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialRoom={room}
        initialRoomCode="PONG-1"
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-party-next-guest-participant"');
    expect(markup).toContain('data-testid="multiplayer-room-watcher-limit"');
    expect(markup).toContain(
      "Watching is full and the open slot is reserved for the next player in line.",
    );
    expectTestButtonDisabled(markup, "multiplayer-room-join-button", true);
    expectTestButtonDisabled(markup, "multiplayer-room-watch-button", true);
  });

  it("shows the active watcher roster while full capacity blocks another guest", () => {
    const watcher = {
      displayName: "Lin",
      id: "watcher-participant",
      role: "observer" as const,
      userId: null,
    };
    const room = {
      ...ACTIVE_PONG_ROOM,
      observerLimit: 1,
      participants: [...ACTIVE_PONG_ROOM.participants, watcher],
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialGame={RUNNING_PONG_GAME}
        initialRoom={room}
        initialRoomCode="PONG-1"
        initialSeq={4}
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-room-active-party-panel"');
    expect(markup).toContain(
      'data-testid="multiplayer-party-watcher-watcher-participant"',
    );
    expect(markup).toContain('aria-label="1 of 1 watcher places used"');
    expectTestButtonDisabled(markup, "multiplayer-room-join-button", true);
    expectTestButtonDisabled(markup, "multiplayer-room-watch-button", true);
  });

  it("keeps a watcher and their queue controls visible after the match finishes", () => {
    const watcher = {
      displayName: "Lin",
      id: "watcher-participant",
      role: "observer" as const,
      userId: null,
    };
    const room = {
      ...ACTIVE_PONG_ROOM,
      nextMatchParticipantIds: [watcher.id],
      participants: [...ACTIVE_PONG_ROOM.participants, watcher],
      status: "finished",
    } satisfies PrivateRoom;
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialGame={RUNNING_PONG_GAME}
        initialParticipantId={watcher.id}
        initialRoom={room}
        initialRoomCode="PONG-1"
        initialSeq={5}
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="pong-multiplayer-room"');
    expect(markup).toContain('data-testid="multiplayer-room-active-party-panel"');
    expect(markup).toContain(
      'data-testid="multiplayer-party-watcher-watcher-participant"',
    );
    expect(markup).toContain(
      'data-testid="multiplayer-party-next-watcher-participant"',
    );
    expect(markup).toContain(
      "Waiting for next match · Position 1",
    );
    expect(markup).toContain(
      'data-testid="multiplayer-party-cancel-next-button"',
    );
    expect(markup).toContain('data-testid="multiplayer-party-leave-button"');
  });

  it("keeps lobby UI for lobby rooms even when no game snapshot exists", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialParticipantId="host-participant"
        initialRoom={PONG_ROOM}
        initialRoomCode="PONG-1"
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="multiplayer-party-players"');
    expect(markup).not.toContain('data-testid="pong-multiplayer-room"');
  });

  it("renders active Pong rooms through the multiplayer Pong surface", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialGame={RUNNING_PONG_GAME}
          initialParticipantId="host-participant"
          initialRoom={ACTIVE_PONG_ROOM}
          initialRoomCode="PONG-1"
          initialSeq={4}
          onBackToLibrary={vi.fn()}
          socialPartyInviteControls={TestSocialPartyInviteControls}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="pong-multiplayer-room"');
    expect(markup).toContain('data-testid="pong-board"');
    expect(markup).toContain('data-testid="pong-multiplayer-score-left"');
    expect(markup).toContain("Ada · Left Paddle");
    expect(markup).toContain('data-testid="multiplayer-room-host-controls"');
    expect(markup).toContain('data-testid="multiplayer-party-panel"');
    expect(markup).toContain(
      'data-testid="test-social-party-invite-controls"',
    );
  });

  it("renders the authoritative accepted-invitation outcome", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider
        initialUser={{ displayName: "Grace", id: "user-2" }}
      >
        <MultiplayerRoomLobby
          initialJoinOutcomeMessage="You accepted Ada's Watch invitation and joined as Watching."
          initialParticipantId="guest-participant"
          initialRoom={PONG_ROOM}
          initialRoomCode="PONG-1"
          onBackToLibrary={vi.fn()}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="multiplayer-room-join-outcome"');
    expect(markup).toContain(
      "You accepted Ada&#x27;s Watch invitation and joined as Watching.",
    );
  });

  it("keeps Join game and Watch available beside an active match", () => {
    const markup = renderToStaticMarkup(
      <MultiplayerRoomLobby
        initialGame={RUNNING_PONG_GAME}
        initialRoom={ACTIVE_PONG_ROOM}
        initialRoomCode="PONG-1"
        initialSeq={4}
        onBackToLibrary={vi.fn()}
      />,
    );

    expect(markup).toContain('data-testid="pong-multiplayer-room"');
    expect(markup).toContain('data-testid="multiplayer-room-active-party-panel"');
    expect(markup).toContain('data-testid="multiplayer-room-join-form"');
    expect(markup).toContain('data-testid="multiplayer-room-join-button"');
    expect(markup).toContain('data-testid="multiplayer-room-watch-button"');
    expect(markup).toContain(">Players</h3>");
    expect(markup).toContain(">Watching</h3>");
    expect(markup).toContain(">Next match</h3>");
  });

  it("selects registered active game renderers only when room and snapshot game ids match", () => {
    for (const gameId of MULTIPLAYER_GAME_IDS) {
      const room = {
        ...ACTIVE_PONG_ROOM,
        settings: { gameId },
      } satisfies PrivateRoom;
      const game = {
        gameId,
        matchId: 1,
        seq: 1,
        serverTimeMs: 1_000,
        snapshot: {},
      } satisfies MultiplayerRoomGameSnapshot;

      expect(getMultiplayerRoomGameRenderer(room, game)?.gameId).toBe(gameId);
    }

    expect(getMultiplayerRoomGameRenderer(ACTIVE_PONG_ROOM, null)).toBeNull();
    expect(
      getMultiplayerRoomGameRenderer(ACTIVE_PONG_ROOM, RUNNING_SNAKE_GAME),
    ).toBeNull();
    expect(
      getMultiplayerRoomGameRenderer(ACTIVE_SNAKE_ROOM, RUNNING_SNAKE_GAME),
    ).toBeNull();
    expect(
      getMultiplayerRoomGameRenderer(ACTIVE_PONG_ROOM, {
        ...RUNNING_PONG_GAME,
        matchId: 2,
      }),
    ).toBeNull();
  });

  it("keeps the generic room shell for active rooms without a registered renderer", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <MultiplayerRoomLobby
          initialGame={RUNNING_SNAKE_GAME}
          initialParticipantId="host-participant"
          initialRoom={ACTIVE_SNAKE_ROOM}
          initialRoomCode="PONG-1"
          initialSeq={4}
          onBackToLibrary={vi.fn()}
        />
      </CurrentUserProvider>,
    );

    expect(markup).toContain('data-testid="multiplayer-room-game"');
    expect(markup).toContain("Snake");
    expect(markup).toContain('data-testid="multiplayer-party-panel"');
    expect(markup).not.toContain('data-testid="pong-multiplayer-room"');
  });

  it("marks missing rooms as abandoned after unrecoverable stream bootstrap rejection", () => {
    expect(
      getMultiplayerRoomConnectionErrorState(
        new MultiplayerRoomTransportError("Room has expired.", {
          code: "room-expired",
        }),
      ),
    ).toEqual({
      abandonRoom: true,
      message:
        "This room expired after being inactive. Start or join a new room.",
    });

    expect(
      getMultiplayerRoomConnectionErrorState(
        new MultiplayerRoomTransportError("Room was not found.", {
          code: "room-not-found",
        }),
      ),
    ).toEqual({
      abandonRoom: true,
      message:
        "Room connection lost. This room is no longer available, so the in-progress game cannot continue. Start or join a new room.",
    });

    expect(
      getMultiplayerRoomConnectionErrorState(
        new MultiplayerRoomTransportError("Room stream connection failed."),
      ),
    ).toEqual({
      abandonRoom: false,
      message: "Room stream connection failed.",
    });
  });

  it("builds full private-room share links when a browser origin is available", () => {
    expect(getPrivateRoomShareLink("44fe068b", "http://localhost:3000")).toBe(
      "http://localhost:3000/?room=44FE068B",
    );
    expect(getPrivateRoomShareLink("44FE068B", null)).toBe("/?room=44FE068B");
    expect(getPrivateRoomShareLink("44FE068B", "not a url")).toBe("/?room=44FE068B");
  });

  it("keeps fresher room and game sequence snapshots", () => {
    const current = {
      game: RUNNING_PONG_GAME,
      room: ACTIVE_PONG_ROOM,
      seq: 4,
    };
    const staleRoom = {
      game: {
        ...RUNNING_PONG_GAME,
        seq: RUNNING_PONG_GAME.seq + 1,
      },
      room: ACTIVE_PONG_ROOM,
      seq: 3,
    };
    const fresherGame = {
      game: {
        ...RUNNING_PONG_GAME,
        seq: RUNNING_PONG_GAME.seq + 1,
      },
      room: ACTIVE_PONG_ROOM,
      seq: 4,
    };

    expect(selectFreshMultiplayerRoomSnapshot(current, staleRoom)).toBe(current);
    expect(selectFreshMultiplayerRoomSnapshot(current, fresherGame)).toBe(fresherGame);

    const nextMatch = {
      game: {
        ...RUNNING_PONG_GAME,
        matchId: 2,
        seq: 1,
      },
      room: {
        ...ACTIVE_PONG_ROOM,
        matchId: 2,
      },
      seq: 5,
    };
    const conflictingGeneration = {
      game: {
        ...RUNNING_PONG_GAME,
        matchId: 2,
        seq: RUNNING_PONG_GAME.seq + 10,
      },
      room: {
        ...ACTIVE_PONG_ROOM,
        matchId: 2,
      },
      seq: 4,
    };

    expect(selectFreshMultiplayerRoomSnapshot(current, nextMatch)).toBe(nextMatch);
    expect(
      selectFreshMultiplayerRoomSnapshot(current, conflictingGeneration),
    ).toBe(current);
  });

});
