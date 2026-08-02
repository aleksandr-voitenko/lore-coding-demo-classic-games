import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, type RawData } from "ws";

import {
  MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT,
  MULTIPLAYER_ROOM_PROTOCOL_VERSION,
  MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER,
} from "@/lib/multiplayer/protocol";
import {
  DEFAULT_MULTIPLAYER_ROOM_MAX_CONNECTIONS_PER_PARTICIPANT,
  DEFAULT_MULTIPLAYER_ROOM_RETENTION_POLICY,
  type MultiplayerRoomStoreResult,
} from "./multiplayer-room-runtime";
import {
  MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS,
  type MultiplayerAccountPartyResult,
} from "./multiplayer-account-party";
import { DEFAULT_PRIVATE_ROOM_OBSERVER_LIMIT } from "../multiplayer/room";

import {
  DEFAULT_MULTIPLAYER_SIDECAR_HOST,
  DEFAULT_MULTIPLAYER_SIDECAR_MAX_ROOMS,
  DEFAULT_MULTIPLAYER_SIDECAR_PORT,
  DEFAULT_MULTIPLAYER_SIDECAR_READINESS_PATH,
  DEFAULT_MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH,
  DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
  DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
  MULTIPLAYER_SIDECAR_MAX_CONNECTIONS_PER_PARTICIPANT_ENV,
  MULTIPLAYER_SIDECAR_MAX_OBSERVERS_PER_PARTY_ENV,
  MULTIPLAYER_SIDECAR_HEALTH_PATH,
  createMultiplayerRoomSidecar,
  parseMultiplayerRoomSidecarConfig,
  type MultiplayerRoomSidecar,
} from "./multiplayer-room-sidecar";

const cleanupCallbacks: Array<() => Promise<void> | void> = [];
const ROOM_SERVICE_MUTATION_HEADERS = {
  "content-type": "application/json",
  [MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER]: String(
    MULTIPLAYER_ROOM_PROTOCOL_VERSION,
  ),
};
const ROOM_SERVICE_AUTHORIZATION_HEADERS = {
  authorization: "Bearer service-secret",
};

afterEach(async () => {
  const callbacks = cleanupCallbacks.splice(0).reverse();

  await Promise.all(callbacks.map((callback) => Promise.resolve().then(callback)));
});

function createTestConfig(
  overrides: Partial<ReturnType<typeof parseMultiplayerRoomSidecarConfig>> = {},
) {
  return {
    healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
    host: "127.0.0.1",
    maxConnectionsPerParticipant:
      DEFAULT_MULTIPLAYER_ROOM_MAX_CONNECTIONS_PER_PARTICIPANT,
    maxObserversPerParty: DEFAULT_PRIVATE_ROOM_OBSERVER_LIMIT,
    maxRooms: DEFAULT_MULTIPLAYER_SIDECAR_MAX_ROOMS,
    port: 0,
    readinessPath: DEFAULT_MULTIPLAYER_SIDECAR_READINESS_PATH,
    roomServicePath: "/_internal/rooms",
    snapshotIntervalMs: DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
    websocketPath: "/rooms",
    ...overrides,
  };
}

function getOrigin(sidecar: MultiplayerRoomSidecar) {
  const address = sidecar.server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected the sidecar test server to listen on a TCP port.");
  }

  return `http://127.0.0.1:${(address as AddressInfo).port}`;
}

async function createStartedSidecar(
  config = createTestConfig(),
): Promise<MultiplayerRoomSidecar> {
  const sidecar = createMultiplayerRoomSidecar(config);

  cleanupCallbacks.push(() => sidecar.close());
  await sidecar.start();

  return sidecar;
}

async function connectClient(url: string) {
  const client = new WebSocket(url);

  cleanupCallbacks.push(() => {
    if (
      client.readyState === WebSocket.CONNECTING ||
      client.readyState === WebSocket.OPEN
    ) {
      client.terminate();
    }
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for the WebSocket client to open."));
    }, 1_000);
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("open", handleOpen);
      client.off("error", handleError);
    };

    client.once("open", handleOpen);
    client.once("error", handleError);
  });

  return client;
}

function waitForServerMessage(
  client: WebSocket,
  predicate: (message: Record<string, unknown>) => boolean = () => true,
) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for a matching WebSocket message."));
    }, 1_000);
    const handleMessage = (data: RawData) => {
      const parsedMessage = JSON.parse(rawDataToText(data)) as unknown;

      if (!isRecord(parsedMessage) || !predicate(parsedMessage)) {
        return;
      }

      cleanup();
      resolve(parsedMessage);
    };
    const handleError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      clearTimeout(timeout);
      client.off("message", handleMessage);
      client.off("error", handleError);
    };

    client.on("message", handleMessage);
    client.once("error", handleError);
  });
}

function rawDataToText(data: RawData) {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString("utf8");
  }

  return Buffer.from(data).toString("utf8");
}

function sendClientMessage(client: WebSocket, message: unknown) {
  const versionedMessage =
    isRecord(message) &&
    (message.type === "connection.hello" || message.type === "connection.resume")
      ? {
          protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
          ...message,
        }
      : message;

  client.send(JSON.stringify(versionedMessage));
}

async function readStoreResult(response: Response) {
  return (await response.json()) as MultiplayerRoomStoreResult;
}

async function readAccountPartyResult(response: Response) {
  return (await response.json()) as MultiplayerAccountPartyResult;
}

function expectStoreSuccess(result: MultiplayerRoomStoreResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.outcome).toBe("snapshot");

  if (result.outcome !== "snapshot") {
    throw new Error("Expected a room snapshot.");
  }

  return result.snapshot;
}

function hasSeatOccupantSnapshot(
  message: Record<string, unknown>,
  seatId: string,
  participantId: string,
) {
  if (message.type !== "room.snapshot" || !isRecord(message.snapshot)) {
    return false;
  }

  const { room } = message.snapshot;

  if (!isRecord(room) || !Array.isArray(room.seats)) {
    return false;
  }

  return room.seats.some(
    (seat) =>
      isRecord(seat) &&
      seat.id === seatId &&
      seat.occupiedByParticipantId === participantId,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("multiplayer room sidecar", () => {
  it("parses safe defaults and environment overrides", () => {
    expect(parseMultiplayerRoomSidecarConfig({})).toEqual({
      healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
      host: DEFAULT_MULTIPLAYER_SIDECAR_HOST,
      maxConnectionsPerParticipant:
        DEFAULT_MULTIPLAYER_ROOM_MAX_CONNECTIONS_PER_PARTICIPANT,
      maxObserversPerParty: DEFAULT_PRIVATE_ROOM_OBSERVER_LIMIT,
      maxRooms: DEFAULT_MULTIPLAYER_SIDECAR_MAX_ROOMS,
      port: DEFAULT_MULTIPLAYER_SIDECAR_PORT,
      readinessPath: DEFAULT_MULTIPLAYER_SIDECAR_READINESS_PATH,
      roomServicePath: DEFAULT_MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH,
      snapshotIntervalMs: 33,
      websocketPath: DEFAULT_MULTIPLAYER_SIDECAR_WEBSOCKET_PATH,
    });

    expect(DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS).toBe(33);

    expect(
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_HOST: " 0.0.0.0 ",
        [MULTIPLAYER_SIDECAR_MAX_CONNECTIONS_PER_PARTICIPANT_ENV]: "6",
        [MULTIPLAYER_SIDECAR_MAX_OBSERVERS_PER_PARTY_ENV]: "12",
        MULTIPLAYER_SIDECAR_MAX_ROOMS: "512",
        MULTIPLAYER_SIDECAR_PORT: "3002",
        MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH: " /_sidecar/rooms ",
        MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS: "33",
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: " /ws/rooms ",
        MULTIPLAYER_SIDECAR_ROOM_SERVICE_BEARER_TOKEN: " service-secret ",
      }),
    ).toEqual({
      healthPath: MULTIPLAYER_SIDECAR_HEALTH_PATH,
      host: "0.0.0.0",
      maxConnectionsPerParticipant: 6,
      maxObserversPerParty: 12,
      maxRooms: 512,
      port: 3002,
      readinessPath: DEFAULT_MULTIPLAYER_SIDECAR_READINESS_PATH,
      roomServiceBearerToken: "service-secret",
      roomServicePath: "/_sidecar/rooms",
      snapshotIntervalMs: 33,
      websocketPath: "/ws/rooms",
    });
  });

  it("rejects invalid sidecar port and path configuration", () => {
    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        [MULTIPLAYER_SIDECAR_MAX_CONNECTIONS_PER_PARTICIPANT_ENV]: "0",
      }),
    ).toThrow(
      `${MULTIPLAYER_SIDECAR_MAX_CONNECTIONS_PER_PARTICIPANT_ENV} must be a positive integer`,
    );

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        [MULTIPLAYER_SIDECAR_MAX_OBSERVERS_PER_PARTY_ENV]: "-1",
      }),
    ).toThrow(
      `${MULTIPLAYER_SIDECAR_MAX_OBSERVERS_PER_PARTY_ENV} must be a non-negative integer`,
    );

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_MAX_ROOMS: "0",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_MAX_ROOMS must be a positive integer");

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_PORT: "not-a-port",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_PORT must be an integer");

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: "rooms",
      }),
    ).toThrow('MULTIPLAYER_SIDECAR_WEBSOCKET_PATH must start with "/"');

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_WEBSOCKET_PATH: "/rooms?debug=true",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_WEBSOCKET_PATH must be a URL path");

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH: "rooms",
      }),
    ).toThrow('MULTIPLAYER_SIDECAR_ROOM_SERVICE_PATH must start with "/"');

    expect(() =>
      parseMultiplayerRoomSidecarConfig({
        MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS: "0",
      }),
    ).toThrow("MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS must be a positive integer");
  });

  it("owns one minute room sweeping and clears it idempotently", async () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
    const sidecar = createMultiplayerRoomSidecar(createTestConfig());

    try {
      await sidecar.start();

      const sweepCallIndex = setIntervalSpy.mock.calls.findIndex(
        (call) =>
          call[1] === DEFAULT_MULTIPLAYER_ROOM_RETENTION_POLICY.sweepIntervalMs,
      );

      expect(sweepCallIndex).toBeGreaterThanOrEqual(0);

      const sweepIntervalId = setIntervalSpy.mock.results[sweepCallIndex]?.value;

      await sidecar.close();
      await sidecar.close();
      expect(
        clearIntervalSpy.mock.calls.filter(
          ([intervalId]) => intervalId === sweepIntervalId,
        ),
      ).toHaveLength(1);
    } finally {
      await sidecar.close();
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it("serves health and readiness JSON before closing the HTTP server", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);

    const healthResponse = await fetch(`${origin}/healthz`);
    const readinessResponse = await fetch(`${origin}/readyz`);

    expect(healthResponse.status).toBe(200);
    await expect(healthResponse.json()).resolves.toEqual({
      readinessPath: "/readyz",
      service: "multiplayer-room-sidecar",
      status: "ok",
      websocketPath: "/rooms",
    });
    expect(readinessResponse.status).toBe(200);
    await expect(readinessResponse.json()).resolves.toEqual({
      checks: {
        http: "ok",
        roomStore: "ok",
        websocket: "ok",
      },
      roomServicePath: "/_internal/rooms",
      roomState: "volatile-memory",
      service: "multiplayer-room-sidecar",
      snapshotIntervalMs: DEFAULT_MULTIPLAYER_SIDECAR_SNAPSHOT_INTERVAL_MS,
      status: "ready",
      websocketPath: "/rooms",
    });

    const missingResponse = await fetch(`${origin}/missing`);

    expect(missingResponse.status).toBe(404);
    await expect(missingResponse.json()).resolves.toEqual({
      error: "Not found.",
    });

    expect(sidecar.server.listening).toBe(true);
    await sidecar.close();
    expect(sidecar.server.listening).toBe(false);
  });

  it("attaches the room WebSocket gateway to the configured path", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);
    const client = await connectClient(origin.replace("http://", "ws://") + "/rooms");

    expect(client.readyState).toBe(WebSocket.OPEN);
  });

  it("fails account authority closed without a bearer token and rejects older mutation paths before room creation", async () => {
    const sidecar = await createStartedSidecar();
    const origin = getOrigin(sidecar);
    const serviceBaseUrl = `${origin}/_internal/rooms`;

    const handshakeResponse = await fetch(serviceBaseUrl);
    const unversionedMutationResponse = await fetch(serviceBaseUrl, {
      body: JSON.stringify({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
      }),
      headers: ROOM_SERVICE_MUTATION_HEADERS,
      method: "POST",
    });
    const unauthorizedCreateResponse = await fetch(
      `${serviceBaseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`,
      {
        body: JSON.stringify({
          host: {
            displayName: "Ada Host",
            id: "user-1",
          },
        }),
        headers: ROOM_SERVICE_MUTATION_HEADERS,
        method: "POST",
      },
    );
    const retiredMutationResponses = await Promise.all(
      ["v2", "v3", "v4", "v5"].map((versionPathSegment) =>
        fetch(`${serviceBaseUrl}/${versionPathSegment}`, {
          body: "{",
          headers: ROOM_SERVICE_MUTATION_HEADERS,
          method: "POST",
        }),
      ),
    );
    const roomResponse = await fetch(`${serviceBaseUrl}/ROOM1`);

    expect(handshakeResponse.status).toBe(200);
    await expect(handshakeResponse.json()).resolves.toEqual({
      accountPartyMemberships: false,
      authenticatedAdmission: false,
      membershipOnlyReacquisition: false,
      mutationPathSegment: MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT,
      participantCapabilities: true,
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      socialPresenceLeases: false,
    });
    expect(unversionedMutationResponse.status).toBe(426);
    await expect(unversionedMutationResponse.json()).resolves.toEqual({
      error: "Room service protocol version is not supported.",
    });
    expect(unauthorizedCreateResponse.status).toBe(401);
    await expect(unauthorizedCreateResponse.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
    expect(retiredMutationResponses.map((response) => response.status)).toEqual([
      426, 426, 426, 426,
    ]);
    await expect(
      Promise.all(retiredMutationResponses.map((response) => response.json())),
    ).resolves.toEqual(
      retiredMutationResponses.map(() => ({
        error: "Room service protocol version is not supported.",
      })),
    );
    expect(roomResponse.status).toBe(404);
  });

  it("gates account commands by bearer token and protocol before parsing their body", async () => {
    const tokenlessSidecar = await createStartedSidecar();
    const sidecar = await createStartedSidecar(
      createTestConfig({ roomServiceBearerToken: "service-secret" }),
    );
    const accountMutationUrl = `${getOrigin(sidecar)}/_internal/rooms/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}/_accounts`;
    const tokenlessResponse = await fetch(
      `${getOrigin(tokenlessSidecar)}/_internal/rooms/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}/_accounts`,
      {
        body: JSON.stringify({
          clientId: "client_account_a",
          state: "available",
          type: "presence.renew",
          userId: "user-1",
        }),
        headers: ROOM_SERVICE_MUTATION_HEADERS,
        method: "POST",
      },
    );
    const unauthorizedResponse = await fetch(accountMutationUrl, {
      body: "{",
      method: "POST",
    });
    const unversionedResponse = await fetch(accountMutationUrl, {
      body: "{",
      headers: { authorization: "Bearer service-secret" },
      method: "POST",
    });
    const wrongVersionResponse = await fetch(accountMutationUrl, {
      body: "{",
      headers: {
        authorization: "Bearer service-secret",
        [MULTIPLAYER_ROOM_PROTOCOL_VERSION_HEADER]: String(
          MULTIPLAYER_ROOM_PROTOCOL_VERSION - 1,
        ),
      },
      method: "POST",
    });
    const invalidJsonResponse = await fetch(accountMutationUrl, {
      body: "{",
      headers: {
        ...ROOM_SERVICE_MUTATION_HEADERS,
        authorization: "Bearer service-secret",
      },
      method: "POST",
    });
    const unsupportedCommandResponse = await fetch(accountMutationUrl, {
      body: JSON.stringify({ type: "party.unsupported" }),
      headers: {
        ...ROOM_SERVICE_MUTATION_HEADERS,
        authorization: "Bearer service-secret",
      },
      method: "POST",
    });
    const oversizedResolutionResponse = await fetch(accountMutationUrl, {
      body: JSON.stringify({
        type: "presence.resolve",
        userIds: Array.from(
          { length: MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS + 1 },
          (_, index) => `user-${index}`,
        ),
      }),
      headers: {
        ...ROOM_SERVICE_MUTATION_HEADERS,
        authorization: "Bearer service-secret",
      },
      method: "POST",
    });

    expect(tokenlessResponse.status).toBe(401);
    await expect(tokenlessResponse.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
    expect(unversionedResponse.status).toBe(426);
    await expect(unversionedResponse.json()).resolves.toEqual({
      error: "Room service protocol version is not supported.",
    });
    expect(wrongVersionResponse.status).toBe(426);
    await expect(wrongVersionResponse.json()).resolves.toEqual({
      error: "Room service protocol version is not supported.",
    });
    expect(invalidJsonResponse.status).toBe(400);
    await expect(invalidJsonResponse.json()).resolves.toEqual({
      code: "invalid-command",
      error: "Request body must be valid JSON.",
      success: false,
    });
    expect(unsupportedCommandResponse.status).toBe(400);
    await expect(unsupportedCommandResponse.json()).resolves.toEqual({
      code: "invalid-account-command",
      error: "Account command type is not supported.",
      success: false,
    });
    expect(oversizedResolutionResponse.status).toBe(413);
    await expect(oversizedResolutionResponse.json()).resolves.toEqual({
      code: "presence-resolution-limit-reached",
      error: `Presence resolution accepts at most ${MAX_MULTIPLAYER_ACCOUNT_AVAILABILITY_USER_IDS} accounts.`,
      success: false,
    });
  });

  it("applies account presence, eligibility, admission, and compensated departure commands", async () => {
    const sidecar = await createStartedSidecar(
      createTestConfig({ roomServiceBearerToken: "service-secret" }),
    );
    const origin = getOrigin(sidecar);
    const serviceBaseUrl = `${origin}/_internal/rooms`;
    const authorizedHeaders = {
      ...ROOM_SERVICE_MUTATION_HEADERS,
      authorization: "Bearer service-secret",
    };
    const createResponse = await fetch(
      `${serviceBaseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`,
      {
        body: JSON.stringify({
          host: {
            displayName: "Ada Host",
            id: "user-1",
          },
          settings: { gameId: "pong" },
        }),
        headers: authorizedHeaders,
        method: "POST",
      },
    );
    const createResult = await readStoreResult(createResponse);
    const createdSnapshot = expectStoreSuccess(createResult);
    const accountMutationUrl = `${serviceBaseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}/_accounts`;
    const postAccountCommand = (command: unknown) =>
      fetch(accountMutationUrl, {
        body: JSON.stringify(command),
        headers: authorizedHeaders,
        method: "POST",
      });

    const presenceResponse = await postAccountCommand({
      clientId: "client_account_b",
      state: "available",
      type: "presence.renew",
      userId: "user-2",
    });
    const availabilityResponse = await postAccountCommand({
      type: "presence.resolve",
      userIds: ["user-1", "user-2", "user-3"],
    });
    const eligibilityResponse = await postAccountCommand({
      hostUserId: "user-1",
      intent: "play",
      partyCode: createdSnapshot.room.code,
      recipientUserId: "user-2",
      type: "party.inspectInvitation",
    });

    expect(presenceResponse.status).toBe(200);
    await expect(readAccountPartyResult(presenceResponse)).resolves.toEqual({
      availability: "available",
      changed: true,
      outcome: "presence",
      success: true,
    });
    expect(availabilityResponse.status).toBe(200);
    await expect(readAccountPartyResult(availabilityResponse)).resolves.toEqual({
      availabilities: [
        { availability: "in-party", userId: "user-1" },
        { availability: "available", userId: "user-2" },
        { availability: "offline", userId: "user-3" },
      ],
      outcome: "availability",
      success: true,
    });
    expect(eligibilityResponse.status).toBe(200);
    await expect(readAccountPartyResult(eligibilityResponse)).resolves.toEqual({
      admissionRole: "player",
      eligible: true,
      outcome: "invitation-eligibility",
      reason: null,
      success: true,
    });

    const broadcastSnapshot = vi.spyOn(sidecar.gateway, "broadcastSnapshot");
    const admissionResponse = await postAccountCommand({
      intent: "play",
      partyCode: createdSnapshot.room.code,
      type: "party.admitAuthenticated",
      user: {
        displayName: "Grace Guest",
        id: "user-2",
      },
    });
    const admissionResult = await readAccountPartyResult(admissionResponse);

    expect(admissionResponse.status).toBe(200);
    expect(admissionResult).toMatchObject({
      admission: "admitted",
      outcome: "admission",
      snapshot: {
        room: {
          code: createdSnapshot.room.code,
          participants: expect.arrayContaining([
            expect.objectContaining({
              displayName: "Grace Guest",
              role: "player",
              userId: "user-2",
            }),
          ]),
        },
      },
      success: true,
    });

    if (!admissionResult.success || admissionResult.outcome !== "admission") {
      throw new Error("Expected authenticated party admission to succeed.");
    }

    expect(broadcastSnapshot).toHaveBeenCalledTimes(1);
    expect(broadcastSnapshot).toHaveBeenLastCalledWith(admissionResult.snapshot);

    const departureCommand = {
      participantCapability: admissionResult.participantCapability,
      participantId: admissionResult.participantId,
      partyCode: createdSnapshot.room.code,
      type: "party.compensateAdmission",
      userId: "user-2",
    };
    const departureResponse = await postAccountCommand(departureCommand);
    const departureResult = await readAccountPartyResult(departureResponse);

    expect(departureResponse.status).toBe(200);
    expect(departureResult).toMatchObject({
      departed: true,
      departedParticipantId: admissionResult.participantId,
      outcome: "departure",
      snapshot: {
        room: {
          code: createdSnapshot.room.code,
          participants: [expect.objectContaining({ userId: "user-1" })],
        },
      },
      success: true,
    });

    if (
      !departureResult.success ||
      departureResult.outcome !== "departure" ||
      departureResult.snapshot === undefined
    ) {
      throw new Error("Expected admission compensation to return a snapshot.");
    }

    expect(broadcastSnapshot).toHaveBeenCalledTimes(2);
    expect(broadcastSnapshot).toHaveBeenLastCalledWith(departureResult.snapshot);

    const repeatedDepartureResponse = await postAccountCommand(departureCommand);

    expect(repeatedDepartureResponse.status).toBe(200);
    await expect(
      readAccountPartyResult(repeatedDepartureResponse),
    ).resolves.toEqual({
      departed: false,
      outcome: "departure",
      success: true,
    });

    const reacquisitionResponse = await postAccountCommand({
      partyCode: createdSnapshot.room.code,
      type: "party.reacquireAuthenticated",
      user: {
        displayName: "Grace Guest",
        id: "user-2",
      },
    });

    expect(reacquisitionResponse.status).toBe(404);
    await expect(readAccountPartyResult(reacquisitionResponse)).resolves.toEqual({
      code: "participant-not-found",
      error: "This account no longer belongs to the party.",
      success: false,
    });
    expect(broadcastSnapshot).toHaveBeenCalledTimes(2);
  });

  it("rejects room creation at configured capacity while a participant is connected", async () => {
    const sidecar = await createStartedSidecar(
      createTestConfig({
        maxRooms: 1,
        roomServiceBearerToken: "service-secret",
      }),
    );
    const origin = getOrigin(sidecar);
    const serviceBaseUrl = `${origin}/_internal/rooms`;
    const createRoomRequest = (hostUserId = "user-1") =>
      fetch(`${serviceBaseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`, {
        body: JSON.stringify({
          host: {
            displayName: "Ada Host",
            id: hostUserId,
          },
          settings: {
            gameId: "pong",
          },
        }),
        headers: {
          ...ROOM_SERVICE_MUTATION_HEADERS,
          ...ROOM_SERVICE_AUTHORIZATION_HEADERS,
        },
        method: "POST",
      });
    const firstResponse = await createRoomRequest();
    const firstResult = await readStoreResult(firstResponse);
    const firstSnapshot = expectStoreSuccess(firstResult);

    if (
      !firstResult.success ||
      firstResult.outcome !== "snapshot" ||
      firstResult.participantCapability === undefined
    ) {
      throw new Error("Expected room creation to include a host capability.");
    }
    const client = await connectClient(
      origin.replace("http://", "ws://") + "/rooms",
    );
    const bootstrapPromise = waitForServerMessage(
      client,
      (message) => message.type === "connection.bootstrap",
    );

    sendClientMessage(client, {
      participantCapability: firstResult.participantCapability,
      participantId: firstSnapshot.room.hostParticipantId,
      requestId: "capacity-bootstrap",
      roomCode: firstSnapshot.room.code,
      type: "connection.resume",
    });
    await bootstrapPromise;

    const capacityResponse = await createRoomRequest("user-2");

    expect(capacityResponse.status).toBe(503);
    await expect(readStoreResult(capacityResponse)).resolves.toEqual({
      code: "room-capacity-reached",
      error: "Room capacity is currently full. Try creating a room again shortly.",
      success: false,
    });
  });

  it("shares HTTP room endpoints with the WebSocket gateway store", async () => {
    const sidecar = await createStartedSidecar(
      createTestConfig({ roomServiceBearerToken: "service-secret" }),
    );
    const origin = getOrigin(sidecar);
    const publicPathCreateResponse = await fetch(`${origin}/rooms`, {
      body: JSON.stringify({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
      }),
      headers: ROOM_SERVICE_MUTATION_HEADERS,
      method: "POST",
    });
    const serviceBaseUrl = `${origin}/_internal/rooms`;
    const createResponse = await fetch(
      `${serviceBaseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`,
      {
        body: JSON.stringify({
          host: {
            displayName: "Ada Host",
            id: "user-1",
          },
          settings: {
            gameId: "pong",
          },
        }),
        headers: {
          ...ROOM_SERVICE_MUTATION_HEADERS,
          authorization: "Bearer service-secret",
        },
        method: "POST",
      },
    );

    expect(publicPathCreateResponse.status).toBe(404);
    await expect(publicPathCreateResponse.json()).resolves.toEqual({
      error: "Not found.",
    });
    expect(createResponse.status).toBe(201);

    const createdSnapshot = expectStoreSuccess(
      await readStoreResult(createResponse),
    );
    const { code: roomCode, hostParticipantId } = createdSnapshot.room;
    const client = await connectClient(
      origin.replace("http://", "ws://") + "/rooms",
    );
    const bootstrapPromise = waitForServerMessage(
      client,
      (message) => message.type === "connection.bootstrap",
    );

    sendClientMessage(client, {
      requestId: "hello-1",
      roomCode,
      type: "connection.hello",
    });

    await expect(bootstrapPromise).resolves.toMatchObject({
      requestId: "hello-1",
      roomCode,
      snapshot: {
        room: {
          code: roomCode,
          hostParticipantId,
        },
        seq: 1,
      },
      type: "connection.bootstrap",
    });

    const joinAckPromise = waitForServerMessage(
      client,
      (message) =>
        message.type === "room.commandAck" && message.requestId === "join-1",
    );

    sendClientMessage(client, {
      command: {
        displayName: "Guest Hero",
        type: "room.joinObserver",
      },
      requestId: "join-1",
      roomCode,
      type: "room.command",
    });

    const joinAck = await joinAckPromise;
    const guestParticipantId = joinAck.participantId;

    if (typeof guestParticipantId !== "string") {
      throw new Error("Expected the join ack to include a participant id.");
    }

    const afterWebSocketCommandResponse = await fetch(
      `${serviceBaseUrl}/${roomCode}`,
      { headers: ROOM_SERVICE_AUTHORIZATION_HEADERS },
    );

    expect(afterWebSocketCommandResponse.status).toBe(200);
    const afterWebSocketCommandSnapshot = expectStoreSuccess(
      await readStoreResult(afterWebSocketCommandResponse),
    );

    expect(afterWebSocketCommandSnapshot.room.participants).toEqual([
      expect.objectContaining({ id: hostParticipantId, role: "host" }),
      expect.objectContaining({
        displayName: "Guest Hero",
        id: guestParticipantId,
        role: "observer",
      }),
    ]);

    const unversionedCommandResponse = await fetch(
      `${serviceBaseUrl}/${roomCode}`,
      {
        body: JSON.stringify({
          participantId: guestParticipantId,
          seatId: "right",
          matchId: 1,
          type: "room.claimSeat",
        }),
        headers: {
          ...ROOM_SERVICE_MUTATION_HEADERS,
          ...ROOM_SERVICE_AUTHORIZATION_HEADERS,
        },
        method: "POST",
      },
    );

    expect(unversionedCommandResponse.status).toBe(426);
    await expect(unversionedCommandResponse.json()).resolves.toEqual({
      error: "Room service protocol version is not supported.",
    });

    const afterRejectedCommandSnapshot = expectStoreSuccess(
      await readStoreResult(
        await fetch(`${serviceBaseUrl}/${roomCode}`, {
          headers: ROOM_SERVICE_AUTHORIZATION_HEADERS,
        }),
      ),
    );

    expect(afterRejectedCommandSnapshot.room.seats).toEqual([
      expect.objectContaining({
        id: "left",
        occupiedByParticipantId: hostParticipantId,
      }),
      expect.objectContaining({
        id: "right",
        occupiedByParticipantId: null,
      }),
    ]);

    const httpCommandBroadcastPromise = waitForServerMessage(
      client,
      (message) => hasSeatOccupantSnapshot(message, "right", guestParticipantId),
    );

    const httpCommandResponse = await fetch(
      `${serviceBaseUrl}/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}/${roomCode}`,
      {
        body: JSON.stringify({
          participantId: guestParticipantId,
          seatId: "right",
          matchId: 1,
          type: "room.claimSeat",
        }),
        headers: {
          ...ROOM_SERVICE_MUTATION_HEADERS,
          ...ROOM_SERVICE_AUTHORIZATION_HEADERS,
        },
        method: "POST",
      },
    );

    expect(httpCommandResponse.status).toBe(200);

    const afterHttpCommandSnapshot = expectStoreSuccess(
      await readStoreResult(httpCommandResponse),
    );
    const httpCommandBroadcast = await httpCommandBroadcastPromise;

    expect(afterHttpCommandSnapshot.room.seats).toEqual([
      expect.objectContaining({
        id: "left",
        occupiedByParticipantId: hostParticipantId,
      }),
      expect.objectContaining({
        id: "right",
        occupiedByParticipantId: guestParticipantId,
      }),
    ]);
    expect(httpCommandBroadcast).toMatchObject({
      roomCode,
      snapshot: {
        room: {
          seats: [
            expect.objectContaining({
              id: "left",
              occupiedByParticipantId: hostParticipantId,
            }),
            expect.objectContaining({
              id: "right",
              occupiedByParticipantId: guestParticipantId,
            }),
          ],
        },
        seq: afterHttpCommandSnapshot.seq,
      },
      type: "room.snapshot",
    });

    const observer = await connectClient(
      origin.replace("http://", "ws://") + "/rooms",
    );
    const observerBootstrapPromise = waitForServerMessage(
      observer,
      (message) => message.type === "connection.bootstrap",
    );

    sendClientMessage(observer, {
      requestId: "hello-2",
      roomCode,
      type: "connection.hello",
    });

    await expect(observerBootstrapPromise).resolves.toMatchObject({
      requestId: "hello-2",
      roomCode,
      snapshot: {
        room: {
          seats: [
            expect.objectContaining({
              id: "left",
              occupiedByParticipantId: hostParticipantId,
            }),
            expect.objectContaining({
              id: "right",
              occupiedByParticipantId: guestParticipantId,
            }),
          ],
        },
        seq: afterHttpCommandSnapshot.seq,
      },
      type: "connection.bootstrap",
    });
  });

  it("protects room service endpoints when a bearer token is configured", async () => {
    const sidecar = await createStartedSidecar(
      createTestConfig({
        roomServiceBearerToken: "service-secret",
      }),
    );
    const origin = getOrigin(sidecar);
    const handshakeResponse = await fetch(`${origin}/_internal/rooms`, {
      headers: { authorization: "Bearer service-secret" },
    });
    const mutationUrl = `${origin}/_internal/rooms/${MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT}`;
    const unauthorizedResponse = await fetch(mutationUrl, {
      body: "{}",
      method: "POST",
    });
    const authorizedResponse = await fetch(mutationUrl, {
      body: JSON.stringify({
        host: {
          displayName: "Ada Host",
          id: "user-1",
        },
      }),
      headers: {
        ...ROOM_SERVICE_MUTATION_HEADERS,
        authorization: "Bearer service-secret",
      },
      method: "POST",
    });

    expect(handshakeResponse.status).toBe(200);
    await expect(handshakeResponse.json()).resolves.toEqual({
      accountPartyMemberships: true,
      authenticatedAdmission: true,
      membershipOnlyReacquisition: true,
      mutationPathSegment: MULTIPLAYER_ROOM_PROTOCOL_PATH_SEGMENT,
      participantCapabilities: true,
      protocolVersion: MULTIPLAYER_ROOM_PROTOCOL_VERSION,
      socialPresenceLeases: true,
    });
    expect(unauthorizedResponse.status).toBe(401);
    await expect(unauthorizedResponse.json()).resolves.toEqual({
      error: "Unauthorized.",
    });
    expect(authorizedResponse.status).toBe(201);
    expectStoreSuccess(await readStoreResult(authorizedResponse));
  });

  it("imports without resolving the Next server-only marker", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => {
      throw new Error("The sidecar entrypoint must not import server-only.");
    });

    try {
      const { createMultiplayerRoomSidecar: createSidecar } = await import(
        "./multiplayer-room-sidecar"
      );
      const sidecar = createSidecar(createTestConfig());

      cleanupCallbacks.push(() => sidecar.close());

      expect(sidecar.gateway.webSocketServer.options.path).toBe("/rooms");
    } finally {
      vi.doUnmock("server-only");
    }
  });
});
