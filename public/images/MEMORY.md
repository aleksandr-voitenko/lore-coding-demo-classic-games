# Images Memory

Public card and sprite contracts. Asset-only child folders stay documented here
because URL/versioning rules span those folders and their source renderers.

## Launcher Cards

- Local `<game>-game-card.png` files are wide, centered source masters. Keep art
  text-free for clean cropping; `tank-patrol-game-card.png` is the approved
  title-bearing exception.
- Launcher and global-leaderboard `GameCardArtworkFrame` render responsive Next
  image-optimizer variants (WebP when supported). When replacing a source in
  place, update `GAME_CARD_ARTWORK_VERSION` in `src/lib/game-catalog.ts` and the
  exact `images.localPatterns` search in `next.config.ts` together. Preserve the
  version in optimizer source URLs so blurred/foreground variants cannot remain
  stale. A renamed source path supplies its own cache boundary
  (Lore `LC-20260709-IMOP`).

## Board Sprites

- Most boards are code-native; Snake, Space Invaders, and Tank Patrol use sprites.
- Space Invaders URL/version and sprite mappings live in
  `src/components/space-invaders-board-assets.ts`; board sprites move with
  board-relative `translate3d(...)`. `space-invaders/` includes background,
  separate player ships, standard/piercing shots, UFO, health/score HUD,
  `explosion-1` through `explosion-4`, and power-ups named for engine kinds.
  Row-colored aliens use `alien-<color>.png`; special kinds use dedicated art.
  Armored sprites map to remaining HP (1–3); Splitter fragments reuse the parent
  alien sprite. Invader shot names match engine kinds except smaller commander
  shards reuse `invader-shot-commander.png`. Mine Layer uses its own alien and
  mine projectile; shield absorption uses `explosion-shield.png` with unchanged
  explosion timing.
- Alien hitbox ratios now live in `src/lib/space-invaders/hitboxes.ts`, behind
  the engine facade, and derive from occupied bounds in 112x112 alien PNGs.
  Update ratios when sprite shape/padding changes so visible size and collision
  difficulty remain aligned.
- Tank Patrol retains `battle-city/` and version `modern-v1`; URL/tier mappings
  live in `src/lib/battle-city/assets.ts`. Preserve classic top-down silhouettes
  and 64x64 gameplay footprint, distinct upgrade/enemy roles, transparent foliage,
  animated water, framed power-ups/effects, and intact/destroyed headquarters.
  Player 2's four `tank-player-2-tier-<0..3>.png` files use distinct green artwork,
  replacing the original placeholders while preserving the 64x64 RGBA format.
  Keep P1/P2 URLs separate so art changes preserve tier selection and cannot
  overwrite the other player's assets (Lore `LC-20260714-P2TX`).
- `snake/` contains 128x128 floor, food, obstacle, door/key, head/tail, and
  straight/corner-body art. `src/components/snake-board.tsx` owns versioned URLs
  and CSS segment rotation derived from neighboring snake coordinates.
