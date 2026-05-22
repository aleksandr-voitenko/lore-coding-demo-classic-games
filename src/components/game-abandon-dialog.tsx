"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type GameAbandonDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function GameAbandonDialog({ onCancel, onConfirm }: GameAbandonDialogProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      aria-describedby="game-abandon-dialog-description"
      aria-labelledby="game-abandon-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      data-testid="game-abandon-dialog"
      role="alertdialog"
    >
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-white/25 bg-[#10151f] p-4 text-left text-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
        <div className="flex flex-col gap-2">
          <h2
            className="text-xl font-semibold tracking-normal text-balance"
            id="game-abandon-dialog-title"
          >
            Abandon game?
          </h2>
          <p className="text-sm leading-6 text-white/78" id="game-abandon-dialog-description">
            Your current game will be lost and you will return to the game menu.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            autoFocus
            className="border-white/35 bg-white/10 text-white hover:bg-white/20 hover:text-white focus-visible:border-white/70 focus-visible:ring-white/40"
            data-testid="game-abandon-cancel"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="bg-white text-[#10151f] hover:bg-white/86"
            data-testid="game-abandon-confirm"
            onClick={onConfirm}
            type="button"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
