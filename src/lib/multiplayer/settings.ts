import { isGameId, type GameId } from "../game-catalog";

export type PrivateRoomSettingValue =
  | boolean
  | null
  | number
  | string
  | readonly PrivateRoomSettingValue[]
  | { readonly [key: string]: PrivateRoomSettingValue };

export type PrivateRoomSettings = {
  gameId: GameId;
  parameters?: Readonly<Record<string, PrivateRoomSettingValue>>;
};

// Count JSON containers, including settings at depth 1 and parameters at depth 2.
// Admission stays well below native JSON.stringify stack limits and leaves room
// for protocol envelopes within the 64 KiB request/message transport budget.
export const MAX_PRIVATE_ROOM_SETTINGS_DEPTH = 32;
export const MAX_PRIVATE_ROOM_SETTINGS_BYTES = 16 * 1024;

type SettingsCopyResult =
  | { success: true; value: PrivateRoomSettingValue }
  | { success: false; error: string };

type SettingsLimits = { maxBytes: number; maxDepth: number };
const encoder = new TextEncoder();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function copySettingTree(
  value: unknown,
  limits?: SettingsLimits,
): SettingsCopyResult {
  const invalid = {
    success: false,
    error: "Room parameters must contain JSON-compatible values.",
  } as const;
  const tooLarge = {
    success: false,
    error: `Room settings must not exceed ${MAX_PRIVATE_ROOM_SETTINGS_BYTES} serialized UTF-8 bytes.`,
  } as const;
  const holder = { value: null as PrivateRoomSettingValue };
  const pending = [
    { value, containerDepth: 1, target: holder as object, key: "value" },
  ];
  const visited = new WeakSet<object>();
  let bytes = 0;

  try {
    while (pending.length > 0) {
      const item = pending.pop()!;
      const current = item.value;
      let copy: PrivateRoomSettingValue;

      if (
        current === null ||
        typeof current === "boolean" ||
        typeof current === "string" ||
        (typeof current === "number" && Number.isFinite(current))
      ) {
        // String length is a cheap lower bound before allocating an escaped UTF-8 copy.
        if (
          limits &&
          typeof current === "string" &&
          current.length > limits.maxBytes - bytes
        ) {
          return tooLarge;
        }
        if (limits) {
          bytes += encoder.encode(JSON.stringify(current)).byteLength;
        }
        copy = current;
      } else if (typeof current === "object" && current !== null) {
        // Parsed JSON is a tree; cycles and shared references cannot cross the wire.
        if (visited.has(current)) {
          return invalid;
        }
        visited.add(current);
        if (limits && item.containerDepth > limits.maxDepth) {
          return {
            success: false,
            error: `Room settings must not exceed ${limits.maxDepth} nested JSON containers.`,
          };
        }

        const array = Array.isArray(current);
        const keys = array
          ? Array.from({ length: current.length }, (_, index) => String(index))
          : Object.keys(current);
        if (limits) {
          bytes += 2 + Math.max(0, keys.length - 1);
        }
        copy = array ? [] : {};
        for (const key of keys.reverse()) {
          if (limits && !array) {
            if (key.length > limits.maxBytes - bytes) {
              return tooLarge;
            }
            bytes += encoder.encode(JSON.stringify(key)).byteLength + 1;
          }
          if (limits && bytes > limits.maxBytes) {
            return tooLarge;
          }
          pending.push({
            value: (current as Record<string, unknown>)[key],
            containerDepth: item.containerDepth + 1,
            target: copy as object,
            key,
          });
        }
      } else {
        return invalid;
      }

      if (limits && bytes > limits.maxBytes) {
        return tooLarge;
      }
      // Defining data properties preserves JSON keys such as __proto__ without
      // invoking an inherited setter or retaining references to the source tree.
      Object.defineProperty(item.target, item.key, {
        configurable: true,
        enumerable: true,
        value: copy,
        writable: true,
      });
    }
  } catch {
    return invalid;
  }

  return { success: true, value: holder.value };
}

/** Structural validation is total and has no admission-depth limit. */
export function isPrivateRoomSettingValue(
  value: unknown,
): value is PrivateRoomSettingValue {
  return copySettingTree(value).success;
}

/** Normalizes, bounds, and independently copies settings before room admission. */
export function normalizePrivateRoomSettings(value: unknown):
  | { success: true; settings: PrivateRoomSettings }
  | { success: false; error: string } {
  try {
    const gameId =
      isRecord(value) && typeof value.gameId === "string"
        ? value.gameId.trim()
        : "";
    if (!isGameId(gameId)) {
      return {
        success: false,
        error: "Room settings require a supported game id.",
      };
    }
    const parameters = (value as Record<string, unknown>).parameters;
    if (parameters !== undefined && !isRecord(parameters)) {
      return { success: false, error: "Room parameters must be a JSON object." };
    }
    const result = copySettingTree(
      { gameId, ...(parameters === undefined ? {} : { parameters }) },
      {
        maxBytes: MAX_PRIVATE_ROOM_SETTINGS_BYTES,
        maxDepth: MAX_PRIVATE_ROOM_SETTINGS_DEPTH,
      },
    );
    return result.success
      ? { success: true, settings: result.value as PrivateRoomSettings }
      : result;
  } catch {
    return {
      success: false,
      error: "Room parameters must contain JSON-compatible values.",
    };
  }
}

/** Copies canonical room settings without recursive traversal. */
export function clonePrivateRoomSettings(
  settings: PrivateRoomSettings,
): PrivateRoomSettings {
  const result = copySettingTree(settings);
  if (!result.success) {
    throw new Error(result.error);
  }
  return result.value as PrivateRoomSettings;
}
