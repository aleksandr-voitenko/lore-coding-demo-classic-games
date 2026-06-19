import { describe, expect, it } from "vitest";

import { formatLoreCodingResult, validateLoreCoding } from "../.githooks/lore-coding.mjs";

const EXISTING_COMMIT = "a".repeat(40);
const EXISTING_LORE_ID = "LC-20260529-18A1";
const MISSING_LORE_ID = "LC-20260529-DEAD";
const MESSAGE_LORE_ID = "LC-20260530-7B2C";

function createMessage(overrides = {}) {
  const loreId =
    overrides.loreId === undefined ? `Lore-ID: ${MESSAGE_LORE_ID}` : overrides.loreId;
  const loreLinks =
    overrides.loreLinks === undefined
      ? `Lore-Link: ${EXISTING_LORE_ID} — established the behavior being extended`
      : overrides.loreLinks;
  const trailers =
    overrides.trailers === undefined
      ? [loreId, loreLinks].filter(Boolean).join("\n")
      : overrides.trailers;

  return `${overrides.subject ?? "Feature(snake): Add timed yellow apples"}

Context:
${overrides.context ?? "Snake needs a temporary bonus pickup with clear scoring behavior."}

Implementation:
${overrides.implementation ?? "Added the pickup rule in the deterministic engine."}

Verification:
${overrides.verification ?? "- Added deterministic tests for the timed pickup."}

${trailers}
`;
}

function createGitInspector() {
  return {
    findCommitsByLoreId: (loreId) =>
      loreId === EXISTING_LORE_ID ? [EXISTING_COMMIT] : [],
  };
}

async function validate(message, options = {}) {
  return validateLoreCoding(message, {
    gitInspector: createGitInspector(),
    ...options,
  });
}

function codes(result) {
  return result.errors.map((error) => error.code);
}

describe("Lore Coding validator", () => {
  it("accepts a complete v15 Lore Coding commit message with a reachable Lore-Link", async () => {
    const result = await validate(createMessage());

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("allows valid messages without Lore-Link trailers", async () => {
    const result = await validate(
      createMessage({
        loreLinks: "",
      }),
    );

    expect(result.valid).toBe(true);
  });

  it("rejects assistant wrapper text and code fences", async () => {
    const result = await validate(`Here’s the commit-message-ready task description:

\`\`\`text
${createMessage()}
\`\`\`
`);

    expect(codes(result)).toEqual(expect.arrayContaining(["LORE001", "LORE002"]));
  });

  it("rejects unsupported task types and malformed scopes", async () => {
    const unsupportedType = await validate(
      createMessage({
        subject: "Title: Add a validator",
      }),
    );
    const malformedScope = await validate(
      createMessage({
        subject: "Feature(Game/Input): Add a validator",
      }),
    );

    expect(codes(unsupportedType)).toContain("LORE011");
    expect(codes(malformedScope)).toContain("LORE012");
  });

  it("rejects missing, empty, duplicate, and out-of-order sections", async () => {
    const missing = await validate(`Feature(snake): Add timed yellow apples

Context:
Snake needs a timed pickup.

Verification:
- Ran the focused tests.

Lore-ID: ${MESSAGE_LORE_ID}
`);
    const emptyDuplicate = await validate(`Feature(snake): Add timed yellow apples

Context:

Implementation:
Added the engine rule.

Implementation:
Updated tests.

Verification:
- Ran the focused tests.

Lore-ID: ${MESSAGE_LORE_ID}
`);
    const outOfOrder = await validate(`Feature(snake): Add timed yellow apples

Implementation:
Added the engine rule.

Context:
Snake needs a timed pickup.

Verification:
- Ran the focused tests.

Lore-ID: ${MESSAGE_LORE_ID}
`);

    expect(codes(missing)).toContain("LORE020");
    expect(codes(emptyDuplicate)).toEqual(expect.arrayContaining(["LORE022", "LORE023"]));
    expect(codes(outOfOrder)).toContain("LORE021");
  });

  it("rejects missing, malformed, duplicate, and non-final Lore-ID trailers", async () => {
    const missing = await validate(
      createMessage({
        trailers: "",
      }),
    );
    const malformed = await validate(
      createMessage({
        loreId: "Lore-ID: LC-2026-ABCD",
        loreLinks: "",
      }),
    );
    const duplicate = await validate(
      createMessage({
        trailers: `Lore-ID: ${MESSAGE_LORE_ID}
Lore-ID: LC-20260530-ABCD`,
      }),
    );
    const nonFinal = await validate(
      createMessage({
        trailers: `Lore-ID: ${MESSAGE_LORE_ID}
Extra notes after the trailer.`,
      }),
    );

    expect(codes(missing)).toContain("LORE040");
    expect(codes(malformed)).toContain("LORE041");
    expect(codes(duplicate)).toContain("LORE042");
    expect(codes(nonFinal)).toContain("LORE043");
  });

  it("rejects legacy Links sections", async () => {
    const result = await validate(`Feature(snake): Add timed yellow apples

Links:
- ${EXISTING_COMMIT} — established the prior pickup behavior

Context:
Snake needs a timed pickup.

Implementation:
Added the engine rule.

Verification:
- Ran the focused tests.

Lore-ID: ${MESSAGE_LORE_ID}
`);

    expect(codes(result)).toContain("LORE046");
  });

  it("rejects malformed Lore-Link trailers and missing link reasons", async () => {
    const malformed = await validate(
      createMessage({
        loreLinks: `Lore-Link: ${EXISTING_LORE_ID} - uses a hyphen instead of an em dash`,
      }),
    );
    const missingReason = await validate(
      createMessage({
        loreLinks: `Lore-Link: ${EXISTING_LORE_ID} —`,
      }),
    );

    expect(codes(malformed)).toContain("LORE044");
    expect(codes(missingReason)).toContain("LORE045");
  });

  it("checks that Lore-Link trailers reference reachable historical Lore IDs", async () => {
    const result = await validate(
      createMessage({
        loreLinks: `Lore-Link: ${MISSING_LORE_ID} — references a task that does not exist`,
      }),
    );

    expect(codes(result)).toContain("LORE047");
  });

  it("can skip Lore-Link history lookups for syntax-only validation", async () => {
    const result = await validate(
      createMessage({
        loreLinks: `Lore-Link: ${MISSING_LORE_ID} — references a task from unavailable history`,
      }),
      { checkLinkedLoreIds: false },
    );

    expect(result.valid).toBe(true);
  });

  it("formats actionable diagnostics for hook output", async () => {
    const result = await validate(`Title: Add a validator`);
    const output = formatLoreCodingResult(result);

    expect(output).toContain("LORE011 line 1: Unsupported task type.");
    expect(output).toContain("Expected:");
    expect(output).toContain("Fix:");
    expect(output).toContain("Example:");
  });
});
