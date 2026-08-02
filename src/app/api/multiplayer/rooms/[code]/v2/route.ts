import { createMultiplayerProtocolMismatchResponse } from "../../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function POST(request: Request) {
  void request;
  return createMultiplayerProtocolMismatchResponse();
}
