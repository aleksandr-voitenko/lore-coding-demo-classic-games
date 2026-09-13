# App Router Memory

## Entry Boundaries And Pages

- Keep page/route entries limited to Next-supported exports; put injectable
  factories in adjacent `route-handlers.ts` and pure query parsing in
  `home-search-params.ts`. Unit/type checks alone missed invalid entry exports;
  nearby exact-export tests and a Next build cover that contract
  (`LC-20260709-RPBX`, `LC-20260709-PQBX`). Reusable helpers touching session or
  response cookies import `server-only` (for example `api/auth/session-response.ts`
  and `api/replays/route-handlers.ts`). The multiplayer collection
  `api/multiplayer/rooms/route.ts` currently still houses shared parsing/factories;
  do not mistake that existing exception for the preferred entry pattern.
- `page.tsx` hydrates `CurrentUserProvider.initialUser` from the HTTP-only session
  cookie before rendering `GameLauncher`, preventing signed-out flashes after
  profile navigation. It maps `?auth=login|signup`, replay ids, and room codes;
  testable replay/room parsing stays outside the entry.
- Root and `profile/page.tsx` are dynamic, Node-only routes because of cookies and
  SQLite. Profile renders signed-in aggregate stats/latest-replay links; unsigned
  requests redirect to `/?auth=login`. `profile/profile-escape-to-launcher.tsx`
  makes Escape mirror Back to games. Profile consumes persisted theme but theme
  switching belongs to launcher chrome.
- `layout.tsx` owns HTML, Geist variables, CSS import, metadata, pre-hydration
  persisted-theme initialization, and one app-wide `CookieNotice`. Align public
  catalog/title/description changes with README. `globals.css` owns Tailwind and
  theme styles: app chrome uses `--chrome-*` from `../lib/app-theme.ts`; games use
  `--<game>-page/panel/ink/muted/border` with dark overrides. Keep playfield tokens
  separate so arcade boards can stay dark. Simon casing uses `--simon-board-*`
  while its classic pad colors remain stable.

## Leaderboard, Auth, Sessions, And Replays

- `api/leaderboard/route-handlers.ts` injects leaderboard/session stores into
  `createLeaderboardRouteHandlers`; `route.ts` composes dynamic Node GET/POST.
  GET takes `key` and optional `sort`; POST JSON takes key, score, player name,
  optional sort. Invalid key/JSON/score returns 400; accepted scores return 201,
  valid nonqualifying scores 200.
- `api/auth/signup/route-handlers.ts` owns validation, normalized-name duplicate
  errors, and cookie responses; `api/auth/login/route-handlers.ts` owns generic
  invalid-credential errors. Cookies use Secure in production, preserving local
  HTTP development. `api/me/route-handlers.ts` owns current-user GET and logout
  DELETE/cookie clearing. Their entries only wire production handlers/config.
- `api/game-sessions/route-handlers.ts` parses payloads and injects the signed-in
  POST recorder; unsigned requests return 401. Guest play remains a client-side
  profile-stat no-op; actor identity always comes from the cookie.
- `api/replays/route-handlers.ts` provides common run/latest-replay factories.
  Per-game adjacent helpers supply game id, parser, and label; entries expose
  only HTTP/config fields. All ten solo games support
  `/api/replays/<game-id>/run` for server-issued run/seed and
  `/api/replays/<game-id>` for signed-in latest-replay save/download. Tank Patrol
  uses `battle-city`; multiplayer never enters this solo path.

## Multiplayer Room API

- `api/multiplayer/rooms/[code]/route-handlers.ts` owns lookup, command parsing,
  WebSocket-only rejection, and signed-in host authorization. Unversioned
  `[code]/route.ts` serves GET; live create/host POSTs use
  `api/multiplayer/rooms/v6/route.ts` and `[code]/v6/route.ts`.
  Unversioned and retired mutation routes return 426;
  do not infer that the unversioned POST applies commands.
- `api/multiplayer/rooms/request-body.ts` bounds declared and streamed public
  JSON to 64 KiB before parsing (413). Settings admission shares authority
  normalization: maximum nesting is 32 containers, counting settings root as 1
  and parameters as 2, with 16 KiB serialized UTF-8 including game id, keys,
  punctuation, and escaping. Invalid/excessive settings return 400 before host
  authorization looks up/advances the room; canonical storage repeats admission
  for internal callers (`LC-20260905-5EDA`).

## Social API

- `api/social/shared.ts` centralizes cookie-derived actor lookup, no-store JSON,
  private-error mapping, bounded body parsing, and private invitation redaction.
  JSON methods require `application/json`; declared/streamed bodies over 16 KiB
  return 413. Every mutation checks a supplied Origin before storage: accept the
  framework origin or same-protocol transport Host (Next may canonicalize its
  URL), reject different host/protocol. An absent Origin is allowed.
- `GET /api/social` reconciles private pending invitation tuples with authority,
  revokes terminal-party rows, then returns durable overview plus chunked friend
  availability; failed/rejected chunks remain `unknown`. Party codes never enter
  invitation JSON. Reconciliation and availability each use at most four
  concurrent authority calls. `GET /api/social/discovery` is exact normalized
  display-name lookup, never a directory.
- Presence POST/DELETE renew/release a volatile browser lease using the session
  actor. Nonavailable presence suspends pending invitations; it does not resolve
  them. They remain acceptable after availability clears, subject to TTL.
  Friend/request/block routes delegate direction and retry rules to SQLite.
  Separate durable fixed-window limits for discovery/request/invitation creation
  are 30/10/20 per minute and return 429 with `Retry-After`.
- Invitation creation validates friendship/block state, asks authority to check
  host ownership, recipient availability, and capacity, revalidates the
  relationship, then persists. Busy/in-party/offline/unknown conflicts preserve
  existing pending invitations; terminal parties revoke their invitations.
- Acceptance claims in SQLite before authority admission; only the live claim
  token can atomically accept the selected invitation and revoke other pending
  invitations before returning a capability. Handled authority failure releases
  the claim and restores base expiry. Failed durable finalization compensates
  only newly `admitted`, never `reacquired`, membership, and releases the claim
  only after confirmed compensation. Accepted-response retries use
  `party.reacquireAuthenticated`, which cannot rejoin after departure
  (`LC-20260803-SAPI`). Claim/TTL/history bounds and the deferred late-response
  provisional-admission limitation live in `../lib/server/MEMORY.md` and
  `../../docs/adr/0003-persistent-parties-and-friends.md`.
