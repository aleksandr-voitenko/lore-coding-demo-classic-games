import "server-only";

import { isMultiplayerRoomSnapshot } from "../multiplayer/protocol-validation";
import { normalizePrivateRoomCode } from "../multiplayer/room";

import type {
  CreateMultiplayerRoomOptions,
  MultiplayerRoomSnapshot,
  MultiplayerRoomStore,
  MultiplayerRoomStoreCommand,
  MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";
import { isMultiplayerRoomStoreErrorCode } from "./multiplayer-room-runtime";

export const MULTIPLAYER_ROOM_SERVICE_URL_ENV = "MULTIPLAYER_ROOM_SERVICE_URL";
export const MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN_ENV =
  "MULTIPLAYER_ROOM_SERVICE_CLIENT_BEARER_TOKEN";

type MultiplayerRoomServiceClientOptions = {
  baseUrl: string;
  bearerToken?: string;
  fetcher?: typeof fetch;
};

type HttpMethod = "GET" | "POST";

export class MultiplayerRoomServiceClient implements MultiplayerRoomStore {
  readonly #baseUrl: string;
  readonly #bearerToken: string | undefined;
  readonly #fetcher: typeof fetch;

  constructor({
    baseUrl,
    bearerToken,
    fetcher = fetch,
  }: MultiplayerRoomServiceClientOptions) {
    this.#baseUrl = normalizeMultiplayerRoomServiceBaseUrl(baseUrl);
    this.#bearerToken = getOptionalServiceString(bearerToken);
    this.#fetcher = fetcher;
  }

  async createRoom(
    options: CreateMultiplayerRoomOptions,
  ): Promise<MultiplayerRoomStoreResult> {
    return this.#request("POST", undefined, options);
  }

  async getRoom(roomCode: unknown): Promise<MultiplayerRoomStoreResult> {
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

    if (normalizedRoomCode === null) {
      return createServiceFailure(
        "invalid-room-code",
        "Room code is not supported.",
      );
    }

    return this.#request("GET", normalizedRoomCode);
  }

  async applyCommand(
    roomCode: unknown,
    command: MultiplayerRoomStoreCommand,
  ): Promise<MultiplayerRoomStoreResult> {
    const normalizedRoomCode = normalizePrivateRoomCode(roomCode);

    if (normalizedRoomCode === null) {
      return createServiceFailure(
        "invalid-room-code",
        "Room code is not supported.",
      );
    }

    return this.#request("POST", normalizedRoomCode, command);
  }

  async #request(
    method: HttpMethod,
    roomCode: string | undefined,
    body?: unknown,
  ): Promise<MultiplayerRoomStoreResult> {
    const url = this.#getRequestUrl(roomCode);
    let response: Response;

    try {
      response = await this.#fetcher(url, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers: this.#getHeaders(body !== undefined),
        method,
      });
    } catch (error) {
      return createServiceFailure(
        "room-service-unavailable",
        `Room service request failed for ${method} ${url}: ${getErrorMessage(
          error,
        )}`,
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      return createServiceFailure(
        "room-service-invalid-response",
        `Room service returned ${response.status} without a valid JSON room result.`,
      );
    }

    const result = parseMultiplayerRoomServiceResult(payload);

    if (result === null) {
      return createServiceFailure(
        "room-service-invalid-response",
        `Room service returned ${response.status} with an invalid room result.`,
      );
    }

    return result;
  }

  #getRequestUrl(roomCode: string | undefined) {
    return roomCode === undefined
      ? this.#baseUrl
      : `${this.#baseUrl}/${encodeURIComponent(roomCode)}`;
  }

  #getHeaders(hasBody: boolean) {
    const headers: Record<string, string> = {
      accept: "application/json",
    };

    if (hasBody) {
      headers["content-type"] = "application/json";
    }

    if (this.#bearerToken !== undefined) {
      headers.authorization = `Bearer ${this.#bearerToken}`;
    }

    return headers;
  }
}

export function normalizeMultiplayerRoomServiceBaseUrl(value: string) {
  const trimmedValue = getOptionalServiceString(value);

  if (trimmedValue === undefined) {
    throw new Error(`${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must not be empty.`);
  }

  let url: URL;

  try {
    url = new URL(trimmedValue);
  } catch {
    throw new Error(`${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must be an absolute URL.`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must use http or https.`,
    );
  }

  if (url.username !== "" || url.password !== "") {
    throw new Error(
      `${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must not include credentials.`,
    );
  }

  if (url.search !== "" || url.hash !== "") {
    throw new Error(
      `${MULTIPLAYER_ROOM_SERVICE_URL_ENV} must not include query or fragment.`,
    );
  }

  const pathname = url.pathname.replace(/\/+$/, "");

  return `${url.origin}${pathname === "" ? "" : pathname}`;
}

export function getOptionalServiceString(value: string | undefined) {
  const trimmedValue = value?.trim();

  return trimmedValue === undefined || trimmedValue.length === 0
    ? undefined
    : trimmedValue;
}

function parseMultiplayerRoomServiceResult(
  value: unknown,
): MultiplayerRoomStoreResult | null {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    return null;
  }

  if (value.success) {
    if (!isMultiplayerRoomSnapshot(value.snapshot)) {
      return null;
    }

    return {
      snapshot: value.snapshot as MultiplayerRoomSnapshot,
      success: true,
    };
  }

  if (
    isMultiplayerRoomStoreErrorCode(value.code) &&
    typeof value.error === "string"
  ) {
    return {
      code: value.code,
      error: value.error,
      success: false,
    };
  }

  return null;
}

function createServiceFailure(
  code: Extract<MultiplayerRoomStoreResult, { success: false }>["code"],
  error: string,
): MultiplayerRoomStoreResult {
  return {
    code,
    error,
    success: false,
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error.";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
