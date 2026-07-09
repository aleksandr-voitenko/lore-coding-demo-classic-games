import "server-only";

import { NextResponse } from "next/server";

import type { SqliteUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { normalizeUserDisplayName } from "@/lib/user-profile";

import { createAuthErrorJson, createSessionResponse } from "../session-response";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createLoginRouteHandlers(store: SqliteUserProfileStore) {
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

      const displayName = isRecord(payload)
        ? normalizeUserDisplayName(payload.displayName)
        : "";
      const password = isRecord(payload) && typeof payload.password === "string"
        ? payload.password
        : "";
      const fieldErrors = {
        ...(displayName.length === 0
          ? { displayName: "User name is required." }
          : {}),
        ...(password.length === 0 ? { password: "Password is required." } : {}),
      };

      if (Object.keys(fieldErrors).length > 0) {
        return NextResponse.json(
          createAuthErrorJson("Log in details are incomplete.", fieldErrors),
          { status: 400 },
        );
      }

      const result = await store.authenticateUser(displayName, password);

      if (!result.success) {
        return NextResponse.json(
          createAuthErrorJson("User name or password is incorrect.", {
            password: "User name or password is incorrect.",
          }),
          { status: 401 },
        );
      }

      return createSessionResponse(result.session, 200);
    },
  };
}
