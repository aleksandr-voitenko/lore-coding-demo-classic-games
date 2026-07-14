# Images Memory

This file covers public image assets under `public/images/`.

## Launcher Cards

- Launcher cards use local PNG key-art files named `<game>-game-card.png`.
- Keep card artwork wide, centered, and text-free so the shared launcher card
  frame can crop it cleanly behind each game title. `tank-patrol-game-card.png`
  is an explicitly approved title-bearing exception.
- Launcher and global leaderboard cards keep these PNGs as source masters and
  render responsive variants through the Next image optimizer in
  `GameCardArtworkFrame` (WebP when supported). Keep the version query in the
  optimizer source URL, and update both `GAME_CARD_ARTWORK_VERSION` and the exact
  `next.config.ts` local-pattern search when a source image changes in place so
  cached blurred and foreground variants cannot outlive the replacement
  artwork. A renamed source path supplies its own cache boundary.

## Board Artwork

- Board artwork is generally code-native inside board components instead of
  external sprite sheets.
- `space-invaders/` is a sprite-backed exception. It contains the board
  background and transparent PNG sprites for aliens, player ship, standard and
  piercing player shots, `explosion-1` through `explosion-4` effects, and the
  UFO bonus ship. Shield Bearer aliens use the dedicated
  `alien-shield-bearer.png` sprite, Revenge Aliens use the dedicated
  `alien-revenge-alien.png` sprite, Splitter Aliens and their fragments use the
  dedicated `alien-splitter.png` sprite, Armored Aliens use
  `alien-armored-1.png`, `alien-armored-2.png`, and `alien-armored-3.png` for
  one, two, and three remaining HP, while ordinary formation rows use the
  row-colored `alien-<color>.png` sprites. Sprite-backed invader shots use
  `invader-shot-<kind>.png` filenames matching the engine's invader shot kind
  strings, except commander shards reuse `invader-shot-commander.png` at smaller
  engine dimensions. Mine Layer aliens use the dedicated
  `alien-mine-layer.png` sprite, and their slow lane-denial projectile uses
  `invader-shot-mine.png`. Shield-absorbed player shots use `explosion-shield.png`
  while keeping the existing explosion animation timing.
  The in-board HUD uses
  `hud-health.png` and `hud-score.png` for the top-corner health and score
  readouts. Power-up pickup icons use `power-up-<kind>.png` filenames matching
  the engine's power-up kind strings. `SpaceInvadersBoard` references these with
  versioned public URLs and moves sprites with board-relative `translate3d(...)`
  transforms.
- Tank Patrol retains the internal `battle-city/` sprite namespace for
  compatibility. Its `modern-v1` art keeps the classic
  top-down silhouettes and 64x64 gameplay footprint while adding detailed
  player upgrade tiers, canonical enemy roles, transparent foliage, animated
  water variants, framed power-ups, generated effects, and intact/destroyed
  phoenix-headquarters states. `tank-patrol-game-card.png` is its title-bearing
  launcher artwork.
  Multiplayer Player 2 currently uses temporary copies of the four Player 1
  upgrade-tier sprites under the distinct
  `tank-player-2-tier-0.png` through `tank-player-2-tier-3.png` names. Keep those
  URLs separate so replacement P2 artwork can land without changing runtime
  code or overwriting the approved P1 assets.
- Alien player-shot collision in `src/lib/space-invaders-game-engine.ts` uses
  occupied-pixel hitbox ratios derived from the non-transparent bounds of these
  112x112 alien PNGs. When alien sprites change shape or padding, update those
  ratios alongside the asset swap so visually smaller aliens remain harder to
  hit.
- `snake/` is a sprite-backed exception. It contains 128x128 floor, food,
  obstacle, door/key, head, tail, straight-body, and corner-body assets.
  `SnakeBoard` references these with versioned public URLs and derives segment
  orientation with CSS rotation from neighboring snake coordinates.
- Keep deeper Snake, Space Invaders, and Tank Patrol asset details here because
  the immediate child folders are asset-only folders, and their public
  URL/versioning conventions are part of the `public/images` contract rather
  than independent source modules.
