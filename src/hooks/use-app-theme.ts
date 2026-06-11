"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  APP_THEME_CHANGE_EVENT,
  APP_THEME_CSS_VARIABLES,
  APP_THEME_STORAGE_KEY,
  getOppositeAppTheme,
  isAppTheme,
  type AppTheme,
} from "@/lib/app-theme";

function getDocumentTheme(): AppTheme {
  if (typeof document === "undefined") {
    return "light";
  }

  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readStoredTheme() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const storedTheme = window.localStorage.getItem(APP_THEME_STORAGE_KEY);

    return isAppTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function getThemeSnapshot(): AppTheme {
  return readStoredTheme() ?? getDocumentTheme();
}

function getServerThemeSnapshot(): AppTheme {
  return "light";
}

function applyAppTheme(theme: AppTheme) {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;

  for (const [property, value] of Object.entries(APP_THEME_CSS_VARIABLES[theme])) {
    root.style.setProperty(property, value);
  }
}

function persistAppTheme(theme: AppTheme) {
  applyAppTheme(theme);

  try {
    window.localStorage.setItem(APP_THEME_STORAGE_KEY, theme);
  } catch {
    // The class is still applied when storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(APP_THEME_CHANGE_EVENT, { detail: theme }));
}

function subscribeToTheme(callback: () => void) {
  function handleThemeChange() {
    callback();
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key !== APP_THEME_STORAGE_KEY) {
      return;
    }

    const nextTheme = isAppTheme(event.newValue) ? event.newValue : "light";

    applyAppTheme(nextTheme);
    callback();
  }

  window.addEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(APP_THEME_CHANGE_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

export function useAppTheme() {
  const theme = useSyncExternalStore(
    subscribeToTheme,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  const setTheme = useCallback((nextTheme: AppTheme) => {
    persistAppTheme(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    persistAppTheme(getOppositeAppTheme(getThemeSnapshot()));
  }, []);

  return {
    setTheme,
    theme,
    toggleTheme,
  };
}
