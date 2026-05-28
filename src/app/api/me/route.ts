import { NextResponse } from "next/server";

import { normalizeUserDisplayName } from "@/lib/user-profile";
import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  getSessionTokenFromRequest,
  USER_SESSION_COOKIE_MAX_AGE_SECONDS,
  USER_SESSION_COOKIE_NAME,
} from "@/lib/server/user-session-cookie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function createUserJson(user: { displayName: string; id: string } | null) {
  return { user };
}

export function createCurrentUserRouteHandlers(store: SqliteUserProfileStore) {
  return {
    async DELETE(request: Request) {
      await store.deleteUserSession(getSessionTokenFromRequest(request));

      const response = NextResponse.json(createUserJson(null));
      response.cookies.set(USER_SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        maxAge: 0,
        path: "/",
        sameSite: "lax",
      });

      return response;
    },

    async GET(request: Request) {
      const user = await store.getUserBySessionToken(getSessionTokenFromRequest(request));

      return NextResponse.json(createUserJson(user));
    },

    async POST(request: Request) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
      }

      const displayName =
        typeof payload === "object" && payload !== null && "displayName" in payload
          ? normalizeUserDisplayName(payload.displayName)
          : "";

      if (displayName.length === 0) {
        return NextResponse.json({ error: "Display name is required." }, { status: 400 });
      }

      const session = await store.createUserSession(displayName);

      if (session === null) {
        return NextResponse.json({ error: "Display name is required." }, { status: 400 });
      }

      const response = NextResponse.json(createUserJson(session.user), { status: 201 });
      response.cookies.set(USER_SESSION_COOKIE_NAME, session.sessionToken, {
        expires: new Date(session.expiresAt),
        httpOnly: true,
        maxAge: USER_SESSION_COOKIE_MAX_AGE_SECONDS,
        path: "/",
        sameSite: "lax",
      });

      return response;
    },
  };
}

export async function DELETE(request: Request) {
  return createCurrentUserRouteHandlers(getUserProfileStore()).DELETE(request);
}

export async function GET(request: Request) {
  return createCurrentUserRouteHandlers(getUserProfileStore()).GET(request);
}

export async function POST(request: Request) {
  return createCurrentUserRouteHandlers(getUserProfileStore()).POST(request);
}
