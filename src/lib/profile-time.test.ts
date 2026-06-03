import { describe, expect, it } from "vitest";

import { formatProfileLastPlayed } from "./profile-time";

const now = new Date("2026-06-03T12:00:00.000Z");

function isoAge(ms: number) {
  return new Date(now.getTime() - ms).toISOString();
}

describe("profile time", () => {
  it("formats sub-minute and future last-played values as moments ago", () => {
    expect(formatProfileLastPlayed(isoAge(0), now)).toBe("moments ago");
    expect(formatProfileLastPlayed(isoAge(59_000), now)).toBe("moments ago");
    expect(formatProfileLastPlayed("2026-06-03T12:01:00.000Z", now)).toBe("moments ago");
  });

  it("formats elapsed minutes and hours with singular and plural labels", () => {
    expect(formatProfileLastPlayed(isoAge(60_000), now)).toBe("1 minute ago");
    expect(formatProfileLastPlayed(isoAge(4 * 60_000), now)).toBe("4 minutes ago");
    expect(formatProfileLastPlayed(isoAge(60 * 60_000), now)).toBe("1 hour ago");
    expect(formatProfileLastPlayed(isoAge(5 * 60 * 60_000), now)).toBe("5 hours ago");
  });

  it("formats older play times as days, months, and years", () => {
    expect(formatProfileLastPlayed(isoAge(24 * 60 * 60_000), now)).toBe("1 day ago");
    expect(formatProfileLastPlayed(isoAge(12 * 24 * 60 * 60_000), now)).toBe("12 days ago");
    expect(formatProfileLastPlayed(isoAge(30 * 24 * 60 * 60_000), now)).toBe("1 month ago");
    expect(formatProfileLastPlayed(isoAge(4 * 30 * 24 * 60 * 60_000), now)).toBe(
      "4 months ago",
    );
    expect(formatProfileLastPlayed(isoAge(365 * 24 * 60 * 60_000), now)).toBe("1 year ago");
    expect(formatProfileLastPlayed(isoAge(10 * 365 * 24 * 60 * 60_000), now)).toBe(
      "10 years ago",
    );
  });
});
