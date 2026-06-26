export type MultiplayerRoomEventType =
  | "game.inputAccepted"
  | "game.snapshotAdvanced"
  | "participant.observerJoined"
  | "room.created"
  | "room.lifecycle"
  | "room.settingsUpdated"
  | "seat.claimed"
  | "seat.released";

export type MultiplayerRoomEventPayloadValue =
  | boolean
  | null
  | number
  | string
  | readonly MultiplayerRoomEventPayloadValue[]
  | {
      readonly [key: string]: MultiplayerRoomEventPayloadValue;
    };

export type MultiplayerRoomEventPayload = Readonly<
  Record<string, MultiplayerRoomEventPayloadValue>
>;

export type MultiplayerRoomEventLogEntry = {
  readonly eventSeq: number;
  readonly gameId?: string;
  readonly gameSeq?: number;
  readonly participantId?: string;
  readonly payload: MultiplayerRoomEventPayload;
  readonly roomCode: string;
  readonly roomSeq: number;
  readonly timestampMs: number;
  readonly type: MultiplayerRoomEventType;
};

export type AppendMultiplayerRoomEventLogEntry = Omit<
  MultiplayerRoomEventLogEntry,
  "eventSeq"
>;

// Process-local foundation only; durable storage and WebSocket event schemas
// should build on this ordering model without reusing it as a wire contract.
export class InMemoryMultiplayerRoomEventLog {
  readonly #eventsByRoomCode = new Map<string, MultiplayerRoomEventLogEntry[]>();

  append(event: AppendMultiplayerRoomEventLogEntry) {
    const events = this.#eventsByRoomCode.get(event.roomCode) ?? [];
    const entry = {
      ...event,
      eventSeq: events.length + 1,
      payload: cloneEventPayload(event.payload),
    };

    events.push(entry);
    this.#eventsByRoomCode.set(event.roomCode, events);

    return cloneEventLogEntry(entry);
  }

  getRoomEvents(roomCode: string) {
    return (this.#eventsByRoomCode.get(roomCode) ?? []).map((event) =>
      cloneEventLogEntry(event),
    );
  }
}

function cloneEventLogEntry(
  entry: MultiplayerRoomEventLogEntry,
): MultiplayerRoomEventLogEntry {
  return {
    ...entry,
    payload: cloneEventPayload(entry.payload),
  };
}

function cloneEventPayload(
  payload: MultiplayerRoomEventPayload,
): MultiplayerRoomEventPayload {
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, cloneEventPayloadValue(value)]),
  );
}

function cloneEventPayloadValue(
  value: MultiplayerRoomEventPayloadValue,
): MultiplayerRoomEventPayloadValue {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneEventPayloadValue(entry));
  }

  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        cloneEventPayloadValue(entry),
      ]),
    );
  }

  return value;
}
