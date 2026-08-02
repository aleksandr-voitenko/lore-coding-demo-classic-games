# Components Memory

This file covers React component ownership and shared game UI conventions under
`src/components/`.

## Ownership

- `*-game.tsx` files own React state, browser events, timers, controls, overlays,
  pause/resume/restart flows, leaderboard hook usage, and menu return behavior.
- `*-board.tsx` files render board cells, game pieces, code-native board art, and
  board accessibility labels for the active state.
- Tank Patrol retains the internal `battle-city` namespace and follows the same
  split with `battle-city-game.tsx` owning the single-player campaign flow,
  `battle-city-multiplayer-room.tsx` owning the server-authoritative room view
  and seat-specific input, and `battle-city-board.tsx` layering fragment-
  rendered terrain, tanks, projectiles, explosions, and foreground forest
  cover for either one or two players. Its held-direction state is sampled by
  one fixed-step NTSC loop; do
  not add a second movement interval because frame ordering is part of
  collision behavior. Latch each fire press for that same loop so the engine
  can apply movement before creating the shell on its first eligible frame.
  Player protection uses one code-native four-arc shield layer instead of
  pulsing the tank texture. Center it on the player sprites' measured visual
  centroid, 9.7% below their PNG canvas center; only the final 64-frame clock
  count blinks, and reduced-motion mode keeps the arcs static.
  The ready overlay owns the original wrapping Stage 1-35
  selector; after confirmation, the engine owns the fixed map-reveal interval.
- `game-launcher-config.ts` owns the launcher-only game-card catalog,
  descriptions, accent styling, parameter registry, and pure
  default-value/initial-prop helpers. `game-launcher-playables.ts` owns the lazy
  playable component mapping with `next/dynamic`, so the initial launcher bundle
  does not import every `*-game.tsx` module. Config imports ids, display labels,
  and versioned card-art metadata from the server-safe catalog in
  `src/lib/game-catalog.ts` so server routes and pages can share profile-safe
  game metadata without importing playable components.
- `game-launcher.tsx` owns selected game state, single-player/multiplayer
  launcher tab state, launcher card parameter state, menu rendering, menu
  viewport preservation, and placement of the shared `UserAccountControls`.
  Keep browser-only `window` access in this client component; it snapshots
  `window.scrollX` and `window.scrollY` before opening a game and restores the
  viewport when returning to the launcher. It also reconciles private-room URL
  entries on `popstate` while retaining launcher-owned tab, parameter, selection,
  and viewport state. Forward always bootstraps authoritative room state; it may
  reuse only a participant id plus opaque capability scoped to the same signed-in
  user in versioned `sessionStorage`. Capabilities never belong in room URLs,
  shared snapshots, logs, or durable profile storage.
  Popstate, account changes, and unmount invalidate in-flight room creation so a
  stale response cannot navigate or replace a newer creation status.
  Multiplayer card availability and count come from the pure registry in
  `src/lib/multiplayer/game-registry.ts`, not a launcher-local game-id list.
  The launcher tablist uses automatic activation with a roving tab stop, so
  keyboard navigation must remain relative to the focused tab. Selected tab
  colors use the paired `--chrome-selection*` tokens and switch without a color
  transition so every rendered frame keeps readable foreground contrast. Keep
  both tabpanel shells mounted so each `aria-controls` target exists, while
  rendering cards only inside the active panel to avoid duplicate form ids.
- `multiplayer-room-lobby.tsx` owns the generic private-room lobby/shell UI and
  browser session state: participant resolution, fresh snapshot selection,
  host derivation, diagnostics presentation, and pending form/action state.
  `multiplayer-room-client.ts` owns validated browser HTTP room creation and
  authenticated host-command helpers plus the game-agnostic HTTP/WebSocket
  dispatch boundary consumed by the shell. `multiplayer-room-transport.ts` is
  the stable public transport surface. `multiplayer-room-websocket-transport.ts`
  owns URL derivation from `NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL`, generic
  non-host `room.command` and `game.input` envelopes, resume/hello bootstrap,
  timeout, cancellation, and inbound message validation.
  `multiplayer-room-transport-hook.ts` owns the React reconnect,
  focus/visibility, diagnostics-ping, callback, and status lifecycle. Host-only
  lifecycle/settings commands stay on the Next HTTP route until the WebSocket
  sidecar has an authenticated host session model. Live room snapshots,
  guest-capable room commands, and game input require the WebSocket stream; do
  not reintroduce browser HTTP polling or POST fallback for those paths.
  Bootstrap and command-ack deadlines default to five seconds and remain
  configurable at the transport boundary. Bootstrap timeouts reconnect, while
  command timeouts reject without automatic retry because the server may have
  applied a command before its ack was lost and request ids are not idempotency
  keys. Keep these surfaces game-agnostic; actual game play, score submission,
  replay derivation, and server transport authority belong outside the shell.
  Validate inbound WebSocket and successful room HTTP snapshots with the shared
  transport-neutral protocol guards before updating React state. The low-level
  WebSocket transport normalizes its requested room code once before sending
  messages or scoping inbound validation. A resume sends the private participant
  capability; public participant ids are display identifiers only. The server
  binds the resolved participant to the socket and supplies command authority,
  while an invalid stored capability is cleared before reconnecting read-only.
  HTTP room mutations use versioned paths, and an unversioned/mismatched
  WebSocket bootstrap is terminal: ignore pre-bootstrap snapshots, close the
  socket, and do not schedule reconnects against the incompatible gateway.
  `multiplayer-party-panel.tsx` derives player slots from seats rather than role
  labels, keeps Watching and FIFO Next match lists visible during and after play,
  and owns Join game, Join next match, Cancel, Watch instead, and Leave party
  presentation. Membership-ended and party-closed messages clear local
  credentials, show a terminal room message, and suppress reconnect. Back to
  library remains navigation and must not implicitly leave the party.
- Active multiplayer game UI should be selected through a client
  renderer/input registry keyed by `gameId`. A renderer consumes authoritative
  server snapshots/events and emits adapter-owned intents through the generic
  transport envelope; it does not own canonical game state, result ordering,
  solo replay saving, or solo leaderboard submission.
  Keep that renderer map exhaustive over the shared `MultiplayerGameId` so a
  registry addition cannot omit its client implementation silently.
- `battle-city-multiplayer-room.tsx` renders authoritative Tank Patrol room
  snapshots, sends direction/fire intents only for the active participant's
  claimed `player-1` or `player-2` seat, and leaves observers read-only. It may
  visually project player movement between snapshots, but must reconcile to the
  server state and must not resolve collisions, scoring, pickups, stage flow, or
  outcomes locally. Before the first local direction transition, projection
  must use the active seat's server-held direction; `undefined` means no local
  override, while `null` is an explicit local stop. Keep the fixed Stage 1 room
  setup, separate P1/P2 stats and stage-result columns, room-owned pause state,
  and terminal summary outside the solo campaign's replay/session/leaderboard
  orchestration.
- The future Space Invaders multiplayer renderer should present two independent
  ship seats, `ship-a` and `ship-b`, on one shared alien wave with shared score
  and lives. It should display server-owned outcomes for simultaneous hits and
  power-up awards rather than resolving those ambiguities locally.
- The future Asteroids multiplayer renderer should present two independent
  `ship-a` and `ship-b` seats on one shared asteroid field with shared score,
  wave, lives, saucer state, and power-up spawn state. It should render
  server-owned per-ship position, explosion/respawn, invulnerability, shot
  cooldown, and upgrade outcomes rather than resolving collisions, saucer-shot
  hits, saucer target choice, respawn choice, or power-up ownership locally.
- `pong-multiplayer-room.tsx` owns the first private-room Pong renderer/input
  adapter fed by server snapshots. It may render `PongBoard` and post committed
  room `game.input` commands for seated participants, but it must not import
  `PongGame`, solo replay/session hooks, leaderboard presenters, or local Pong
  engine tick ownership, and it should not become the template for generic room
  shell behavior.
- `game-card-artwork-frame.tsx` owns the shared launcher-style key-art frame
  used by launcher cards and the global leaderboard cards. Keep the blurred
  background, dark overlay, centered rounded foreground image, responsive
  optimizer sizing, versioned source URL, and button-safe `<span>` structure
  together there.
- `game-leaderboard.tsx` renders the shared top-three panel and save-score form.
  `use-game-leaderboard.ts` in `src/hooks/` owns the client state feeding those
  components and pre-fills the signed-in display name when available.
- `global-leaderboard.tsx` renders the launcher-level leaderboard overview. It
  should consume `src/lib/global-leaderboard.ts` targets so the overview shows
  each game's default parameter-scoped board instead of mixing incompatible
  launcher parameter variants.
- `user-account-controls.tsx` is the stable launcher account-control entry point
  against `useCurrentUser`. Keep the signed-out modal implementation in
  `user-account-auth-dialog.tsx` and the signed-in circular menu implementation
  in `user-account-profile-menu.tsx`. Durable account state belongs in the
  provider; local component state should stay limited to auth mode, form values,
  menu/tooltip intent, pending state, and field-level errors. Account chrome can
  host the shared `ThemeToggle`, but theme persistence and `<html class="dark">`
  mutation belong to `use-app-theme.ts`.
- `cookie-notice.tsx` owns the app-wide essential cookie/storage disclosure. It
  should keep dismissal state minimal and versioned in localStorage, and it
  should not grow into an optional analytics or marketing consent manager unless
  the app actually adds non-essential storage.

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
- Simon live and replay surfaces use `--simon-*` tokens for page chrome, stats,
  replay messages, board casing, and board feedback panels. Keep the four
  classic Simon pad colors stable unless a task explicitly changes pad contrast
  or visual identity.
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
- Snake replay playback is launched through the root launcher query
  `/?replay=snake`, passed into `SnakeGame` as replay mode, and rendered by the
  focused `snake-replay-player.tsx` component. The other replay-enabled games
  follow the same launcher query pattern at
  `/?replay=tetris`, `/?replay=breakout`, `/?replay=minesweeper`,
  `/?replay=space-invaders`, `/?replay=pong`, `/?replay=simon`,
  `/?replay=twenty-forty-eight`, `/?replay=asteroids`, and
  `/?replay=battle-city` through their focused replay-player components,
  with replayed parameters coming from the saved payload instead of current
  launcher selections. Replay mode should not record profile sessions or expose
  live-game controls; use a Back-only board action rail wired through the shared
  Escape-to-menu hook to return to the profile during playback. Snake replay
  playback should mirror live Snake pickup feedback popups by deriving them from
  replayed game-state transitions.
- Live replay recordings are one-shot per run. Terminal replay payload capture
  should consume the active recording, and starting a new run should abandon any
  unsaved replay state so stale events cannot be saved later. When replacement
  run setup is asynchronous, freeze the current game, replay clock, and profile
  session clock and ignore live input until setup succeeds; a failed replacement
  must not reset the completed profile-session guard or discard the current
  replay. Replay recordings
  stamp active elapsed milliseconds on each event and pause that replay clock
  while Pause, Help, or abandon-confirm overlays stop the player's active view;
  replay players schedule playback from those elapsed timestamps instead of
  fixed per-turn delays. `game-replay-playback.ts` ignores stale saved-replay
  load settlements and owns the main elapsed-frame timeout, shared
  ready/finished state, and ref cleanup on player unmount. Its optional
  next-frame adapter lets fixed-step games schedule synthetic frames from a
  compressed stored event without expanding the payload in memory. Tank Patrol
  uses that boundary for run-length-encoded identical inputs and applies paused
  frame spans as one engine operation. Its adapter may reduce at most 128
  consecutive advance frames that resolve to the same interpolated timestamp in
  one scheduled step; it still applies every engine frame in order, yields
  between batches, and stops immediately on terminal loss so trailing-event
  integrity failures stay observable. Focused replay
  players keep their game-specific frame reducers and visual side effects;
  Minesweeper and Simon also keep their cursor timers local so
  cursor-before-action ordering remains explicit. Replacing a loader or
  initializer must synchronously cancel the current main-frame timeout before
  replacement playback refs can be installed. Every accepted load increments an
  internal scheduling generation so replacement playback starts even when its
  initialized game keeps the same object identity.
  Minesweeper and Simon live recordings also sample mouse movement over the
  board into a separate cursor event stream every 50ms, and their replay
  playback draws that stream as a schematic board-local cursor without moving
  the system mouse. `game-replay-cursor.tsx` owns the shared schematic cursor
  appearance for cursor-enabled replay players, while
  `game-replay-cursor-recording.ts` owns shared live cursor appending,
  board-local coordinate normalization, and board/action event extraction;
  future games should reuse those helpers instead of adding game-specific
  cursor plumbing or icon styles.
- Use `GameReplaySaveAction` for replay-enabled terminal Save replay footers.
  Keep finished replay payload creation and save handlers local to each game,
  and pass a game-specific `testIdPrefix` so existing replay save button and
  error test IDs stay stable.
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
  The shared Help screen owns a theme-aware modal palette through
  `--game-help-*` tokens, so game components should pass content only rather than
  board-specific color classes. Long Controls or Rules content scrolls inside
  its own Help section while the Help header stays fixed. Controls sections use
  compact keyboard/mouse rows, arrow icons only for arrow keys, and short rules
  lists.
- Use `useGameEscapeToMenu` and `GameAbandonDialog` for Escape/back-to-menu
  behavior. Ready and terminal games return directly to the launcher; active
  unfinished games show the abandon confirmation. Keep this hook disabled while
  Help is visible so Help owns Escape until it closes. The shared abandon
  confirmation owns a theme-aware modal palette through `--game-abandon-*`
  tokens, so game components should pass behavior only rather than
  board-specific dialog colors.
- Shared Help and abandon surfaces use Base UI modal dialogs for focus trapping
  and background isolation. Keep their `data-game-modal` marker so shared game
  input ignores every mounted modal. Their shared return-focus helper defers
  restoration until the parent flow re-enables the action opener after close
  and must not override focus intentionally taken by another surface.
- Completed UI surfaces that show a Back, Close, Done, or equivalent return
  action should let Escape trigger that same action. Keep this behavior
  consistent across game overlays, replay screens, and modal-like UI unless a
  focused text input, form submission flow, or higher-priority overlay owns
  Escape.
- Shared Help and Escape/back-to-menu transition rules live in
  `src/lib/game-ui-flow.ts`; component hooks should apply returned effects rather
  than reimplementing the state machine.

## Input And Tests

- Use `shouldIgnoreGameKeyDown`, `registerGameKeyDown`, and `registerGameKeyUp`
  from `game-input.ts` for game-level global keyboard handlers that should ignore
  Help overlays, mounted shared game modals, pending leaderboard entry, and
  typing targets.
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
