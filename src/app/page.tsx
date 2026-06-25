import { GameLauncher } from "@/components/game-launcher";
import { CurrentUserProvider } from "@/hooks/use-current-user";
import { normalizePrivateRoomCode } from "@/lib/multiplayer/room";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { USER_SESSION_COOKIE_NAME } from "@/lib/server/user-session-cookie";
import type { UserAuthMode } from "@/lib/user-profile";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type HomeProps = {
  searchParams?: Promise<{
    auth?: string | string[];
    replay?: string | string[];
    room?: string | string[];
  }>;
};

type HomeSearchParams = {
  auth?: string | string[];
  replay?: string | string[];
  room?: string | string[];
};

function getInitialAuthMode(value: string | string[] | undefined): UserAuthMode | null {
  const authMode = Array.isArray(value) ? value[0] : value;

  return authMode === "login" || authMode === "signup" ? authMode : null;
}

export function getInitialReplayGameId(value: string | string[] | undefined) {
  const replayGameId = Array.isArray(value) ? value[0] : value;

  return replayGameId === "snake" ||
    replayGameId === "tetris" ||
    replayGameId === "breakout" ||
    replayGameId === "minesweeper" ||
    replayGameId === "pong" ||
    replayGameId === "simon" ||
    replayGameId === "space-invaders" ||
    replayGameId === "asteroids" ||
    replayGameId === "twenty-forty-eight"
    ? replayGameId
    : null;
}

export function getInitialRoomCode(value: string | string[] | undefined) {
  const roomCode = Array.isArray(value) ? value[0] : value;

  if (roomCode === undefined) {
    return null;
  }

  return normalizePrivateRoomCode(roomCode) ?? roomCode.trim();
}

export default async function Home({ searchParams }: HomeProps) {
  const searchParamsPromise: Promise<HomeSearchParams> =
    searchParams ?? Promise.resolve({});
  const [cookieStore, resolvedSearchParams] = await Promise.all([
    cookies(),
    searchParamsPromise,
  ]);
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value ?? null;
  const initialUser = await getUserProfileStore().getUserBySessionToken(sessionToken);
  const initialAuthMode = getInitialAuthMode(resolvedSearchParams.auth);
  const initialReplayGameId = getInitialReplayGameId(resolvedSearchParams.replay);
  const initialRoomCode = getInitialRoomCode(resolvedSearchParams.room);

  return (
    <CurrentUserProvider initialUser={initialUser}>
      <GameLauncher
        initialAuthMode={initialAuthMode}
        initialReplayGameId={initialReplayGameId}
        initialRoomCode={initialRoomCode}
      />
    </CurrentUserProvider>
  );
}
