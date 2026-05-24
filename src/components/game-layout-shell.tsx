"use client";

import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

type GameShellProps = {
  children: ReactNode;
  className: string;
};

type GameSidebarProps = {
  children: ReactNode;
  className: string;
};

type GameBoardColumnProps = {
  children: ReactNode;
  className: string;
};

type GameBoardStageProps = {
  actions: ReactNode;
  children: ReactNode;
};

type GameHeaderProps = {
  status: string;
  statusTestId: string;
  title: string;
};

type GameStatCardProps = {
  className: string;
  label: ReactNode;
  labelClassName: string;
  value: ReactNode;
  valueClassName?: string;
  valueTestId?: string;
};

export function GameShell({ children, className }: GameShellProps) {
  return (
    <main className={cn("min-h-svh px-4 py-6 sm:px-6 lg:py-8", className)}>
      <section className="mx-auto grid w-full max-w-[100rem] gap-5 xl:min-h-[calc(100svh-4rem)] xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] xl:content-center xl:items-start">
        {children}
      </section>
    </main>
  );
}

export function GameSidebar({ children, className }: GameSidebarProps) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-4 rounded-md border p-4 shadow-sm xl:justify-self-end",
        className,
      )}
      data-testid="game-sidebar"
    >
      {children}
    </aside>
  );
}

export function GameBoardColumn({ children, className }: GameBoardColumnProps) {
  return (
    <div className={cn("mx-auto flex w-full flex-col gap-3 xl:col-start-2", className)}>
      {children}
    </div>
  );
}

export function GameBoardStage({ actions, children }: GameBoardStageProps) {
  return (
    <div
      className="grid w-full grid-cols-[minmax(0,1fr)_2.25rem] items-start gap-2 sm:gap-3 xl:relative xl:block"
      data-testid="game-board-stage"
    >
      <div className="min-w-0">{children}</div>
      <div className="xl:absolute xl:left-[calc(100%+0.75rem)] xl:top-0">{actions}</div>
    </div>
  );
}

export function GameHeader({ status, statusTestId, title }: GameHeaderProps) {
  return (
    <div className="sr-only">
      <h1>{title}</h1>
      <p aria-live="polite" data-testid={statusTestId}>
        {status}
      </p>
    </div>
  );
}

export function GameStatCard({
  className,
  label,
  labelClassName,
  value,
  valueClassName,
  valueTestId,
}: GameStatCardProps) {
  return (
    <div className={cn("rounded-md border p-3", className)}>
      <dt className={cn("text-xs font-medium", labelClassName)}>{label}</dt>
      <dd
        className={cn("font-mono text-3xl font-semibold leading-none", valueClassName)}
        data-testid={valueTestId}
      >
        {value}
      </dd>
    </div>
  );
}
