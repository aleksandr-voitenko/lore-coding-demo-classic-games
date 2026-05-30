# Scripts Memory

This file covers repository-local development tooling under `scripts/`.

## Agentic Lore Coding Validator

- `scripts/lore-coding.mjs` is a dependency-free Node CLI and importable module
  for validating Agentic Lore Coding commit messages. Keep it portable so it can
  be copied or packaged for other repositories without app-specific imports.
- The CLI supports `--edit <file>` for Git `commit-msg` hooks, `--file <file>`
  or stdin for manual checks, `--format json` for machine-readable diagnostics,
  `explain <LORE###>` for stable rule help, `--target <commit>` for Lore-Link
  history checks, `--no-lore-links` for syntax-only link validation, and the
  legacy `--no-git-links` alias.
- `.githooks/commit-msg` calls `node scripts/lore-coding.mjs --edit "$1"`.
  `scripts/install-lore-coding-hooks.mjs` configures `core.hooksPath .githooks` from
  the package `prepare` script after dependency install. The installer skips
  outside Git worktrees, in CI, and when `LORE_CODING_INSTALL_HOOKS=0`; it does
  not overwrite an existing custom `core.hooksPath`. CI does not run this
  validator yet.
- Validation strips Git comment lines before checking the message so editor
  templates do not create false failures.
- Subject validation follows the Agentic Lore Coding task subject format:
  `Type: subject` or `Type(scope): subject`. Supported task types live in
  `LORE_TASK_TYPES`; scopes are optional lower-case words or numbers separated
  by single spaces or hyphens.
- Body validation requires non-empty `Context:`, `Implementation:`, and
  `Verification:` sections in that order, followed by final Lore trailers.
  Wrapper prose, Markdown code fences, and legacy `Links:` sections are rejected
  because they previously appeared in real commit subjects.
- Trailer validation requires exactly one `Lore-ID: LC-YYYYMMDD-XXXX` trailer.
  Optional repeated `Lore-Link: LC-YYYYMMDD-XXXX — <reason>` trailers must be
  contiguous final lines and resolve to a matching `Lore-ID:` in the target
  history (`HEAD` by default for local hooks), unless syntax-only validation is
  requested.
- Diagnostics use stable `LORE###` codes with line numbers, expected format,
  fix guidance, and examples. Preserve those codes when tightening copy so
  agents can react to failures reliably.

## Tests

- `scripts/lore-coding.test.mjs` covers accepted Lore messages, wrapper and
  code-fence rejection, subject type/scope validation, required section checks,
  Lore-ID and Lore-Link trailer syntax, legacy Links rejection, Lore-Link
  history resolution, syntax-only link validation, and hook-style diagnostic
  formatting.
- `scripts/install-lore-coding-hooks.test.mjs` covers install planning for fresh
  worktrees, non-Git directories, CI, explicit opt-out, existing custom hook
  paths, and already-configured `.githooks` paths.
