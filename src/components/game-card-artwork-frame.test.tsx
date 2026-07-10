import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GameCardArtworkFrame } from "./game-card-artwork-frame";

const VERSIONED_ARTWORK_SRC = "/images/snake-game-card.png?v=ai-key-art-v2";

describe("game card artwork frame", () => {
  it("emits responsive optimized sources for both decorative artwork layers", () => {
    const markup = renderToStaticMarkup(
      <GameCardArtworkFrame
        artwork={{
          height: 941,
          src: "/images/snake-game-card.png",
          width: 1672,
        }}
        artworkSrc={VERSIONED_ARTWORK_SRC}
        backgroundSizes="(min-width: 640px) 24rem, calc(100vw - 2rem)"
      />,
    );
    const images = markup.match(/<img\b[^>]*>/g) ?? [];

    expect(images).toHaveLength(2);
    expect(images[0]).toContain(
      'sizes="(min-width: 640px) 24rem, calc(100vw - 2rem)"',
    );
    expect(images[1]).toContain('sizes="242px"');

    for (const image of images) {
      expect(image).toContain('alt=""');
      expect(image).toContain('aria-hidden="true"');
      expect(image).toContain("/_next/image?url=%2Fimages%2Fsnake-game-card.png%3Fv%3Dai-key-art-v2");
      expect(image).toContain("srcSet=");
      expect(image).not.toContain(`src="${VERSIONED_ARTWORK_SRC}"`);
    }
  });
});
