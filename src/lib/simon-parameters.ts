export type SimonDifficulty = "easy" | "medium" | "hard";

export const SIMON_DEFAULT_DIFFICULTY = "medium" satisfies SimonDifficulty;
export const SIMON_DIFFICULTY_SETTINGS = {
  easy: {
    label: "Easy",
    winTarget: 8,
  },
  hard: {
    label: "Hard",
    winTarget: 16,
  },
  medium: {
    label: "Medium",
    winTarget: 12,
  },
} as const satisfies Record<SimonDifficulty, { label: string; winTarget: number }>;
export const SIMON_DIFFICULTY_OPTIONS = [
  { label: SIMON_DIFFICULTY_SETTINGS.easy.label, value: "easy" },
  { label: SIMON_DIFFICULTY_SETTINGS.medium.label, value: "medium" },
  { label: SIMON_DIFFICULTY_SETTINGS.hard.label, value: "hard" },
] as const satisfies readonly { label: string; value: SimonDifficulty }[];

export function normalizeSimonDifficulty(value: unknown): SimonDifficulty {
  return (
    SIMON_DIFFICULTY_OPTIONS.find((option) => option.value === value)?.value ??
    SIMON_DEFAULT_DIFFICULTY
  );
}

export function getSimonDifficultySettings(difficulty: SimonDifficulty) {
  return SIMON_DIFFICULTY_SETTINGS[difficulty];
}
