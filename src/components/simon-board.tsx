"use client";

import type { ReactNode } from "react";

import {
  SIMON_PADS,
  type SimonGameState,
  type SimonPadId,
} from "@/lib/simon-game-engine";
import { cn } from "@/lib/utils";

type SimonBoardProps = {
  children?: ReactNode;
  game: SimonGameState;
  onPadPress: (pad: SimonPadId) => void;
  statusLabel: string;
};

const simonPadLabels: Record<SimonPadId, string> = {
  blue: "Blue",
  green: "Green",
  red: "Red",
  yellow: "Yellow",
};

const simonPadKeys: Record<SimonPadId, string> = {
  blue: "4 or R",
  green: "1 or Q",
  red: "2 or W",
  yellow: "3 or E",
};

const simonPadClassNames: Record<SimonPadId, string> = {
  blue:
    "rounded-br-full border-[#14528f] bg-[#1d7ed0] shadow-[inset_0_-8px_0_rgba(10,35,70,0.34),0_0_24px_rgba(29,126,208,0.3)]",
  green:
    "rounded-tl-full border-[#1f6b3f] bg-[#25a75a] shadow-[inset_0_-8px_0_rgba(13,63,33,0.34),0_0_24px_rgba(37,167,90,0.3)]",
  red:
    "rounded-tr-full border-[#8a2431] bg-[#d73548] shadow-[inset_0_-8px_0_rgba(89,16,28,0.34),0_0_24px_rgba(215,53,72,0.3)]",
  yellow:
    "rounded-bl-full border-[#9a7120] bg-[#f0bd38] shadow-[inset_0_-8px_0_rgba(107,78,16,0.34),0_0_24px_rgba(240,189,56,0.3)]",
};

const simonPadActiveClassNames: Record<SimonPadId, string> = {
  blue: "bg-[#65b7ff] shadow-[inset_0_-4px_0_rgba(10,35,70,0.22),0_0_42px_rgba(101,183,255,0.72)]",
  green:
    "bg-[#62e78f] shadow-[inset_0_-4px_0_rgba(13,63,33,0.22),0_0_42px_rgba(98,231,143,0.72)]",
  red: "bg-[#ff7a87] shadow-[inset_0_-4px_0_rgba(89,16,28,0.22),0_0_42px_rgba(255,122,135,0.72)]",
  yellow:
    "bg-[#ffe27a] shadow-[inset_0_-4px_0_rgba(107,78,16,0.22),0_0_42px_rgba(255,226,122,0.72)]",
};

export function SimonBoard({ children, game, onPadPress, statusLabel }: SimonBoardProps) {
  const isInputReady = game.status === "input";

  return (
    <div className="relative aspect-square overflow-hidden rounded-md border border-[#cfd8e6] bg-[#f8fbff] p-3 shadow-[0_24px_70px_rgba(15,23,42,0.13)]">
      <div
        aria-label={`Simon board. Round ${game.round}. Score ${game.score}. Target ${game.winTarget}. ${statusLabel}.`}
        className="relative grid size-full grid-cols-2 gap-3 rounded-full border-[12px] border-[#141923] bg-[#141923] p-2"
        data-testid="simon-board"
      >
        {SIMON_PADS.map((pad) => {
          const isActive = game.activePad === pad;

          return (
            <button
              aria-label={`${simonPadLabels[pad]} pad. Key ${simonPadKeys[pad]}.`}
              className={cn(
                "min-h-0 border-2 transition duration-150 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/85 disabled:cursor-not-allowed disabled:opacity-80",
                simonPadClassNames[pad],
                isActive && simonPadActiveClassNames[pad],
                isInputReady && "hover:brightness-110 active:translate-y-px",
              )}
              data-testid={`simon-pad-${pad}`}
              disabled={!isInputReady}
              key={pad}
              onClick={() => onPadPress(pad)}
              type="button"
            >
              <span className="sr-only">{simonPadLabels[pad]}</span>
            </button>
          );
        })}

        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 flex size-[34%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[10px] border-[#141923] bg-[#f8fbff] shadow-[0_12px_34px_rgba(15,23,42,0.28)]"
        >
          <div className="flex size-[68%] items-center justify-center rounded-full bg-[#202735] font-mono text-xl font-semibold text-white">
            {game.round || 0}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
