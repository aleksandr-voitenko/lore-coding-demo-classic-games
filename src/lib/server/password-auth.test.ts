import { describe, expect, it } from "vitest";

import { hashUserPassword, verifyUserPassword } from "./password-auth";

describe("password auth", () => {
  it("hashes passwords with salts and verifies only matching passwords", async () => {
    const firstHash = await hashUserPassword("password123", "salt-one");
    const secondHash = await hashUserPassword("password123", "salt-two");

    expect(firstHash).not.toBe(secondHash);
    await expect(verifyUserPassword("password123", firstHash)).resolves.toBe(true);
    await expect(verifyUserPassword("not-password", firstHash)).resolves.toBe(false);
    await expect(verifyUserPassword("password123", null)).resolves.toBe(false);
    await expect(verifyUserPassword("password123", "legacy")).resolves.toBe(false);
  });
});
