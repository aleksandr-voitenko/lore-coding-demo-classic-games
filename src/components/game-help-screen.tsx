"use client";

import { XIcon, type LucideIcon } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GameHelpSection = {
  controls?: GameHelpControlRow[];
  items?: string[];
  title: string;
};

export type GameHelpControlRow = {
  buttons: GameHelpControlButtonSpec[];
  label: string;
};

export type GameHelpControlButtonSpec = {
  icon?: LucideIcon;
  label: string;
  text?: string;
};

type GameHelpScreenProps = {
  className?: string;
  onClose: () => void;
  sections: GameHelpSection[];
  testId: string;
  title: string;
};

export function GameHelpScreen({
  className,
  onClose,
  sections,
  testId,
  title,
}: GameHelpScreenProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      data-testid={testId}
      role="dialog"
      aria-label={`${title} help`}
    >
      <div
        className={cn(
          "flex max-h-[min(36rem,calc(100svh-2rem))] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-md border border-white/25 p-4 text-left shadow-[0_24px_80px_rgba(0,0,0,0.42)]",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-normal opacity-70">Help</p>
            <h2 className="text-2xl font-semibold tracking-normal text-balance">{title}</h2>
          </div>
          <Button
            aria-label="Close help"
            autoFocus
            className="border-white/35 bg-white/10 text-current hover:bg-white/20 hover:text-current focus-visible:border-white/70 focus-visible:ring-white/40"
            data-testid={`${testId}-close`}
            onClick={onClose}
            size="icon"
            type="button"
            variant="outline"
          >
            <XIcon />
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
          {sections.map((section) => (
            <section className="flex min-w-0 flex-col gap-2" key={section.title}>
              <h3 className="text-sm font-semibold tracking-normal">{section.title}</h3>
              {section.controls ? <GameHelpControls controls={section.controls} /> : null}
              {section.items ? <GameHelpItems items={section.items} /> : null}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function GameHelpControls({ controls }: { controls: GameHelpControlRow[] }) {
  return (
    <div className="inline-grid min-w-[100px] max-w-full self-start grid-cols-[minmax(100px,max-content)] gap-2">
      {controls.map((control) => (
        <div
          className="flex w-full max-w-full items-center gap-3 rounded-md border border-[color-mix(in_oklch,currentColor_16%,transparent)] bg-[color-mix(in_oklch,currentColor_7%,transparent)] p-2 pr-3"
          key={control.label}
        >
          <div className="flex flex-wrap gap-1.5" aria-hidden="true">
            {control.buttons.map((button) => (
              <GameHelpControlButton button={button} key={button.label} />
            ))}
          </div>
          <p className="min-w-0 text-sm font-medium leading-5">{control.label}</p>
        </div>
      ))}
    </div>
  );
}

function GameHelpControlButton({ button }: { button: GameHelpControlButtonSpec }) {
  const Icon = button.icon;

  return (
    <span
      className="flex h-8 min-w-8 items-center justify-center rounded-md border border-[color-mix(in_oklch,currentColor_24%,transparent)] bg-[color-mix(in_oklch,currentColor_12%,transparent)] px-2 text-sm font-semibold leading-none shadow-[inset_0_-1px_0_color-mix(in_oklch,currentColor_18%,transparent)]"
      title={button.label}
    >
      {Icon ? <Icon className="size-4" /> : button.text}
    </span>
  );
}

function GameHelpItems({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-2.5 text-[0.9375rem] leading-7 opacity-90 sm:text-base">
      {items.map((item) => (
        <li className="flex gap-2" key={item}>
          <span
            className="mt-[0.75rem] size-1.5 shrink-0 rounded-full bg-current opacity-60"
            aria-hidden="true"
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
