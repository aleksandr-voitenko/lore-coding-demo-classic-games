import "server-only";

import { NextResponse } from "next/server";

import { normalizeLeaderboardKey } from "@/lib/leaderboard";
import type {
  BaseGameReplayPayload,
  GameReplayPayloadParser,
} from "@/lib/game-replay";
import type {
  SaveReplayResult,
  SqliteReplayStore,
} from "@/lib/server/sqlite-replay-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";
import type { AuthenticatedUser } from "@/lib/user-profile";

export type UserSessionLookup = {
  getUserBySessionToken: (sessionToken: string | null) => Promise<AuthenticatedUser | null>;
};

type GameReplayRouteOptions<Payload extends BaseGameReplayPayload> = {
  gameId: Payload["gameId"];
  parsePayload: GameReplayPayloadParser<Payload>;
  replayLabel: string;
};

type ReplaySaveFailureReason = Extract<SaveReplayResult, { success: false }>["reason"];

function getReplaySaveErrorMessage(reason: ReplaySaveFailureReason, replayLabel: string) {
  if (reason === "run-user-mismatch") {
    return `${replayLabel} run belongs to another user.`;
  }

  if (reason === "run-seed-mismatch") {
    return `${replayLabel} seed does not match the issued run.`;
  }

  if (reason === "unsupported-game") {
    return `${replayLabel} game is not supported.`;
  }

  return `${replayLabel} run was not found.`;
}

export function createGameReplayRouteHandlers<Payload extends BaseGameReplayPayload>(
  replayStore: Pick<SqliteReplayStore, "getReplay" | "saveReplay">,
  userStore: UserSessionLookup,
  {
    gameId,
    parsePayload,
    replayLabel,
  }: GameReplayRouteOptions<Payload>,
) {
  return {
    async GET(request: Request) {
      const user = await userStore.getUserBySessionToken(getSessionTokenFromRequest(request));

      if (user === null) {
        return NextResponse.json({ error: "Sign in before downloading replays." }, { status: 401 });
      }

      const replay = await replayStore.getReplay(user, gameId, parsePayload);

      if (replay === null) {
        return NextResponse.json({ error: `No ${replayLabel} saved.` }, { status: 404 });
      }

      return NextResponse.json({ replay });
    },

    async POST(request: Request) {
      const user = await userStore.getUserBySessionToken(getSessionTokenFromRequest(request));

      if (user === null) {
        return NextResponse.json({ error: "Sign in before saving replays." }, { status: 401 });
      }

      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
      }

      const parsedReplay = parsePayload(payload);

      if (!parsedReplay.success) {
        return NextResponse.json({ error: parsedReplay.error }, { status: 400 });
      }

      if (normalizeLeaderboardKey(parsedReplay.payload.leaderboardKey) === null) {
        return NextResponse.json(
          { error: `${replayLabel} leaderboard key is not supported.` },
          { status: 400 },
        );
      }

      const saveResult = await replayStore.saveReplay(user, parsedReplay.payload);

      if (!saveResult.success) {
        return NextResponse.json(
          { error: getReplaySaveErrorMessage(saveResult.reason, replayLabel) },
          { status: saveResult.reason === "run-user-mismatch" ? 403 : 400 },
        );
      }

      return NextResponse.json({ saved: true }, { status: 201 });
    },
  };
}

export function createGameReplayRunRouteHandlers(
  replayStore: Pick<SqliteReplayStore, "createReplayRun">,
  userStore: UserSessionLookup | undefined,
  { gameId }: { gameId: string },
) {
  return {
    async POST(request: Request) {
      const user = userStore
        ? await userStore.getUserBySessionToken(getSessionTokenFromRequest(request))
        : null;
      const run = await replayStore.createReplayRun(gameId, user);

      return NextResponse.json(run, { status: 201 });
    },
  };
}
