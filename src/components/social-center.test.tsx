import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import { SocialClientError } from "@/lib/social-client";

import {
  SocialCenterTrigger,
  formatSocialActionError,
  getPartyInvitationAcceptanceMessage,
  getPartyInvitationIntentDescription,
  getSocialAvailabilityLabel,
  isAmbiguousPartyAcceptanceError,
  isRetryablePartyAcceptanceRecoveryError,
} from "./social-center";
import { SocialProvider } from "./social-provider";

describe("social center", () => {
  it("uses explicit user-facing availability labels", () => {
    expect([
      getSocialAvailabilityLabel("available"),
      getSocialAvailabilityLabel("busy"),
      getSocialAvailabilityLabel("in-party"),
      getSocialAvailabilityLabel("offline"),
      getSocialAvailabilityLabel("unknown"),
    ]).toEqual([
      "Available",
      "Busy",
      "In a party",
      "Offline",
      "Checking availability",
    ]);
  });

  it("allows invitation acceptance only with a handoff and available presence", () => {
    expect(getPartyInvitationAcceptanceMessage("available", true)).toBeNull();
    expect(getPartyInvitationAcceptanceMessage("busy", true)).toBe(
      "Finish the current game before accepting this invitation.",
    );
    expect(getPartyInvitationAcceptanceMessage("in-party", false)).toBe(
      "Leave your current party before accepting another invitation.",
    );
    expect(getPartyInvitationAcceptanceMessage("offline", true)).toBe(
      "Reconnect before accepting this invitation.",
    );
    expect(getPartyInvitationAcceptanceMessage("unknown", true)).toBe(
      "Wait for your availability to finish updating before accepting.",
    );
    expect(getPartyInvitationAcceptanceMessage("available", false)).toBe(
      "Return to the Game Library or Leaderboards to accept this invitation.",
    );
  });

  it("explains observer admission without promising a player seat", () => {
    const invitation = {
      createdAt: "2026-08-03T00:00:00.000Z",
      expiresAt: "2026-08-03T00:05:00.000Z",
      id: "invitation-1",
      intent: "play" as const,
      inviter: { displayName: "Ada", id: "user-1" },
      recipient: { displayName: "Grace", id: "user-2" },
      resolvedAt: null,
      status: "pending" as const,
      updatedAt: "2026-08-03T00:00:00.000Z",
    };

    expect(getPartyInvitationIntentDescription(invitation)).toBe(
      "Play invitation. Accepting offers a player spot when available, otherwise Watching; capacity is checked when you accept.",
    );
    expect(
      getPartyInvitationIntentDescription({ ...invitation, intent: "watch" }),
    ).toBe(
      "Watch invitation. Accepting joins as Watching; capacity is checked when you accept.",
    );
  });

  it("adds typed Retry-After guidance without changing ordinary errors", () => {
    expect(
      formatSocialActionError(
        new SocialClientError({
          code: "rate-limit-reached",
          message: "Too many searches.",
          retryAfterSeconds: 12,
          status: 429,
        }),
      ),
    ).toBe("Too many searches. Try again in 12 seconds.");
    expect(formatSocialActionError(new Error("Network offline."))).toBe(
      "Network offline.",
    );
  });

  it("retries only ambiguous party acceptance failures", () => {
    expect(
      isAmbiguousPartyAcceptanceError(
        new SocialClientError({
          code: "network-error",
          message: "Network offline.",
          status: 0,
        }),
      ),
    ).toBe(true);
    expect(
      isAmbiguousPartyAcceptanceError(
        new SocialClientError({
          code: "invalid-response",
          message: "Invalid response.",
          status: 200,
        }),
      ),
    ).toBe(true);
    expect(
      isAmbiguousPartyAcceptanceError(
        new SocialClientError({
          code: "recipient-unavailable",
          message: "Recipient is unavailable.",
          status: 409,
        }),
      ),
    ).toBe(false);
    expect(isAmbiguousPartyAcceptanceError(new Error("Callback failed."))).toBe(
      false,
    );
  });

  it("retains accepted-membership recovery only for retryable authority errors", () => {
    for (const [status, code] of [
      [429, "participant-capability-limit-reached"],
      [409, "party-invitation-acceptance-in-progress"],
      [502, "room-service-unavailable"],
    ] as const) {
      expect(
        isRetryablePartyAcceptanceRecoveryError(
          new SocialClientError({
            code,
            message: "Try again.",
            status,
          }),
        ),
      ).toBe(true);
    }

    expect(
      isRetryablePartyAcceptanceRecoveryError(
        new SocialClientError({
          code: "party-closed",
          message: "Party closed.",
          status: 409,
        }),
      ),
    ).toBe(false);
  });

  it("renders its trigger only for an enabled signed-in account", () => {
    const signedInMarkup = renderToStaticMarkup(
      <CurrentUserProvider
        initialUser={{ displayName: "Ada", id: "user-1" }}
      >
        <SocialProvider enabled presenceState="available">
          <SocialCenterTrigger />
        </SocialProvider>
      </CurrentUserProvider>,
    );
    const signedOutMarkup = renderToStaticMarkup(
      <CurrentUserProvider initialUser={null}>
        <SocialProvider enabled presenceState="available">
          <SocialCenterTrigger />
        </SocialProvider>
      </CurrentUserProvider>,
    );
    const disabledMarkup = renderToStaticMarkup(
      <CurrentUserProvider
        initialUser={{ displayName: "Ada", id: "user-1" }}
      >
        <SocialProvider enabled={false} presenceState="available">
          <SocialCenterTrigger />
        </SocialProvider>
      </CurrentUserProvider>,
    );

    expect(signedInMarkup).toContain('data-testid="social-center-trigger"');
    expect(signedInMarkup).toContain("Friends");
    expect(signedOutMarkup).toBe("");
    expect(disabledMarkup).toBe("");
  });
});
