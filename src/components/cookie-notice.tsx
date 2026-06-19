"use client";

import { useCallback, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

const COOKIE_NOTICE_CHANGE_EVENT = "game-library-cookie-notice-change";
const COOKIE_NOTICE_STORAGE_KEY = "game-library-cookie-notice:v1";
const COOKIE_NOTICE_DISMISSED_VALUE = "dismissed";

let isDismissedForPage = false;

function hasDismissedCookieNotice() {
  if (isDismissedForPage) {
    return true;
  }

  try {
    return (
      window.localStorage.getItem(COOKIE_NOTICE_STORAGE_KEY) ===
      COOKIE_NOTICE_DISMISSED_VALUE
    );
  } catch {
    return false;
  }
}

function getCookieNoticeSnapshot() {
  return !hasDismissedCookieNotice();
}

function getCookieNoticeServerSnapshot() {
  return false;
}

function subscribeToCookieNotice(callback: () => void) {
  function handleStorageChange(event: StorageEvent) {
    if (event.key !== COOKIE_NOTICE_STORAGE_KEY) {
      return;
    }

    callback();
  }

  window.addEventListener(COOKIE_NOTICE_CHANGE_EVENT, callback);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(COOKIE_NOTICE_CHANGE_EVENT, callback);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function CookieNotice() {
  const isNoticeVisible = useSyncExternalStore(
    subscribeToCookieNotice,
    getCookieNoticeSnapshot,
    getCookieNoticeServerSnapshot,
  );

  const dismissNotice = useCallback(() => {
    isDismissedForPage = true;

    try {
      window.localStorage.setItem(
        COOKIE_NOTICE_STORAGE_KEY,
        COOKIE_NOTICE_DISMISSED_VALUE,
      );
    } catch {
      // The in-memory flag still dismisses the notice for this page.
    }

    window.dispatchEvent(new Event(COOKIE_NOTICE_CHANGE_EVENT));
  }, []);

  if (!isNoticeVisible) {
    return null;
  }

  return (
    <aside
      aria-label="Cookie and storage notice"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6"
      data-testid="cookie-notice"
    >
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-3 text-[var(--chrome-ink)] shadow-[0_18px_60px_var(--chrome-shadow-modal)] pointer-events-auto sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-[var(--chrome-muted)]">
          We use essential cookies to keep you signed in and protect your game
          account. We also save your theme preference on this device. We do not
          use advertising or analytics cookies.
        </p>
        <Button
          className="w-full sm:w-auto"
          data-testid="cookie-notice-dismiss"
          onClick={dismissNotice}
          size="sm"
          type="button"
        >
          Got it
        </Button>
      </div>
    </aside>
  );
}
