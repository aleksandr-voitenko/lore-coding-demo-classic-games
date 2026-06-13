"use client";

import { Menu } from "@base-ui/react/menu";
import { LogOutIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { AuthenticatedUser } from "@/lib/user-profile";

type UserAccountProfileMenuProps = {
  signOut: () => Promise<void>;
  user: AuthenticatedUser;
  userError: boolean;
};

const PROFILE_MENU_TOOLTIP_ID = "profile-menu-tooltip";

function getProfileInitials(displayName: string) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "P";
}

export function UserAccountProfileMenu({
  signOut,
  user,
  userError,
}: UserAccountProfileMenuProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileTooltipVisible, setIsProfileTooltipVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const isProfileTooltipAvailable = !isProfileMenuOpen && !isSubmitting;
  const shouldShowProfileTooltip =
    isProfileTooltipAvailable && isProfileTooltipVisible;

  function handleProfileMenuOpenChange(open: boolean) {
    setIsProfileMenuOpen(open);
    setIsProfileTooltipVisible(false);
  }

  function resetProfileTooltipIntent() {
    setIsProfileTooltipVisible(false);
  }

  function handleProfileTriggerPointerEnter() {
    if (!isProfileMenuOpen && !isSubmitting) {
      setIsProfileTooltipVisible(true);
    }
  }

  function suppressProfileTooltip() {
    setIsProfileTooltipVisible(false);
  }

  async function handleSignOut() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitFailed(false);

    try {
      await signOut();
    } catch {
      setSubmitFailed(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Menu.Root
      modal={false}
      onOpenChange={handleProfileMenuOpenChange}
      open={isProfileMenuOpen}
    >
      <div
        className="flex w-full flex-wrap items-center justify-start gap-2 text-sm sm:w-auto sm:justify-end"
        data-testid="user-account-controls"
      >
        <div className="group relative shrink-0">
          <Menu.Trigger
            aria-describedby={
              isProfileTooltipAvailable ? PROFILE_MENU_TOOLTIP_ID : undefined
            }
            aria-label={`${user.displayName} account menu`}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--chrome-border)] bg-[var(--chrome-accent-soft)] text-sm font-bold text-[var(--chrome-ink)] shadow-sm transition hover:border-[color-mix(in_oklch,var(--chrome-accent)_55%,var(--chrome-border))] hover:bg-[var(--chrome-accent-hover)] hover:text-[var(--chrome-accent-ink)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)] disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:border-[color-mix(in_oklch,var(--chrome-accent)_65%,var(--chrome-border))]"
            data-testid="profile-menu-trigger"
            disabled={isSubmitting}
            onBlur={resetProfileTooltipIntent}
            onPointerDown={suppressProfileTooltip}
            onPointerEnter={handleProfileTriggerPointerEnter}
            onPointerLeave={resetProfileTooltipIntent}
            type="button"
          >
            <span aria-hidden="true">{getProfileInitials(user.displayName)}</span>
          </Menu.Trigger>
          {isProfileTooltipAvailable ? (
            <span
              className={`pointer-events-none absolute left-0 top-full z-40 mt-2 whitespace-nowrap rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 py-2 text-sm font-semibold text-[var(--chrome-ink)] shadow-[0_18px_50px_var(--chrome-shadow-soft)] transition-[opacity,transform] duration-150 ease-out sm:left-auto sm:right-0 ${
                shouldShowProfileTooltip
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-1 scale-95 opacity-0"
              }`}
              data-testid="profile-menu-tooltip"
              id={PROFILE_MENU_TOOLTIP_ID}
              role="tooltip"
            >
              Open user navigation menu
            </span>
          ) : null}
        </div>
        <Menu.Portal>
          <Menu.Positioner align="end" collisionPadding={12} side="bottom" sideOffset={8}>
            <Menu.Popup
              className="z-50 flex min-w-40 origin-top-right flex-col gap-1 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-1.5 text-sm font-medium text-[var(--chrome-ink)] shadow-[0_18px_50px_var(--chrome-shadow-soft)] outline-none transition-[opacity,transform] duration-150 ease-out data-[ending-style]:-translate-y-1 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
              data-testid="profile-menu"
            >
              <Menu.LinkItem
                className="flex h-9 items-center gap-2 rounded-md px-2.5 transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none data-[highlighted]:bg-[var(--chrome-accent-faint)]"
                closeOnClick
                data-testid="profile-link"
                render={<Link href="/profile" />}
              >
                <UserIcon className="size-4 shrink-0" aria-hidden="true" />
                Profile
              </Menu.LinkItem>
              <Menu.Item
                className="flex h-9 items-center gap-2 rounded-md px-2.5 text-destructive transition hover:bg-destructive/10 focus-visible:outline-none data-[highlighted]:bg-destructive/10 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                data-testid="sign-out-button"
                disabled={isSubmitting}
                onClick={handleSignOut}
              >
                <LogOutIcon className="size-4 shrink-0" aria-hidden="true" />
                Log out
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
        {submitFailed || userError ? (
          <p className="basis-full text-xs font-medium text-destructive" role="status">
            Account unavailable.
          </p>
        ) : null}
      </div>
    </Menu.Root>
  );
}
