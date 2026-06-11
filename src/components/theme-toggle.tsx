"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { useAppTheme } from "@/hooks/use-app-theme";
import { getOppositeAppTheme } from "@/lib/app-theme";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  compact?: boolean;
  testId?: string;
};

export function ThemeToggle({
  className,
  compact = false,
  testId = "theme-toggle",
}: ThemeToggleProps) {
  const { setTheme, theme } = useAppTheme();
  const nextTheme = getOppositeAppTheme(theme);
  const label = nextTheme === "dark" ? "Switch to dark mode" : "Switch to light mode";
  const isDark = theme === "dark";

  return (
    <button
      aria-label={label}
      aria-pressed={isDark}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center justify-between overflow-hidden rounded-full border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-1 text-[var(--chrome-muted)] shadow-sm transition hover:bg-[var(--chrome-accent-faint)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[var(--chrome-focus-ring)] active:translate-y-px",
        compact ? "h-9 w-[4.5rem]" : "h-10 w-[5.25rem]",
        className,
      )}
      data-testid={testId}
      onClick={() => setTheme(nextTheme)}
      type="button"
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-1 top-1 rounded-full bg-[var(--chrome-ink)] shadow-[0_4px_14px_var(--chrome-shadow-soft)] transition-transform duration-200 ease-out",
          compact ? "size-7" : "size-8",
          isDark ? (compact ? "translate-x-[2.25rem]" : "translate-x-[2.75rem]") : "translate-x-0",
        )}
        data-theme-toggle-thumb
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 grid place-items-center rounded-full transition-colors duration-200",
          compact ? "size-7" : "size-8",
          isDark ? "text-[var(--chrome-muted)]" : "text-[var(--chrome-panel)]",
        )}
      >
        <SunIcon className="size-4" data-theme-icon="sun" />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative z-10 grid place-items-center rounded-full transition-colors duration-200",
          compact ? "size-7" : "size-8",
          isDark ? "text-[var(--chrome-panel)]" : "text-[var(--chrome-muted)]",
        )}
      >
        <MoonIcon className="size-4" data-theme-icon="moon" />
      </span>
    </button>
  );
}
