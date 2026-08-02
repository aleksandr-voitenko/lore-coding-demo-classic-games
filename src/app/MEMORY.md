# App Router Memory

This file covers routes and App Router conventions under `src/app/`.

## Routes

- `page.tsx` is the launcher route. It should stay thin and render
  `GameLauncher` inside `CurrentUserProvider` so launcher controls, games, and
  leaderboard saves share the current signed-in display name. The route reads
  the HTTP-only session cookie on the server and passes `initialUser` into the
  provider to avoid a signed-out flash during client navigation from `/profile`.
  It also maps `?auth=login|signup` to the launcher auth modal. Keep testable
  replay and room query parsing in `home-search-params.ts` so `page.tsx` exports
  only fields supported by the Next.js page contract.
- `profile/page.tsx` renders signed-in aggregate stats from the server-side
  profile store. It is dynamic and Node-only because it reads the session cookie
  and SQLite-backed session rows. Signed-out profile requests redirect to
  `/?auth=login` instead of rendering private profile content. It renders a
  tiny client shortcut component so Escape mirrors the visible Back to games
  action and returns signed-in users to the launcher. The profile route consumes
  the persisted app chrome theme but does not host its own theme toggle; theme
  switching belongs to the launcher chrome.
- `layout.tsx` owns the global HTML shell, Geist font variables, `globals.css`
  import, app metadata, and the small pre-hydration script that applies the
  persisted light/dark chrome theme class and `--chrome-*` variables to
  `<html>`. It also mounts the app-wide cookie/storage notice so the session
  cookie and theme preference disclosure follows every route without duplicating
  per-page UI. Keep public title/description changes aligned with README when
  the visible catalog changes.
- `globals.css` owns global Tailwind/theme styles for the game collection. The
  launcher, profile, and account chrome consume app-level `--chrome-*` variables
  supplied by `src/lib/app-theme.ts`; game screens consume their own
  `--<game>-page`, `--<game>-panel`, `--<game>-ink`, `--<game>-muted`, and
  `--<game>-border` tokens, with `.dark` overrides for surrounding game chrome.
  Board/playfield tokens stay separate so intentionally dark arcade boards remain
  dark across light and dark app chrome. Simon also exposes `--simon-board-*`
  shell tokens for its board casing while the classic pad colors remain stable.

## Leaderboard API

- `api/leaderboard/route.ts` exposes the generic leaderboard API at
  `/api/leaderboard`.
- The route is dynamic and Node-only (`dynamic = "force-dynamic"`,
  `runtime = "nodejs"`) because it uses the server leaderboard store.
- Keep request parsing and store-independent behavior testable through
  `api/leaderboard/route-handlers.ts` and its
  `createLeaderboardRouteHandlers(store)` factory. The `route.ts` entry should
  export only Next-supported route fields and keep GET/POST thin around the
  production leaderboard and user-profile stores.
- GET reads `key` and optional `sort` search params. POST expects JSON with a
  leaderboard key, score, player name, and optional sort direction.
- Invalid keys, invalid JSON, or invalid scores return `400`; accepted
  submissions return `201`, while non-qualifying valid submissions return `200`.

## User And Session APIs

- `api/auth/signup/route-handlers.ts` owns testable account registration,
  including field validation, duplicate normalized display-name errors, and
  session-cookie responses. `api/auth/signup/route.ts` stays a thin App Router
  entry that exports only Next-supported route configuration and the production
  `POST` handler. Session-cookie responses use `Secure` in production while
  leaving local HTTP development usable.
- Reusable API helper modules that touch server session cookies or response
  cookies, such as `api/auth/session-response.ts` and
  `api/replays/route-handlers.ts`, import `server-only`; route entry files stay
  under App Router's server boundary and compose those guarded helpers.
- `api/auth/login/route-handlers.ts` owns the testable display-name/password
  login handler, including session-cookie responses and generic invalid-credential
  errors. `api/auth/login/route.ts` stays a thin App Router entry that exports
  only Next-supported route configuration and the production `POST` handler.
- `api/me/route-handlers.ts` owns the testable current-session GET and logout
  DELETE handlers, including session-cookie clearing. `api/me/route.ts` stays a
  thin App Router entry that exports only Next-supported route configuration
  and the production `GET` and `DELETE` handlers.
- `api/game-sessions/route-handlers.ts` owns game-session payload parsing and
  the injectable signed-in session-recording handler. `api/game-sessions/route.ts`
  stays a thin App Router entry that exports only Next-supported route
  configuration and the production `POST` handler. Unsigned requests return
  `401`; guest play should remain a client-side no-op for profile stats.
- `api/replays/route-handlers.ts` owns reusable replay run and latest replay
  route factories. Supported replay games such as Snake, Tetris, Breakout,
  Minesweeper, Space Invaders, Pong, Simon, 2048, Asteroids, and Tank Patrol
  expose `api/replays/<game>/run/route.ts` to issue replay run ids and seeds for
  live recording and `api/replays/<game>/route.ts` to require a signed-in
  session before saving or downloading the current user's latest replay. Each
  game's adjacent `route-handlers.ts` owns its testable game-id, payload-parser,
  and replay-label adapters; both production route entries export only their
  Next-supported HTTP and configuration fields.

## Multiplayer Room API

- `api/multiplayer/rooms/[code]/route-handlers.ts` owns testable room lookup,
  command parsing, WebSocket-only command rejection, and signed-in host-command
  authorization. Its `route.ts` entry stays thin and exports only Next-supported
  route configuration plus the production `GET` and `POST` handlers.

## Social API

- `api/social/shared.ts` owns the common signed-in session lookup, optional
  same-origin mutation check, JSON content-type/body parsing, no-store response
  shaping, durable and volatile error mapping, and the only serializer allowed
  to turn a private invitation record into client JSON. Its shared reader
  rejects declared or streamed JSON bodies over 16 KiB before unbounded parsing.
  Route entries stay thin and export only Next-supported methods plus `dynamic`
  and `runtime`.
- `GET /api/social` returns one durable overview enriched with chunked volatile
  friend availability. Failed or rejected authority chunks remain `unknown`
  instead of hiding the durable graph. `GET /api/social/discovery` performs one
  exact normalized display-name lookup without exposing a directory. Before
  overview serialization, private pending invitation tuples are inspected and
  terminal-party rows are revoked; party codes never enter the response.
- `POST` and `DELETE /api/social/presence` renew or release one authenticated
  browser lease. The actor always comes from the session cookie. Presence is a
  volatile invitation gate and never resolves durable invitations: pending
  invitations remain suspended while the effective state is not `available`
  and can be accepted after availability clears, subject to TTL.
- Friend-request, friend, and block routes delegate direction and retry
  semantics to the SQLite social store. JSON methods require
  `application/json`; every state-changing method rejects a mismatched supplied
  Origin before calling the store. Exact discovery, friend-request creation,
  and party-invitation creation consume separate durable fixed-window rate
  limits (30/minute, 10/minute, and 20/minute) and return `429` plus
  `Retry-After`; the store also caps pending incoming and outgoing requests at
  100 each per account.
- Party invitation creation validates friendship/block state before the private
  authority call, checks host ownership, recipient availability, and capacity,
  revalidates the relationship after the call, and only then persists the row.
  Busy, in-party, offline, and unknown recipients return a conflict without
  resolving an existing pending invitation. Terminal party failures revoke all
  invitations for that party.
- Acceptance claims one pending invitation through a 30-second recipient-wide
  SQLite lease before calling party authority. Only the matching live token can
  finalize acceptance; the claim extends the invitation through a two-minute
  recovery grace while retaining the base expiry. A handled authority failure
  releases the claim and restores that base expiry, immediately expiring the
  row when its original deadline has passed. Successful finalization accepts
  the selected invitation and revokes the recipient's other pending invitations
  atomically before returning the capability. A failed durable finalization
  compensates only `admitted`,
  never `reacquired`, membership and releases the claim only after compensation
  is confirmed. An accepted-response retry uses the authority's membership-only
  `party.reacquireAuthenticated` command, which cannot create a new participant
  after the account leaves. Party invitations are capped at 20 pending incoming
  and 20 pending outgoing rows per account; resolved nonaccepted history is
  capped at 1,000 rows, with only the newest accepted row per recipient retained
  as a retry index. Overview reconciliation and friend-availability resolution
  run at most four authority calls concurrently.
