# Classic Games Lore Coding Demo

This demo is a Next.js App Router game collection used to demonstrate
[agentic-lore-coding](https://github.com/aleksandr-voitenko/agentic-lore-coding).
It opens to a card-based menu with Classic games like Snake, Tetris, Breakout, Minesweeper, Asteroids and many others.

All the code in this repository was created using AI agents and the Lore Coding Method. The code was reviewed, but never edited in an IDE. Instead, all edits were performed using an AI agent while working on a specific task.

## Features

- Nine classic games with deterministic gameplay rules and polished browser
  controls.
- Asteroids includes vector-style ship thrust, wraparound movement,
  asteroid splitting, waves, lives, scoring, and parameter-scoped records.
- Snake includes level progression through key-and-door exits, timed special
  foods, obstacle islands, and a full-board win state.
- SQLite-backed, parameter-scoped top-three leaderboards for every game.
  Minesweeper ranks fastest clears; the other games rank higher scores.
- Name-and-password player accounts with private profile stats for signed-in
  play sessions, including total play time and per-game best metrics.
- Snake and Tetris replay recording with server-issued runs, signed-in replay
  saves, and profile playback for the latest saved run.
- Closable in-game Help screens and Escape-to-menu abandon confirmations.
- Local game-card artwork for every game in the launcher.

## Try it with Docker

```bash
docker run --rm -p 3000:3000 aleksandrvoitenko/lore-coding-demo-classic-games
```

Open [http://localhost:3000](http://localhost:3000) to choose a game from the
menu.

## Building from source

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to choose a game from the
menu.

## Stack

- Node.js 22
- TypeScript
- Next.js App Router
- React with the React Compiler enabled
- SQLite through `better-sqlite3`
- Tailwind CSS v4
- shadcn/ui
- Vitest
- Playwright
- ESLint
- Docker

## Persistent Storage

Leaderboards, player accounts, signed-in sessions, profile stats, and saved
Snake replays use SQLite.
Leaderboard records are stored under game-and-parameter keys such as
`snake|mode=levels` or `tetris|board=10x20|level=3`. Signed-in play sessions also
store the selected leaderboard key so profile stats can report both per-game
totals and parameter-aware history.

Player names are unique after trimming, whitespace collapsing, and
case-insensitive comparison. Passwords are salted and hashed in SQLite; existing
passwordless demo names remain reserved and cannot be claimed through sign-up.

The default database path is `.data/snake-leaderboard.sqlite`, kept for
compatibility with existing Snake deployments. On a VPS, set
`GAME_LEADERBOARD_SQLITE_PATH` to durable storage.

Snake and Tetris record replay events during play after the server issues a run
id and seed. Signed-in players can save the completed run from the final screen;
the profile page stores one latest replay per user and game and links back into
the launcher at `/?replay=snake` or `/?replay=tetris` for client playback.

## Docker

Build the production image locally with:

```bash
docker build -t lore-coding-demo .
```

Run it with a mounted data directory so SQLite state survives container
replacement:

```bash
docker run --rm -p 3000:3000 \
  -v "$PWD/.data:/data" \
  lore-coding-demo
```

The image uses Next.js standalone output and listens on port `3000`.

## Checks

| Command | Purpose |
| --- | --- |
| `npm test` | Run the deterministic Vitest suite. |
| `npm run test:agent` | Write JSON/JUnit results and coverage under `reports/`. |
| `npm run test:coverage` | Generate broad all-source coverage under `reports/coverage/`. |
| `npm run test:coverage:core` | Run the thresholded core coverage gate under `reports/coverage-core/`. |
| `npm run test:e2e:install` | Install the Chromium browser used by Playwright. |
| `npm run test:e2e` | Run the focused Chromium Playwright smoke suite. |
| `npm run test:e2e:headed` | Run the Playwright suite in a visible browser. |
| `npm run test:e2e:ui` | Open Playwright's interactive test runner. |
| `npm run typecheck` | Run TypeScript without emitting. |
| `npm run lint` | Run ESLint. |
| `npm run lore-coding -- --file <path>` | Validate a Lore Coding commit message file. |
| `npm run build` | Build the Next.js app. |

GitHub Actions runs these checks on pushes to `main` and pull requests that
change code or build-affecting files: `npm ci`, `npm run build`,
`npm run lint`, `npm run typecheck`, `npm run test:coverage:core`, and
`npm run test:e2e`. Documentation-only changes such as Markdown, `docs/**`,
and `LICENSE` are ignored by CI.

After those checks pass on a push to `main`, GitHub Actions builds the
`linux/amd64` and `linux/arm64` Docker images and pushes a multi-platform
manifest to Docker Hub using the `DOCKERHUB_USERNAME` and `DOCKERHUB_IMAGE`
repository variables plus the `DOCKERHUB_TOKEN` repository secret. The
published tags are `latest`, `main`, and the short commit SHA.

## Lore Coding Validation

The repository includes a dependency-free Agentic Lore Coding validator at
`scripts/lore-coding.mjs`, a local Git `commit-msg` hook wrapper at
`.githooks/commit-msg`, and an install-time hook setup script at
`scripts/install-lore-coding-hooks.mjs`.

`npm install` runs the package `prepare` script, which configures this clone
with:

```bash
git config core.hooksPath .githooks
```

The installer only does this inside a Git worktree, skips in CI, and does not
overwrite an existing custom `core.hooksPath`. Set
`LORE_CODING_INSTALL_HOOKS=0` before installing dependencies to skip automatic
hook setup. If your package manager skips lifecycle scripts, run the Git config
command manually.

After the hook path is configured, `git commit` passes the proposed
commit-message file to the hook. The hook runs:

```bash
node scripts/lore-coding.mjs --edit "$1"
```

If validation fails, Git aborts the commit and prints stable `LORE###` error
codes with the offending line, expected format, fix guidance, and an example.
The validator rejects assistant wrapper prose, Markdown code fences, malformed
subjects, unsupported task types, malformed scopes, missing or empty required
sections, out-of-order sections, missing or malformed `Lore-ID:` trailers,
legacy `Links:` sections, malformed `Lore-Link:` trailers, and linked Lore IDs
that do not exist in reachable history.

Run it manually against a message file with:

```bash
npm run lore-coding -- --file .git/COMMIT_EDITMSG
```

Explain an error code with:

```bash
npm run lore-coding -- explain LORE047
```

Every task commit must end with a `Lore-ID:` trailer. Related tasks use
repeatable `Lore-Link:` trailers with a stable Lore ID, an em dash, and a reason:

```text
Lore-ID: LC-20260530-4D61
Lore-Link: LC-20260529-18A1 — established validator behavior extended here
```

This first version is local-only; CI does not run Lore Coding validation yet.

## UI Components

shadcn/ui is initialized with Tailwind CSS v4, the `base-nova` preset, and the
`@/*` import alias. Add components with:

```bash
npx shadcn@latest add <component>
```
