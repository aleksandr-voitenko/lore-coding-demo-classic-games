import { GameLauncher } from "@/components/game-launcher";
import { CurrentUserProvider } from "@/hooks/use-current-user";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { USER_SESSION_COOKIE_NAME } from "@/lib/server/user-session-cookie";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Home() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value ?? null;
  const initialUser = await getUserProfileStore().getUserBySessionToken(sessionToken);

  return (
    <CurrentUserProvider initialUser={initialUser}>
      <GameLauncher />
    </CurrentUserProvider>
  );
}
