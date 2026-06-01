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
  UFO bonus ship.
  `SpaceInvadersBoard` references these with versioned public URLs and moves
  sprites with board-relative `translate3d(...)` transforms.
- `snake/` is a sprite-backed exception. It contains 128x128 floor, food,
  obstacle, head, tail, straight-body, and corner-body assets. `SnakeBoard`
  references these with versioned public URLs and derives segment orientation
  with CSS rotation from neighboring snake coordinates.
- Keep deeper Snake and Space Invaders asset details here because the immediate
  child folders are asset-only folders, and their public URL/versioning
  conventions are part of the `public/images` contract rather than independent
  source modules.
