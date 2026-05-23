"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type GameEndScreenProps = {
  children: ReactNode;
  className?: string;
  testId: string;
};

type GameEndSummaryProps = {
  metricLabel: string;
  metricValue: ReactNode;
  metricValueTestId?: string;
  title: ReactNode;
};

export function GameEndScreen({ children, className, testId }: GameEndScreenProps) {
  return (
    <div
      className={cn(
        "absolute inset-2 flex flex-col items-center justify-center gap-4 overflow-y-auto rounded-md border border-white/20 bg-[#0f172a]/92 px-4 py-5 text-center text-[#f8fafc] shadow-[0_20px_60px_rgba(0,0,0,0.38)] backdrop-blur-[3px]",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

export function GameEndSummary({
  metricLabel,
  metricValue,
  metricValueTestId,
  title,
}: GameEndSummaryProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-3xl font-semibold tracking-normal text-balance">{title}</p>
      <p className="text-sm font-semibold text-[#cbd5e1]">{metricLabel}</p>
      <p
        className="font-mono text-5xl font-semibold leading-none"
        data-testid={metricValueTestId}
      >
        {metricValue}
      </p>
    </div>
  );
}
