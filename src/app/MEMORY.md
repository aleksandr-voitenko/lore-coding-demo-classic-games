# App Router Memory

This file covers routes and App Router conventions under `src/app/`.

## Routes

- `page.tsx` is the launcher route. It should stay thin and render
  `GameLauncher` from `src/components/game-launcher.tsx`.
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
