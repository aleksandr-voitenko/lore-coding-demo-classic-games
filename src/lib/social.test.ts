import { describe, expect, it } from "vitest";

import {
  PARTY_INVITATION_INTENTS,
  PARTY_INVITATION_STATUSES,
  getCanonicalSocialUserPair,
  isPartyInvitationIntent,
  isPartyInvitationStatus,
  normalizePartyInvitationId,
  normalizeSocialUserId,
} from "./social";

describe("social", () => {
  it("normalizes social user and party invitation ids", () => {
    expect(normalizeSocialUserId("  User-123  ")).toBe("User-123");
    expect(normalizePartyInvitationId("  invite-456  ")).toBe("invite-456");
    expect(normalizeSocialUserId("x".repeat(80))).toBe("x".repeat(80));
    expect(normalizePartyInvitationId("x".repeat(80))).toBe("x".repeat(80));
  });

  it.each([
    ["empty text", ""],
    ["whitespace", "   "],
    ["spaces inside the id", "user one"],
    ["unsupported punctuation", "user_one"],
    ["an overlong id", "x".repeat(81)],
    ["a non-string value", null],
  ])("rejects %s as a social or invitation id", (_label, value) => {
    expect(normalizeSocialUserId(value)).toBeNull();
    expect(normalizePartyInvitationId(value)).toBeNull();
  });

  it("returns the same canonical social pair regardless of input order", () => {
    const expectedPair = {
      userAId: "ada-1",
      userBId: "grace-2",
    };

    expect(getCanonicalSocialUserPair("grace-2", "ada-1")).toEqual(
      expectedPair,
    );
    expect(getCanonicalSocialUserPair(" ada-1 ", " grace-2 ")).toEqual(
      expectedPair,
    );
  });

  it("rejects self-pairs and pairs containing an invalid user id", () => {
    expect(getCanonicalSocialUserPair("user-1", " user-1 ")).toBeNull();
    expect(getCanonicalSocialUserPair("user-1", "bad user")).toBeNull();
    expect(getCanonicalSocialUserPair(undefined, "user-2")).toBeNull();
  });

  it("recognizes only supported party invitation intents", () => {
    for (const intent of PARTY_INVITATION_INTENTS) {
      expect(isPartyInvitationIntent(intent)).toBe(true);
    }

    expect(isPartyInvitationIntent("player")).toBe(false);
    expect(isPartyInvitationIntent("PLAY")).toBe(false);
    expect(isPartyInvitationIntent(null)).toBe(false);
  });

  it("recognizes only supported party invitation statuses", () => {
    for (const status of PARTY_INVITATION_STATUSES) {
      expect(isPartyInvitationStatus(status)).toBe(true);
    }

    expect(isPartyInvitationStatus("active")).toBe(false);
    expect(isPartyInvitationStatus("PENDING")).toBe(false);
    expect(isPartyInvitationStatus(undefined)).toBe(false);
  });
});
