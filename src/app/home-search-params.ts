import { normalizePrivateRoomCode } from "@/lib/multiplayer/room";

export function getInitialReplayGameId(value: string | string[] | undefined) {
  const replayGameId = Array.isArray(value) ? value[0] : value;

  return replayGameId === "snake" ||
    replayGameId === "tetris" ||
    replayGameId === "breakout" ||
    replayGameId === "minesweeper" ||
    replayGameId === "pong" ||
    replayGameId === "simon" ||
    replayGameId === "space-invaders" ||
    replayGameId === "asteroids" ||
    replayGameId === "battle-city" ||
    replayGameId === "twenty-forty-eight"
    ? replayGameId
    : null;
}

export function getInitialRoomCode(value: string | string[] | undefined) {
  const roomCode = Array.isArray(value) ? value[0] : value;

  if (roomCode === undefined) {
    return null;
  }

  return normalizePrivateRoomCode(roomCode) ?? roomCode.trim();
}
