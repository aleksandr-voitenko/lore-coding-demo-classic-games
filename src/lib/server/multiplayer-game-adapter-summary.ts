import type {
  MultiplayerTerminalSummaryParticipant,
  MultiplayerTerminalSummarySeat,
} from "../multiplayer/protocol";
import type { PrivateRoom } from "../multiplayer/room";

export function createMultiplayerTerminalSummarySeats(
  room: PrivateRoom,
): MultiplayerTerminalSummarySeat[] {
  return room.seats.map((seat) => ({
    id: seat.id,
    label: seat.label,
    participant: getTerminalSummaryParticipant(
      room,
      seat.occupiedByParticipantId,
    ),
  }));
}

export function getSeatParticipantId(room: PrivateRoom, seatId: string) {
  return (
    room.seats.find((seat) => seat.id === seatId)?.occupiedByParticipantId ?? null
  );
}

function getTerminalSummaryParticipant(
  room: PrivateRoom,
  participantId: string | null,
): MultiplayerTerminalSummaryParticipant | null {
  if (participantId === null) {
    return null;
  }

  const participant = room.participants.find((entry) => entry.id === participantId);

  if (participant === undefined) {
    return null;
  }

  return {
    displayName: participant.displayName,
    id: participant.id,
    role: participant.role,
    userId: participant.userId,
  };
}
