"use client";

import { ArrowLeftIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
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

type GameHeaderProps = {
  accentClassName: string;
  backButtonTestId: string;
  onBackToMenu?: () => void;
  status: string;
  statusClassName: string;
  statusTestId: string;
  title: string;
};

export function GameShell({ children, className }: GameShellProps) {
  return (
    <main className={cn("min-h-svh px-4 py-6 sm:px-6 lg:py-8", className)}>
      <section className="mx-auto grid w-full max-w-6xl gap-5 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-[minmax(17rem,20rem)_minmax(0,1fr)] lg:items-center">
        {children}
      </section>
    </main>
  );
}

export function GameSidebar({ children, className }: GameSidebarProps) {
  return (
    <aside className={cn("flex flex-col gap-4 rounded-md border p-4 shadow-sm", className)}>
      {children}
    </aside>
  );
}

export function GameBoardColumn({ children, className }: GameBoardColumnProps) {
  return <div className={cn("mx-auto flex w-full flex-col gap-3", className)}>{children}</div>;
}

export function GameHeader({
  accentClassName,
  backButtonTestId,
  onBackToMenu,
  status,
  statusClassName,
  statusTestId,
  title,
}: GameHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-2">
        <div className={cn("h-2 w-14 rounded-full", accentClassName)} aria-hidden="true" />
        <h1 className="text-3xl font-semibold tracking-normal text-balance">{title}</h1>
        <p
          className={cn("text-sm font-medium", statusClassName)}
          aria-live="polite"
          data-testid={statusTestId}
        >
          {status}
        </p>
      </div>
      {onBackToMenu ? (
        <Button
          aria-label="Back to game menu"
          data-testid={backButtonTestId}
          onClick={onBackToMenu}
          size="icon"
          type="button"
          variant="outline"
        >
          <ArrowLeftIcon />
        </Button>
      ) : null}
    </div>
  );
}
