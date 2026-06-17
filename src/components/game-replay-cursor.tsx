import { MousePointer2Icon } from "lucide-react";

export type GameReplayCursorPosition = {
  x: number;
  y: number;
};

type GameReplayCursorProps = {
  position: GameReplayCursorPosition | null;
  testId?: string;
};

export function GameReplayCursor({
  position,
  testId = "game-replay-cursor",
}: GameReplayCursorProps) {
  if (position === null) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute size-5 -translate-x-[12.5%] -translate-y-[12.5%] text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.72)] sm:size-6"
      data-testid={testId}
      style={{
        left: `${position.x * 100}%`,
        top: `${position.y * 100}%`,
      }}
    >
      <MousePointer2Icon className="size-full fill-black" strokeWidth={2.6} />
    </div>
  );
}
