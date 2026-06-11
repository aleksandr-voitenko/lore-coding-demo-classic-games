"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type GameStartScreenProps = {
  children: ReactNode;
  className?: string;
  testId: string;
};

type GameStartScreenHeaderProps = {
  preview: ReactNode;
  status: ReactNode;
  statusAriaLive?: "off" | "polite";
  title: ReactNode;
};

export function GameStartScreen({ children, className, testId }: GameStartScreenProps) {
  return (
    <div
      className={cn(
        "game-start-screen absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-md border border-[var(--game-start-border)] bg-[var(--game-start-bg)] px-4 py-5 text-center text-[var(--game-start-ink)] shadow-[0_20px_60px_var(--game-start-shadow)] backdrop-blur-[3px]",
        className,
      )}
      data-game-start-screen="true"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function GameStartScreenHeader({
  preview,
  status,
  statusAriaLive,
  title,
}: GameStartScreenHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      {preview}
      <div className="flex flex-col items-center gap-1">
        <p className="text-3xl font-semibold tracking-normal text-balance">{title}</p>
        <p
          className="text-sm font-medium text-[color-mix(in_oklch,currentColor_72%,transparent)]"
          aria-live={statusAriaLive}
        >
          {status}
        </p>
      </div>
    </div>
  );
}
