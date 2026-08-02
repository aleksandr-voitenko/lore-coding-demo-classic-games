import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import { GAME_CATALOG } from "@/lib/game-catalog";
import { MULTIPLAYER_GAME_IDS } from "@/lib/multiplayer/game-registry";
import type { PrivateRoom } from "@/lib/multiplayer/room";
import type { SocialPartyInvitationAcceptance } from "@/lib/social-client";

import {
  GameLauncher,
  createLauncherPartyInvitationHandoff,
  createLauncherPrivateRoomSettings,
  getLauncherPrivateRoomCreateError,
  getLauncherPrivateRoomCodeFromSearch,
  isLauncherRoomCreateRequestCurrent,
} from "./game-launcher";
import { GAME_CARDS, createDefaultParameterValues } from "./game-launcher-config";
import { PLAYABLE_GAME_COMPONENTS } from "./game-launcher-playables";

const LAUNCHER_ARTWORK_SIZES =
  "(min-width: 1200px) 23.333rem, (min-width: 944px) calc(33.333vw - 1.667rem), (min-width: 640px) calc(50vw - 2rem), calc(100vw - 2rem)";

const ACCEPTED_PARTY_ROOM: PrivateRoom = {
  code: "PONG-1",
  hostParticipantId: "host-participant",
  matchId: 1,
  nextMatchParticipantIds: [],
  observerLimit: 2,
  participants: [
    {
      displayName: "Host",
      id: "host-participant",
      role: "host",
      userId: "user-host",
    },
    {
      displayName: "Friend",
      id: "friend-participant",
      role: "observer",
      userId: "user-friend",
    },
  ],
  seats: [
    {
      id: "left",
      label: "Left paddle",
      occupiedByParticipantId: "host-participant",
      required: true,
    },
    {
      id: "right",
      label: "Right paddle",
      occupiedByParticipantId: null,
      required: true,
    },
  ],
  settings: { gameId: "pong" },
  status: "lobby",
};

function createAcceptedPartyRoomForRole(
  role: "host" | "observer" | "player",
): PrivateRoom {
  if (role === "observer") {
    return ACCEPTED_PARTY_ROOM;
  }

  return {
    ...ACCEPTED_PARTY_ROOM,
    hostParticipantId:
      role === "host" ? "friend-participant" : "host-participant",
    participants: ACCEPTED_PARTY_ROOM.participants.map((participant) => {
      if (participant.id === "friend-participant") {
        return { ...participant, role };
      }

      return role === "host" ? { ...participant, role: "player" } : participant;
    }),
    seats: ACCEPTED_PARTY_ROOM.seats.map((seat) =>
      seat.id === "right"
        ? { ...seat, occupiedByParticipantId: "friend-participant" }
        : seat,
    ),
  };
}

function createPartyAcceptance(
  overrides: Partial<SocialPartyInvitationAcceptance> = {},
): SocialPartyInvitationAcceptance {
  return {
    admission: "admitted",
    invitation: {
      createdAt: "2026-08-03T00:00:00.000Z",
      expiresAt: "2026-08-03T00:05:00.000Z",
      id: "invitation-1",
      intent: "watch",
      inviter: { displayName: "Host", id: "user-host" },
      recipient: { displayName: "Friend", id: "user-friend" },
      resolvedAt: "2026-08-03T00:01:00.000Z",
      status: "accepted",
      updatedAt: "2026-08-03T00:01:00.000Z",
    },
    participantCapability: "friend-capability",
    participantId: "friend-participant",
    snapshot: {
      participant: ACCEPTED_PARTY_ROOM.participants[1],
      room: ACCEPTED_PARTY_ROOM,
      seq: 17,
    },
    ...overrides,
  };
}

const EXPECTED_PARAMETER_SELECTS = [
  {
    defaultLabel: "10 x 20",
    defaultValue: "10x20",
    label: "Board",
    testId: "tetris-board-size",
  },
  {
    defaultLabel: "1",
    defaultValue: "1",
    label: "Level",
    testId: "tetris-start-level",
  },
  {
    defaultLabel: "420 x 560",
    defaultValue: "420x560",
    label: "Board",
    testId: "breakout-board-size",
  },
  {
    defaultLabel: "3",
    defaultValue: "3",
    label: "Lives",
    testId: "breakout-lives",
  },
  {
    defaultLabel: "Easy",
    defaultValue: "easy",
    label: "Difficulty",
    testId: "minesweeper-difficulty",
  },
  {
    defaultLabel: "420 x 560",
    defaultValue: "420x560",
    label: "Board",
    testId: "space-invaders-board-size",
  },
  {
    defaultLabel: "50",
    defaultValue: "50",
    label: "Aliens",
    testId: "space-invaders-aliens",
  },
  {
    defaultLabel: "4 x 4",
    defaultValue: "4",
    label: "Board",
    testId: "twenty-forty-eight-board-size",
  },
  {
    defaultLabel: "2048",
    defaultValue: "2048",
    label: "Goal",
    testId: "twenty-forty-eight-goal",
  },
  {
    defaultLabel: "420 x 560",
    defaultValue: "420x560",
    label: "Board",
    testId: "pong-board-size",
  },
  {
    defaultLabel: "5",
    defaultValue: "5",
    label: "Target",
    testId: "pong-target",
  },
  {
    defaultLabel: "Medium",
    defaultValue: "medium",
    label: "Difficulty",
    testId: "simon-difficulty",
  },
  {
    defaultLabel: "Medium",
    defaultValue: "medium",
    label: "Difficulty",
    testId: "asteroids-difficulty",
  },
] as const;

describe("game launcher", () => {
  it("uses the shared game catalog ids and labels for launcher cards", () => {
    expect(GAME_CARDS.map(({ id, label }) => ({ id, label }))).toEqual(GAME_CATALOG);
  });

  it("keeps a lazy playable component for every launcher card", () => {
    expect(Object.keys(PLAYABLE_GAME_COMPONENTS).sort()).toEqual(
      GAME_CARDS.map((game) => game.id).sort(),
    );
  });

  it("offers Tank Patrol without launch parameters in both library tabs", () => {
    expect(GAME_CARDS.find((game) => game.id === "battle-city")).toMatchObject({
      description:
        "A classic tank campaign across 35 maps with destructible defenses, enemy waves, and a base to protect.",
      label: "Tank Patrol",
      parameters: [],
    });
    expect(MULTIPLAYER_GAME_IDS).toContain("battle-city");
  });

  it("splits the launcher into single-player and multiplayer tabs", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);
    const singlePlayerTabMarkup = getButtonMarkup(
      markup,
      "game-library-single-player-tab",
    );
    const multiplayerTabMarkup = getButtonMarkup(markup, "game-library-multiplayer-tab");

    expect(singlePlayerTabMarkup).toContain('aria-selected="true"');
    expect(singlePlayerTabMarkup).toContain('tabindex="0"');
    expect(singlePlayerTabMarkup).toContain("lucide-user");
    expect(singlePlayerTabMarkup).not.toContain("lucide-gamepad-2");
    expect(singlePlayerTabMarkup).toContain(">Single player<");
    expect(singlePlayerTabMarkup).toContain(">10<");
    expect(singlePlayerTabMarkup).toContain(">10 games<");
    expect(multiplayerTabMarkup).toContain('aria-selected="false"');
    expect(multiplayerTabMarkup).toContain('tabindex="-1"');
    expect(multiplayerTabMarkup).toContain("lucide-users");
    expect(multiplayerTabMarkup).toContain(">Multiplayer<");
    expect(multiplayerTabMarkup).toContain(">4<");
    expect(multiplayerTabMarkup).toContain(">4 games<");
    expect(markup).toContain('data-testid="game-library-single-player-panel"');
    expect(markup).toMatch(
      /<div(?=[^>]*data-testid="game-library-multiplayer-panel")(?=[^>]*hidden="")[^>]*>/,
    );
    expect(markup).not.toContain("single player games available");
    expect(markup).not.toContain("multiplayer games available");
  });

  it("renders only configurable card parameters on the launch screen", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    expect(markup).toContain('data-testid="game-menu"');
    expect(markup).toContain('data-testid="global-leaderboard-open-button"');
    expect(markup).toContain("Leaderboards");

    for (const parameter of EXPECTED_PARAMETER_SELECTS) {
      expect(markup).toContain('data-testid="' + parameter.testId + '"');
    }

    expect(markup).not.toContain('data-testid="snake-board-size"');
    expect(markup).not.toContain(">Mode<");
    expect(markup).not.toContain(">Records<");
    expect(markup).not.toContain(">Top 3<");
    expect(markup).not.toContain(">Pieces<");
    expect(markup).not.toContain(">Pads<");
    expect(markup).not.toContain('data-testid="minesweeper-board-size"');
    expect(markup).not.toContain('data-testid="minesweeper-mines"');
    expect(markup).not.toContain('data-testid="simon-target"');
  });

  it("matches responsive artwork widths to the launcher grid", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    expect(countOccurrences(markup, `sizes="${LAUNCHER_ARTWORK_SIZES}"`)).toBe(
      GAME_CARDS.length,
    );
  });

  it("preserves launcher parameter labels and defaults", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    for (const parameter of EXPECTED_PARAMETER_SELECTS) {
      const selectMarkup = getSelectMarkup(markup, parameter.testId);

      expect(markup).toContain(">" + parameter.label + "</label>");
      expect(selectMarkup).toContain(
        'value="' + parameter.defaultValue + '" selected="">' + parameter.defaultLabel,
      );
    }

    expect(getSelectMarkup(markup, "minesweeper-difficulty").match(/<option/g)).toHaveLength(3);
  });

  it("keeps private-room host controls out of launcher cards", () => {
    const markup = renderToStaticMarkup(<GameLauncher />);

    for (const gameId of MULTIPLAYER_GAME_IDS) {
      expect(markup).not.toContain(`data-testid="private-room-host-${gameId}-button"`);
      expect(markup).not.toContain(`data-testid="private-room-host-${gameId}-status"`);
    }

    expect(markup).not.toContain("Host room");
  });

  it("does not reintroduce host controls for signed-in users", () => {
    const markup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <GameLauncher />
      </CurrentUserProvider>,
    );

    for (const gameId of MULTIPLAYER_GAME_IDS) {
      expect(markup).not.toContain(`data-testid="private-room-host-${gameId}-button"`);
      expect(markup).not.toContain(`data-testid="private-room-host-${gameId}-status"`);
    }
    expect(markup).toContain('data-testid="social-center-trigger"');
  });

  it("shows Friends in a signed-in room header but not during replay gameplay", () => {
    const roomMarkup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <GameLauncher initialRoomCode="PONG-1" />
      </CurrentUserProvider>,
    );
    const replayMarkup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={{ displayName: "Ada", id: "user-1" }}>
        <GameLauncher initialReplayGameId="snake" />
      </CurrentUserProvider>,
    );

    expect(roomMarkup).toContain('data-testid="social-center-trigger"');
    expect(replayMarkup).not.toContain('data-testid="social-center-trigger"');
  });

  it("creates Space Invaders private-room settings from selected launcher parameters", () => {
    const spaceInvaders = GAME_CARDS.find((game) => game.id === "space-invaders");

    if (spaceInvaders === undefined) {
      throw new Error("Space Invaders launcher card is missing.");
    }

    const parameterValues = {
      ...createDefaultParameterValues(),
      "space-invaders-board-size": "480x640",
      "space-invaders-aliens": "24",
    };

    expect(createLauncherPrivateRoomSettings(spaceInvaders, parameterValues)).toEqual({
      gameId: "space-invaders",
      parameters: {
        "space-invaders-aliens": "24",
        "space-invaders-board-size": "480x640",
      },
    });
  });

  it("creates Asteroids private-room settings from selected launcher difficulty", () => {
    const asteroids = GAME_CARDS.find((game) => game.id === "asteroids");

    if (asteroids === undefined) {
      throw new Error("Asteroids launcher card is missing.");
    }

    const parameterValues = {
      ...createDefaultParameterValues(),
      "asteroids-difficulty": "hard",
    };

    expect(createLauncherPrivateRoomSettings(asteroids, parameterValues)).toEqual({
      gameId: "asteroids",
      parameters: {
        "asteroids-difficulty": "hard",
      },
    });
  });

  it("reads normalized and unsupported room codes from browser search params", () => {
    expect(getLauncherPrivateRoomCodeFromSearch("")).toBeNull();
    expect(getLauncherPrivateRoomCodeFromSearch("?room=pong-1")).toBe("PONG-1");
    expect(getLauncherPrivateRoomCodeFromSearch("?room=bad%20code")).toBe("bad code");
  });

  it("creates an account-scoped launcher handoff from accepted party credentials", () => {
    const handoff = createLauncherPartyInvitationHandoff(
      createPartyAcceptance({ admission: "reacquired" }),
      "user-friend",
      7,
    );

    expect(handoff).toMatchObject({
      activeRoomSession: {
        accountEpoch: 7,
        focusHeadingOnMount: true,
        game: null,
        joinOutcomeMessage:
          "You accepted Host's Watch invitation and initially joined as Watching.",
        participantCapability: "friend-capability",
        participantId: "friend-participant",
        room: ACCEPTED_PARTY_ROOM,
        roomCode: "PONG-1",
        seq: 17,
        userId: "user-friend",
      },
      credentials: {
        participantCapability: "friend-capability",
        participantId: "friend-participant",
        userId: "user-friend",
      },
      invitePath: "/?room=PONG-1",
    });
    expect(handoff.invitePath).not.toContain("friend-capability");
    expect(handoff.activeRoomSession.joinOutcomeMessage).not.toContain(
      "friend-capability",
    );
  });

  it("rejects room-create settlement after its account epoch changes", () => {
    const isAccountEpochCurrent = (candidate: number) => candidate === 8;

    expect(
      isLauncherRoomCreateRequestCurrent({
        currentGeneration: 12,
        isAccountEpochCurrent,
        requestAccountEpoch: 7,
        requestGeneration: 12,
      }),
    ).toBe(false);
    expect(
      isLauncherRoomCreateRequestCurrent({
        currentGeneration: 13,
        isAccountEpochCurrent,
        requestAccountEpoch: 8,
        requestGeneration: 12,
      }),
    ).toBe(false);
    expect(
      isLauncherRoomCreateRequestCurrent({
        currentGeneration: 12,
        isAccountEpochCurrent,
        requestAccountEpoch: 8,
        requestGeneration: 12,
      }),
    ).toBe(true);
    expect(
      getLauncherPrivateRoomCreateError(
        { accountEpoch: 7, message: "Account A could not create a room." },
        8,
      ),
    ).toBeNull();
    expect(
      getLauncherPrivateRoomCreateError(
        { accountEpoch: 8, message: "Account B could not create a room." },
        8,
      ),
    ).toBe("Account B could not create a room.");
  });

  it("describes Play fallback authoritatively and rejects another account's handoff", () => {
    const acceptance = createPartyAcceptance({
      invitation: {
        ...createPartyAcceptance().invitation,
        intent: "play",
      },
    });

    expect(
      createLauncherPartyInvitationHandoff(acceptance, "user-friend", 7)
        .activeRoomSession.joinOutcomeMessage,
    ).toBe(
      "You accepted Host's Play invitation and initially joined as Watching because no player spot was available. You can request the next match.",
    );
    expect(() =>
      createLauncherPartyInvitationHandoff(acceptance, "user-other", 8),
    ).toThrow("no longer matches the signed-in account");
    expect(() =>
      createLauncherPartyInvitationHandoff(acceptance, null, 8),
    ).toThrow("no longer matches the signed-in account");
    const playerRoom = createAcceptedPartyRoomForRole("player");
    const hostRoom = createAcceptedPartyRoomForRole("host");
    const reacquiredPlayer = createLauncherPartyInvitationHandoff(
      createPartyAcceptance({
        admission: "reacquired",
        snapshot: {
          participant: playerRoom.participants[1],
          room: playerRoom,
          seq: 17,
        },
      }),
      "user-friend",
      7,
    );
    const reacquiredHost = createLauncherPartyInvitationHandoff(
      createPartyAcceptance({
        admission: "reacquired",
        snapshot: {
          participant: hostRoom.participants[1],
          room: hostRoom,
          seq: 17,
        },
      }),
      "user-friend",
      7,
    );

    expect(reacquiredPlayer.activeRoomSession.joinOutcomeMessage).toBe(
      "You accepted Host's Watch invitation and joined as a player.",
    );
    expect(reacquiredHost.activeRoomSession.joinOutcomeMessage).toBe(
      "You accepted Host's Watch invitation and are now the party host.",
    );
    expect(() =>
      createLauncherPartyInvitationHandoff(
        createPartyAcceptance({
          snapshot: {
            participant: playerRoom.participants[1],
            room: playerRoom,
            seq: 17,
          },
        }),
        "user-friend",
        7,
      ),
    ).toThrow("unsupported role");
  });

  it("renders the room lobby instead of the launcher grid when a room code is present", () => {
    const markup = renderToStaticMarkup(<GameLauncher initialRoomCode="pong-1" />);

    expect(markup).toContain('data-testid="multiplayer-room-lobby"');
    expect(markup).toContain('data-testid="multiplayer-room-loading"');
    expect(markup).toContain("PONG-1");
    expect(markup).not.toContain('data-testid="game-menu"');
  });

  it("keeps unsupported room params in the lobby with a clear error", () => {
    const markup = renderToStaticMarkup(<GameLauncher initialRoomCode="bad code" />);

    expect(markup).toContain('data-testid="multiplayer-room-lobby"');
    expect(markup).toContain('data-testid="multiplayer-room-error"');
    expect(markup).toContain("Room code is not supported.");
    expect(markup).not.toContain('data-testid="game-menu"');
  });
});

function getSelectMarkup(markup: string, testId: string) {
  const selectMatch = markup.match(
    new RegExp('<select(?=[^>]*data-testid="' + testId + '")[\\s\\S]*?</select>'),
  );

  expect(selectMatch).not.toBeNull();

  return selectMatch?.[0] ?? "";
}

function getButtonMarkup(markup: string, testId: string) {
  const elementMatch = markup.match(
    new RegExp('<button(?=[^>]*data-testid="' + testId + '")[\\s\\S]*?</button>'),
  );

  expect(elementMatch).not.toBeNull();

  return elementMatch?.[0] ?? "";
}

function countOccurrences(value: string, substring: string) {
  return value.split(substring).length - 1;
}
