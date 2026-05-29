import { describe, expect, it } from "vitest";

import { formatLoreCodingResult, validateLoreCoding } from "./lore-coding.mjs";

const EXISTING_COMMIT = "a".repeat(40);
const MISSING_COMMIT = "b".repeat(40);
const TREE_OBJECT = "c".repeat(40);
const UNREACHABLE_COMMIT = "d".repeat(40);

function createMessage(overrides = {}) {
  const links =
    overrides.links === undefined
      ? `Links:
- ${EXISTING_COMMIT} — established the behavior being extended

`
      : overrides.links;

  return `${overrides.subject ?? "Feature(snake): Add timed yellow apples"}

${links}Context:
${overrides.context ?? "Snake needs a temporary bonus pickup with clear scoring behavior."}

Implementation:
${overrides.implementation ?? "Added the pickup rule in the deterministic engine."}

Verification:
${overrides.verification ?? "- Added deterministic tests for the timed pickup."}
`;
}

function createGitInspector() {
  return {
    getObjectFormat: () => "sha1",
    getObjectType: (hash) => {
      if (hash === EXISTING_COMMIT || hash === UNREACHABLE_COMMIT) {
        return "commit";
      }

      if (hash === TREE_OBJECT) {
        return "tree";
      }

      return null;
    },
    isAncestor: (hash) => hash === EXISTING_COMMIT,
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
  it("accepts a complete Lore Coding commit message with a reachable linked commit", async () => {
    const result = await validate(createMessage());

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("allows valid messages without Links", async () => {
    const result = await validate(
      createMessage({
        links: "",
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
`);
    const empty = await validate(`Feature(snake): Add timed yellow apples

Context:

Implementation:
Added the engine rule.

Implementation:
Updated tests.

Verification:
- Ran the focused tests.

Links:
- ${EXISTING_COMMIT} — established the prior pickup behavior
`);

    expect(codes(missing)).toContain("LORE020");
    expect(codes(empty)).toEqual(expect.arrayContaining(["LORE021", "LORE022", "LORE023"]));
  });

  it("rejects malformed Links entries and missing link reasons", async () => {
    const malformed = await validate(
      createMessage({
        links: `Links:
- ${EXISTING_COMMIT} - uses a hyphen instead of an em dash

`,
      }),
    );
    const missingReason = await validate(
      createMessage({
        links: `Links:
- ${EXISTING_COMMIT} —

`,
      }),
    );

    expect(codes(malformed)).toContain("LORE030");
    expect(codes(missingReason)).toContain("LORE035");
  });

  it("checks linked commit hash format, existence, type, and reachability", async () => {
    const result = await validate(
      createMessage({
        links: `Links:
- abc123 — abbreviated hashes are not allowed
- ${MISSING_COMMIT} — missing commit
- ${TREE_OBJECT} — non-commit object
- ${UNREACHABLE_COMMIT} — unrelated branch commit

`,
      }),
    );

    expect(codes(result)).toEqual(
      expect.arrayContaining(["LORE031", "LORE032", "LORE033", "LORE034"]),
    );
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
