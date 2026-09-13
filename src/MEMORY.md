# Source Memory

Source ownership and shared hook invariants. Read the applicable child memory
before changing a subsystem.

## Boundaries

- `app/`: App Router pages, metadata, global CSS, and API entries.
  See `src/app/MEMORY.md`.
- `components/`: launcher, browser game orchestration, boards, shared layouts,
  social/leaderboard UI, input helpers, and shadcn wrappers.
  See `src/components/MEMORY.md`.
- `lib/`: deterministic engines and pure/shared contracts; `lib/multiplayer/`
  owns room models/protocols. See `src/lib/MEMORY.md` and
  `src/lib/multiplayer/MEMORY.md`.
- `lib/server/`: Node storage, route helpers, authoritative rooms, and sidecar
  services. See `src/lib/server/MEMORY.md`.
- `hooks/`: shared React state described below. Keep browser lifecycle here or
  in components; engines calculate deterministic transitions.

## Shared Hooks

- `use-game-leaderboard.ts` owns loading, submission/failure, player name, slots,
  and pending scores. Reuse it across games instead of adding parallel paths.
- `use-current-user.tsx` owns auth context/actions. Server routes enforce unique
  normalized names and derive profile ownership from the session cookie.
- `use-game-session.ts` records signed-in play and leaves guest stats untouched.
  Keep timing outside engines. A terminal-to-nonterminal transition starts a new
  run; old request settlements must not replace its completed session id or
  submission guard. This also protects replay/session association on restart.
- `use-social-overview.ts` retains the last valid same-account graph during
  refresh, fences stale account/request results, coalesces polling/focus refresh,
  and polls only while visible. `use-social-presence.ts` maps launcher surface
  state into one per-document lease through the shared presence controller.

## Integration and Tests

- Games use `lib/<game>-game-engine.ts`, `components/<game>-game.tsx`, and
  `components/<game>-board.tsx`. Engine presets supply launcher parameters and
  remain in game state across restart, replay, rendering, and record submission.
- Keep Snake pickup feedback metadata pure in `lib/snake-food-feedback.ts`,
  separate from engine progression and browser animation.
- Use existing `game-layout`, `game-input`, `leaderboard`, and shared hooks.
  Source and Vitest share the `@/*` alias to `src/`.
- Solo recording starts after a server-issued replay run, including guest play;
  profile replay saves/downloads require auth. Private-room play stays outside
  solo replay, profile-session, and leaderboard persistence.
- Prefer deterministic whole-state/structured-output assertions; field-level
  checks are useful when they explain a failure better. Use Playwright for
  rendered interaction (navigation, Help/Escape, keyboard/pointer, responsive
  overlays, client/server flows); component tests suit static markup and pure
  board rendering. See `e2e/MEMORY.md` for browser fixtures and suite isolation.
