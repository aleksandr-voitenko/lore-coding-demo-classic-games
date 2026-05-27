# Components Memory

This file covers React component ownership and shared game UI conventions under
`src/components/`.

## Ownership

- `*-game.tsx` files own React state, browser events, timers, controls, overlays,
  pause/resume/restart flows, leaderboard hook usage, and menu return behavior.
- `*-board.tsx` files render board cells, game pieces, code-native board art, and
  board accessibility labels for the active state.
- `game-launcher-config.ts` owns the typed game-card catalog, playable component
  mapping, launcher artwork metadata/versioning, parameter registry, and pure
  default-value/initial-prop helpers.
- `game-launcher.tsx` owns selected game state, launcher card parameter state,
  menu rendering, and menu viewport preservation. Keep browser-only `window`
  access in this client component; it snapshots `window.scrollX` and
  `window.scrollY` before opening a game and restores the viewport when
  returning to the launcher.
- `game-leaderboard.tsx` renders the shared top-three panel and save-score form.
  `use-game-leaderboard.ts` in `src/hooks/` owns the client state feeding those
  components.

## Shared Layout

- `game-layout.tsx` is the stable import surface for game components. Put new
  shared layout, action, Help, dialog, or flow-hook implementation details in
  focused sibling modules so the barrel does not regain unrelated responsibilities.
- `game-layout-shell.tsx` contains `GameShell`, `GameSidebar`,
  `GameBoardColumn`, `GameBoardStage`, `GameHeader`, and `GameStatCard`.
- `GameShell` centers the board column in the desktop viewport and places
  `GameSidebar` immediately to the board's left, aligned to the board stage's top
  edge. Per-game `GameBoardColumn` usage should provide an explicit responsive
  width so the shared auto-width center column can measure and center the board.
- `GameHeader` is intentionally screen-reader-only status/title structure for
  accessibility and existing status test IDs. Keep visible titles and statuses in
  board overlays, Help screens, and end screens.
- Keep per-game metrics and live status details in `GameSidebar`; do not add
  separate information strips below `GameBoardStage`. Use `GameStatCard` for
  simple repeated sidebar metrics and keep specialized panels local.

## Board Actions And Overlays

- Use `GameBoardStage` and `GameBoardActions` for the right-side action rail
  beside game boards. Back belongs at the top of that rail and should use the
  shared Escape-to-menu path.
- Realtime games provide Back, Help, Pause-or-Resume, and Restart actions.
  Turn-based games such as Minesweeper and 2048 provide Back, Help, and Restart
  and omit Pause.
- Use `GameEndScreen` for terminal won/lost overlays. Use
  `GameEndLeaderboardContent` when a terminal overlay needs the shared pending
  leaderboard branch; pass per-game summary text, leaderboard props, score-form
  props, and the action button without adding extra wrappers. Use
  `GameEndSummary` directly for terminal overlays that do not need leaderboard
  branching.
- Use `GameHelpScreen` and `useGameHelpScreen` for Help overlays. Realtime games
  pause when Help opens from an active run and resume only when Help caused the
  pause; turn-based games should block keyboard input while Help is visible.
  Controls sections use compact keyboard/mouse rows, arrow icons only for arrow
  keys, and short rules lists.
- Use `useGameEscapeToMenu` and `GameAbandonDialog` for Escape/back-to-menu
  behavior. Ready and terminal games return directly to the launcher; active
  unfinished games show the abandon confirmation. Keep this hook disabled while
  Help is visible so Help owns Escape until it closes.
- Shared Help and Escape/back-to-menu transition rules live in
  `src/lib/game-ui-flow.ts`; component hooks should apply returned effects rather
  than reimplementing the state machine.

## Input And Tests

- Use `shouldIgnoreGameKeyDown`, `registerGameKeyDown`, and `registerGameKeyUp`
  from `game-input.ts` for game-level global keyboard handlers that should ignore
  Help overlays, pending leaderboard entry, and typing targets.
- Direct game-level keyboard pause/resume shortcuts should use `isGamePauseKey`;
  `P` is the only direct pause key, while Space remains available for
  game-specific actions such as start, hard drop, or fire.
- For held-key movement, keep transient key state out of React render state and
  drive movement through engine/helper functions on an interval until
  keyup/blur/modal cleanup. Use the shared held-direction movement state and
  controller in `game-input.ts`, with small game-specific key-map wrappers beside
  the game components.
- Component tests are useful for static board renderers, shared input filtering,
  and focused shared UI behavior. Prefer Playwright for broad rendered flows and
  browser interactions.
