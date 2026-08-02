import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CurrentUserProvider } from "@/hooks/use-current-user";
import type { AuthenticatedUser } from "@/lib/user-profile";

import {
  SocialProvider,
  useSocial,
  type SocialContextValue,
} from "./social-provider";

const SIGNED_IN_USER = {
  displayName: "Ada Player",
  id: "user-1",
} satisfies AuthenticatedUser;

function SocialContextCapture({
  capture,
}: {
  capture: (context: SocialContextValue) => void;
}) {
  capture(useSocial());

  return null;
}

function renderSocialContext({
  enabled,
  user,
}: {
  enabled: boolean;
  user: AuthenticatedUser | null;
}) {
  let capturedContext: SocialContextValue | null = null;

  renderToStaticMarkup(
    <CurrentUserProvider initialUser={user}>
      <SocialProvider enabled={enabled} presenceState="available">
        <SocialContextCapture
          capture={(context) => {
            capturedContext = context;
          }}
        />
      </SocialProvider>
    </CurrentUserProvider>,
  );

  if (capturedContext === null) {
    throw new Error("Expected SocialProvider to expose its context.");
  }

  return capturedContext as SocialContextValue;
}

describe("social provider", () => {
  it("fails clearly when useSocial is called outside its provider", () => {
    function UnprovidedConsumer() {
      useSocial();

      return null;
    }

    expect(() => renderToStaticMarkup(<UnprovidedConsumer />)).toThrow(
      "useSocial must be used within a SocialProvider.",
    );
  });

  it("exposes the enabled signed-in Friends API", () => {
    const context = renderSocialContext({ enabled: true, user: SIGNED_IN_USER });

    expect(context).toMatchObject({
      availability: "offline",
      isEnabled: true,
      isSocialCenterOpen: false,
      overview: null,
      overviewError: null,
      pendingCount: 0,
      presenceError: null,
    });
    expect(context.isMutationPending("friend:user-2")).toBe(false);
    expect(context).toMatchObject({
      closeSocialCenter: expect.any(Function),
      openSocialCenter: expect.any(Function),
      refresh: expect.any(Function),
      runMutation: expect.any(Function),
      setSocialCenterOpen: expect.any(Function),
    });
  });

  it("keeps disabled and signed-out state unavailable without running mutations", async () => {
    const disabledContext = renderSocialContext({
      enabled: false,
      user: SIGNED_IN_USER,
    });
    const signedOutContext = renderSocialContext({ enabled: true, user: null });
    const disabledMutation = vi.fn(async () => "disabled");
    const signedOutMutation = vi.fn(async () => "signed-out");

    for (const context of [disabledContext, signedOutContext]) {
      expect(context).toMatchObject({
        availability: "offline",
        isEnabled: false,
        isLoading: false,
        isRefreshing: false,
        isSocialCenterOpen: false,
        overview: null,
        overviewError: null,
        pendingCount: 0,
        presenceError: null,
      });
      expect(context.isMutationPending("friend:user-2")).toBe(false);
    }

    await expect(
      disabledContext.runMutation("disabled", disabledMutation),
    ).rejects.toThrow("Friends are not available on this screen.");
    await expect(
      signedOutContext.runMutation("signed-out", signedOutMutation),
    ).rejects.toThrow("Sign in to use friends and party invitations.");
    expect(disabledMutation).not.toHaveBeenCalled();
    expect(signedOutMutation).not.toHaveBeenCalled();
  });
});
