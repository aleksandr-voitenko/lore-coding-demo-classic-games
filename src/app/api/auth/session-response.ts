import "server-only";

import { NextResponse } from "next/server";

import type { UserSession } from "@/lib/server/sqlite-user-profile-store";
import {
  USER_SESSION_COOKIE_MAX_AGE_SECONDS,
  USER_SESSION_COOKIE_NAME,
} from "@/lib/server/user-session-cookie";
import type { AuthenticatedUser, UserAuthFieldErrors } from "@/lib/user-profile";

export function createUserJson(user: AuthenticatedUser | null) {
  return { user };
}

export function createAuthErrorJson(error: string, fieldErrors?: UserAuthFieldErrors) {
  return {
    error,
    ...(fieldErrors === undefined ? {} : { fieldErrors }),
  };
}

export function createSessionResponse(session: UserSession, status: number) {
  const response = NextResponse.json(createUserJson(session.user), { status });

  response.cookies.set(USER_SESSION_COOKIE_NAME, session.sessionToken, {
    expires: new Date(session.expiresAt),
    httpOnly: true,
    maxAge: USER_SESSION_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
