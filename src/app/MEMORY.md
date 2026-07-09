# App Router Memory

This file covers routes and App Router conventions under `src/app/`.

## Routes

- `page.tsx` is the launcher route. It should stay thin and render
  `GameLauncher` inside `CurrentUserProvider` so launcher controls, games, and
  leaderboard saves share the current signed-in display name. The route reads
  the HTTP-only session cookie on the server and passes `initialUser` into the
  provider to avoid a signed-out flash during client navigation from `/profile`.
  It also maps `?auth=login|signup` to the launcher auth modal.
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
  `createLeaderboardRouteHandlers(store)`. The exported GET/POST handlers should
  stay thin and use `getLeaderboardStore()`.
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
- `api/me/route.ts` only returns the current session user on GET and clears the
  current session on DELETE.
- `api/game-sessions/route.ts` records completed or abandoned signed-in play
  sessions. It rejects unsigned requests with `401`; guest play should remain a
  client-side no-op for profile stats.
- `api/replays/route-handlers.ts` owns reusable replay run and latest replay
  route factories. Supported replay games such as Snake, Tetris, Breakout,
  Minesweeper, Space Invaders, Pong, Simon, 2048, and Asteroids expose
  `api/replays/<game>/run/route.ts` to issue replay run ids and seeds for live
  recording and `api/replays/<game>/route.ts` to require a signed-in session
  before saving or downloading the current user's latest replay.
