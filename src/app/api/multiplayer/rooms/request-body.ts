import "server-only";

import { NextResponse } from "next/server";

// Match the internal sidecar request budget before decoding or parsing public JSON.
export const MAX_MULTIPLAYER_ROOM_JSON_BODY_BYTES = 64 * 1024;

function tooLargeResponse() {
  return NextResponse.json(
    { error: "Request body must not exceed 65536 bytes." },
    { status: 413 },
  );
}

export async function readMultiplayerRoomJson(request: Request): Promise<
  | { success: true; payload: unknown }
  | { success: false; response: Response }
> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (declaredLength > MAX_MULTIPLAYER_ROOM_JSON_BODY_BYTES) {
    return { success: false, response: tooLargeResponse() };
  }

  try {
    const reader = request.body?.getReader();
    const decoder = new TextDecoder();
    let byteLength = 0;
    let text = "";
    if (reader) {
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) {
            break;
          }
          byteLength += chunk.value.byteLength;
          if (byteLength > MAX_MULTIPLAYER_ROOM_JSON_BODY_BYTES) {
            await reader.cancel();
            return { success: false, response: tooLargeResponse() };
          }
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    return { success: true, payload: JSON.parse(text) as unknown };
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Request body must be valid JSON." },
        { status: 400 },
      ),
    };
  }
}
