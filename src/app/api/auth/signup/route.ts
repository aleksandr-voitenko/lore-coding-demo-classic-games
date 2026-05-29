import { NextResponse } from "next/server";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import {
  getUserPasswordValidationError,
  normalizeUserDisplayName,
  type UserAuthFieldErrors,
} from "@/lib/user-profile";

import { createAuthErrorJson, createSessionResponse } from "../session-response";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getSignupFieldErrors(payload: unknown): UserAuthFieldErrors {
  const displayName = isRecord(payload)
    ? normalizeUserDisplayName(payload.displayName)
    : "";
  const password = isRecord(payload) ? payload.password : undefined;
  const passwordConfirmation = isRecord(payload)
    ? payload.passwordConfirmation
    : undefined;
  const passwordError = getUserPasswordValidationError(password);

  return {
    ...(displayName.length === 0
      ? { displayName: "User name is required." }
      : {}),
    ...(passwordError === null ? {} : { password: passwordError }),
    ...(typeof passwordConfirmation !== "string" ||
    passwordConfirmation.length === 0
      ? { passwordConfirmation: "Repeat your password." }
      : {}),
    ...(typeof password === "string" &&
    typeof passwordConfirmation === "string" &&
    passwordConfirmation.length > 0 &&
    password !== passwordConfirmation
      ? { passwordConfirmation: "Passwords must match." }
      : {}),
  };
}

export function createSignupRouteHandlers(store: SqliteUserProfileStore) {
  return {
    async POST(request: Request) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          createAuthErrorJson("Request body must be valid JSON."),
          { status: 400 },
        );
      }

      const fieldErrors = getSignupFieldErrors(payload);

      if (Object.keys(fieldErrors).length > 0) {
        return NextResponse.json(
          createAuthErrorJson("Sign up details need attention.", fieldErrors),
          { status: 400 },
        );
      }

      const displayName = normalizeUserDisplayName(
        isRecord(payload) ? payload.displayName : "",
      );
      const password = isRecord(payload) && typeof payload.password === "string"
        ? payload.password
        : "";
      const result = await store.registerUser(displayName, password);

      if (!result.success && result.reason === "display-name-taken") {
        return NextResponse.json(
          createAuthErrorJson("User name is already taken.", {
            displayName: "User name is already taken.",
          }),
          { status: 409 },
        );
      }

      if (!result.success) {
        return NextResponse.json(
          createAuthErrorJson("Sign up details need attention."),
          { status: 400 },
        );
      }

      return createSessionResponse(result.session, 201);
    },
  };
}

export async function POST(request: Request) {
  return createSignupRouteHandlers(getUserProfileStore()).POST(request);
}
