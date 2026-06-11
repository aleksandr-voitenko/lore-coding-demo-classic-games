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
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-[var(--game-abandon-border)] bg-[var(--game-abandon-panel)] p-4 text-left text-[var(--game-abandon-ink)] shadow-[0_24px_80px_var(--game-abandon-shadow)]">
        <div className="flex flex-col gap-2">
          <h2
            className="text-xl font-semibold tracking-normal text-balance"
            id="game-abandon-dialog-title"
          >
            Abandon game?
          </h2>
          <p
            className="text-sm leading-6 text-[var(--game-abandon-muted)]"
            id="game-abandon-dialog-description"
          >
            Your current game will be lost and you will return to the game menu.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button
            autoFocus
            className="!border-[var(--game-abandon-border)] !bg-[var(--game-abandon-cancel-bg)] !text-[var(--game-abandon-cancel-ink)] hover:!bg-[var(--game-abandon-cancel-hover-bg)] hover:!text-[var(--game-abandon-cancel-ink)] focus-visible:!border-[var(--game-abandon-focus-border)] focus-visible:!ring-[var(--game-abandon-focus-ring)]"
            data-testid="game-abandon-cancel"
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="!bg-[var(--game-abandon-confirm-bg)] !text-[var(--game-abandon-confirm-ink)] hover:!bg-[var(--game-abandon-confirm-hover-bg)] hover:!text-[var(--game-abandon-confirm-ink)] focus-visible:!border-[var(--game-abandon-focus-border)] focus-visible:!ring-[var(--game-abandon-focus-ring)]"
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
