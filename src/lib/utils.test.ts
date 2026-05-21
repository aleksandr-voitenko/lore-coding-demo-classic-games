import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("combines conditional classes and resolves Tailwind conflicts", () => {
    expect(
      cn("px-2", ["text-sm", "px-4"], {
        "font-bold": true,
        "opacity-50": false,
      }),
    ).toBe("text-sm px-4 font-bold");
  });
});
