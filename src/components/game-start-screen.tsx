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
        "absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-md border border-white/20 bg-[rgba(17,19,24,0.94)] px-4 py-5 text-center text-[#f8fafc] shadow-[0_20px_60px_rgba(0,0,0,0.38)] backdrop-blur-[3px]",
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
        <p className="text-sm font-medium text-[#d1d5db]" aria-live={statusAriaLive}>
          {status}
        </p>
      </div>
    </div>
  );
}
