import { cn } from "@/lib/utils";

export function SpaceInvadersHudMetric({
  align,
  iconSrc,
  testId,
  value,
  valueTestId,
}: {
  align: "left" | "right";
  iconSrc: string;
  testId: string;
  value: number;
  valueTestId: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute top-[clamp(0.45rem,2cqw,0.85rem)] z-30 flex min-w-[clamp(3.35rem,10cqw,4.75rem)] items-center gap-[clamp(0.25rem,1cqw,0.45rem)] rounded-[0.35rem] bg-[rgb(0_0_0_/_0.46)] px-[clamp(0.35rem,1.4cqw,0.6rem)] py-[clamp(0.22rem,0.8cqw,0.35rem)] text-[var(--invaders-board-text)] shadow-[0_0_16px_rgb(0_0_0_/_0.58)] backdrop-blur-[1px]",
        align === "left"
          ? "left-[clamp(0.45rem,2cqw,0.85rem)]"
          : "right-[clamp(0.45rem,2cqw,0.85rem)] justify-end",
      )}
      data-testid={testId}
    >
      <span
        className="block size-[clamp(1.05rem,4.8cqw,1.65rem)] shrink-0 bg-contain bg-center bg-no-repeat drop-shadow-[0_0_8px_rgb(255_255_255_/_0.34)] [image-rendering:pixelated]"
        style={{ backgroundImage: `url("${iconSrc}")` }}
      />
      <span
        className="font-mono text-[clamp(0.72rem,3.8cqw,1.35rem)] font-extrabold leading-none tracking-normal tabular-nums text-white"
        data-testid={valueTestId}
      >
        {value}
      </span>
    </div>
  );
}
