import Image from "next/image";

import type { GameCatalogArtwork } from "@/lib/game-catalog";

type GameCardArtworkFrameProps = {
  accentClassName?: string;
  artwork: GameCatalogArtwork & {
    loading?: "eager" | "lazy";
    priority?: boolean;
  };
  artworkSrc: string;
  backgroundSizes: string;
};

export function GameCardArtworkFrame({
  accentClassName,
  artwork,
  artworkSrc,
  backgroundSizes,
}: GameCardArtworkFrameProps) {
  return (
    <span className="relative block h-40 w-full overflow-hidden bg-[var(--snake-board)]">
      {accentClassName ? (
        <span
          className={`absolute inset-x-0 top-0 h-1 ${accentClassName}`}
          aria-hidden="true"
        />
      ) : null}
      <Image
        alt=""
        aria-hidden="true"
        className="scale-110 object-cover opacity-55 blur-[2px]"
        fill
        loading={artwork.loading}
        priority={artwork.priority}
        sizes={backgroundSizes}
        src={artworkSrc}
        unoptimized
      />
      <span className="absolute inset-0 bg-[color-mix(in_oklch,var(--snake-board)_38%,transparent)]" />
      <span className="absolute inset-3 flex items-center justify-center">
        <Image
          alt=""
          aria-hidden="true"
          className="h-full w-auto rounded-md border border-[color-mix(in_oklch,var(--snake-board)_16%,white)] object-contain shadow-[0_18px_50px_color-mix(in_oklch,var(--snake-board)_34%,transparent)]"
          height={artwork.height}
          loading={artwork.loading}
          priority={artwork.priority}
          src={artworkSrc}
          unoptimized
          width={artwork.width}
        />
      </span>
    </span>
  );
}
