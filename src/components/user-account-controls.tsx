"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { Menu } from "@base-ui/react/menu";
import {
  LogInIcon,
  LogOutIcon,
  UserIcon,
  UserPlusIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  MAX_USER_DISPLAY_NAME_LENGTH,
  MAX_USER_PASSWORD_LENGTH,
  UserAuthError,
  getUserPasswordValidationError,
  normalizeUserDisplayName,
  type UserAuthField,
  type UserAuthFieldErrors,
  type UserAuthMode,
} from "@/lib/user-profile";

type UserAccountControlsProps = {
  initialAuthMode?: UserAuthMode | null;
};

type AuthFieldProps = {
  autoComplete: string;
  disabled: boolean;
  error?: string;
  id: string;
  label: string;
  maxLength?: number;
  name: UserAuthField;
  onValueChange: (field: UserAuthField, value: string) => void;
  placeholder: string;
  type?: "password" | "text";
  value: string;
};

const AUTH_MODE_LABELS = {
  login: "Log in",
  signup: "Sign up",
} satisfies Record<UserAuthMode, string>;

const PROFILE_MENU_TOOLTIP_ID = "profile-menu-tooltip";

function hasFieldErrors(fieldErrors: UserAuthFieldErrors) {
  return Object.keys(fieldErrors).length > 0;
}

function getProfileInitials(displayName: string) {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "P";
}

function removeAuthQueryParam() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (!url.searchParams.has("auth")) {
    return;
  }

  url.searchParams.delete("auth");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function UserAccountControls({
  initialAuthMode = null,
}: UserAccountControlsProps) {
  const { isLoading, logIn, signOut, signUp, user, userError } = useCurrentUser();
  const [authMode, setAuthMode] = useState<UserAuthMode>(initialAuthMode ?? "login");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<UserAuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(initialAuthMode !== null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileTooltipVisible, setIsProfileTooltipVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [submitFailed, setSubmitFailed] = useState(false);
  const normalizedDisplayName = normalizeUserDisplayName(displayName);
  const activeModeLabel = AUTH_MODE_LABELS[authMode];
  const isAuthDisabled = isLoading || isSubmitting;
  const isProfileTooltipAvailable = !isProfileMenuOpen && !isSubmitting;
  const shouldShowProfileTooltip =
    isProfileTooltipAvailable && isProfileTooltipVisible;

  function resetAuthForm({ keepDisplayName = false }: { keepDisplayName?: boolean } = {}) {
    setFieldErrors({});
    setFormError(null);
    setPassword("");
    setPasswordConfirmation("");

    if (!keepDisplayName) {
      setDisplayName("");
    }
  }

  function openAuthDialog(mode: UserAuthMode) {
    setAuthMode(mode);
    resetAuthForm({ keepDisplayName: true });
    setIsAuthOpen(true);
  }

  function handleAuthOpenChange(open: boolean) {
    setIsAuthOpen(open);

    if (!open) {
      resetAuthForm();
      removeAuthQueryParam();
    }
  }

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

  function updateAuthField(field: UserAuthField, value: string) {
    if (field === "displayName") {
      setDisplayName(value);
    } else if (field === "password") {
      setPassword(value);
    } else {
      setPasswordConfirmation(value);
    }

    setFormError(null);
    setFieldErrors((currentErrors) => {
      if (!(field in currentErrors)) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };

      delete nextErrors[field];
      return nextErrors;
    });
  }

  function validateAuthFields() {
    const nextFieldErrors: UserAuthFieldErrors = {
      ...(normalizedDisplayName.length === 0
        ? { displayName: "User name is required." }
        : {}),
      ...(password.length === 0 ? { password: "Password is required." } : {}),
    };

    if (authMode === "signup") {
      const passwordError = getUserPasswordValidationError(password);

      if (passwordError !== null) {
        nextFieldErrors.password = passwordError;
      }

      if (passwordConfirmation.length === 0) {
        nextFieldErrors.passwordConfirmation = "Repeat your password.";
      } else if (password !== passwordConfirmation) {
        nextFieldErrors.passwordConfirmation = "Passwords must match.";
      }
    }

    return nextFieldErrors;
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextFieldErrors = validateAuthFields();

    if (hasFieldErrors(nextFieldErrors)) {
      setFieldErrors(nextFieldErrors);
      setFormError(null);
      return;
    }

    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      if (authMode === "login") {
        await logIn(normalizedDisplayName, password);
      } else {
        await signUp(normalizedDisplayName, password, passwordConfirmation);
      }

      setIsAuthOpen(false);
      resetAuthForm();
      removeAuthQueryParam();
    } catch (error) {
      if (error instanceof UserAuthError) {
        setFieldErrors(error.fieldErrors);
        setFormError(hasFieldErrors(error.fieldErrors) ? null : error.message);
      } else {
        setFormError("Account unavailable.");
      }
    } finally {
      setIsSubmitting(false);
    }
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

  if (user) {
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
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--snake-border)] bg-[color-mix(in_oklch,var(--snake-head)_16%,white)] text-sm font-bold text-[var(--snake-ink)] shadow-sm transition hover:border-[color-mix(in_oklch,var(--snake-head)_55%,var(--snake-border))] hover:bg-[color-mix(in_oklch,var(--snake-head)_24%,white)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)] disabled:pointer-events-none disabled:opacity-50 data-[popup-open]:border-[color-mix(in_oklch,var(--snake-head)_65%,var(--snake-border))]"
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
                className={`pointer-events-none absolute left-0 top-full z-40 mt-2 whitespace-nowrap rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] px-3 py-2 text-sm font-semibold text-[var(--snake-ink)] shadow-[0_18px_50px_rgb(15_23_42/0.14)] transition-[opacity,transform] duration-150 ease-out sm:left-auto sm:right-0 ${
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
                className="z-50 flex min-w-40 origin-top-right flex-col gap-1 rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-1.5 text-sm font-medium text-[var(--snake-ink)] shadow-[0_18px_50px_rgb(15_23_42/0.18)] outline-none transition-[opacity,transform] duration-150 ease-out data-[ending-style]:-translate-y-1 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:-translate-y-1 data-[starting-style]:scale-95 data-[starting-style]:opacity-0"
                data-testid="profile-menu"
              >
                <Menu.LinkItem
                  className="flex h-9 items-center gap-2 rounded-md px-2.5 transition hover:bg-[color-mix(in_oklch,var(--snake-head)_10%,white)] focus-visible:outline-none data-[highlighted]:bg-[color-mix(in_oklch,var(--snake-head)_14%,white)]"
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

  return (
    <Dialog.Root open={isAuthOpen} onOpenChange={handleAuthOpenChange}>
      <div
        className="flex w-full flex-wrap items-center justify-start gap-2 text-sm sm:w-auto sm:justify-end"
        data-testid="user-account-controls"
      >
        <Button
          data-testid="log-in-open-button"
          disabled={isLoading}
          onClick={() => openAuthDialog("login")}
          size="lg"
          type="button"
          variant="outline"
        >
          <LogInIcon data-icon="inline-start" />
          Log in
        </Button>
        <Button
          data-testid="sign-up-open-button"
          disabled={isLoading}
          onClick={() => openAuthDialog("signup")}
          size="lg"
          type="button"
        >
          <UserPlusIcon data-icon="inline-start" />
          Sign up
        </Button>
      </div>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/35" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 max-h-[min(42rem,calc(100svh-2rem))] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-[var(--snake-border)] bg-[var(--snake-panel)] p-4 text-[var(--snake-ink)] shadow-[0_24px_90px_rgb(15_23_42/0.28)] outline-none"
          data-testid="auth-dialog"
        >
          <div className="relative flex min-h-8 items-center justify-center">
            <Dialog.Title className="px-10 text-center text-3xl font-semibold tracking-normal text-black">
              {activeModeLabel}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close account dialog"
              className="absolute right-0 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md border border-[var(--snake-border)] bg-white text-[var(--snake-ink)] shadow-sm transition hover:bg-[color-mix(in_oklch,var(--snake-head)_10%,white)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)]"
              type="button"
            >
              <XIcon aria-hidden="true" />
            </Dialog.Close>
          </div>

          <form
            autoComplete="off"
            className="mt-5 flex flex-col gap-3"
            data-testid="auth-form"
            onSubmit={handleAuthSubmit}
          >
            <AuthField
              autoComplete="username"
              disabled={isAuthDisabled}
              error={fieldErrors.displayName}
              id={`${authMode}-display-name`}
              label="User name"
              maxLength={MAX_USER_DISPLAY_NAME_LENGTH}
              name="displayName"
              onValueChange={updateAuthField}
              placeholder="Player name"
              value={displayName}
            />
            <AuthField
              autoComplete={authMode === "login" ? "current-password" : "new-password"}
              disabled={isAuthDisabled}
              error={fieldErrors.password}
              id={`${authMode}-password`}
              label="Password"
              maxLength={MAX_USER_PASSWORD_LENGTH}
              name="password"
              onValueChange={updateAuthField}
              placeholder="Password"
              type="password"
              value={password}
            />
            {authMode === "signup" ? (
              <AuthField
                autoComplete="new-password"
                disabled={isAuthDisabled}
                error={fieldErrors.passwordConfirmation}
                id="signup-password-confirmation"
                label="Repeat password"
                maxLength={MAX_USER_PASSWORD_LENGTH}
                name="passwordConfirmation"
                onValueChange={updateAuthField}
                placeholder="Repeat password"
                type="password"
                value={passwordConfirmation}
              />
            ) : null}
            {formError || userError ? (
              <p
                className="text-sm font-medium text-destructive"
                data-testid="auth-form-error"
                role="status"
              >
                {formError ?? "Account unavailable."}
              </p>
            ) : null}
            <Button
              className="mt-2"
              data-testid="auth-submit-button"
              disabled={isAuthDisabled}
              size="lg"
              type="submit"
            >
              {authMode === "login" ? (
                <LogInIcon data-icon="inline-start" />
              ) : (
                <UserPlusIcon data-icon="inline-start" />
              )}
              {isSubmitting ? `${activeModeLabel}...` : activeModeLabel}
            </Button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AuthField({
  autoComplete,
  disabled,
  error,
  id,
  label,
  maxLength,
  name,
  onValueChange,
  placeholder,
  type = "text",
  value,
}: AuthFieldProps) {
  const errorId = `${id}-error`;
  const hasError = error !== undefined;

  return (
    <Field.Root className="flex flex-col gap-1.5" invalid={hasError}>
      <Field.Label
        className="text-sm font-semibold text-[var(--snake-ink)]"
        htmlFor={id}
      >
        {label}
      </Field.Label>
      <Input
        aria-describedby={hasError ? errorId : undefined}
        aria-invalid={hasError}
        autoComplete={autoComplete}
        className="h-9 min-w-0 rounded-md border border-[var(--snake-border)] bg-white px-3 text-sm font-medium outline-none transition placeholder:text-[var(--snake-muted)] focus-visible:border-[var(--snake-head)] focus-visible:ring-3 focus-visible:ring-[color-mix(in_oklch,var(--snake-head)_25%,transparent)] aria-invalid:border-[color-mix(in_oklch,red_60%,var(--snake-border))]"
        data-testid={`auth-${name}-input`}
        disabled={disabled}
        id={id}
        maxLength={maxLength}
        name={name}
        onValueChange={(nextValue) => onValueChange(name, nextValue)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {hasError ? (
        <Field.Error
          className="text-xs font-medium text-destructive"
          id={errorId}
          match
        >
          {error}
        </Field.Error>
      ) : null}
    </Field.Root>
  );
}
