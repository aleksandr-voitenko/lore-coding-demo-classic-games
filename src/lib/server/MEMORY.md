# Server Library Memory

Node-only storage and multiplayer authority live here. Pure room/protocol rules
are in `../multiplayer/MEMORY.md`; authenticated HTTP boundaries are documented
in `../../app/MEMORY.md`. Root `README.md` owns operational commands and overrides.

## Ownership and Runtime Boundaries

- Next-facing storage, cookie, crypto, and service facades import `server-only`;
  Vitest aliases that marker to its empty implementation. The standalone
  sidecar graph deliberately omits it: runtime, gateway, sidecar, game adapters,
  and account/presence helpers must run under plain Node. Next routes enter
  through `multiplayer-room-store.ts`, not the runtime/gateway.
- `leaderboard-store.ts` defines the injectable `LeaderboardStore` contract,
  submission/query parsing, response shaping, and ranking helpers.
  `sqlite-leaderboard-store.ts` supplies the production singleton; keep clients
  and routes independent of the SQLite implementation.
- `sqlite-app-schema.ts` owns shared path preparation and schema initialization
  (currently version 7). Leaderboard, profile, replay, and social stores use the
  same application database; do not create a separate friends database.
- `sqlite-user-profile-store.ts` owns registration/login, sessions, signed-in
  game-session recording, and aggregate stats. `password-auth.ts` uses Node
  `crypto.scrypt` with per-user salts; `user-session-cookie.ts` owns cookie policy.
- `sqlite-replay-store.ts` issues runs/seeds and stores one latest signed-in
  replay per user/game. Preserve generic `createReplayRun`, `saveReplay`, and
  `getReplay` plus the existing Snake compatibility wrappers.
- `multiplayer-room-store.ts` supplies the Next singleton: local in-process
  authority by default, or `multiplayer-room-service-client.ts` when
  `MULTIPLAYER_ROOM_SERVICE_URL` is set. The client validates sidecar responses
  and maps upstream failures to store results for routes.
- `multiplayer-room-runtime.ts` owns canonical volatile rooms, generations,
  ordering, retention, capabilities, account membership, and adapter dispatch.
  `multiplayer-account-party.ts` defines the trusted account-authority contract;
  `multiplayer-social-presence.ts` owns leases and effective availability.

## SQLite Invariants

- Prefer `GAME_LEADERBOARD_SQLITE_PATH`, with
  `SNAKE_LEADERBOARD_SQLITE_PATH` as fallback. The compatibility default remains
  `.data/snake-leaderboard.sqlite`. `:memory:` tests must not create directories.
- `leaderboard_scores` uses stable game/parameter keys and separate ascending
  and descending indexes. Ties sort by earlier `created_at`, then `id`.
  Schema initialization migrates legacy `snake_scores` to `snake|board=<size>`.
- Optional score/session links resolve inside the score insert transaction only
  when the session belongs to the server-derived score user. Guest, missing,
  and mismatched links become null without rejecting a valid score. Profile
  stats come from `game_sessions`, not leaderboard rows (`LC-20260709-SOWN`).
- Normalized unique display-name keys identify accounts. Nullable password
  hashes preserve legacy rows, but passwordless names stay reserved and cannot
  be claimed through signup or used for social relationships. Session cookies
  are stored as token hashes. `game_sessions` records signed-in active duration,
  final score/result, sort direction, game id, and leaderboard key.
- `game_replay_runs` records server-issued ids/seeds; `game_replays` holds latest
  user/game payloads. Multiplayer matches, inputs, and outcomes never enter
  these solo replay, profile-session, or leaderboard paths.

## Durable Social State and Admission

- `sqlite-social-store.ts` is the sole durable relationship/invitation writer.
  Immediate transactions serialize mutations and state-based retries. Exact
  discovery reuses `display_name_key`, returns at most one minimal identity,
  and suppresses self, passwordless accounts, and either-direction blocks.
  Actors come from authenticated session boundaries, never public ids.
- Friend requests contain one pending canonical pair plus requester direction;
  friendships are canonical pairs and blocks are directed. Blocking atomically
  deletes pair requests/friendships and revokes invitations both ways. Removing
  friendship also revokes pair invitations; unblocking restores nothing.
- Durable fixed-window limits per account/minute are 30 discovery, 10 request
  creation, and 20 invitation creation. Pending incoming/outgoing ceilings are
  independently 100 friend requests and 20 party invitations per account.
- Invitations contain play/watch intent and a private volatile party code with
  no room foreign key, match state, or participant capability. The server owns
  their five-minute default TTL; public overviews redact the code. Pending rows
  have no resolution timestamp; accepted/declined/canceled/revoked/expired rows
  do. Busy, in-party, offline, or unknown availability suspends existing pending
  invitations; it does not revoke them (`LC-20260803-SAPI`).
- `party_invitation_acceptance_claims` gives each recipient one 30-second claim
  bound to invitation, recipient, and token. Only the matching live claim may
  finalize. It extends expiry through the lease plus two-minute recovery grace;
  `base_expires_at` preserves the original deadline. Handled failure release
  restores that deadline and expires it if elapsed. Expiry cleanup preserves
  live claims; terminal relationship/party/invitation transitions clear them.
- Successful acceptance and revocation of the recipient's other live
  invitations are one immediate transaction; accepted retries repeat cleanup.
  Resolved nonaccepted history is capped at 1,000 rows, and only the newest
  accepted row per recipient survives as the lost-response recovery index.
- The authenticated API revalidates relationships around authority checks,
  claims before admission, and returns a capability only after durable
  finalization. Failed persistence requires exact compensation of a new
  admission before claim release; pre-existing membership must survive.
  Accepted retries use atomic membership-only `party.reacquireAuthenticated`,
  so an accepted row cannot rejoin a party after leave. Overview reconciliation
  uses private `party.inspectInvitation` tuples to revoke terminal parties,
  including expiry/eviction/restart; host transfer is not terminal. See
  `../../app/MEMORY.md` for route ordering and bounded concurrency.
- Claims are not a distributed transaction with sidecar admission. The rare
  delayed-response/retry compensation gap still requires provisional-admission
  generations; preserve this limitation from
  `docs/adr/0003-persistent-parties-and-friends.md` (repository-root-relative).

## Volatile Party Authority

- Rooms retain current canonical state and room/game sequence counters, with
  no per-event history. Reconnect takes a fresh authoritative snapshot; restart
  of the owning process abandons its rooms. A bounded cursor window needs an
  explicit future retention policy (`LC-20260709-MPRT`).
- Party code and membership survive match replacement; host ownership may
  transfer on leave. `matchId`, seats, settings, and status project the current
  match. Stale generations are rejected before gameplay advances. Restart and
  replacement increment `matchId` and reset the game runtime/sequence;
  pause/resume/finish preserve the generation (`LC-20260803-MGEN`).
- Host creation takes Player 1. Play admission takes an eligible open seat
  between matches, respecting queue priority, or falls back to Watching within
  capacity. Cross-game settings updates are rejected: atomic host replacement
  preserves participant order, maps occupied slots by ordinal including gaps,
  and supplies the new adapter's exactly two required seats. Ordinary seat
  changes and replacement require lobby/finished state.
- FIFO queue promotion fills lobby openings (including queue, release, leave,
  and start transitions) or establishes the roster at restart/replacement.
  Restart may replace an active or finished match; promotion never injects a
  player into the existing running match. Natural adapter termination marks
  the room finished and increments room sequence once.
- Explicit leave clears seats, queued position, capabilities, connections, and
  held input. A departing host transfers to the earliest connected signed-in
  participant; with no eligible successor the party closes. Each runtime keeps
  immutable match-start room attribution so later membership edits cannot
  rewrite terminal participants/winners (`LC-20260803-QUEU`).
- Public participant ids are labels. Admission mints 256-bit opaque capabilities
  and stores only SHA-256 hashes. Raw credentials go solely to that participant
  through authorized admission/reacquisition responses; room snapshots and
  `getRoom` never contain them. Watcher capacity defaults to eight and live
  connections to four per participant, configured independently.
- Account authority enforces one active party per signed-in account, bounded
  multi-tab capability reacquisition, and tuple-bound admission compensation.
  Leave/close/expiry/eviction clear account membership. Capability recovery does
  not refresh room lifetime (`LC-20260803-PRES`).
- Presence has 45-second leases, at most 16 per account, and precedence
  in-party > busy > available > offline. Sequenced per-document operations
  replay exact retries and reject stale/conflicting generations, including
  capacity failures and release tombstones. Active leases retain ordering;
  inactive records last at most five minutes with 64 client ids per account.
  Generationless legacy calls work only until that id enters sequenced mode
  (`LC-20260803-SWEB`). Presence/membership never reconstruct from SQLite.
- Default retention is 256 rooms; disconnected lobbies expire after 60 minutes,
  running/paused rooms after two hours, and terminal rooms after 30 minutes.
  Successful mutations refresh meaningful activity, but terminal lifetime uses
  its terminal timestamp. Reads, handshakes, pings, snapshots, and ticks do not
  refresh clocks. Recognized connections protect rooms; final disconnect grants
  the full state-specific grace again.
- Capacity removes expired rooms, then oldest disconnected terminal rooms,
  then oldest disconnected lobbies. Never evict connected or nonterminal active
  rooms; reject creation with retryable 503 when no safe candidate exists.
  Validate creation before capacity eviction. Capacity-bounded expiry markers
  return 410 for up to five minutes, then ordinary 404 (`LC-20260710-R3TN`).

## Transport and Game Adapters

- `multiplayer-room-websocket.ts` binds actors to capability-authenticated
  sockets and rejects client-asserted account identities. Anonymous viewers get
  one bootstrap only; recognized members receive ongoing fanout. Leave detaches
  all member sockets; closure delivers one terminal event and detaches everyone.
  Connection cleanup is idempotent on close/error/room change.
- Live browser snapshots, guest commands, and game input use WebSockets.
  Authenticated host lifecycle/settings/replacement stay on Next HTTP routes;
  public room HTTP also creates rooms and reads invites. The internal sidecar
  service is not a browser polling or live-command fallback.
- The gateway pumps subscribed rooms at 33ms by default, fans out accepted
  socket/internal HTTP mutations, deduplicates by generation and sequence, and
  never acknowledges/broadcasts rejected stale-match commands. Inbound WebSocket
  `maxPayload` defaults to 64 KiB, preserving explicit factory overrides.
- `multiplayer-room-sidecar.ts` shares one store between HTTP and WebSocket,
  serves health/internal room/account endpoints, owns the one-minute retention
  sweep, and clears timers during idempotent shutdown. `tsconfig.sidecar.json`
  emits CommonJS: runtime imports must resolve in plain Node, since TypeScript
  does not rewrite aliases. README lists paths and configuration variables.
- Protocol v6 mutation paths and version headers are checked before parsing
  bodies; WebSocket bootstrap checks version before room lookup. Legacy paths
  fail closed with 426. Collection preflight must advertise all required account
  capabilities, including `membershipOnlyReacquisition` and
  `sequencedSocialPresenceOperations`, before mutation. Account commands and
  creation always require the configured shared bearer secret; tokenless
  sidecars advertise account authority as unavailable. The dev wrapper shares
  one ephemeral secret between processes.
- Normalize settings before creation/update/replacement, before room lookup,
  retention work, or runtime advancement. Admission allows 32 nested containers
  and 16 KiB UTF-8 serialized settings; public/internal room HTTP bodies have a
  64 KiB pre-parse budget. Structural snapshot validation has independent depth
  semantics; see `../multiplayer/MEMORY.md` (`LC-20260905-5EDA`).
- `multiplayer-game-adapters.ts` is the exhaustive `MultiplayerGameId` registry
  for Pong, Space Invaders, Asteroids, and Tank Patrol. Per-game adapters own
  settings, required seats, input validation/mapping, held/one-shot input,
  lifecycle, bounded tick catch-up, cloned snapshots, and terminal summaries;
  shared contract/runtime/summary helpers remain separate. Room authority stays
  game-agnostic. Space Invaders/Asteroids use `ship-a`/`ship-b`; authoritative
  engine randomness resolves ambiguous hits/pickups (see `../MEMORY.md`).
- Tank Patrol retains `battle-city`, required `player-1`/`player-2` seats, and
  Stage 1 starts. Its adapter latches one-shot fire, advances NTSC ticks, and
  freezes the internal engine during room pause while allowing introductions,
  results, and ending tails during running play. Freeze outcome on `lost` with
  match-start attribution. Terminal key:
  `battle-city|mode=private-room|start-stage=1` (`LC-20260714-TPMP`).
- Results remain volatile and mode-scoped. Asteroids summaries contain shared
  score/wave/lives and occupied seats, without per-ship contributions. Future
  persistence should save compact server-derived terminal summaries, never
  client-uploaded multiplayer histories or a durable per-event log.

## Verification Map

- SQLite tests inject paths/ids/time and cover persistence, migrations,
  parameter isolation, ranking/ties, ownership links, password/session rules,
  transactional social retries, claim expiry, privacy, and capacity/rate limits.
  Route factories accept injected stores; avoid singleton state in tests.
- Room/runtime tests inject id/code/clock/capability factories. Focused suites
  cover retention, settings admission, account/presence ordering, match
  generations, and immutable terminal attribution. Adapter tests use controlled
  clocks/randomness and explicit engine state.
- Gateway/service-client/sidecar suites cover capabilities, version preflight,
  payload guards, fanout, and lifecycle cleanup. Actual socket tests need
  loopback binding. `npm run build:sidecar` checks emitted Node imports; browser
  integration uses the isolated sidecar Playwright suite (see `e2e/MEMORY.md`).
