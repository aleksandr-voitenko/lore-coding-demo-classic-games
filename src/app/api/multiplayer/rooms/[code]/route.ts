import { NextResponse } from "next/server";

import type { MultiplayerRoomStoreCommand } from "@/lib/server/multiplayer-room-store";
import {
  getMultiplayerRoomStore,
  type MultiplayerRoomStore,
} from "@/lib/server/multiplayer-room-store";
import { getUserProfileStore } from "@/lib/server/sqlite-user-profile-store";
import { getSessionTokenFromRequest } from "@/lib/server/user-session-cookie";

import {
  createHostOnlyCommandAuthErrorResponse,
  createMultiplayerRoomErrorResponse,
  isRecord,
  parsePrivateRoomSettingsPayload,
  type MultiplayerRoomUserSessionLookup,
} from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MultiplayerRoomRouteContext = {
  params: Promise<{
    code: string;
  }>;
};

type ParseRoomCommandResult =
  | {
      command: MultiplayerRoomStoreCommand;
      success: true;
    }
  | {
      error: string;
      success: false;
    };

function isLifecycleCommand(
  value: unknown,
): value is Extract<MultiplayerRoomStoreCommand, { type: "room.lifecycle" }>["command"] {
  return (
    value === "finish" ||
    value === "pause" ||
    value === "restart" ||
    value === "resume" ||
    value === "start"
  );
}

function isHostOnlyCommand(command: MultiplayerRoomStoreCommand) {
  return command.type === "room.lifecycle" || command.type === "room.updateSettings";
}

function parseRoomCommand(value: unknown): ParseRoomCommandResult {
  if (!isRecord(value)) {
    return {
      error: "Room command must be a JSON object.",
      success: false,
    };
  }

  if (value.type === "room.joinObserver") {
    return {
      command: {
        displayName: value.displayName,
        type: "room.joinObserver",
      },
      success: true,
    };
  }

  if (value.type === "room.claimSeat") {
    return {
      command: {
        participantId: value.participantId,
        seatId: value.seatId,
        type: "room.claimSeat",
      },
      success: true,
    };
  }

  if (value.type === "room.releaseSeat") {
    return {
      command: {
        participantId: value.participantId,
        seatId: value.seatId,
        type: "room.releaseSeat",
      },
      success: true,
    };
  }

  if (value.type === "room.updateSettings") {
    const parsedSettings = parsePrivateRoomSettingsPayload(value.settings);

    if (!parsedSettings.success) {
      return parsedSettings;
    }

    return {
      command: {
        participantId: value.participantId,
        settings: parsedSettings.settings,
        type: "room.updateSettings",
      },
      success: true,
    };
  }

  if (value.type === "room.lifecycle") {
    if (!isLifecycleCommand(value.command)) {
      return {
        error: "Room lifecycle command is not supported.",
        success: false,
      };
    }

    return {
      command: {
        command: value.command,
        participantId: value.participantId,
        type: "room.lifecycle",
      },
      success: true,
    };
  }

  return {
    error: "Room command type is not supported.",
    success: false,
  };
}

async function isAuthorizedHostCommand(
  request: Request,
  roomStore: MultiplayerRoomStore,
  userStore: MultiplayerRoomUserSessionLookup,
  roomCode: string,
  command: MultiplayerRoomStoreCommand,
) {
  if (!isHostOnlyCommand(command)) {
    return true;
  }

  const roomResult = roomStore.getRoom(roomCode);

  if (!roomResult.success) {
    return createMultiplayerRoomErrorResponse(roomResult);
  }

  const user = await userStore.getUserBySessionToken(getSessionTokenFromRequest(request));

  if (user === null) {
    return createHostOnlyCommandAuthErrorResponse();
  }

  const { room } = roomResult.snapshot;
  const hostParticipant = room.participants.find(
    (participant) => participant.id === room.hostParticipantId,
  );

  if (
    hostParticipant?.userId !== user.id ||
    command.participantId !== room.hostParticipantId
  ) {
    return createHostOnlyCommandAuthErrorResponse(403);
  }

  return true;
}

export function createMultiplayerRoomRouteHandlers(
  roomStore: MultiplayerRoomStore,
  userStore: MultiplayerRoomUserSessionLookup,
) {
  return {
    async GET(_request: Request, { code }: { code: string }) {
      const result = roomStore.getRoom(code);

      if (!result.success) {
        return createMultiplayerRoomErrorResponse(result);
      }

      return NextResponse.json(result.snapshot);
    },

    async POST(request: Request, { code }: { code: string }) {
      let payload: unknown;

      try {
        payload = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Request body must be valid JSON." },
          { status: 400 },
        );
      }

      const parsedCommand = parseRoomCommand(payload);

      if (!parsedCommand.success) {
        return NextResponse.json({ error: parsedCommand.error }, { status: 400 });
      }

      const hostAuthorization = await isAuthorizedHostCommand(
        request,
        roomStore,
        userStore,
        code,
        parsedCommand.command,
      );

      if (hostAuthorization !== true) {
        return hostAuthorization;
      }

      const result = roomStore.applyCommand(code, parsedCommand.command);

      if (!result.success) {
        return createMultiplayerRoomErrorResponse(result);
      }

      return NextResponse.json(result.snapshot);
    },
  };
}

export async function GET(request: Request, context: MultiplayerRoomRouteContext) {
  const { code } = await context.params;

  return createMultiplayerRoomRouteHandlers(
    getMultiplayerRoomStore(),
    getUserProfileStore(),
  ).GET(request, { code });
}

export async function POST(request: Request, context: MultiplayerRoomRouteContext) {
  const { code } = await context.params;

  return createMultiplayerRoomRouteHandlers(
    getMultiplayerRoomStore(),
    getUserProfileStore(),
  ).POST(request, { code });
}
