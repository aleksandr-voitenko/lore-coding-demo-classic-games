# Images Memory

This file covers public image assets under `public/images/`.

## Launcher Cards

- Launcher cards use local PNG key-art files named `<game>-game-card.png`.
- Keep card artwork wide, centered, and text-free so the shared launcher card
  frame can crop it cleanly behind each game title.
- `GameLauncher` renders card art with direct, versioned public URLs instead of
  optimized `/_next/image` URLs. Preserve this behavior so replacing an image
  file does not leave stale optimized variants in the blurred background or
  foreground preview.

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
  strings. Shield-absorbed player shots use `explosion-shield.png` while keeping
  the existing explosion animation timing.
  The in-board HUD uses
  `hud-health.png` and `hud-score.png` for the top-corner health and score
  readouts. Power-up pickup icons use `power-up-<kind>.png` filenames matching
  the engine's power-up kind strings. `SpaceInvadersBoard` references these with
  versioned public URLs and moves sprites with board-relative `translate3d(...)`
  transforms.
- Alien player-shot collision in `src/lib/space-invaders-game-engine.ts` uses
  occupied-pixel hitbox ratios derived from the non-transparent bounds of these
  112x112 alien PNGs. When alien sprites change shape or padding, update those
  ratios alongside the asset swap so visually smaller aliens remain harder to
  hit.
- `snake/` is a sprite-backed exception. It contains 128x128 floor, food,
  obstacle, door/key, head, tail, straight-body, and corner-body assets.
  `SnakeBoard` references these with versioned public URLs and derives segment
  orientation with CSS rotation from neighboring snake coordinates.
- Keep deeper Snake and Space Invaders asset details here because the immediate
  child folders are asset-only folders, and their public URL/versioning
  conventions are part of the `public/images` contract rather than independent
  source modules.
