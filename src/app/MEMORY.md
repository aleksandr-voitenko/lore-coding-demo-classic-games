# App Router Memory

This file covers routes and App Router conventions under `src/app/`.

## Routes

- `page.tsx` is the launcher route. It should stay thin and render
  `GameLauncher` inside `CurrentUserProvider` so launcher controls, games, and
  leaderboard saves share the current signed-in display name. The route reads
  the HTTP-only session cookie on the server and passes `initialUser` into the
  provider to avoid a signed-out flash during client navigation from `/profile`.
- `profile/page.tsx` renders signed-in aggregate stats from the server-side
  profile store. It is dynamic and Node-only because it reads the session cookie
  and SQLite-backed session rows.
- `layout.tsx` owns the global HTML shell, Geist font variables, `globals.css`
  import, and app metadata. Keep public title/description changes aligned with
  README when the visible catalog changes.
- `globals.css` owns global Tailwind/theme styles for the game collection.

## Leaderboard API

- `api/leaderboard/route.ts` exposes the generic leaderboard API at
  `/api/leaderboard`.
- The route is dynamic and Node-only (`dynamic = "force-dynamic"`,
  `runtime = "nodejs"`) because it uses the server leaderboard store.
- Keep request parsing and store-independent behavior testable through
  `createLeaderboardRouteHandlers(store)`. The exported GET/POST handlers should
  stay thin and use `getLeaderboardStore()`.
- GET reads `key` and optional `sort` search params. POST expects JSON with a
  leaderboard key, score, player name, and optional sort direction.
- Invalid keys, invalid JSON, or invalid scores return `400`; accepted
  submissions return `201`, while non-qualifying valid submissions return `200`.

## User And Session APIs

- `api/me/route.ts` exposes demo display-name sign-in. POST creates or resumes a
  user by normalized display-name key, sets the HTTP-only
  `game_user_session` cookie, GET returns the current user, and DELETE clears
  the current session.
- `api/game-sessions/route.ts` records completed or abandoned signed-in play
  sessions. It rejects unsigned requests with `401`; guest play should remain a
  client-side no-op for profile stats.
