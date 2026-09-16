import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { formatLoreCodingResult, validateLoreCoding } from "./lore-coding.mjs";

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

describe("Lore Coding real Git history", () => {
  const directories = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  function createHistory() {
    const cwd = mkdtempSync(join(tmpdir(), "lore-coding-history-"));
    directories.push(cwd);
    const git = (args, input) =>
      execFileSync("git", args, {
        cwd,
        input,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: "Lore test",
          GIT_AUTHOR_EMAIL: "lore-test@example.invalid",
          GIT_COMMITTER_NAME: "Lore test",
          GIT_COMMITTER_EMAIL: "lore-test@example.invalid",
        },
      }).trim();

    git(["init", "--quiet"]);
    const tree = git(["mktree"], "");
    let parent;

    return {
      cwd,
      commit(message) {
        const hash = git(
          ["-c", "commit.gpgsign=false", "commit-tree", tree, ...(parent ? ["-p", parent] : [])],
          message,
        );
        git(["update-ref", "HEAD", hash]);
        parent = hash;
        return hash;
      },
    };
  }

  it("resolves a Lore-Link with more than 1 MiB of unrelated history", async () => {
    const history = createHistory();
    history.commit(`Docs: Unrelated history\n\n${"x".repeat(1024 * 1024 + 1024)}\n`);
    history.commit(createMessage({ loreId: `Lore-ID:\t${EXISTING_LORE_ID}`, loreLinks: "" }));

    expect(await validateLoreCoding(createMessage(), { cwd: history.cwd })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects missing IDs and IDs mentioned only in prose or Lore-Link trailers", async () => {
    const history = createHistory();
    history.commit(createMessage({ context: `This refers to ${EXISTING_LORE_ID}.` }));

    for (const loreId of [EXISTING_LORE_ID, MISSING_LORE_ID]) {
      const result = await validateLoreCoding(
        createMessage({ loreLinks: `Lore-Link: ${loreId} — previous task` }),
        { cwd: history.cwd },
      );
      expect(result.valid).toBe(false);
      expect(codes(result)).toEqual(["LORE047"]);
    }
  });

  it("rejects a Lore-ID outside the selected target history", async () => {
    const history = createHistory();
    const targetCommit = history.commit(createMessage({ loreLinks: "" }));
    history.commit(createMessage({ loreId: `Lore-ID: ${EXISTING_LORE_ID}`, loreLinks: "" }));

    const result = await validateLoreCoding(createMessage(), { cwd: history.cwd, targetCommit });
    expect(result.valid).toBe(false);
    expect(codes(result)).toEqual(["LORE047"]);
  });
});

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
