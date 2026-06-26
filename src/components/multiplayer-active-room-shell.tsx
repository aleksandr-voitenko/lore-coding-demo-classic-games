"use client";

import type { ReactNode } from "react";

import type {
  PrivateRoomParticipant,
  PrivateRoomSeat,
} from "@/lib/multiplayer/room";

export type MultiplayerActiveRoomSidePanel = {
  content: ReactNode;
  id: string;
  testId?: string;
};

type MultiplayerActiveRoomShellProps = {
  activeParticipant: PrivateRoomParticipant | null;
  activeSeat: PrivateRoomSeat | null;
  board: ReactNode;
  boardFrameMaxWidth?: string;
  boardFrameTestId?: string;
  lifecycleControls?: ReactNode;
  readOnlyTestId: string;
  roleLabelTestId: string;
  rootTestId: string;
  sidePanels?: MultiplayerActiveRoomSidePanel[];
};

type MultiplayerActiveRoomPanelProps = {
  children: ReactNode;
  testId?: string;
};

export function MultiplayerActiveRoomShell({
  activeParticipant,
  activeSeat,
  board,
  boardFrameMaxWidth,
  boardFrameTestId,
  lifecycleControls = null,
  readOnlyTestId,
  roleLabelTestId,
  rootTestId,
  sidePanels = [],
}: MultiplayerActiveRoomShellProps) {
  const roleLabel = getMultiplayerActiveRoomParticipantRoleLabel(
    activeParticipant,
    activeSeat,
  );
  const readOnlyMessage = getMultiplayerActiveRoomReadOnlyMessage(
    activeParticipant,
    activeSeat,
  );

  return (
    <div
      className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)]"
      data-testid={rootTestId}
    >
      <section className="min-w-0">
        <div
          className="mx-auto w-full"
          data-testid={boardFrameTestId}
          style={{ maxWidth: boardFrameMaxWidth }}
        >
          {board}
        </div>
      </section>

      <aside className="flex min-w-0 flex-col gap-4">
        {sidePanels.map((panel) => (
          <MultiplayerActiveRoomPanel key={panel.id} testId={panel.testId}>
            {panel.content}
          </MultiplayerActiveRoomPanel>
        ))}

        <MultiplayerActiveRoomPanel>
          <h2 className="text-lg font-semibold tracking-normal">Your Role</h2>
          <p
            className="mt-1 text-sm font-medium text-[var(--chrome-muted)]"
            data-testid={roleLabelTestId}
          >
            {roleLabel}
          </p>
          {readOnlyMessage !== null ? (
            <p
              className="mt-3 rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-accent-faint)] p-3 text-sm font-semibold text-[var(--chrome-ink)]"
              data-testid={readOnlyTestId}
            >
              {readOnlyMessage}
            </p>
          ) : null}
        </MultiplayerActiveRoomPanel>

        {lifecycleControls !== null ? (
          <MultiplayerActiveRoomPanel>
            {lifecycleControls}
          </MultiplayerActiveRoomPanel>
        ) : null}
      </aside>
    </div>
  );
}

export function getMultiplayerActiveRoomParticipantSeat(
  seats: PrivateRoomSeat[],
  participantId: string | null,
) {
  if (participantId === null) {
    return null;
  }

  return (
    seats.find((seat) => seat.occupiedByParticipantId === participantId) ?? null
  );
}

export function getMultiplayerActiveRoomParticipantRoleLabel(
  participant: PrivateRoomParticipant | null,
  seat: PrivateRoomSeat | null,
) {
  if (participant === null) {
    return "Guest · Observer";
  }

  if (seat !== null) {
    return `${participant.displayName} · ${seat.label}`;
  }

  return `${participant.displayName} · Observer`;
}

export function getMultiplayerActiveRoomReadOnlyMessage(
  participant: PrivateRoomParticipant | null,
  seat: PrivateRoomSeat | null,
) {
  if (seat !== null) {
    return null;
  }

  if (participant === null) {
    return "Watching read-only";
  }

  return "Observer view";
}

function MultiplayerActiveRoomPanel({
  children,
  testId,
}: MultiplayerActiveRoomPanelProps) {
  return (
    <section
      className="rounded-md border border-[var(--chrome-border)] bg-[var(--chrome-panel)] p-4 shadow-sm"
      data-testid={testId}
    >
      {children}
    </section>
  );
}
