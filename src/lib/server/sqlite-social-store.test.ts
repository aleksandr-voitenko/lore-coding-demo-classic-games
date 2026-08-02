import Database from "better-sqlite3";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { PartyInvitationIntent } from "@/lib/social";
import { createUserDisplayNameKey } from "@/lib/user-profile";

import {
  SOCIAL_API_RATE_LIMITS,
  SqliteSocialStore,
  type PartyInvitationMutationResult,
  type SocialOverviewResult,
} from "./sqlite-social-store";

const START_TIME = Date.parse("2026-08-03T10:00:00.000Z");
const INVITATION_TTL_MS = 60_000;

const USERS = [
  { displayName: "Ada Lovelace", id: "user-ada" },
  { displayName: "Alan Turing", id: "user-alan" },
  { displayName: "amy adams", id: "user-amy" },
  { displayName: "Betty Holberton", id: "user-betty" },
  { displayName: "Carl Gauss", id: "user-carl" },
  { displayName: "Dana Scott", id: "user-dana" },
  { displayName: "Eve Online", id: "user-eve" },
  { displayName: "Grace Hopper", id: "user-grace" },
  { displayName: "Legacy Hero", id: "user-legacy", passwordless: true },
  { displayName: "Zed Shaw", id: "user-zed" },
] as const;

type InvitationRecord = {
  id: string;
  partyCode: string;
  resolvedAt: string | null;
  status: string;
  updatedAt: string;
};

type StoreHarness = ReturnType<typeof createStoreHarness>;

function seedUsers(databasePath: string) {
  const database = new Database(databasePath);
  const insertUser = database.prepare<{
    createdAt: string;
    displayName: string;
    displayNameKey: string;
    id: string;
    passwordHash: string | null;
  }>(`
    INSERT INTO users (
      id,
      display_name,
      display_name_key,
      password_hash,
      created_at,
      updated_at
    )
    VALUES (
      @id,
      @displayName,
      @displayNameKey,
      @passwordHash,
      @createdAt,
      @createdAt
    )
  `);
  const insertUsers = database.transaction(() => {
    for (const user of USERS) {
      insertUser.run({
        createdAt: new Date(START_TIME).toISOString(),
        displayName: user.displayName,
        displayNameKey: createUserDisplayNameKey(user.displayName),
        id: user.id,
        passwordHash: "passwordless" in user ? null : "test-password-hash",
      });
    }
  });

  insertUsers.immediate();
  database.close();
}

function createStoreHarness() {
  const tempDir = mkdtempSync(join(tmpdir(), "social-store-"));
  const databasePath = join(tempDir, "social.sqlite");
  const stores = new Set<SqliteSocialStore>();
  let currentTime = START_TIME;
  let nextAcceptanceClaimToken = 0;
  let nextInvitationId = 0;

  function createStore(
    options: {
      acceptanceClaimTtlMs?: number;
      acceptanceRecoveryGraceMs?: number;
      createAcceptanceClaimToken?: () => string;
      createId?: () => string;
      maxIncomingFriendRequestsPerUser?: number;
      maxOutgoingFriendRequestsPerUser?: number;
      maxPendingPartyInvitationsPerInviter?: number;
      maxPendingPartyInvitationsPerRecipient?: number;
      maxResolvedPartyInvitationHistory?: number;
    } = {},
  ) {
    const store = new SqliteSocialStore({
      acceptanceClaimTtlMs: options.acceptanceClaimTtlMs,
      acceptanceRecoveryGraceMs: options.acceptanceRecoveryGraceMs,
      createAcceptanceClaimToken:
        options.createAcceptanceClaimToken ??
        (() => `claim-${++nextAcceptanceClaimToken}`),
      createId: options.createId ?? (() => `invitation-${++nextInvitationId}`),
      databasePath,
      maxIncomingFriendRequestsPerUser:
        options.maxIncomingFriendRequestsPerUser,
      maxOutgoingFriendRequestsPerUser:
        options.maxOutgoingFriendRequestsPerUser,
      maxPendingPartyInvitationsPerInviter:
        options.maxPendingPartyInvitationsPerInviter,
      maxPendingPartyInvitationsPerRecipient:
        options.maxPendingPartyInvitationsPerRecipient,
      maxResolvedPartyInvitationHistory:
        options.maxResolvedPartyInvitationHistory,
      now: () => new Date(currentTime),
      partyInvitationTtlMs: INVITATION_TTL_MS,
    });
    stores.add(store);
    return store;
  }

  const store = createStore();
  seedUsers(databasePath);

  return {
    advanceTime(milliseconds = 1000) {
      currentTime += milliseconds;
      return new Date(currentTime).toISOString();
    },
    closeStore(storeToClose: SqliteSocialStore) {
      if (stores.delete(storeToClose)) {
        storeToClose.close();
      }
    },
    createStore,
    databasePath,
    dispose() {
      for (const openStore of stores) {
        openStore.close();
      }
      stores.clear();
      rmSync(tempDir, { force: true, recursive: true });
    },
    expiresIn(milliseconds = INVITATION_TTL_MS) {
      return new Date(currentTime + milliseconds).toISOString();
    },
    now() {
      return new Date(currentTime).toISOString();
    },
    setTime(timestamp: string) {
      currentTime = Date.parse(timestamp);
    },
    store,
  };
}

function readInvitationRecords(databasePath: string) {
  const database = new Database(databasePath, { readonly: true });
  const rows = database
    .prepare(`
      SELECT
        id,
        party_code AS partyCode,
        status,
        updated_at AS updatedAt,
        resolved_at AS resolvedAt
      FROM party_invitations
      ORDER BY id ASC
    `)
    .all() as InvitationRecord[];
  database.close();
  return rows;
}

function expectOverview(result: SocialOverviewResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(`Expected social overview, got ${result.reason}.`);
  }

  return result.overview;
}

function expectInvitation(result: PartyInvitationMutationResult) {
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(`Expected party invitation, got ${result.reason}.`);
  }

  return result.invitation;
}

async function makeFriends(
  harness: StoreHarness,
  requesterUserId: string,
  recipientUserId: string,
  store = harness.store,
) {
  const request = await store.createFriendRequest(
    requesterUserId,
    recipientUserId,
  );
  expect(request.success).toBe(true);

  harness.advanceTime();
  const acceptance = await store.acceptFriendRequest(
    recipientUserId,
    requesterUserId,
  );
  expect(acceptance.success).toBe(true);

  if (!acceptance.success) {
    throw new Error(`Expected friendship, got ${acceptance.reason}.`);
  }

  return acceptance.friend;
}

async function createInvitation(
  harness: StoreHarness,
  {
    intent = "play",
    inviterUserId,
    partyCode,
    recipientUserId,
    store = harness.store,
  }: {
    intent?: PartyInvitationIntent;
    inviterUserId: string;
    partyCode: string;
    recipientUserId: string;
    store?: SqliteSocialStore;
  },
) {
  return expectInvitation(
    await store.createPartyInvitation({
      intent,
      inviterUserId,
      partyCode,
      recipientUserId,
    }),
  );
}

async function claimInvitation(
  store: SqliteSocialStore,
  recipientUserId: string,
  invitationId: string,
) {
  const claim = await store.claimPartyInvitationForAcceptance(
    recipientUserId,
    invitationId,
  );
  expect(claim.success).toBe(true);

  if (!claim.success) {
    throw new Error(`Expected acceptance claim, got ${claim.reason}.`);
  }

  return claim;
}

async function claimAndAcceptInvitation(
  store: SqliteSocialStore,
  recipientUserId: string,
  invitationId: string,
) {
  const claim = await claimInvitation(store, recipientUserId, invitationId);

  return store.acceptPartyInvitationAfterAdmission(
    recipientUserId,
    invitationId,
    claim.claimToken,
  );
}

describe("sqlite social store", () => {
  const disposables: Array<() => void> = [];

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.();
    }
  });

  it("validates configuration before creating or opening the database", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "social-store-invalid-"));
    const databasePath = join(tempDir, "social.sqlite");
    disposables.push(() => rmSync(tempDir, { force: true, recursive: true }));

    expect(
      () =>
        new SqliteSocialStore({
          databasePath,
          maxPendingPartyInvitationsPerRecipient: 0,
        }),
    ).toThrow("Pending party invitation recipient limit");
    expect(existsSync(databasePath)).toBe(false);
  });

  it("discovers exactly normalized account names and reports relationship changes", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);

    await expect(
      harness.store.discoverUser("user-ada", "  GRACE   HOPPER "),
    ).resolves.toEqual({
      discovery: {
        relationship: "none",
        user: { displayName: "Grace Hopper", id: "user-grace" },
      },
      success: true,
    });
    await expect(
      harness.store.discoverUser("user-ada", "Grace"),
    ).resolves.toEqual({ discovery: null, success: true });

    await harness.store.createFriendRequest("user-ada", "user-grace");
    await expect(
      harness.store.discoverUser("user-ada", "Grace Hopper"),
    ).resolves.toMatchObject({
      discovery: { relationship: "outgoing-request" },
      success: true,
    });
    await expect(
      harness.store.discoverUser("user-grace", "Ada Lovelace"),
    ).resolves.toMatchObject({
      discovery: { relationship: "incoming-request" },
      success: true,
    });

    await harness.store.acceptFriendRequest("user-grace", "user-ada");
    await expect(
      harness.store.discoverUser("user-ada", "Grace Hopper"),
    ).resolves.toMatchObject({
      discovery: { relationship: "friends" },
      success: true,
    });
  });

  it("makes self, absent, passwordless, and either-direction blocked discovery indistinguishable", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    const hiddenResult = { discovery: null, success: true };

    await harness.store.blockUser("user-ada", "user-alan");
    await harness.store.blockUser("user-betty", "user-ada");

    await expect(
      harness.store.discoverUser("user-ada", "Ada Lovelace"),
    ).resolves.toEqual(hiddenResult);
    await expect(
      harness.store.discoverUser("user-ada", "Missing User"),
    ).resolves.toEqual(hiddenResult);
    await expect(
      harness.store.discoverUser("user-ada", "Legacy Hero"),
    ).resolves.toEqual(hiddenResult);
    await expect(
      harness.store.discoverUser("user-ada", "Alan Turing"),
    ).resolves.toEqual(hiddenResult);
    await expect(
      harness.store.discoverUser("user-ada", "Betty Holberton"),
    ).resolves.toEqual(hiddenResult);

    await expect(harness.store.discoverUser("bad user", "Grace Hopper")).resolves.toEqual({
      reason: "invalid-user-id",
      success: false,
    });
    await expect(harness.store.discoverUser("user-ada", "   ")).resolves.toEqual({
      reason: "invalid-display-name",
      success: false,
    });
    await expect(harness.store.discoverUser("user-missing", "Grace Hopper")).resolves.toEqual({
      reason: "user-not-found",
      success: false,
    });
  });

  it("rate-limits social API actions independently and resets fixed windows", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    const discoveryLimit = SOCIAL_API_RATE_LIMITS.discovery.limit;

    for (let request = 0; request < discoveryLimit; request += 1) {
      await expect(
        harness.store.consumeSocialApiRateLimit("user-ada", "discovery"),
      ).resolves.toMatchObject({
        allowed: true,
        remaining: discoveryLimit - request - 1,
        success: true,
      });
    }

    await expect(
      harness.store.consumeSocialApiRateLimit("user-ada", "discovery"),
    ).resolves.toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 60,
      success: true,
    });
    await expect(
      harness.store.consumeSocialApiRateLimit("user-ada", "friend-request"),
    ).resolves.toMatchObject({ allowed: true, success: true });
    const partyInvitationLimit =
      SOCIAL_API_RATE_LIMITS["party-invitation"].limit;

    for (let request = 0; request < partyInvitationLimit; request += 1) {
      await expect(
        harness.store.consumeSocialApiRateLimit(
          "user-ada",
          "party-invitation",
        ),
      ).resolves.toMatchObject({
        allowed: true,
        remaining: partyInvitationLimit - request - 1,
        success: true,
      });
    }

    await expect(
      harness.store.consumeSocialApiRateLimit(
        "user-ada",
        "party-invitation",
      ),
    ).resolves.toMatchObject({ allowed: false, remaining: 0, success: true });

    harness.advanceTime(SOCIAL_API_RATE_LIMITS.discovery.windowMs);
    await expect(
      harness.store.consumeSocialApiRateLimit("user-ada", "discovery"),
    ).resolves.toMatchObject({
      allowed: true,
      remaining: discoveryLimit - 1,
      success: true,
    });
    await expect(
      harness.store.consumeSocialApiRateLimit("bad user", "discovery"),
    ).resolves.toEqual({ reason: "invalid-user-id", success: false });
    await expect(
      harness.store.consumeSocialApiRateLimit("user-ada", "unsupported"),
    ).resolves.toEqual({
      reason: "invalid-rate-limit-action",
      success: false,
    });
  });

  it("returns ordered, directional, actor-isolated overviews with unknown friend availability", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);

    await makeFriends(harness, "user-ada", "user-zed");
    harness.advanceTime();
    await makeFriends(harness, "user-amy", "user-ada");

    harness.advanceTime();
    await harness.store.createFriendRequest("user-ada", "user-dana");
    harness.advanceTime();
    await harness.store.createFriendRequest("user-ada", "user-carl");
    harness.advanceTime();
    await harness.store.createFriendRequest("user-eve", "user-ada");
    harness.advanceTime();
    await harness.store.createFriendRequest("user-betty", "user-ada");

    harness.advanceTime();
    await harness.store.blockUser("user-ada", "user-alan");
    harness.advanceTime();
    await harness.store.blockUser("user-ada", "user-grace");

    harness.advanceTime();
    const outgoingOld = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "OUT-OLD",
      recipientUserId: "user-amy",
    });
    harness.advanceTime();
    const outgoingNew = await createInvitation(harness, {
      intent: "watch",
      inviterUserId: "user-ada",
      partyCode: "OUT-NEW",
      recipientUserId: "user-zed",
    });
    harness.advanceTime();
    const incomingOld = await createInvitation(harness, {
      inviterUserId: "user-amy",
      partyCode: "IN-OLD",
      recipientUserId: "user-ada",
    });
    harness.advanceTime();
    const incomingNew = await createInvitation(harness, {
      intent: "watch",
      inviterUserId: "user-zed",
      partyCode: "IN-NEW",
      recipientUserId: "user-ada",
    });

    const overview = expectOverview(await harness.store.getOverview("user-ada"));

    expect(overview.friends).toEqual([
      {
        availability: "unknown",
        friendsSince: "2026-08-03T10:00:03.000Z",
        user: { displayName: "amy adams", id: "user-amy" },
      },
      {
        availability: "unknown",
        friendsSince: "2026-08-03T10:00:01.000Z",
        user: { displayName: "Zed Shaw", id: "user-zed" },
      },
    ]);
    expect(
      overview.outgoingFriendRequests.map((request) => [
        request.user.id,
        request.direction,
      ]),
    ).toEqual([
      ["user-carl", "outgoing"],
      ["user-dana", "outgoing"],
    ]);
    expect(
      overview.incomingFriendRequests.map((request) => [
        request.user.id,
        request.direction,
      ]),
    ).toEqual([
      ["user-betty", "incoming"],
      ["user-eve", "incoming"],
    ]);
    expect(overview.blockedUsers.map((block) => block.user.id)).toEqual([
      "user-grace",
      "user-alan",
    ]);
    expect(
      overview.outgoingPartyInvitations.map((invitation) => [
        invitation.id,
        invitation.intent,
      ]),
    ).toEqual([
      [outgoingNew.id, "watch"],
      [outgoingOld.id, "play"],
    ]);
    expect(
      overview.incomingPartyInvitations.map((invitation) => [
        invitation.id,
        invitation.intent,
      ]),
    ).toEqual([
      [incomingNew.id, "watch"],
      [incomingOld.id, "play"],
    ]);
    for (const invitation of [
      ...overview.incomingPartyInvitations,
      ...overview.outgoingPartyInvitations,
    ]) {
      expect(invitation).not.toHaveProperty("partyCode");
    }

    expect(expectOverview(await harness.store.getOverview("user-grace"))).toEqual({
      blockedUsers: [],
      friends: [],
      incomingFriendRequests: [],
      incomingPartyInvitations: [],
      outgoingFriendRequests: [],
      outgoingPartyInvitations: [],
    });
    await expect(harness.store.getOverview("bad user")).resolves.toEqual({
      reason: "invalid-user-id",
      success: false,
    });
    await expect(harness.store.getOverview("user-legacy")).resolves.toEqual({
      reason: "user-not-found",
      success: false,
    });
  });

  it("creates friend requests idempotently and rejects reverse, self, absent, and passwordless targets", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    const createdAt = harness.now();

    await expect(
      harness.store.createFriendRequest("user-ada", "user-grace"),
    ).resolves.toEqual({
      created: true,
      request: {
        createdAt,
        direction: "outgoing",
        user: { displayName: "Grace Hopper", id: "user-grace" },
      },
      success: true,
    });
    harness.advanceTime();
    await expect(
      harness.store.createFriendRequest("user-ada", "user-grace"),
    ).resolves.toEqual({
      created: false,
      request: {
        createdAt,
        direction: "outgoing",
        user: { displayName: "Grace Hopper", id: "user-grace" },
      },
      success: true,
    });
    await expect(
      harness.store.createFriendRequest("user-grace", "user-ada"),
    ).resolves.toEqual({ reason: "incoming-request-exists", success: false });
    await expect(
      harness.store.createFriendRequest("user-ada", "user-ada"),
    ).resolves.toEqual({ reason: "invalid-user-id", success: false });
    await expect(
      harness.store.createFriendRequest("user-ada", "user-missing"),
    ).resolves.toEqual({ reason: "user-not-found", success: false });
    await expect(
      harness.store.createFriendRequest("user-ada", "user-legacy"),
    ).resolves.toEqual({ reason: "user-not-found", success: false });
  });

  it("caps pending incoming and outgoing friend requests without breaking retries", async () => {
    const outgoingHarness = createStoreHarness();
    disposables.push(outgoingHarness.dispose);
    const outgoingStore = outgoingHarness.createStore({
      maxOutgoingFriendRequestsPerUser: 1,
    });

    await expect(
      outgoingStore.createFriendRequest("user-ada", "user-grace"),
    ).resolves.toMatchObject({ created: true, success: true });
    await expect(
      outgoingStore.createFriendRequest("user-ada", "user-grace"),
    ).resolves.toMatchObject({ created: false, success: true });
    await expect(
      outgoingStore.createFriendRequest("user-ada", "user-alan"),
    ).resolves.toEqual({
      reason: "friend-request-limit-reached",
      success: false,
    });
    await outgoingStore.cancelFriendRequest("user-ada", "user-grace");
    await expect(
      outgoingStore.createFriendRequest("user-ada", "user-alan"),
    ).resolves.toMatchObject({ created: true, success: true });

    const incomingHarness = createStoreHarness();
    disposables.push(incomingHarness.dispose);
    const incomingStore = incomingHarness.createStore({
      maxIncomingFriendRequestsPerUser: 1,
    });

    await expect(
      incomingStore.createFriendRequest("user-ada", "user-grace"),
    ).resolves.toMatchObject({ created: true, success: true });
    await expect(
      incomingStore.createFriendRequest("user-amy", "user-grace"),
    ).resolves.toEqual({
      reason: "friend-request-limit-reached",
      success: false,
    });
  });

  it("accepts only incoming requests and prevents duplicate friendships", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);

    await harness.store.createFriendRequest("user-ada", "user-grace");
    await expect(
      harness.store.acceptFriendRequest("user-ada", "user-grace"),
    ).resolves.toEqual({
      reason: "friend-request-not-incoming",
      success: false,
    });

    const friendsSince = harness.advanceTime();
    await expect(
      harness.store.acceptFriendRequest("user-grace", "user-ada"),
    ).resolves.toEqual({
      friend: {
        availability: "unknown",
        friendsSince,
        user: { displayName: "Ada Lovelace", id: "user-ada" },
      },
      success: true,
    });
    await expect(
      harness.store.acceptFriendRequest("user-grace", "user-ada"),
    ).resolves.toEqual({
      friend: {
        availability: "unknown",
        friendsSince,
        user: { displayName: "Ada Lovelace", id: "user-ada" },
      },
      success: true,
    });
    await expect(
      harness.store.createFriendRequest("user-ada", "user-grace"),
    ).resolves.toEqual({ reason: "already-friends", success: false });
  });

  it("declines and cancels requests only from their matching direction", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);

    await harness.store.createFriendRequest("user-ada", "user-grace");
    await expect(
      harness.store.declineFriendRequest("user-ada", "user-grace"),
    ).resolves.toEqual({
      reason: "friend-request-not-incoming",
      success: false,
    });
    await expect(
      harness.store.declineFriendRequest("user-grace", "user-ada"),
    ).resolves.toEqual({ success: true });
    await expect(
      harness.store.declineFriendRequest("user-grace", "user-ada"),
    ).resolves.toEqual({ success: true });

    await harness.store.createFriendRequest("user-ada", "user-alan");
    await expect(
      harness.store.cancelFriendRequest("user-alan", "user-ada"),
    ).resolves.toEqual({
      reason: "friend-request-not-outgoing",
      success: false,
    });
    await expect(
      harness.store.cancelFriendRequest("user-ada", "user-alan"),
    ).resolves.toEqual({ success: true });
    await expect(
      harness.store.cancelFriendRequest("user-ada", "user-alan"),
    ).resolves.toEqual({ success: true });
  });

  it("removes friendships without blocking a fresh request", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);

    await makeFriends(harness, "user-ada", "user-grace");
    await expect(
      harness.store.removeFriend("user-grace", "user-ada"),
    ).resolves.toEqual({ success: true });
    await expect(
      harness.store.removeFriend("user-ada", "user-grace"),
    ).resolves.toEqual({ success: true });
    await expect(
      harness.store.createFriendRequest("user-grace", "user-ada"),
    ).resolves.toMatchObject({ created: true, success: true });
  });

  it("blocks idempotently, cleans pair state, and does not restore it after unblock", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);

    await makeFriends(harness, "user-ada", "user-grace");
    const outgoingInvitation = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "PAIR-OUT",
      recipientUserId: "user-grace",
    });
    const incomingInvitation = await createInvitation(harness, {
      inviterUserId: "user-grace",
      partyCode: "PAIR-IN",
      recipientUserId: "user-ada",
    });
    await harness.store.createFriendRequest("user-ada", "user-alan");

    const blockedAt = harness.advanceTime();
    await expect(
      harness.store.blockUser("user-ada", "user-grace"),
    ).resolves.toEqual({
      block: {
        blockedAt,
        user: { displayName: "Grace Hopper", id: "user-grace" },
      },
      created: true,
      success: true,
    });
    harness.advanceTime();
    await expect(
      harness.store.blockUser("user-ada", "user-grace"),
    ).resolves.toMatchObject({
      block: { blockedAt },
      created: false,
      success: true,
    });
    await harness.store.blockUser("user-alan", "user-ada");

    expect(readInvitationRecords(harness.databasePath)).toEqual([
      expect.objectContaining({ id: outgoingInvitation.id, status: "revoked" }),
      expect.objectContaining({ id: incomingInvitation.id, status: "revoked" }),
    ]);
    expect(expectOverview(await harness.store.getOverview("user-ada"))).toMatchObject({
      friends: [],
      incomingFriendRequests: [],
      incomingPartyInvitations: [],
      outgoingFriendRequests: [],
      outgoingPartyInvitations: [],
    });

    await expect(
      harness.store.unblockUser("user-ada", "user-grace"),
    ).resolves.toEqual({ success: true });
    await expect(
      harness.store.unblockUser("user-alan", "user-ada"),
    ).resolves.toEqual({ success: true });
    await expect(
      harness.store.unblockUser("user-ada", "user-grace"),
    ).resolves.toEqual({ success: true });

    await expect(
      harness.store.discoverUser("user-ada", "Grace Hopper"),
    ).resolves.toMatchObject({
      discovery: { relationship: "none" },
      success: true,
    });
    await expect(
      harness.store.acceptFriendRequest("user-alan", "user-ada"),
    ).resolves.toEqual({ reason: "friend-request-not-found", success: false });
    await expect(
      harness.store.getPendingPartyInvitation("user-grace", outgoingInvitation.id),
    ).resolves.toEqual({
      reason: "party-invitation-not-pending",
      success: false,
    });
  });

  it("validates party invitations without disclosing non-account users", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-ada", "user-betty");
    await harness.store.blockUser("user-betty", "user-ada");

    await expect(
      harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-alan",
      }),
    ).resolves.toEqual({ reason: "not-friends", success: false });
    await expect(
      harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-betty",
      }),
    ).resolves.toEqual({ reason: "blocked", success: false });
    await expect(
      harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "bad party",
        recipientUserId: "user-grace",
      }),
    ).resolves.toEqual({ reason: "invalid-party-code", success: false });
    await expect(
      harness.store.createPartyInvitation({
        intent: "player",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-grace",
      }),
    ).resolves.toEqual({
      reason: "invalid-invitation-intent",
      success: false,
    });
    await expect(
      harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-ada",
      }),
    ).resolves.toEqual({ reason: "invalid-user-id", success: false });
    await expect(
      harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-missing",
      }),
    ).resolves.toEqual({ reason: "user-not-found", success: false });
    await expect(
      harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-legacy",
      }),
    ).resolves.toEqual({ reason: "user-not-found", success: false });

    const invalidIdStore = harness.createStore({ createId: () => "bad id" });
    await expect(
      invalidIdStore.createPartyInvitation({
        intent: "watch",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-grace",
      }),
    ).resolves.toEqual({ reason: "invalid-invitation-id", success: false });

    await makeFriends(harness, "user-ada", "user-amy");
    const existingInvitation = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "ID-OWNER",
      recipientUserId: "user-grace",
    });
    const collidingIdStore = harness.createStore({
      createId: () => existingInvitation.id,
    });
    await expect(
      collidingIdStore.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "ID-COLLISION",
        recipientUserId: "user-amy",
      }),
    ).resolves.toEqual({
      reason: "party-invitation-id-conflict",
      success: false,
    });
  });

  it("rejects duplicate live invitations and permits replacement after lazy expiry", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");

    const expiry = harness.expiresIn();
    const firstResult = await harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: " party-1 ",
        recipientUserId: "user-grace",
      });
    const first = expectInvitation(firstResult);
    expect(firstResult).toMatchObject({ created: true, success: true });
    expect(first).toMatchObject({
      expiresAt: expiry,
      partyCode: "PARTY-1",
      resolvedAt: null,
      status: "pending",
    });
    await expect(
      harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-grace",
      }),
    ).resolves.toEqual({ created: false, invitation: first, success: true });
    await expect(
      harness.store.createPartyInvitation({
        intent: "watch",
        inviterUserId: "user-ada",
        partyCode: "PARTY-1",
        recipientUserId: "user-grace",
      }),
    ).resolves.toEqual({
      reason: "duplicate-party-invitation",
      success: false,
    });

    harness.setTime(expiry);
    expect(
      expectOverview(await harness.store.getOverview("user-grace"))
        .incomingPartyInvitations,
    ).toEqual([]);
    expect(readInvitationRecords(harness.databasePath)).toEqual([
      expect.objectContaining({ id: first.id, status: "expired" }),
    ]);
    await expect(
      harness.store.getPendingPartyInvitation("user-grace", first.id),
    ).resolves.toEqual({
      reason: "party-invitation-expired",
      success: false,
    });
    const replacement = await createInvitation(harness, {
      intent: "watch",
      inviterUserId: "user-ada",
      partyCode: "PARTY-1",
      recipientUserId: "user-grace",
    });
    expect(replacement.id).not.toBe(first.id);
    const replacementOverview = expectOverview(
      await harness.store.getOverview("user-grace"),
    ).incomingPartyInvitations;
    expect(replacementOverview).toEqual([
      expect.objectContaining({ id: replacement.id, intent: "watch" }),
    ]);
    expect(replacementOverview[0]).not.toHaveProperty("partyCode");
  });

  it("returns private pending invitation tuples only for server reconciliation", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-amy", "user-ada");
    await makeFriends(harness, "user-grace", "user-betty");

    const outgoing = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "OUTGOING",
      recipientUserId: "user-grace",
    });
    const incoming = await createInvitation(harness, {
      inviterUserId: "user-amy",
      partyCode: "INCOMING",
      recipientUserId: "user-ada",
    });
    await createInvitation(harness, {
      inviterUserId: "user-grace",
      partyCode: "UNRELATED",
      recipientUserId: "user-betty",
    });

    const result =
      await harness.store.getPendingPartyInvitationsForReconciliation(
        "user-ada",
      );

    expect(result).toMatchObject({ success: true });
    if (!result.success) {
      throw new Error(`Expected reconciliation rows, got ${result.reason}.`);
    }
    expect(
      result.invitations.map((invitation) => ({
        id: invitation.id,
        partyCode: invitation.partyCode,
      })),
    ).toEqual(
      expect.arrayContaining([
        { id: outgoing.id, partyCode: "OUTGOING" },
        { id: incoming.id, partyCode: "INCOMING" },
      ]),
    );
    expect(result.invitations).toHaveLength(2);
    await expect(
      harness.store.getPendingPartyInvitationsForReconciliation("bad user"),
    ).resolves.toEqual({ reason: "invalid-user-id", success: false });
  });

  it("caps pending party invitations per inviter and recipient while preserving retries", async () => {
    const outgoingHarness = createStoreHarness();
    disposables.push(outgoingHarness.dispose);
    await makeFriends(outgoingHarness, "user-ada", "user-grace");
    await makeFriends(outgoingHarness, "user-ada", "user-amy");
    const outgoingStore = outgoingHarness.createStore({
      maxPendingPartyInvitationsPerInviter: 1,
    });
    const first = await createInvitation(
      outgoingHarness,
      {
        inviterUserId: "user-ada",
        partyCode: "OUTGOING-1",
        recipientUserId: "user-grace",
        store: outgoingStore,
      },
    );

    await expect(
      outgoingStore.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "OUTGOING-1",
        recipientUserId: "user-grace",
      }),
    ).resolves.toEqual({ created: false, invitation: first, success: true });
    await expect(
      outgoingStore.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "OUTGOING-2",
        recipientUserId: "user-amy",
      }),
    ).resolves.toEqual({
      reason: "party-invitation-limit-reached",
      success: false,
    });

    const incomingHarness = createStoreHarness();
    disposables.push(incomingHarness.dispose);
    await makeFriends(incomingHarness, "user-ada", "user-grace");
    await makeFriends(incomingHarness, "user-amy", "user-grace");
    const incomingStore = incomingHarness.createStore({
      maxPendingPartyInvitationsPerRecipient: 1,
    });
    await createInvitation(
      incomingHarness,
      {
        inviterUserId: "user-ada",
        partyCode: "INCOMING-1",
        recipientUserId: "user-grace",
        store: incomingStore,
      },
    );
    await expect(
      incomingStore.createPartyInvitation({
        intent: "watch",
        inviterUserId: "user-amy",
        partyCode: "INCOMING-2",
        recipientUserId: "user-grace",
      }),
    ).resolves.toEqual({
      reason: "party-invitation-limit-reached",
      success: false,
    });
  });

  it("enforces invitation ownership and records accepted, declined, canceled, revoked, and expired resolutions", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");

    const accepted = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "ACCEPT",
      recipientUserId: "user-grace",
    });
    await expect(
      harness.store.getPendingPartyInvitation("user-alan", accepted.id),
    ).resolves.toEqual({ reason: "party-invitation-not-found", success: false });
    await expect(
      harness.store.getPendingPartyInvitation("user-ada", accepted.id),
    ).resolves.toEqual({ reason: "party-invitation-not-found", success: false });
    await expect(
      harness.store.cancelPartyInvitation("user-grace", accepted.id),
    ).resolves.toEqual({ reason: "party-invitation-not-found", success: false });
    await expect(
      harness.store.claimPartyInvitationForAcceptance("user-ada", accepted.id),
    ).resolves.toEqual({ reason: "party-invitation-not-found", success: false });

    const acceptanceClaim = await claimInvitation(
      harness.store,
      "user-grace",
      accepted.id,
    );
    const acceptedAt = harness.advanceTime();
    const acceptedResult = await harness.store.acceptPartyInvitationAfterAdmission(
      "user-grace",
      accepted.id,
      acceptanceClaim.claimToken,
    );
    expect(acceptedResult).toMatchObject({
      invitation: {
        id: accepted.id,
        partyCode: "ACCEPT",
        resolvedAt: acceptedAt,
        status: "accepted",
        updatedAt: acceptedAt,
      },
      success: true,
    });
    await expect(
      harness.store.acceptPartyInvitationAfterAdmission(
        "user-grace",
        accepted.id,
        acceptanceClaim.claimToken,
      ),
    ).resolves.toEqual(acceptedResult);
    await expect(
      harness.store.declinePartyInvitation("user-grace", accepted.id),
    ).resolves.toEqual({
      reason: "party-invitation-not-pending",
      success: false,
    });

    const declined = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "DECLINE",
      recipientUserId: "user-grace",
    });
    harness.advanceTime();
    await expect(
      harness.store.declinePartyInvitation("user-grace", declined.id),
    ).resolves.toMatchObject({
      invitation: { status: "declined" },
      success: true,
    });

    const canceled = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "CANCEL",
      recipientUserId: "user-grace",
    });
    harness.advanceTime();
    await expect(
      harness.store.cancelPartyInvitation("user-ada", canceled.id),
    ).resolves.toMatchObject({
      invitation: { status: "canceled" },
      success: true,
    });

    const revoked = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "REVOKE",
      recipientUserId: "user-grace",
    });
    harness.advanceTime();
    await expect(
      harness.store.revokePartyInvitation("user-ada", revoked.id),
    ).resolves.toMatchObject({
      invitation: { status: "revoked" },
      success: true,
    });

    const expired = expectInvitation(
      await harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "EXPIRE",
        recipientUserId: "user-grace",
      }),
    );
    harness.advanceTime(INVITATION_TTL_MS);
    await expect(
      harness.store.declinePartyInvitation("user-grace", expired.id),
    ).resolves.toEqual({
      reason: "party-invitation-expired",
      success: false,
    });

    expect(readInvitationRecords(harness.databasePath).map((row) => row.status)).toEqual([
      "accepted",
      "declined",
      "canceled",
      "revoked",
      "expired",
    ]);
  });

  it("atomically accepts one invitation and revokes the recipient's other live invitations", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-amy", "user-grace");
    await makeFriends(harness, "user-ada", "user-zed");

    const selected = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "SELECTED",
      recipientUserId: "user-grace",
    });
    const otherForRecipient = await createInvitation(harness, {
      inviterUserId: "user-amy",
      partyCode: "OTHER-FOR-RECIPIENT",
      recipientUserId: "user-grace",
    });
    const unrelatedRecipient = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "UNRELATED-RECIPIENT",
      recipientUserId: "user-zed",
    });

    const acceptedAt = harness.advanceTime();
    await expect(
      claimAndAcceptInvitation(
        harness.store,
        "user-grace",
        selected.id,
      ),
    ).resolves.toMatchObject({
      invitation: { id: selected.id, status: "accepted" },
      success: true,
    });

    expect(readInvitationRecords(harness.databasePath)).toEqual([
      expect.objectContaining({
        id: selected.id,
        resolvedAt: acceptedAt,
        status: "accepted",
      }),
      expect.objectContaining({
        id: otherForRecipient.id,
        resolvedAt: acceptedAt,
        status: "revoked",
      }),
      expect.objectContaining({
        id: unrelatedRecipient.id,
        resolvedAt: null,
        status: "pending",
      }),
    ]);

    const createdAfterAcceptance = await createInvitation(harness, {
      inviterUserId: "user-amy",
      partyCode: "CREATED-AFTER-ACCEPTANCE",
      recipientUserId: "user-grace",
    });
    const retriedAt = harness.advanceTime();
    await expect(
      harness.store.acceptPartyInvitationAfterAdmission(
        "user-grace",
        selected.id,
        "already-accepted-token",
      ),
    ).resolves.toMatchObject({
      invitation: { id: selected.id, status: "accepted" },
      success: true,
    });

    expect(
      readInvitationRecords(harness.databasePath).find(
        (invitation) => invitation.id === createdAfterAcceptance.id,
      ),
    ).toEqual(
      expect.objectContaining({
        resolvedAt: retriedAt,
        status: "revoked",
      }),
    );
    expect(
      readInvitationRecords(harness.databasePath).find(
        (invitation) => invitation.id === unrelatedRecipient.id,
      ),
    ).toEqual(expect.objectContaining({ resolvedAt: null, status: "pending" }));
  });

  it("serializes recipient acceptance claims and protects the claimed invitation", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-amy", "user-grace");
    const selected = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "CLAIMED",
      recipientUserId: "user-grace",
    });
    const other = await createInvitation(harness, {
      inviterUserId: "user-amy",
      partyCode: "OTHER",
      recipientUserId: "user-grace",
    });
    const claim = await claimInvitation(
      harness.store,
      "user-grace",
      selected.id,
    );

    await expect(
      harness.store.claimPartyInvitationForAcceptance(
        "user-grace",
        selected.id,
      ),
    ).resolves.toEqual({
      reason: "party-invitation-acceptance-in-progress",
      success: false,
    });
    await expect(
      harness.store.claimPartyInvitationForAcceptance("user-grace", other.id),
    ).resolves.toEqual({
      reason: "party-invitation-acceptance-in-progress",
      success: false,
    });
    await expect(
      harness.store.revokePendingPartyInvitationsForRecipient("user-grace"),
    ).resolves.toEqual({ revokedCount: 1, success: true });
    await expect(
      harness.store.getPendingPartyInvitation("user-grace", selected.id),
    ).resolves.toMatchObject({ invitation: { status: "pending" }, success: true });
    await expect(
      harness.store.releasePartyInvitationAcceptanceClaim(
        "user-grace",
        selected.id,
        "wrong-token",
      ),
    ).resolves.toEqual({ released: false, success: true });
    await expect(
      harness.store.releasePartyInvitationAcceptanceClaim(
        "user-grace",
        selected.id,
        claim.claimToken,
      ),
    ).resolves.toEqual({ released: true, success: true });
  });

  it("extends near-expiry invitations so an expired claim can be retried safely", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    const claimStore = harness.createStore({
      acceptanceClaimTtlMs: 1_000,
      acceptanceRecoveryGraceMs: 5_000,
    });
    const invitation = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "RECOVERY",
      recipientUserId: "user-grace",
      store: claimStore,
    });
    harness.advanceTime(INVITATION_TTL_MS - 500);
    const firstClaim = await claimInvitation(
      claimStore,
      "user-grace",
      invitation.id,
    );

    expect(Date.parse(firstClaim.invitation.expiresAt)).toBeGreaterThan(
      Date.parse(firstClaim.claimExpiresAt),
    );
    harness.advanceTime(1_100);
    const retryClaim = await claimInvitation(
      claimStore,
      "user-grace",
      invitation.id,
    );

    await expect(
      claimStore.acceptPartyInvitationAfterAdmission(
        "user-grace",
        invitation.id,
        firstClaim.claimToken,
      ),
    ).resolves.toEqual({
      reason: "party-invitation-acceptance-in-progress",
      success: false,
    });
    await expect(
      claimStore.acceptPartyInvitationAfterAdmission(
        "user-grace",
        invitation.id,
        retryClaim.claimToken,
      ),
    ).resolves.toMatchObject({
      invitation: { status: "accepted" },
      success: true,
    });
  });

  it("restores the base TTL when a failed acceptance releases its claim", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    const claimStore = harness.createStore({
      acceptanceClaimTtlMs: 2_000,
      acceptanceRecoveryGraceMs: 5_000,
    });
    const invitation = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "RELEASED-RECOVERY",
      recipientUserId: "user-grace",
      store: claimStore,
    });
    harness.advanceTime(INVITATION_TTL_MS - 500);
    const firstClaim = await claimInvitation(
      claimStore,
      "user-grace",
      invitation.id,
    );

    expect(firstClaim.invitation.expiresAt).not.toBe(invitation.expiresAt);
    await expect(
      claimStore.releasePartyInvitationAcceptanceClaim(
        "user-grace",
        invitation.id,
        firstClaim.claimToken,
      ),
    ).resolves.toEqual({ released: true, success: true });
    await expect(
      claimStore.getPendingPartyInvitation("user-grace", invitation.id),
    ).resolves.toMatchObject({
      invitation: { expiresAt: invitation.expiresAt, status: "pending" },
      success: true,
    });

    const secondClaim = await claimInvitation(
      claimStore,
      "user-grace",
      invitation.id,
    );
    harness.advanceTime(600);
    await expect(
      claimStore.releasePartyInvitationAcceptanceClaim(
        "user-grace",
        invitation.id,
        secondClaim.claimToken,
      ),
    ).resolves.toEqual({ released: true, success: true });
    await expect(
      claimStore.getPendingPartyInvitation("user-grace", invitation.id),
    ).resolves.toEqual({
      reason: "party-invitation-expired",
      success: false,
    });
  });

  it("clears acceptance claims when relationship invalidation revokes an invitation", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-amy", "user-grace");
    const invalidated = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "INVALIDATED",
      recipientUserId: "user-grace",
    });
    await claimInvitation(harness.store, "user-grace", invalidated.id);
    await harness.store.blockUser("user-ada", "user-grace");
    const replacement = await createInvitation(harness, {
      inviterUserId: "user-amy",
      partyCode: "REPLACEMENT",
      recipientUserId: "user-grace",
    });

    await expect(
      harness.store.claimPartyInvitationForAcceptance(
        "user-grace",
        replacement.id,
      ),
    ).resolves.toMatchObject({ invitation: { id: replacement.id }, success: true });
    expect(readInvitationRecords(harness.databasePath)).toContainEqual(
      expect.objectContaining({ id: invalidated.id, status: "revoked" }),
    );
  });

  it("bounds resolved history while retaining only the newest accepted reconnect index", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    const boundedStore = harness.createStore({
      maxResolvedPartyInvitationHistory: 2,
    });

    for (let index = 0; index < 4; index += 1) {
      const invitation = await createInvitation(harness, {
        inviterUserId: "user-ada",
        partyCode: `HISTORY-${index}`,
        recipientUserId: "user-grace",
        store: boundedStore,
      });
      await expect(
        boundedStore.cancelPartyInvitation("user-ada", invitation.id),
      ).resolves.toMatchObject({
        invitation: { id: invitation.id, status: "canceled" },
        success: true,
      });
    }

    expect(
      readInvitationRecords(harness.databasePath).filter(
        (invitation) => invitation.status === "canceled",
      ),
    ).toHaveLength(2);

    const firstAccepted = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "ACCEPTED-OLD",
      recipientUserId: "user-grace",
      store: boundedStore,
    });
    await claimAndAcceptInvitation(
      boundedStore,
      "user-grace",
      firstAccepted.id,
    );
    const newestAccepted = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "ACCEPTED-NEW",
      recipientUserId: "user-grace",
      store: boundedStore,
    });
    await claimAndAcceptInvitation(
      boundedStore,
      "user-grace",
      newestAccepted.id,
    );

    await expect(
      boundedStore.getAcceptedPartyInvitationForReacquisition(
        "user-grace",
        firstAccepted.id,
      ),
    ).resolves.toEqual({
      reason: "party-invitation-not-found",
      success: false,
    });
    await expect(
      boundedStore.getAcceptedPartyInvitationForReacquisition(
        "user-grace",
        newestAccepted.id,
      ),
    ).resolves.toMatchObject({
      invitation: { id: newestAccepted.id, partyCode: "ACCEPTED-NEW" },
      success: true,
    });
  });

  it("returns only recipient-owned accepted invitations for capability reacquisition", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");

    const accepted = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "REACQUIRE",
      recipientUserId: "user-grace",
    });
    await claimAndAcceptInvitation(
      harness.store,
      "user-grace",
      accepted.id,
    );
    const pending = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "STILL-PENDING",
      recipientUserId: "user-grace",
    });

    await expect(
      harness.store.getAcceptedPartyInvitationForReacquisition(
        "user-grace",
        accepted.id,
      ),
    ).resolves.toMatchObject({
      invitation: {
        id: accepted.id,
        partyCode: "REACQUIRE",
        status: "accepted",
      },
      success: true,
    });
    await expect(
      harness.store.getAcceptedPartyInvitationForReacquisition(
        "user-ada",
        accepted.id,
      ),
    ).resolves.toEqual({
      reason: "party-invitation-not-found",
      success: false,
    });
    await expect(
      harness.store.getAcceptedPartyInvitationForReacquisition(
        "user-grace",
        pending.id,
      ),
    ).resolves.toEqual({
      reason: "party-invitation-not-pending",
      success: false,
    });
  });

  it("revokes both directions for a removed pair without touching another friendship", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-ada", "user-amy");

    const outgoing = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "PAIR-A",
      recipientUserId: "user-grace",
    });
    const incoming = await createInvitation(harness, {
      inviterUserId: "user-grace",
      partyCode: "PAIR-B",
      recipientUserId: "user-ada",
    });
    const unrelated = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "OTHER",
      recipientUserId: "user-amy",
    });

    const revokedAt = harness.advanceTime();
    await expect(
      harness.store.removeFriend("user-ada", "user-grace"),
    ).resolves.toEqual({ success: true });

    expect(readInvitationRecords(harness.databasePath)).toEqual([
      expect.objectContaining({
        id: outgoing.id,
        resolvedAt: revokedAt,
        status: "revoked",
      }),
      expect.objectContaining({
        id: incoming.id,
        resolvedAt: revokedAt,
        status: "revoked",
      }),
      expect.objectContaining({
        id: unrelated.id,
        resolvedAt: null,
        status: "pending",
      }),
    ]);
  });

  it("expires stale party invitations before revoking only live invitations for that party", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-ada", "user-amy");
    await makeFriends(harness, "user-ada", "user-zed");

    const expiring = expectInvitation(
      await harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "GROUP-1",
        recipientUserId: "user-grace",
      }),
    );
    harness.advanceTime();
    const live = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "GROUP-1",
      recipientUserId: "user-amy",
    });
    const otherParty = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "GROUP-2",
      recipientUserId: "user-zed",
    });

    const revokedAt = harness.advanceTime(INVITATION_TTL_MS - 1000);
    await expect(
      harness.store.revokePartyInvitationsForParty(" group-1 "),
    ).resolves.toEqual({ revokedCount: 1, success: true });
    await expect(
      harness.store.revokePartyInvitationsForParty("GROUP-1"),
    ).resolves.toEqual({ revokedCount: 0, success: true });
    await expect(
      harness.store.revokePartyInvitationsForParty("bad party"),
    ).resolves.toEqual({ reason: "invalid-party-code", success: false });

    expect(readInvitationRecords(harness.databasePath)).toEqual([
      expect.objectContaining({
        id: expiring.id,
        resolvedAt: revokedAt,
        status: "expired",
      }),
      expect.objectContaining({
        id: live.id,
        resolvedAt: revokedAt,
        status: "revoked",
      }),
      expect.objectContaining({
        id: otherParty.id,
        resolvedAt: null,
        status: "pending",
      }),
    ]);
  });

  it("atomically expires stale and revokes every live invitation for one recipient", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    await makeFriends(harness, "user-ada", "user-grace");
    await makeFriends(harness, "user-amy", "user-grace");
    await makeFriends(harness, "user-ada", "user-zed");

    const expiring = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "RECIPIENT-OLD",
      recipientUserId: "user-grace",
    });
    harness.advanceTime();
    const live = await createInvitation(harness, {
      inviterUserId: "user-amy",
      partyCode: "RECIPIENT-LIVE",
      recipientUserId: "user-grace",
    });
    const otherRecipient = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "RECIPIENT-OTHER",
      recipientUserId: "user-zed",
    });

    const revokedAt = harness.advanceTime(INVITATION_TTL_MS - 1000);
    await expect(
      harness.store.revokePendingPartyInvitationsForRecipient("user-grace"),
    ).resolves.toEqual({ revokedCount: 1, success: true });
    await expect(
      harness.store.revokePendingPartyInvitationsForRecipient("user-grace"),
    ).resolves.toEqual({ revokedCount: 0, success: true });
    await expect(
      harness.store.revokePendingPartyInvitationsForRecipient("bad user"),
    ).resolves.toEqual({ reason: "invalid-user-id", success: false });
    await expect(
      harness.store.revokePendingPartyInvitationsForRecipient("user-missing"),
    ).resolves.toEqual({ reason: "user-not-found", success: false });

    expect(readInvitationRecords(harness.databasePath)).toEqual([
      expect.objectContaining({
        id: expiring.id,
        resolvedAt: revokedAt,
        status: "expired",
      }),
      expect.objectContaining({
        id: live.id,
        resolvedAt: revokedAt,
        status: "revoked",
      }),
      expect.objectContaining({
        id: otherRecipient.id,
        resolvedAt: null,
        status: "pending",
      }),
    ]);
  });

  it("persists social state across close and reopen", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);

    await makeFriends(harness, "user-ada", "user-grace");
    await harness.store.createFriendRequest("user-alan", "user-ada");
    await harness.store.blockUser("user-ada", "user-betty");
    const invitation = await createInvitation(harness, {
      inviterUserId: "user-ada",
      partyCode: "PERSIST",
      recipientUserId: "user-grace",
    });
    const beforeClose = expectOverview(
      await harness.store.getOverview("user-ada"),
    );

    harness.closeStore(harness.store);
    const reopenedStore = harness.createStore();
    expect(expectOverview(await reopenedStore.getOverview("user-ada"))).toEqual(
      beforeClose,
    );
    await expect(
      reopenedStore.discoverUser("user-ada", "Grace Hopper"),
    ).resolves.toMatchObject({
      discovery: { relationship: "friends" },
      success: true,
    });
    await expect(
      reopenedStore.getPendingPartyInvitation("user-grace", invitation.id),
    ).resolves.toMatchObject({ invitation: { id: invitation.id }, success: true });
    await expect(
      reopenedStore.cancelPartyInvitation("user-ada", invitation.id),
    ).resolves.toMatchObject({
      invitation: { status: "canceled" },
      success: true,
    });
  });

  it("shares crossed-request and invitation invariants across independent store connections", async () => {
    const harness = createStoreHarness();
    disposables.push(harness.dispose);
    const secondStore = harness.createStore();

    const crossedResults = [
      await harness.store.createFriendRequest("user-ada", "user-grace"),
      await secondStore.createFriendRequest("user-grace", "user-ada"),
    ];
    expect(crossedResults).toEqual([
      expect.objectContaining({ created: true, success: true }),
      { reason: "incoming-request-exists", success: false },
    ]);

    await secondStore.acceptFriendRequest("user-grace", "user-ada");
    const invitationResults = [
      await harness.store.createPartyInvitation({
        intent: "play",
        inviterUserId: "user-ada",
        partyCode: "RACE-1",
        recipientUserId: "user-grace",
      }),
      await secondStore.createPartyInvitation({
        intent: "watch",
        inviterUserId: "user-ada",
        partyCode: "RACE-1",
        recipientUserId: "user-grace",
      }),
    ];
    expect(invitationResults).toEqual([
      expect.objectContaining({ success: true }),
      { reason: "duplicate-party-invitation", success: false },
    ]);
    expect(
      expectOverview(await secondStore.getOverview("user-grace"))
        .incomingPartyInvitations,
    ).toHaveLength(1);
  });
});
