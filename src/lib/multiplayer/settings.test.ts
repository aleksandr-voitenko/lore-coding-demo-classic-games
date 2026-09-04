import { describe, expect, it } from "vitest";

import {
  clonePrivateRoomSettings,
  isPrivateRoomSettingValue,
  MAX_PRIVATE_ROOM_SETTINGS_BYTES,
  MAX_PRIVATE_ROOM_SETTINGS_DEPTH,
  normalizePrivateRoomSettings,
  type PrivateRoomSettings,
} from "./settings";

function expectSettings(value: unknown) {
  const result = normalizePrivateRoomSettings(value);
  if (!result.success) throw new Error(result.error);
  return result.settings;
}

function jsonBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

describe("shared private room settings", () => {
  it.each(["x", "é", "😀", "\n", "\ud800"])(
    "counts escaped UTF-8 bytes exactly for %j, including envelope bytes",
    (character) => {
      const empty = { gameId: "pong", parameters: { future: "" } };
      const capacity = MAX_PRIVATE_ROOM_SETTINGS_BYTES - jsonBytes(empty);
      const characterBytes = jsonBytes(character) - 2;
      const value = character.repeat(Math.floor(capacity / characterBytes)) +
        "x".repeat(capacity % characterBytes);
      const settings = { gameId: "pong", parameters: { future: value } };
      expect(jsonBytes(settings)).toBe(MAX_PRIVATE_ROOM_SETTINGS_BYTES);
      expect(expectSettings(settings)).toEqual(settings);
      expect(normalizePrivateRoomSettings({
        ...settings, parameters: { future: value + "x" },
      })).toMatchObject({ success: false });
    },
  );

  it("counts object keys and nested container punctuation toward the byte budget", () => {
    const key = "é".repeat(200);
    const parameters = { [key]: [{ value: "" }] };
    const empty = { gameId: "pong", parameters };
    const capacity = MAX_PRIVATE_ROOM_SETTINGS_BYTES - jsonBytes(empty);
    parameters[key][0].value = "x".repeat(capacity);
    expect(jsonBytes(empty)).toBe(MAX_PRIVATE_ROOM_SETTINGS_BYTES);
    expect(expectSettings(empty)).toEqual(empty);
    parameters[key][0].value += "x";
    expect(normalizePrivateRoomSettings(empty)).toMatchObject({ success: false });
  });

  it("counts the normalized settings root and parameters object in the nesting limit", () => {
    let value: unknown = true;
    for (let depth = 2; depth < MAX_PRIVATE_ROOM_SETTINGS_DEPTH; depth += 1) {
      value = { future: value };
    }
    const settings = expectSettings({ gameId: " pong ", parameters: { future: value } });
    expect(JSON.parse(JSON.stringify(settings))).toEqual(settings);
    expect(normalizePrivateRoomSettings({
      gameId: "pong", parameters: { future: { future: value } },
    })).toMatchObject({ success: false });
  });

  it("copies nested arrays, records, and special JSON keys without sharing references", () => {
    const source = JSON.parse(
      '{"gameId":"pong","parameters":{"__proto__":{"safe":true},"list":[{"value":1}],"last":null}}',
    ) as PrivateRoomSettings;
    const normalized = expectSettings(source);
    const snapshot = clonePrivateRoomSettings(normalized);
    expect(JSON.stringify(snapshot)).toBe(JSON.stringify(source));
    expect(Object.hasOwn(snapshot.parameters!, "__proto__")).toBe(true);
    (source.parameters!.list as Array<{ value: number }>)[0].value = 2;
    (normalized.parameters!.list as Array<{ value: number }>)[0].value = 3;
    expect((snapshot.parameters!.list as Array<{ value: number }>)[0]).toEqual({ value: 1 });
  });

  it("keeps structural validation independent from admission limits", () => {
    let value: unknown = true;
    for (let depth = 0; depth < 20_000; depth += 1) value = [value];
    expect(isPrivateRoomSettingValue(value)).toBe(true);
    expect(normalizePrivateRoomSettings({ gameId: "pong", parameters: { future: value } }))
      .toMatchObject({ success: false });
  });

  it.each([undefined, Number.NaN, Infinity, BigInt(1), () => undefined])(
    "rejects non-JSON values through total structural and admission guards",
    (value) => {
      expect(isPrivateRoomSettingValue(value)).toBe(false);
      expect(normalizePrivateRoomSettings({ gameId: "pong", parameters: { future: value } }))
        .toMatchObject({ success: false });
    },
  );

  it("rejects cycles, shared references, and failing reflective access without throwing", () => {
    const shared = { value: true };
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const throwing = Object.defineProperty({}, "future", {
      enumerable: true, get() { throw new Error("Cannot read setting"); },
    });
    for (const parameters of [cyclic, { first: shared, second: shared }, throwing]) {
      expect(isPrivateRoomSettingValue(parameters)).toBe(false);
      expect(normalizePrivateRoomSettings({ gameId: "pong", parameters }))
        .toMatchObject({ success: false });
    }
  });
});
