import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

describe("sqlite social store facade", () => {
  const tempDirectories: string[] = [];

  afterEach(() => {
    vi.unstubAllEnvs();

    while (tempDirectories.length > 0) {
      rmSync(tempDirectories.pop() as string, { force: true, recursive: true });
    }
  });

  it("reuses one store on the configured user-profile SQLite path", async () => {
    const tempDirectory = mkdtempSync(join(tmpdir(), "social-store-facade-"));
    const databasePath = join(tempDirectory, "shared.sqlite");
    tempDirectories.push(tempDirectory);
    vi.resetModules();
    vi.stubEnv("GAME_LEADERBOARD_SQLITE_PATH", databasePath);
    vi.stubEnv("SNAKE_LEADERBOARD_SQLITE_PATH", "");

    const { getUserProfileSqlitePath } = await import(
      "./sqlite-user-profile-store"
    );
    const { getSocialStore } = await import("./sqlite-social-store");
    const store = getSocialStore();

    expect(getUserProfileSqlitePath()).toBe(databasePath);
    expect(getSocialStore()).toBe(store);

    const database = new Database(databasePath, { readonly: true });
    expect(database.pragma("user_version", { simple: true })).toBe(7);
    database.close();
    store.close();
  });
});
