import { NextResponse } from "next/server";

import { isGameId } from "@/lib/game-catalog";
import type {
  PrivateRoomSettingValue,
  PrivateRoomSettings,
} from "@/lib/multiplayer/room";
import {
  getMultiplayerRoomStore,
  type MultiplayerRoomStore,
  type MultiplayerRoomStoreErrorCode,
  type MultiplayerRoomStoreResult,
} from "@/lib/server/multiplayer-room-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";
import type { AuthenticatedUser } from "@/lib/user-profile";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type MultiplayerRoomUserSessionLookup = {
  getUserBySessionToken: (
    sessionToken: string | null,
  ) => Promise<AuthenticatedUser | null>;
};

type ParseRoomSettingsResult =
  | {
      settings: PrivateRoomSettings;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

const HOST_ONLY_COMMAND_AUTH_ERROR =
  "Sign in as the room host before changing room settings or lifecycle.";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPrivateRoomSettingValue(value: unknown): value is PrivateRoomSettingValue {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isPrivateRoomSettingValue(entry));
  }

  if (isRecord(value)) {
    return Object.values(value).every((entry) => isPrivateRoomSettingValue(entry));
  }

  return false;
}

export function parsePrivateRoomSettingsPayload(
  value: unknown,
): ParseRoomSettingsResult {
  if (!isRecord(value)) {
    return {
      error: "Room settings must be a JSON object.",
      success: false,
    };
  }

  const settingsSource =
    value.settings === undefined
      ? value
      : isRecord(value.settings)
        ? value.settings
        : null;

  if (settingsSource === null) {
    return {
      error: "Room settings must be a JSON object.",
      success: false,
    };
  }

  const gameIdValue = settingsSource.gameId ?? value.gameId ?? "pong";

  if (typeof gameIdValue !== "string") {
    return {
      error: "Room game id is not supported.",
      success: false,
    };
  }

  const gameId = gameIdValue.trim();

  if (!isGameId(gameId)) {
    return {
      error: "Room game id is not supported.",
      success: false,
    };
  }

  const parametersValue =
    settingsSource.parameters === undefined
      ? value.parameters
      : settingsSource.parameters;

  if (parametersValue === undefined) {
    return {
      settings: {
        gameId,
      },
      success: true,
    };
  }

  if (!isRecord(parametersValue)) {
    return {
      error: "Room parameters must be a JSON object.",
      success: false,
    };
  }

  if (
    !Object.values(parametersValue).every((entry) =>
      isPrivateRoomSettingValue(entry),
    )
  ) {
    return {
      error: "Room parameters must contain JSON-compatible values.",
      success: false,
    };
  }

  return {
    settings: {
      gameId,
      parameters: parametersValue as Readonly<Record<string, PrivateRoomSettingValue>>,
    },
    success: true,
  };
}

export function getMultiplayerRoomErrorStatus(code: MultiplayerRoomStoreErrorCode) {
  if (code === "room-not-found") {
    return 404;
  }

  if (code === "not-host") {
    return 403;
  }

  if (
    code === "duplicate-participant" ||
    code === "duplicate-room" ||
    code === "invalid-status" ||
    code === "participant-already-seated" ||
    code === "required-seats-empty" ||
    code === "seat-occupied"
  ) {
    return 409;
  }

  if (
    code === "participant-not-found" ||
    code === "participant-not-seated" ||
    code === "seat-not-found"
  ) {
    return 404;
  }

  return 400;
}

export function createMultiplayerRoomErrorResponse(
  result: Extract<MultiplayerRoomStoreResult, { success: false }>,
) {
  return NextResponse.json(
    {
      code: result.code,
      error: result.error,
    },
    {
      status: getMultiplayerRoomErrorStatus(result.code),
    },
  );
}

export function createHostOnlyCommandAuthErrorResponse(status: 401 | 403 = 401) {
  return NextResponse.json(
    {
      code: "not-host",
      error: HOST_ONLY_COMMAND_AUTH_ERROR,
    },
    {
      status,
    },
  );
}

export function createMultiplayerRoomsRouteHandlers(
  roomStore: MultiplayerRoomStore,
  userStore: MultiplayerRoomUserSessionLookup,
) {
  return {
    async POST(request: Request) {
      const user = await userStore.getUserBySessionToken(
        getSessionTokenFromRequest(request),
      );

      if (user === null) {
        return NextResponse.json(
          { error: "Sign in before creating multiplayer rooms." },
          { status: 401 },
        );
      }

      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Request body must be valid JSON." },
          { status: 400 },
        );
      }

      const parsedSettings = parsePrivateRoomSettingsPayload(payload);

      if (!parsedSettings.success) {
        return NextResponse.json({ error: parsedSettings.error }, { status: 400 });
      }

      const result = roomStore.createRoom({
        host: user,
        settings: parsedSettings.settings,
      });

      if (!result.success) {
        return createMultiplayerRoomErrorResponse(result);
      }

      return NextResponse.json(result.snapshot, { status: 201 });
    },
  };
}

export async function POST(request: Request) {
  return createMultiplayerRoomsRouteHandlers(
    getMultiplayerRoomStore(),
    getUserProfileStore(),
  ).POST(request);
}
