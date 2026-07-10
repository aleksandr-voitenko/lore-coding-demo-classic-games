"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useState } from "react";

import { useGameDialogReturnFocus } from "@/components/game-dialog-focus";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GameAbandonDialogProps = {
  onCancel: () => void;
  onConfirm: () => void;
};

export function GameAbandonDialog({ onCancel, onConfirm }: GameAbandonDialogProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { restoreReturnFocus, returnFocusRef } = useGameDialogReturnFocus();

  return (
    <Dialog.Root
      disablePointerDismissal
      onOpenChange={setIsOpen}
      onOpenChangeComplete={(open) => {
        if (!open) {
          onCancel();
          restoreReturnFocus();
        }
      }}
      open={isOpen}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-sm" />
        <Dialog.Popup
          aria-describedby="game-abandon-dialog-description"
          aria-labelledby="game-abandon-dialog-title"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 outline-none"
          data-game-modal
          data-testid="game-abandon-dialog"
          initialFocus
          finalFocus={returnFocusRef}
          role="alertdialog"
        >
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-md border border-[var(--game-abandon-border)] bg-[var(--game-abandon-panel)] p-4 text-left text-[var(--game-abandon-ink)] shadow-[0_24px_80px_var(--game-abandon-shadow)]">
            <div className="flex flex-col gap-2">
              <Dialog.Title
                className="text-xl font-semibold tracking-normal text-balance"
                id="game-abandon-dialog-title"
              >
                Abandon game?
              </Dialog.Title>
              <Dialog.Description
                className="text-sm leading-6 text-[var(--game-abandon-muted)]"
                id="game-abandon-dialog-description"
              >
                Your current game will be lost and you will return to the game menu.
              </Dialog.Description>
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "!border-[var(--game-abandon-border)] !bg-[var(--game-abandon-cancel-bg)] !text-[var(--game-abandon-cancel-ink)] hover:!bg-[var(--game-abandon-cancel-hover-bg)] hover:!text-[var(--game-abandon-cancel-ink)] focus-visible:!border-[var(--game-abandon-focus-border)] focus-visible:!ring-[var(--game-abandon-focus-ring)]",
                )}
                data-slot="button"
                data-testid="game-abandon-cancel"
                type="button"
              >
                Cancel
              </Dialog.Close>
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
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
