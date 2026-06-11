export const APP_THEME_STORAGE_KEY = "game-library-theme";
export const APP_THEME_CHANGE_EVENT = "game-library-theme-change";

export const APP_THEMES = ["light", "dark"] as const;

export type AppTheme = (typeof APP_THEMES)[number];

export const APP_THEME_CSS_VARIABLES = {
  light: {
    "--chrome-page": "oklch(0.985 0.012 150)",
    "--chrome-panel": "oklch(1 0 0)",
    "--chrome-ink": "oklch(0.18 0.035 150)",
    "--chrome-muted": "oklch(0.45 0.035 150)",
    "--chrome-border": "oklch(0.89 0.024 150)",
    "--chrome-accent": "oklch(0.82 0.2 132)",
    "--chrome-accent-ink": "oklch(0.18 0.035 150)",
    "--chrome-accent-soft": "color-mix(in oklch, var(--chrome-accent) 16%, var(--chrome-panel))",
    "--chrome-accent-faint": "color-mix(in oklch, var(--chrome-accent) 10%, var(--chrome-panel))",
    "--chrome-accent-hover": "color-mix(in oklch, var(--chrome-accent) 24%, var(--chrome-panel))",
    "--chrome-focus-ring": "color-mix(in oklch, var(--chrome-accent) 25%, transparent)",
    "--chrome-shadow-soft": "oklch(0.24 0.04 158 / 14%)",
    "--chrome-shadow-modal": "oklch(0.2 0.03 255 / 28%)",
  },
  dark: {
    "--chrome-page": "oklch(0.145 0.018 255)",
    "--chrome-panel": "oklch(0.205 0.018 255)",
    "--chrome-ink": "oklch(0.985 0.006 255)",
    "--chrome-muted": "oklch(0.72 0.03 245)",
    "--chrome-border": "oklch(1 0 0 / 14%)",
    "--chrome-accent": "oklch(0.78 0.18 142)",
    "--chrome-accent-ink": "oklch(0.15 0.025 145)",
    "--chrome-accent-soft": "color-mix(in oklch, var(--chrome-accent) 18%, var(--chrome-panel))",
    "--chrome-accent-faint": "color-mix(in oklch, var(--chrome-accent) 12%, var(--chrome-panel))",
    "--chrome-accent-hover": "color-mix(in oklch, var(--chrome-accent) 28%, var(--chrome-panel))",
    "--chrome-focus-ring": "color-mix(in oklch, var(--chrome-accent) 35%, transparent)",
    "--chrome-shadow-soft": "oklch(0 0 0 / 42%)",
    "--chrome-shadow-modal": "oklch(0 0 0 / 58%)",
  },
} satisfies Record<AppTheme, Record<string, string>>;

export function isAppTheme(value: unknown): value is AppTheme {
  return value === "light" || value === "dark";
}

export function getOppositeAppTheme(theme: AppTheme): AppTheme {
  return theme === "dark" ? "light" : "dark";
}
