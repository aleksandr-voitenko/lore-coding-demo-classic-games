import { NextResponse } from "next/server";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  getSessionTokenFromRequest,
  shouldUseSecureUserSessionCookie,
  USER_SESSION_COOKIE_NAME,
} from "@/lib/server/user-session-cookie";

import { createUserJson } from "../auth/session-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
        secure: shouldUseSecureUserSessionCookie(),
      });

      return response;
    },

    async GET(request: Request) {
      const user = await store.getUserBySessionToken(getSessionTokenFromRequest(request));

      return NextResponse.json(createUserJson(user));
    },
  };
}

export async function DELETE(request: Request) {
  return createCurrentUserRouteHandlers(getUserProfileStore()).DELETE(request);
}

export async function GET(request: Request) {
  return createCurrentUserRouteHandlers(getUserProfileStore()).GET(request);
}
