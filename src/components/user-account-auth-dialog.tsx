"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Field } from "@base-ui/react/field";
import { Input } from "@base-ui/react/input";
import { LogInIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
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

type UserAccountAuthDialogProps = {
  initialAuthMode?: UserAuthMode | null;
  isLoading: boolean;
  logIn: (displayName: string, password: string) => Promise<void>;
  signUp: (
    displayName: string,
    password: string,
    passwordConfirmation: string,
  ) => Promise<void>;
  userError: boolean;
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

function hasFieldErrors(fieldErrors: UserAuthFieldErrors) {
  return Object.keys(fieldErrors).length > 0;
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

export function UserAccountAuthDialog({
  initialAuthMode = null,
  isLoading,
  logIn,
  signUp,
  userError,
}: UserAccountAuthDialogProps) {
  const [authMode, setAuthMode] = useState<UserAuthMode>(initialAuthMode ?? "login");
  const [displayName, setDisplayName] = useState("");
  const [fieldErrors, setFieldErrors] = useState<UserAuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(initialAuthMode !== null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const normalizedDisplayName = normalizeUserDisplayName(displayName);
  const activeModeLabel = AUTH_MODE_LABELS[authMode];
  const isAuthDisabled = isLoading || isSubmitting;

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
        <Dialog.Backdrop className="fixed inset-0 bg-black/45" />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 max-h-[min(42rem,calc(100svh-2rem))] w-[min(calc(100vw-2rem),28rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 text-[var(--chrome-ink)] shadow-[0_24px_90px_var(--chrome-shadow-modal)] outline-none"
          data-testid="auth-dialog"
        >
          <div className="relative flex min-h-8 items-center justify-center">
            <ThemeToggle
              className="absolute left-0 top-1/2 -translate-y-1/2"
              compact
              testId="auth-theme-toggle"
            />
            <Dialog.Title className="px-20 text-center text-3xl font-semibold tracking-normal text-[var(--chrome-ink)]">
              {activeModeLabel}
            </Dialog.Title>
            <Dialog.Close
              aria-label="Close account dialog"
              className="absolute right-0 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-[var(--chrome-ink)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)]"
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
        className="text-sm font-semibold text-[var(--chrome-ink)]"
        htmlFor={id}
      >
        {label}
      </Field.Label>
      <Input
        aria-describedby={hasError ? errorId : undefined}
        aria-invalid={hasError}
        autoComplete={autoComplete}
        className="h-9 min-w-0 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] px-3 text-sm font-medium text-[var(--chrome-ink)] outline-none transition placeholder:text-[var(--chrome-muted)] focus-visible:border-[var(--chrome-accent)] focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)] aria-invalid:border-[color-mix(in_oklch,red_60%,var(--chrome-border))]"
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
