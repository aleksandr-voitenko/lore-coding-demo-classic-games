"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  getBrowserSocialPresenceSnapshot,
  getBrowserSocialPresenceController,
  subscribeBrowserSocialPresence,
  type BrowserSocialPresenceState,
  type SocialPresenceClientSnapshot,
} from "@/lib/social-presence-client";

export type { BrowserSocialPresenceState } from "@/lib/social-presence-client";

const INITIAL_SOCIAL_PRESENCE_SNAPSHOT: SocialPresenceClientSnapshot = {
  availability: "offline",
  error: null,
};

export function useSocialPresence(
  userId: string | null,
  state: BrowserSocialPresenceState,
) {
  const snapshot = useSyncExternalStore(
    subscribeBrowserSocialPresence,
    getBrowserSocialPresenceSnapshot,
    () => INITIAL_SOCIAL_PRESENCE_SNAPSHOT,
  );

  useEffect(() => {
    void getBrowserSocialPresenceController()?.update(userId, state);
  }, [state, userId]);

  useEffect(() => {
    const controller = getBrowserSocialPresenceController();
    controller?.start();

    return () => {
      void controller?.stop();
    };
  }, []);

  return snapshot;
}
