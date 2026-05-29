#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const LORE_TASK_TYPES = [
  "Feature",
  "Improvement",
  "Bug fix",
  "Refactor",
  "Revert",
  "Formatting",
  "Mechanical",
  "Dependency",
  "Database",
  "CI",
  "Build",
  "Test",
  "Docs",
  "Config",
  "Security",
  "Performance",
  "Accessibility",
  "Chore",
];

const TASK_TYPE_SET = new Set(LORE_TASK_TYPES);
const REQUIRED_SECTIONS = ["Context", "Implementation", "Verification"];
const ALL_SECTIONS = ["Links", ...REQUIRED_SECTIONS];
const SECTION_ORDER = new Map(ALL_SECTIONS.map((section, index) => [section, index]));
const SCOPE_PATTERN = /^[a-z0-9]+(?:[ -][a-z0-9]+)*$/;
const WRAPPER_PATTERN =
  /^here(?:'|’)?s\s+(?:the\s+)?(?:commit-message-ready\s+)?(?:task\s+description|commit\s+message):?$/i;
const SUBJECT_PATTERN = /^([^():]+)(?:\(([^)]*)\))?: (.+)$/;
const LINK_PATTERN = /^- ([0-9a-fA-F]+)\s+—\s*(.*)$/;

const ERROR_HELP = {
  LORE001: {
    title: "Wrapper text is not allowed.",
    expected: "The first meaningful line must be the Lore subject.",
    fix: "Remove assistant prose such as \"Here is the commit-message-ready task description:\".",
    example: "Feature(snake): Add timed yellow apples",
  },
  LORE002: {
    title: "Code fences are not allowed in commit messages.",
    expected: "Commit the Lore message directly, without Markdown fences.",
    fix: "Remove lines that start with triple backticks.",
    example: "Feature(snake): Add timed yellow apples",
  },
  LORE010: {
    title: "Malformed subject.",
    expected: "Use `Type: subject` or `Type(scope): subject`.",
    fix: "Make the first meaningful line a supported Lore Coding task subject.",
    example: "Bug fix(leaderboard): Prevent duplicate submissions",
  },
  LORE011: {
    title: "Unsupported task type.",
    expected: `Use one of: ${LORE_TASK_TYPES.join(", ")}.`,
    fix: "Replace the subject type with the supported type that best describes the task.",
    example: "Improvement(tetris): Center next-piece preview",
  },
  LORE012: {
    title: "Malformed subject scope.",
    expected:
      "Scopes must be lower-case words or numbers separated by single spaces or hyphens.",
    fix: "Use a concise scope like `snake`, `game input`, `space-invaders`, or omit the scope.",
    example: "Refactor(game input): Share held-movement lifecycle hook",
  },
  LORE020: {
    title: "Missing required section.",
    expected:
      "Every Lore Coding commit message must contain Context:, Implementation:, and Verification:.",
    fix: "Add the missing section with concrete, non-empty task information.",
    example: "Verification:\n- Ran `npm test`; all tests passed.",
  },
  LORE021: {
    title: "Sections are out of order.",
    expected: "Use optional Links: first, then Context:, Implementation:, and Verification:.",
    fix: "Move the section headers into the required order.",
    example: "Links:\nContext:\nImplementation:\nVerification:",
  },
  LORE022: {
    title: "Section is empty.",
    expected: "Sections must include non-empty content below the header.",
    fix: "Add concrete task context, implementation notes, verification evidence, or link entries.",
    example: "Context:\nThe current behavior accepts wrapped commit messages.",
  },
  LORE023: {
    title: "Duplicate section header.",
    expected: "Use each Lore section header at most once.",
    fix: "Merge the duplicate section content under a single header.",
    example: "Context:\nImplementation:\nVerification:",
  },
  LORE030: {
    title: "Malformed Links entry.",
    expected: "Each Links entry must be `- <full commit hash> — <reason>`.",
    fix: "Use a full commit hash, an em dash separator, and a short reason.",
    example:
      "- 3251d4ac7c0cbf6426f901c15ed2195b3a68f82d — established CI workflow behavior",
  },
  LORE031: {
    title: "Linked commit hash has the wrong format.",
    expected: "Use the full commit hash for this repository object format.",
    fix: "Replace the abbreviated or malformed hash with the full commit hash from `git rev-parse`.",
    example: "git rev-parse HEAD",
  },
  LORE032: {
    title: "Linked commit does not exist.",
    expected: "Every Links entry must reference an existing commit in this repository.",
    fix: "Replace the hash with an existing relevant historical commit, or remove the entry.",
    example: "git show --no-patch --format=fuller <hash>",
  },
  LORE033: {
    title: "Linked object is not a commit.",
    expected: "Links entries must reference commit objects.",
    fix: "Replace the object hash with the full hash of a related commit.",
    example: "git log --oneline -- <file>",
  },
  LORE034: {
    title: "Linked commit is not reachable from the target commit.",
    expected: "Links entries must reference commits already in the target commit history.",
    fix: "Use a historical ancestor commit that explains inherited behavior or constraints.",
    example: "git merge-base --is-ancestor <linked-hash> HEAD",
  },
  LORE035: {
    title: "Links entry is missing a reason.",
    expected: "Every Links entry must explain why the commit is relevant.",
    fix: "Add a short reason after the em dash.",
    example:
      "- 3251d4ac7c0cbf6426f901c15ed2195b3a68f82d — established CI workflow behavior",
  },
  LORE090: {
    title: "Git lookup failed.",
    expected: "Commit link validation must run inside a Git repository with enough history.",
    fix: "Run the validator from the repository root and make sure the linked history is available.",
    example: "git rev-parse --show-object-format",
  },
};

export async function validateLoreCoding(rawMessage, options = {}) {
  const records = createMessageRecords(rawMessage);
  const errors = [];
  const linkEntries = [];

  for (const record of records) {
    if (record.text.trimStart().startsWith("```")) {
      errors.push(
        createDiagnostic("LORE002", record, {
          found: record.text,
        }),
      );
    }
  }

  const subjectIndex = records.findIndex((record) => record.text.trim() !== "");

  if (subjectIndex === -1) {
    errors.push(createDiagnostic("LORE010", undefined, { found: "<empty message>" }));
    return createResult(errors);
  }

  const subjectRecord = records[subjectIndex];
  validateSubject(subjectRecord, errors);

  const bodyRecords = records.slice(subjectIndex + 1);
  validateSections(bodyRecords, errors, linkEntries);

  if (linkEntries.length > 0 && options.checkLinkedCommits !== false) {
    await validateLinkedCommits(linkEntries, errors, options);
  }

  return createResult(errors);
}

export function formatLoreCodingResult(result, options = {}) {
  if (options.format === "json") {
    return JSON.stringify(result, null, 2);
  }

  if (result.valid) {
    return "Lore Coding validation passed.";
  }

  const lines = [
    `Lore Coding validation failed with ${result.errors.length} ${pluralize(
      result.errors.length,
      "error",
    )}.`,
    "",
  ];

  for (const error of result.errors) {
    const location = formatLocation(error);
    lines.push(`${error.code}${location}: ${error.title}`);

    if (error.found !== undefined) {
      lines.push("Found:");
      lines.push(indentMultiline(error.found));
    }

    if (error.expected) {
      lines.push("Expected:");
      lines.push(indentMultiline(error.expected));
    }

    if (error.fix) {
      lines.push("Fix:");
      lines.push(indentMultiline(error.fix));
    }

    if (error.example) {
      lines.push("Example:");
      lines.push(indentMultiline(error.example));
    }

    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function createGitInspector(options = {}) {
  const cwd = options.cwd ?? process.cwd();

  return {
    getObjectFormat() {
      return runGit(["rev-parse", "--show-object-format"], cwd).trim();
    },

    getObjectType(hash) {
      const result = runGit(["cat-file", "-t", hash], cwd, { allowFailure: true });

      if (result.status === 0) {
        return result.stdout.trim();
      }

      if (result.status === 128) {
        return null;
      }

      throw new Error(result.stderr || `git cat-file failed for ${hash}`);
    },

    isAncestor(hash, targetCommit) {
      const result = runGit(["merge-base", "--is-ancestor", hash, targetCommit], cwd, {
        allowFailure: true,
      });

      if (result.status === 0) {
        return true;
      }

      if (result.status === 1) {
        return false;
      }

      throw new Error(result.stderr || `git merge-base failed for ${hash}`);
    },
  };
}

export function getHelpForError(code) {
  return ERROR_HELP[code] ?? null;
}

function createMessageRecords(rawMessage) {
  const lines = rawMessage.replace(/\r\n?/g, "\n").split("\n");
  const records = lines
    .map((text, index) => ({
      line: index + 1,
      text,
    }))
    .filter((record) => !record.text.startsWith("#"));

  while (records.length > 0 && records.at(-1).text.trim() === "") {
    records.pop();
  }

  return records;
}

function validateSubject(subjectRecord, errors) {
  const subject = subjectRecord.text.trimEnd();

  if (WRAPPER_PATTERN.test(subject.trim())) {
    errors.push(
      createDiagnostic("LORE001", subjectRecord, {
        found: subject,
      }),
    );
    return;
  }

  const match = subject.match(SUBJECT_PATTERN);

  if (!match) {
    errors.push(
      createDiagnostic("LORE010", subjectRecord, {
        found: subject,
      }),
    );
    return;
  }

  const [, taskType, scope, description] = match;

  if (!TASK_TYPE_SET.has(taskType)) {
    errors.push(
      createDiagnostic("LORE011", subjectRecord, {
        found: taskType,
      }),
    );
  }

  if (scope !== undefined && !SCOPE_PATTERN.test(scope)) {
    errors.push(
      createDiagnostic("LORE012", subjectRecord, {
        found: scope,
      }),
    );
  }

  if (description.trim() === "") {
    errors.push(
      createDiagnostic("LORE010", subjectRecord, {
        found: subject,
      }),
    );
  }
}

function validateSections(bodyRecords, errors, linkEntries) {
  const occurrences = [];

  bodyRecords.forEach((record, index) => {
    const section = parseSectionHeader(record.text);

    if (section) {
      occurrences.push({
        section,
        record,
        bodyIndex: index,
      });
    }
  });

  const sectionOccurrences = new Map();

  for (const occurrence of occurrences) {
    const knownOccurrences = sectionOccurrences.get(occurrence.section) ?? [];
    knownOccurrences.push(occurrence);
    sectionOccurrences.set(occurrence.section, knownOccurrences);

    if (knownOccurrences.length > 1) {
      errors.push(
        createDiagnostic("LORE023", occurrence.record, {
          found: occurrence.record.text.trim(),
        }),
      );
    }
  }

  for (const requiredSection of REQUIRED_SECTIONS) {
    if (!sectionOccurrences.has(requiredSection)) {
      errors.push(
        createDiagnostic("LORE020", undefined, {
          found: "<missing>",
          expected: `Missing section: ${requiredSection}:`,
        }),
      );
    }
  }

  let lastOrder = -1;

  for (const occurrence of occurrences) {
    const currentOrder = SECTION_ORDER.get(occurrence.section);

    if (currentOrder < lastOrder) {
      errors.push(
        createDiagnostic("LORE021", occurrence.record, {
          found: occurrence.record.text.trim(),
        }),
      );
    }

    lastOrder = Math.max(lastOrder, currentOrder);
  }

  for (const occurrence of occurrences) {
    const content = getSectionContent(bodyRecords, occurrences, occurrence);
    const hasContent = content.some((record) => record.text.trim() !== "");

    if (!hasContent) {
      errors.push(
        createDiagnostic("LORE022", occurrence.record, {
          found: occurrence.record.text.trim(),
        }),
      );
    }

    if (occurrence.section === "Links") {
      validateLinksContent(content, errors, linkEntries);
    }
  }
}

function validateLinksContent(contentRecords, errors, linkEntries) {
  for (const record of contentRecords) {
    const line = record.text.trim();

    if (line === "") {
      continue;
    }

    const match = line.match(LINK_PATTERN);

    if (!match) {
      errors.push(
        createDiagnostic("LORE030", record, {
          found: record.text,
        }),
      );
      continue;
    }

    const [, hash, reason] = match;

    if (reason.trim() === "") {
      errors.push(
        createDiagnostic("LORE035", record, {
          found: record.text,
        }),
      );
    }

    linkEntries.push({
      hash,
      line: record.line,
      record,
    });
  }
}

async function validateLinkedCommits(linkEntries, errors, options) {
  const gitInspector = options.gitInspector ?? createGitInspector({ cwd: options.cwd });
  const targetCommit = options.targetCommit ?? "HEAD";
  let objectFormat;

  try {
    objectFormat = await gitInspector.getObjectFormat();
  } catch (error) {
    errors.push(
      createDiagnostic("LORE090", undefined, {
        found: String(error.message ?? error),
      }),
    );
    return;
  }

  const expectedHashLength = getExpectedHashLength(objectFormat);

  if (!expectedHashLength) {
    errors.push(
      createDiagnostic("LORE090", undefined, {
        found: `Unsupported Git object format: ${objectFormat}`,
      }),
    );
    return;
  }

  for (const entry of linkEntries) {
    if (!isFullHashForFormat(entry.hash, expectedHashLength)) {
      errors.push(
        createDiagnostic("LORE031", entry.record, {
          found: entry.hash,
          expected: `A ${expectedHashLength}-character hexadecimal commit hash.`,
        }),
      );
      continue;
    }

    let objectType;

    try {
      objectType = await gitInspector.getObjectType(entry.hash);
    } catch (error) {
      errors.push(
        createDiagnostic("LORE090", entry.record, {
          found: String(error.message ?? error),
        }),
      );
      continue;
    }

    if (objectType === null) {
      errors.push(
        createDiagnostic("LORE032", entry.record, {
          found: entry.hash,
        }),
      );
      continue;
    }

    if (objectType !== "commit") {
      errors.push(
        createDiagnostic("LORE033", entry.record, {
          found: `${entry.hash} is a ${objectType} object`,
        }),
      );
      continue;
    }

    let isReachable;

    try {
      isReachable = await gitInspector.isAncestor(entry.hash, targetCommit);
    } catch (error) {
      errors.push(
        createDiagnostic("LORE090", entry.record, {
          found: String(error.message ?? error),
        }),
      );
      continue;
    }

    if (!isReachable) {
      errors.push(
        createDiagnostic("LORE034", entry.record, {
          found: entry.hash,
        }),
      );
    }
  }
}

function parseSectionHeader(text) {
  const trimmed = text.trim();

  if (!trimmed.endsWith(":")) {
    return null;
  }

  const section = trimmed.slice(0, -1);
  return SECTION_ORDER.has(section) ? section : null;
}

function getSectionContent(bodyRecords, occurrences, occurrence) {
  const nextOccurrence = occurrences.find(
    (candidate) => candidate.bodyIndex > occurrence.bodyIndex,
  );
  const endIndex = nextOccurrence?.bodyIndex ?? bodyRecords.length;
  return bodyRecords.slice(occurrence.bodyIndex + 1, endIndex);
}

function getExpectedHashLength(objectFormat) {
  if (objectFormat === "sha1") {
    return 40;
  }

  if (objectFormat === "sha256") {
    return 64;
  }

  return null;
}

function isFullHashForFormat(hash, expectedLength) {
  return hash.length === expectedLength && /^[0-9a-fA-F]+$/.test(hash);
}

function createResult(errors) {
  return {
    valid: errors.length === 0,
    errors,
  };
}

function createDiagnostic(code, record, overrides = {}) {
  const help = ERROR_HELP[code];

  return {
    code,
    title: help.title,
    line: record?.line,
    expected: help.expected,
    fix: help.fix,
    example: help.example,
    ...overrides,
  };
}

function formatLocation(error) {
  if (!error.line) {
    return "";
  }

  return ` line ${error.line}`;
}

function indentMultiline(value) {
  return String(value)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function pluralize(count, singular) {
  return count === 1 ? singular : `${singular}s`;
}

function runGit(args, cwd, options = {}) {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    if (options.allowFailure) {
      return {
        status: 0,
        stdout,
        stderr: "",
      };
    }

    return stdout;
  } catch (error) {
    if (options.allowFailure) {
      return {
        status: error.status,
        stdout: error.stdout?.toString() ?? "",
        stderr: error.stderr?.toString() ?? "",
      };
    }

    throw error;
  }
}

async function main(argv) {
  const args = parseCliArgs(argv.slice(2));

  if (args.help) {
    process.stdout.write(getCliHelp());
    return 0;
  }

  if (args.explainCode) {
    const help = getHelpForError(args.explainCode);

    if (!help) {
      process.stderr.write(`Unknown Lore Coding error code: ${args.explainCode}\n`);
      return 2;
    }

    process.stdout.write(formatExplainOutput(args.explainCode, help));
    return 0;
  }

  if (args.error) {
    process.stderr.write(`${args.error}\n\n${getCliHelp()}`);
    return 2;
  }

  const message = args.filePath ? readFileSync(args.filePath, "utf8") : await readStdin();
  const result = await validateLoreCoding(message, {
    checkLinkedCommits: args.checkLinkedCommits,
    cwd: process.cwd(),
    targetCommit: args.targetCommit,
  });
  const output = formatLoreCodingResult(result, {
    format: args.format,
  });

  if (result.valid) {
    if (args.format === "json") {
      process.stdout.write(`${output}\n`);
    }

    return 0;
  }

  const stream = args.format === "json" ? process.stdout : process.stderr;
  stream.write(`${output}\n`);

  return result.errors.some((error) => error.code === "LORE090") ? 3 : 1;
}

function parseCliArgs(args) {
  const parsed = {
    checkLinkedCommits: true,
    filePath: null,
    format: "text",
    help: false,
    targetCommit: "HEAD",
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "explain") {
      parsed.explainCode = args[index + 1];

      if (!parsed.explainCode) {
        parsed.error = "Missing error code after `explain`.";
      }

      index += 1;
      continue;
    }

    if (arg === "--edit" || arg === "--file") {
      const filePath = args[index + 1];

      if (!filePath) {
        parsed.error = `Missing file path after ${arg}.`;
        break;
      }

      parsed.filePath = filePath;
      index += 1;
      continue;
    }

    if (arg === "--format") {
      const format = args[index + 1];

      if (format !== "text" && format !== "json") {
        parsed.error = "Expected --format to be `text` or `json`.";
        break;
      }

      parsed.format = format;
      index += 1;
      continue;
    }

    if (arg === "--target") {
      const targetCommit = args[index + 1];

      if (!targetCommit) {
        parsed.error = "Missing commit after --target.";
        break;
      }

      parsed.targetCommit = targetCommit;
      index += 1;
      continue;
    }

    if (arg === "--no-git-links") {
      parsed.checkLinkedCommits = false;
      continue;
    }

    if (arg.startsWith("-")) {
      parsed.error = `Unknown option: ${arg}`;
      break;
    }

    if (parsed.filePath) {
      parsed.error = `Unexpected extra argument: ${arg}`;
      break;
    }

    parsed.filePath = arg;
  }

  return parsed;
}

function getCliHelp() {
  return `Lore Coding validator

Usage:
  node scripts/lore-coding.mjs --edit <commit-message-file>
  node scripts/lore-coding.mjs --file <commit-message-file>
  node scripts/lore-coding.mjs [--format json] <commit-message-file>
  node scripts/lore-coding.mjs explain <error-code>

Options:
  --edit <file>       Validate the commit message file passed by Git commit-msg.
  --file <file>       Validate a commit message file.
  --format <format>   Output text or json. Defaults to text.
  --target <commit>   Require linked commits to be ancestors of this commit. Defaults to HEAD.
  --no-git-links      Validate Links: syntax but skip Git existence and reachability checks.

Exit codes:
  0  valid
  1  validation failed
  2  CLI usage error
  3  Git lookup failed
`;
}

function formatExplainOutput(code, help) {
  return `${code}: ${help.title}

Expected:
  ${help.expected}

Fix:
  ${help.fix}

Example:
${indentMultiline(help.example)}
`;
}

async function readStdin() {
  let input = "";
  process.stdin.setEncoding("utf8");

  for await (const chunk of process.stdin) {
    input += chunk;
  }

  return input;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv)
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      process.stderr.write(`${error.stack ?? error.message ?? error}\n`);
      process.exitCode = 2;
    });
}
