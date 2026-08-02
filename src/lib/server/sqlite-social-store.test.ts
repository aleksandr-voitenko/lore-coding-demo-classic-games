import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { PartyInvitationIntent } from "@/lib/social";
import { createUserDisplayNameKey } from "@/lib/user-profile";

import {
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
  let nextInvitationId = 0;

  function createStore(options: { createId?: () => string } = {}) {
    const store = new SqliteSocialStore({
      createId: options.createId ?? (() => `invitation-${++nextInvitationId}`),
      databasePath,
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

describe("sqlite social store", () => {
  const disposables: Array<() => void> = [];

  afterEach(() => {
    while (disposables.length > 0) {
      disposables.pop()?.();
    }
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
      harness.store.acceptPartyInvitationAfterAdmission("user-ada", accepted.id),
    ).resolves.toEqual({ reason: "party-invitation-not-found", success: false });

    const acceptedAt = harness.advanceTime();
    const acceptedResult = await harness.store.acceptPartyInvitationAfterAdmission(
      "user-grace",
      accepted.id,
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
      harness.store.acceptPartyInvitationAfterAdmission("user-grace", accepted.id),
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
