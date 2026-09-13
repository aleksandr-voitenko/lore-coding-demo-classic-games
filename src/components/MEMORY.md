# Components Memory

Local ownership and browser invariants. Shared rules and persistence boundaries
are in `../MEMORY.md`; browser-flow coverage is in `../../e2e/MEMORY.md`.

## Launcher And Account Chrome

- `*-game.tsx` owns React state, events, timers, controls, overlays, session and
  leaderboard hooks, and menu return; `*-board.tsx` renders state and accessible
  board labels. Rules remain in deterministic engines.
- `game-launcher-config.ts` owns card copy/style, parameters, and initial-prop
  helpers, importing server-safe metadata from `../lib/game-catalog.ts`.
  `game-launcher-playables.ts` alone maps lazy `next/dynamic` game components so
  the menu does not eagerly import every game. Multiplayer availability/count
  comes from `../lib/multiplayer/game-registry.ts`.
- `game-launcher.tsx` owns selected game/tab/parameters and browser navigation.
  Snapshot scroll coordinates before play and restore them on menu return.
  `popstate` preserves launcher state but forward navigation bootstraps an
  authoritative room. Reusable room credentials are a participant id and opaque
  capability in versioned, account-scoped `sessionStorage`; capabilities never
  enter URLs, snapshots, logs, or durable profile storage.
- Room creation results, cleanup, pending indicators, and errors are fenced by
  request generation and synchronous account epoch. Popstate, account changes,
  and unmount invalidate requests; passive account-change effects are too late
  to prevent stale navigation or credential writes. Switching away and back to
  the same account must not revive an old handoff (`LC-20260803-JOIN`).
- Launcher tabs automatically activate with a roving tab stop relative to the
  focused tab. Keep both tabpanel shells mounted for `aria-controls`, but render
  cards only in the active panel to avoid duplicate form ids. Paired
  `--chrome-selection*` colors switch without a color transition to preserve
  contrast throughout the change.
- `game-card-artwork-frame.tsx` shares launcher/global-leaderboard art: blurred
  background, dark overlay, centered rounded foreground, responsive optimizer
  sizing, versioned URL, and button-safe `<span>` structure stay together.
- `game-leaderboard.tsx` renders top-three/save-score UI;
  `../hooks/use-game-leaderboard.ts` owns state and signed-in name prefill.
  `global-leaderboard.tsx` consumes `../lib/global-leaderboard.ts` default-key
  targets so incompatible parameter variants are never mixed.
- `user-account-controls.tsx` is the stable `useCurrentUser` entry;
  `user-account-auth-dialog.tsx` and `user-account-profile-menu.tsx` own signed-out
  modal and signed-in menu UI. Account state belongs in the provider; local state
  is form/menu intent, pending state, and errors. `ThemeToggle` may appear here,
  but `../hooks/use-app-theme.ts` owns theme persistence and `<html>` mutation.
- `cookie-notice.tsx` owns the essential-storage disclosure with minimal,
  versioned localStorage dismissal. Optional consent management needs an actual
  nonessential-storage feature.

## Friends And Invitation Handoff

- Keep `SocialProvider` as the stable root across launcher branches so overview
  and presence survive surface changes without leaking a previous account's
  graph. Library/leaderboard publish `available`; solo/replay/room publish
  browser `busy`. Room authority upgrades authenticated members to `in-party`;
  busy also protects signed-in legacy guest-link members from invitations.
  Friends opens on signed-in library/leaderboard/room surfaces; solo/replay
  omit its trigger. Discovery is exact-name; destructive actions need inline
  confirmation.
- Incoming invitations stay visible when unavailable. Ordinary acceptance
  requires effective `available` presence, a current launcher adoption callback,
  and an immediate surface flag: delayed presence must not reopen acceptance
  while solo/room UI mounts. Pass the callback through every `SocialCenter`
  branch so recovery remains possible across surfaces.
- Lost/invalid acceptance responses and explicit retryable authority failures
  retain the invitation id in account-scoped component memory and retry that
  endpoint, including after an initial uncertain attempt. Successful acceptance
  followed by failed local adoption retains credentials only in that memory and
  retries local adoption alone. Never render/log the capability. Focus the
  appropriate server-recovery or local-adoption retry action.
- Adoption rechecks account/epoch, invalidates old room creation, navigates to
  the canonical room URL before changing local credentials/session state, clears
  prior surfaces, and seeds the lobby with returned room/game/sequence. Bind
  snapshot and capability to both account id and epoch. Focus the room heading;
  arrival copy describes the server's initially admitted role because Play may
  fall back to Watching and watchers can later claim seats (`LC-20260803-JOIN`).
- Launcher injects `SocialPartyInviteControls`; the lobby gates it with live,
  account-bound `isHost`. Place it above the lobby roster or between active-game
  roster and guest-link fallback. Correlate only exact invitation ids created or
  idempotently returned for this mounted party: global outgoing summaries omit
  party identity and cannot recover current-party pending state after transfer.
  Record the explicit post-creation refresh generation; only successful overviews
  at least that new may reconcile the id. This excludes old polls while allowing
  concurrent/replacement refreshes to retire resolutions before first observation.
  Memoize against invitation-relevant membership, seats, queue, status, and
  capacity rather than high-frequency game snapshots (`LC-20260803-INVT`).

## Multiplayer UI And Transport

- `multiplayer-room-lobby.tsx` owns generic room UI/session state: participant
  resolution, fresh snapshots, account-bound host derivation, diagnostics, and
  pending actions. Local lifecycle success focuses the persistent party heading;
  replacement focuses the new game heading. Alternate persistent polite-live
  slots to announce even identical repeated transitions to every member. Remote
  changes preserve surviving focus; if the exact focused control disappears,
  including a same-layout membership update, focus the party heading
  (`LC-20260803-JRNY`).
- `multiplayer-party-panel.tsx` derives player slots from seats, not role labels,
  and shows Watching and FIFO Next match lists during/after play. It presents
  Join game/next match, Cancel, Watch instead, and Leave party. Membership-ended
  and party-closed events clear credentials, show terminal feedback, and suppress
  reconnect. Back to library is navigation, not an implicit leave.
- `multiplayer-room-client.ts` owns validated HTTP creation/host commands and
  generic HTTP/WebSocket dispatch. `multiplayer-room-transport.ts` is the stable
  facade; `multiplayer-room-websocket-transport.ts` owns URL derivation from
  `NEXT_PUBLIC_MULTIPLAYER_WEBSOCKET_URL`, envelopes, bootstrap/resume,
  validation, deadlines, and cancellation. `multiplayer-room-transport-hook.ts`
  owns React reconnect, visibility/focus, diagnostics ping, callbacks, and status
  (`LC-20260714-MTRS`). Gameplay and server authority remain outside these layers.
- Host lifecycle/settings use versioned Next HTTP routes. Live snapshots,
  guest-capable commands, and game input require WebSockets; do not add browser
  HTTP polling/POST fallback. Bootstrap and command-ack deadlines default to five
  seconds and are configurable. Bootstrap timeout reconnects; command timeout
  rejects without automatic retry because an applied command can lose its ack
  and request ids are not idempotency keys.
- Validate successful HTTP and inbound WebSocket snapshots with shared protocol
  guards before state updates. Normalize the requested room code once. Resume
  sends the private capability; public participant ids confer no authority.
  Clear invalid stored capabilities before reconnecting read-only. Ignore
  pre-bootstrap snapshots; missing/mismatched protocol bootstrap is terminal,
  closes the socket, and must not reconnect to the incompatible gateway.
- `multiplayer-room-game-registry.tsx` exhaustively maps `MultiplayerGameId` to
  renderers/input adapters for Pong, Space Invaders, Asteroids, and Tank Patrol.
  Render authoritative snapshots/events and emit adapter-owned intents. Seated
  input is local; observers are read-only. Clients may project visuals but must
  reconcile to server state, never own collisions, scores, outcomes, result
  ordering, solo replay/session hooks, or solo leaderboards.
- `pong-multiplayer-room.tsx` reuses `PongBoard`, not `PongGame` or local engine
  tick ownership. Generic shell behavior belongs outside the Pong adapter.
- `space-invaders-multiplayer-room.tsx` renders `ship-a`/`ship-b` over a shared
  wave, score, and lives; simultaneous hits and power-up awards are server-owned
  (`LC-20260626-SICR`). `asteroids-multiplayer-room.tsx` uses the same seat ids
  with shared field, score, wave, lives, saucers, and power-up spawns. Per-ship
  motion, explosion/respawn, invulnerability, cooldowns, upgrades, target/respawn
  choices, and pickup ownership reconcile to authority (`LC-20260626-AMUI`).
- `battle-city-multiplayer-room.tsx` sends direction/fire for the participant's
  `player-1`/`player-2` seat. Before any local direction change, projection uses
  server-held direction: `undefined` means no local override; `null` means stop.
  Keep Stage 1 setup, separate P1/P2 stats/results, room-owned pause and terminal
  summary outside solo orchestration (`LC-20260714-TPMP`).

## Layout, Overlays, And Input

- `game-layout.tsx` is the stable import barrel; focused sibling modules own
  implementation. `game-layout-shell.tsx` owns shell, sidebar/stats, board column,
  stage, header, and stat cards. Center the board column; give it responsive width
  with an aspect-ratio-based `svh` cap so stats and board fit the first viewport.
  Put `GameSidebar` first inside it, directly above and matching the stage width.
  Keep metrics there through `GameStatsBar`/`GameStatCard`, with special panels
  local; do not add information strips below the board. `GameHeader` intentionally
  remains screen-reader-only status/title markup and stable test ids.
- `GameBoardActions` is the right-side rail with Back first through the shared
  Escape path. Realtime games add Help, Pause/Resume, Restart; turn-based games
  omit Pause. Replay playback uses Back only, returning to profile.
- Ready overlays use `GameStartScreen`/`GameStartScreenHeader`; the shared shell
  owns neutral contrast and browser-test marker, games own preview, action, copy,
  and leaderboard order. Terminal overlays use `GameEndScreen` with
  `GameEndLeaderboardContent` for pending-score branching or `GameEndSummary`
  otherwise; avoid redundant wrappers. `useGameLeaderboardPresenter` assembles
  repeated panel/form/save props; scoring, key, sort, format, pending checks, and
  reset remain local.
- Help uses `GameHelpScreen`/`useGameHelpScreen`: pause active realtime play and
  resume only if Help caused the pause; block turn-based input. Shared
  `--game-help-*` tokens own colors. Controls/rules scroll within sections under
  a fixed header; use compact keyboard/mouse rows and arrow icons only for arrows.
- `useGameEscapeToMenu`/`GameAbandonDialog` return ready/terminal play directly to
  menu and confirm abandoning unfinished play. Disable the hook while Help owns
  Escape. Shared `--game-abandon-*` tokens own colors; games supply behavior.
  Apply transitions from `../lib/game-ui-flow.ts` rather than duplicating them.
- Help/abandon use Base UI modal focus trapping/background isolation. Keep
  `data-game-modal` for global input filtering. `game-dialog-focus.ts` retries
  return focus after the parent re-enables the opener without stealing intentional
  focus elsewhere (`LC-20260709-M4FQ`). Completed Back/Close/Done surfaces should
  map Escape to that action unless typing, submission, or a higher overlay owns it.
- Use `shouldIgnoreGameKeyDown`, `registerGameKeyDown`, and `registerGameKeyUp`
  from `game-input.ts` to ignore Help, mounted modals, pending leaderboard entry,
  and typing. `isGamePauseKey` recognizes P only; Space remains game-specific.
  Shared held-direction state/controller/hook keeps transient keys outside React
  state and clears on keyup/blur/modal changes. Small local control-state helpers
  handle simultaneous inputs such as Asteroids rotation/thrust.
- Simon live/replay chrome and casing use `--simon-*` tokens; preserve its classic
  four pad colors. Tank Patrol's shared `battle-city-board.tsx` layers terrain
  fragments, tanks, shells, explosions, and foreground forest for one/two players.
  Protection is a four-arc code-native layer centered 9.7% below the sprite canvas
  center; only the final 64-frame count blinks, with static reduced-motion arcs.
- Tank Patrol solo samples held direction and latched fire in one NTSC fixed-step
  loop so movement precedes firing; a second movement interval changes collision
  ordering. The ready overlay owns wrapping Stage 1–35 selection, then the engine
  owns the fixed map-reveal interval.

## Replay Lifecycle

- `/?replay=<game-id>` selects focused `*-replay-player.tsx` components with saved
  parameters, not launcher selections. Playback has no profile-session recording
  or live controls. Snake derives pickup feedback from replayed state transitions.
- `game-replay-recording.ts` owns one-shot recordings: terminal capture consumes
  the recording; new starts abandon stale unsaved state. During asynchronous
  replacement, freeze game/replay/profile clocks and input. Failure preserves
  current replay, save/retry state, and the completed profile-session guard.
  Reset/start/successful replacement synchronously invalidate older save results
  using the finished-payload generation (`LC-20260905-0AB7`).
- Events carry active elapsed milliseconds; Pause, Help, and abandon confirmation
  suspend that clock. `game-replay-playback.ts` owns elapsed-frame scheduling,
  load/ready/finished state, stale-load suppression, and ref/timer cleanup.
  Loader/initializer replacement cancels the old timeout before installing refs;
  every accepted load advances the scheduling generation even if initialized game
  identity is unchanged (`LC-20260709-RPLC`). Game-specific reducers/effects stay
  in players.
- The optional next-frame adapter schedules compressed events without materializing
  expanded payloads. Tank Patrol stores identical inputs as runs and applies
  paused spans in one engine operation. Its adapter batches at most 128 advance
  frames sharing an interpolated timestamp, applies every frame in order, yields
  between batches, and stops immediately at terminal loss so trailing events still
  fail integrity checks (`LC-20260714-TPBF`).
- Minesweeper/Simon sample board-local mouse positions every 50ms through
  `game-replay-cursor-recording.ts`; `game-replay-cursor.tsx` renders a schematic
  cursor without moving the system pointer. Keep their timers local to preserve
  cursor-before-action ordering; reuse shared normalization/extraction/appearance.
- Use `GameReplaySaveAction` for terminal save footers and a per-game
  `testIdPrefix`; payload construction and game-specific save wiring stay local.

## Verification Pointers

Use nearby board/input/shared-UI tests for pure/static behavior; Playwright covers
rendered navigation and interactions. Replay lifecycle tests are beside their
shared hooks; launcher, social, lobby, transport, and renderer tests cover their
respective account, timing, input, and authority boundaries.
