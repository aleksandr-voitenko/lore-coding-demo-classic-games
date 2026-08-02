import { describe, expect, it } from "vitest";

import {
  DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_LEASE_TTL_MS,
  DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_MAX_LEASES_PER_ACCOUNT,
  MultiplayerSocialPresenceRegistry,
  normalizeMultiplayerSocialPresenceClientId,
} from "./multiplayer-social-presence";

const CLIENT_A = "client_account_a";
const CLIENT_B = "client_account_b";

function createRegistry(
  options: {
    leaseTtlMs?: number;
    maxLeasesPerAccount?: number;
    nowMs?: number;
  } = {},
) {
  let nowMs = options.nowMs ?? 1_000;
  const registry = new MultiplayerSocialPresenceRegistry({
    getNowMs: () => nowMs,
    ...(options.leaseTtlMs === undefined
      ? {}
      : { leaseTtlMs: options.leaseTtlMs }),
    ...(options.maxLeasesPerAccount === undefined
      ? {}
      : { maxLeasesPerAccount: options.maxLeasesPerAccount }),
  });

  return {
    advanceBy: (durationMs: number) => {
      nowMs += durationMs;
    },
    registry,
    setNowMs: (value: number) => {
      nowMs = value;
    },
  };
}

describe("multiplayer social presence registry", () => {
  it("uses the bounded production defaults and validates injected limits", () => {
    expect(DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_LEASE_TTL_MS).toBe(45_000);
    expect(
      DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_MAX_LEASES_PER_ACCOUNT,
    ).toBe(16);

    for (const leaseTtlMs of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        () => new MultiplayerSocialPresenceRegistry({ leaseTtlMs }),
      ).toThrow("Social presence lease TTL must be a positive integer.");
    }

    for (const maxLeasesPerAccount of [
      0,
      -1,
      1.5,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(
        () =>
          new MultiplayerSocialPresenceRegistry({ maxLeasesPerAccount }),
      ).toThrow("Social presence lease capacity must be a positive integer.");
    }
  });

  it("normalizes account and client identifiers while rejecting unsupported input", () => {
    const { registry } = createRegistry();

    expect(normalizeMultiplayerSocialPresenceClientId(` ${CLIENT_A} `)).toBe(
      CLIENT_A,
    );
    expect(normalizeMultiplayerSocialPresenceClientId("short-client")).toBeNull();
    expect(
      normalizeMultiplayerSocialPresenceClientId("invalid client id!"),
    ).toBeNull();
    expect(
      normalizeMultiplayerSocialPresenceClientId("x".repeat(129)),
    ).toBeNull();
    expect(
      registry.renewLease({
        clientId: ` ${CLIENT_A} `,
        state: "available",
        userId: " user-1 ",
      }),
    ).toEqual({
      created: true,
      lease: {
        clientId: CLIENT_A,
        expiresAtMs: 46_000,
        state: "available",
        userId: "user-1",
      },
      success: true,
    });
    expect(
      registry.renewLease({
        clientId: CLIENT_A,
        state: "idle",
        userId: "user-1",
      }),
    ).toMatchObject({ code: "invalid-presence-state", success: false });
    expect(
      registry.renewLease({
        clientId: "short",
        state: "available",
        userId: "user-1",
      }),
    ).toMatchObject({ code: "invalid-client-id", success: false });
    expect(
      registry.renewLease({
        clientId: CLIENT_A,
        state: "available",
        userId: "bad_user",
      }),
    ).toMatchObject({ code: "invalid-user-id", success: false });
  });

  it("renews one client id idempotently and can update its browser state", () => {
    const { advanceBy, registry } = createRegistry({ leaseTtlMs: 100 });

    expect(
      registry.renewLease({
        clientId: CLIENT_A,
        state: "available",
        userId: "user-1",
      }),
    ).toMatchObject({
      created: true,
      lease: { expiresAtMs: 1_100, state: "available" },
      success: true,
    });

    advanceBy(60);

    expect(
      registry.renewLease({
        clientId: CLIENT_A,
        state: "busy",
        userId: "user-1",
      }),
    ).toMatchObject({
      created: false,
      lease: { expiresAtMs: 1_160, state: "busy" },
      success: true,
    });
    expect(registry.getPresence("user-1")).toEqual({
      activeLeaseCount: 1,
      membership: null,
      state: "busy",
      userId: "user-1",
    });
  });

  it("enforces the per-account cap only for a new active lease", () => {
    const { registry } = createRegistry({ maxLeasesPerAccount: 2 });

    for (const clientId of [CLIENT_A, CLIENT_B]) {
      expect(
        registry.renewLease({
          clientId,
          state: "available",
          userId: "user-1",
        }),
      ).toMatchObject({ created: true, success: true });
    }

    expect(
      registry.renewLease({
        clientId: "client_account_c",
        state: "available",
        userId: "user-1",
      }),
    ).toMatchObject({ code: "lease-capacity-reached", success: false });
    expect(
      registry.renewLease({
        clientId: CLIENT_A,
        state: "busy",
        userId: "user-1",
      }),
    ).toMatchObject({ created: false, success: true });
    expect(
      registry.renewLease({
        clientId: "client_account_c",
        state: "available",
        userId: "user-2",
      }),
    ).toMatchObject({ created: true, success: true });
  });

  it("enforces the default 16-lease cap and reuses an exactly expired slot", () => {
    const { advanceBy, registry } = createRegistry({ leaseTtlMs: 100 });

    for (
      let clientNumber = 0;
      clientNumber <
      DEFAULT_MULTIPLAYER_SOCIAL_PRESENCE_MAX_LEASES_PER_ACCOUNT;
      clientNumber += 1
    ) {
      expect(
        registry.renewLease({
          clientId: `client_${clientNumber.toString().padStart(10, "0")}`,
          state: "available",
          userId: "user-1",
        }),
      ).toMatchObject({ created: true, success: true });
    }

    expect(
      registry.renewLease({
        clientId: "client_over_limit",
        state: "available",
        userId: "user-1",
      }),
    ).toMatchObject({ code: "lease-capacity-reached", success: false });

    advanceBy(100);

    expect(
      registry.renewLease({
        clientId: "client_over_limit",
        state: "available",
        userId: "user-1",
      }),
    ).toMatchObject({ created: true, success: true });
  });

  it("releases leases idempotently without disturbing another client", () => {
    const { registry } = createRegistry();

    for (const clientId of [CLIENT_A, CLIENT_B]) {
      registry.renewLease({
        clientId,
        state: "available",
        userId: "user-1",
      });
    }

    expect(
      registry.releaseLease({ clientId: CLIENT_A, userId: "user-1" }),
    ).toEqual({ released: true, success: true });
    expect(
      registry.releaseLease({ clientId: CLIENT_A, userId: "user-1" }),
    ).toEqual({ released: false, success: true });
    expect(registry.getPresence("user-1")).toMatchObject({
      activeLeaseCount: 1,
      state: "available",
    });
    expect(
      registry.releaseLease({ clientId: CLIENT_B, userId: "user-2" }),
    ).toEqual({ released: false, success: true });
  });

  it("expires leases at the exact boundary and prunes them globally", () => {
    const { advanceBy, registry } = createRegistry({ leaseTtlMs: 100 });

    registry.renewLease({
      clientId: CLIENT_A,
      state: "available",
      userId: "user-1",
    });
    registry.renewLease({
      clientId: CLIENT_B,
      state: "busy",
      userId: "user-2",
    });

    advanceBy(99);
    expect(registry.getEffectiveState("user-1")).toBe("available");
    expect(registry.pruneExpiredLeases()).toBe(0);

    advanceBy(1);
    expect(registry.getEffectiveState("user-1")).toBe("offline");
    expect(registry.pruneExpiredLeases()).toBe(1);
    expect(registry.releaseLease({ clientId: CLIENT_A, userId: "user-1" })).toEqual(
      { released: false, success: true },
    );
  });

  it("aggregates leases with in-party, busy, available, then offline priority", () => {
    const { registry } = createRegistry();

    expect(registry.getEffectiveState("user-1")).toBe("offline");

    registry.renewLease({
      clientId: CLIENT_A,
      state: "available",
      userId: "user-1",
    });
    expect(registry.getEffectiveState("user-1")).toBe("available");

    registry.renewLease({
      clientId: CLIENT_B,
      state: "busy",
      userId: "user-1",
    });
    expect(registry.getEffectiveState("user-1")).toBe("busy");

    expect(
      registry.setPartyMembership({
        participantId: "participant-1",
        roomCode: " room-1 ",
        userId: "user-1",
      }),
    ).toMatchObject({
      changed: true,
      membership: { roomCode: "ROOM-1" },
      success: true,
    });
    expect(registry.getEffectiveState("user-1")).toBe("in-party");

    registry.releaseLease({ clientId: CLIENT_A, userId: "user-1" });
    registry.releaseLease({ clientId: CLIENT_B, userId: "user-1" });
    expect(registry.getPresence("user-1")).toEqual({
      activeLeaseCount: 0,
      membership: {
        participantId: "participant-1",
        roomCode: "ROOM-1",
        userId: "user-1",
      },
      state: "in-party",
      userId: "user-1",
    });
  });

  it("sets one membership idempotently and reports conflicting party state", () => {
    const { registry } = createRegistry();
    const membership = {
      participantId: "participant-1",
      roomCode: "ROOM-1",
      userId: "user-1",
    };

    expect(registry.setPartyMembership(membership)).toEqual({
      changed: true,
      membership,
      success: true,
    });
    expect(registry.setPartyMembership(membership)).toEqual({
      changed: false,
      membership,
      success: true,
    });
    expect(
      registry.setPartyMembership({
        ...membership,
        roomCode: "ROOM-2",
      }),
    ).toMatchObject({ code: "in-other-party", success: false });
    expect(
      registry.setPartyMembership({
        ...membership,
        participantId: "participant-2",
      }),
    ).toMatchObject({ code: "participant-conflict", success: false });
    expect(registry.getPartyMembership("user-1")).toEqual(membership);
  });

  it("validates membership identity without changing an existing membership", () => {
    const { registry } = createRegistry();

    expect(
      registry.setPartyMembership({
        participantId: "participant_1",
        roomCode: "ROOM-1",
        userId: "user-1",
      }),
    ).toMatchObject({ code: "invalid-participant-id", success: false });
    expect(
      registry.setPartyMembership({
        participantId: "participant-1",
        roomCode: "bad room",
        userId: "user-1",
      }),
    ).toMatchObject({ code: "invalid-room-code", success: false });
    expect(
      registry.setPartyMembership({
        participantId: "participant-1",
        roomCode: "ROOM-1",
        userId: "bad_user",
      }),
    ).toMatchObject({ code: "invalid-user-id", success: false });
    expect(registry.getPartyMembership("user-1")).toBeNull();
  });

  it("clears a membership only when the complete identity still matches", () => {
    const { registry } = createRegistry();
    const membership = {
      participantId: "participant-1",
      roomCode: "ROOM-1",
      userId: "user-1",
    };

    registry.setPartyMembership(membership);

    expect(
      registry.clearPartyMembership({
        ...membership,
        participantId: "participant-2",
      }),
    ).toEqual({ cleared: false, success: true });
    expect(
      registry.clearPartyMembership({ ...membership, roomCode: "ROOM-2" }),
    ).toEqual({ cleared: false, success: true });
    expect(registry.getPartyMembership("user-1")).toEqual(membership);
    expect(registry.clearPartyMembership(membership)).toEqual({
      cleared: true,
      success: true,
    });
    expect(registry.clearPartyMembership(membership)).toEqual({
      cleared: false,
      success: true,
    });
  });

  it("bulk-clears only one normalized room and exposes room membership reads", () => {
    const { registry } = createRegistry();
    const roomOneMemberships = [
      {
        participantId: "participant-1",
        roomCode: "ROOM-1",
        userId: "user-1",
      },
      {
        participantId: "participant-2",
        roomCode: "ROOM-1",
        userId: "user-2",
      },
    ];
    const roomTwoMembership = {
      participantId: "participant-3",
      roomCode: "ROOM-2",
      userId: "user-3",
    };

    for (const membership of [...roomOneMemberships, roomTwoMembership]) {
      registry.setPartyMembership(membership);
    }

    expect(registry.getPartyMembershipsForRoom(" room-1 ")).toEqual(
      roomOneMemberships,
    );
    expect(registry.clearPartyMembershipsForRoom(" room-1 ")).toEqual({
      clearedMemberships: roomOneMemberships,
      success: true,
    });
    expect(registry.getPartyMembership("user-1")).toBeNull();
    expect(registry.getPartyMembership("user-2")).toBeNull();
    expect(registry.getPartyMembership("user-3")).toEqual(roomTwoMembership);
    expect(registry.clearPartyMembershipsForRoom("bad room")).toMatchObject({
      code: "invalid-room-code",
      success: false,
    });
  });

  it("rejects an invalid fake clock before mutating lease state", () => {
    const registry = new MultiplayerSocialPresenceRegistry({
      getNowMs: () => Number.NaN,
    });

    expect(() =>
      registry.renewLease({
        clientId: CLIENT_A,
        state: "available",
        userId: "user-1",
      }),
    ).toThrow("Social presence clock must return a non-negative safe integer.");
    expect(registry.getPartyMembership("user-1")).toBeNull();
  });

  it("does not retain an empty account after lease-expiry overflow", () => {
    let nowMs = Number.MAX_SAFE_INTEGER;
    const registry = new MultiplayerSocialPresenceRegistry({
      getNowMs: () => nowMs,
    });

    expect(() =>
      registry.renewLease({
        clientId: CLIENT_A,
        state: "available",
        userId: "user-1",
      }),
    ).toThrow("Social presence lease expiry must be a safe integer.");

    nowMs = 1_000;

    expect(registry.getPresence("user-1")).toEqual({
      activeLeaseCount: 0,
      membership: null,
      state: "offline",
      userId: "user-1",
    });
  });
});
