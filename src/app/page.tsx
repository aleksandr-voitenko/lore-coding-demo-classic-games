import { GameLauncher } from "@/components/game-launcher";
import { CurrentUserProvider } from "@/hooks/use-current-user";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { USER_SESSION_COOKIE_NAME } from "@/lib/server/user-session-cookie";
import type { UserAuthMode } from "@/lib/user-profile";
import { cookies } from "next/headers";

import { getInitialReplayGameId, getInitialRoomCode } from "./home-search-params";

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
