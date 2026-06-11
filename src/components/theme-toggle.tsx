"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
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

  return (
    <Button
      aria-label={label}
      aria-pressed={theme === "dark"}
      className={cn(
        "rounded-md border-[var(--chrome-border)] bg-[var(--chrome-panel)] text-[var(--chrome-ink)] shadow-sm hover:bg-[var(--chrome-accent-faint)] hover:text-[var(--chrome-ink)] focus-visible:ring-[var(--chrome-focus-ring)]",
        className,
      )}
      data-testid={testId}
      onClick={() => setTheme(nextTheme)}
      size={compact ? "icon-lg" : "lg"}
      type="button"
      variant="outline"
    >
      {theme === "dark" ? (
        <SunIcon aria-hidden="true" data-icon="inline-start" />
      ) : (
        <MoonIcon aria-hidden="true" data-icon="inline-start" />
      )}
      {compact ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span>{nextTheme === "dark" ? "Dark mode" : "Light mode"}</span>
      )}
    </Button>
  );
}
