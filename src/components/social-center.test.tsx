import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import { SocialClientError } from "@/lib/social-client";

import {
  SocialCenterTrigger,
  formatSocialActionError,
  getPartyInvitationAcceptanceMessage,
  getSocialAvailabilityLabel,
  isAmbiguousPartyAcceptanceError,
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
    expect(getPartyInvitationAcceptanceMessage("busy", true)).toContain(
      "Current status: Busy",
    );
    expect(getPartyInvitationAcceptanceMessage("in-party", true)).toContain(
      "In a party",
    );
    expect(getPartyInvitationAcceptanceMessage("offline", true)).toContain(
      "Offline",
    );
    expect(getPartyInvitationAcceptanceMessage("unknown", true)).toContain(
      "Checking availability",
    );
    expect(getPartyInvitationAcceptanceMessage("available", false)).toBe(
      "Joining from Friends is not available on this screen yet.",
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
