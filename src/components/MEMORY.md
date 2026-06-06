# Components Memory

This file covers React component ownership and shared game UI conventions under
`src/components/`.

## Ownership

- `*-game.tsx` files own React state, browser events, timers, controls, overlays,
  pause/resume/restart flows, leaderboard hook usage, and menu return behavior.
- `*-board.tsx` files render board cells, game pieces, code-native board art, and
  board accessibility labels for the active state.
- `game-launcher-config.ts` owns the launcher-only game-card catalog,
  descriptions, accent styling, parameter registry, and pure
  default-value/initial-prop helpers. `game-launcher-playables.ts` owns the lazy
  playable component mapping with `next/dynamic`, so the initial launcher bundle
  does not import every `*-game.tsx` module. Config imports ids, display labels,
  and versioned card-art metadata from the server-safe catalog in
  `src/lib/game-catalog.ts` so server routes and pages can share profile-safe
  game metadata without importing playable components.
- `game-launcher.tsx` owns selected game state, launcher card parameter state,
  menu rendering, menu viewport preservation, and placement of the shared
  `UserAccountControls`. Keep browser-only `window` access in this client
  component; it snapshots `window.scrollX` and `window.scrollY` before opening a
  game and restores the viewport when returning to the launcher.
- `game-leaderboard.tsx` renders the shared top-three panel and save-score form.
  `use-game-leaderboard.ts` in `src/hooks/` owns the client state feeding those
  components and pre-fills the signed-in display name when available.
- `user-account-controls.tsx` renders the launcher Log in/Sign up modal plus the
  signed-in circular profile menu against `useCurrentUser`. Keep durable account
  state in the provider; local component state should stay limited to the active
  auth tab, form values, pending state, and field-level errors.

## Shared Layout

- `game-layout.tsx` is the stable import surface for game components. Put new
  shared layout, action, Help, dialog, or flow-hook implementation details in
  focused sibling modules so the barrel does not regain unrelated responsibilities.
- `game-layout-shell.tsx` contains `GameShell`, `GameSidebar`,
  `GameStatsBar`, `GameBoardColumn`, `GameBoardStage`, `GameHeader`, and
  `GameStatCard`.
- `GameShell` centers the board column in the viewport. Per-game
  `GameBoardColumn` usage should provide an explicit responsive width, and
  `GameSidebar` should be the first child inside that board column so the stats
  bar sits directly above `GameBoardStage` and matches the board/stage width.
- Per-game `GameBoardColumn` widths should include a viewport-height cap based
  on the board aspect ratio so the stats bar plus board fit in the first
  in-game viewport without page scrolling. Use the existing `svh`-based width
  classes as the pattern when adding or resizing a board.
- `GameHeader` is intentionally screen-reader-only status/title structure for
  accessibility and existing status test IDs. Keep visible titles and statuses in
  board overlays, Help screens, and end screens.
- Keep per-game metrics and live status details in `GameSidebar`; do not add
  separate information strips below `GameBoardStage`. Use `GameStatsBar` for the
  single-row metric list, `GameStatCard` for simple repeated metrics, and keep
  specialized panels local.

## Board Actions And Overlays

- Use `GameBoardStage` and `GameBoardActions` for the right-side action rail
  beside game boards. Back belongs at the top of that rail and should use the
  shared Escape-to-menu path.
- Realtime games provide Back, Help, Pause-or-Resume, and Restart actions.
  Turn-based games such as Minesweeper and 2048 provide Back, Help, and Restart
  and omit Pause.
- Games that should contribute to profile stats call `useGameSession` with their
  `gameId`, `leaderboardKey`, active/started state, terminal result, final score,
  and sort direction. The hook is a signed-in-only boundary; guest sessions are
  intentionally ignored.
- Use `GameEndScreen` for terminal won/lost overlays. Use
  `GameEndLeaderboardContent` when a terminal overlay needs the shared pending
  leaderboard branch; pass per-game summary text, leaderboard props, score-form
  props, and the action button without adding extra wrappers. Use
  `GameEndSummary` directly for terminal overlays that do not need leaderboard
  branching.
- Use `GameStartScreen` and `GameStartScreenHeader` for ready overlays. The
  shared shell owns the high-contrast neutral start-screen palette and marker
  used by browser coverage, while each game keeps its own preview art, start
  action, status copy, and leaderboard ordering local.
- Use `useGameLeaderboardPresenter` from
  `game-leaderboard-presenter.ts` to assemble repeated start-panel, final-panel,
  score-form, and void-save leaderboard props. Keep game-specific scoring,
  leaderboard keys, sort direction, formatting, pending-entry checks, and reset
  behavior in the game component.
- Use `GameHelpScreen` and `useGameHelpScreen` for Help overlays. Realtime games
  pause when Help opens from an active run and resume only when Help caused the
  pause; turn-based games should block keyboard input while Help is visible.
  The shared Help screen owns the light modal theme for every game, so game
  components should pass content only rather than board-specific color classes.
  Long Controls or Rules content scrolls inside its own Help section while the
  Help header stays fixed. Controls sections use compact keyboard/mouse rows,
  arrow icons only for arrow keys, and short rules lists.
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
  keyup/blur/modal cleanup. Use the shared held-direction movement state,
  controller, and React lifecycle hook in `game-input.ts`, with small
  game-specific key-map wrappers beside the game components.
- For non-exclusive realtime controls that must be held together, keep a small
  local control-state helper beside the game component. Asteroids uses this for
  simultaneous rotation and thrust while still using shared key registration and
  keyboard guards.
- Component tests are useful for static board renderers, shared input filtering,
  and focused shared UI behavior. Prefer Playwright for broad rendered flows and
  browser interactions.
