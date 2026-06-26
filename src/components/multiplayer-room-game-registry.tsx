"use client";

import type { ReactElement, ReactNode } from "react";

import { PongMultiplayerRoom } from "@/components/pong-multiplayer-room";
import type { GameId } from "@/lib/game-catalog";
import type {
  PrivateRoom,
  PrivateRoomParticipant,
} from "@/lib/multiplayer/room";
import type {
  MultiplayerGameInputPayload,
  MultiplayerRoomGameSnapshot,
} from "@/lib/multiplayer/protocol";
import type {
  PongMultiplayerClientInput,
  PongMultiplayerGameSnapshot,
} from "@/lib/pong-multiplayer";

export type MultiplayerRoomGameInputSender = <
  Game extends GameId,
  Input = MultiplayerGameInputPayload<Game>,
>(
  gameId: Game,
  input: Input,
) => void | Promise<void>;

export type MultiplayerRoomGameRendererProps<
  GameSnapshot extends MultiplayerRoomGameSnapshot = MultiplayerRoomGameSnapshot,
> = {
  activeParticipant: PrivateRoomParticipant | null;
  game: GameSnapshot;
  lifecycleControls: ReactNode;
  room: PrivateRoom;
  sendGameInput: MultiplayerRoomGameInputSender;
};

export type MultiplayerRoomGameRenderer = {
  gameId: GameId;
  render: (
    props: MultiplayerRoomGameRendererProps,
  ) => ReactElement | null;
};

type RenderMultiplayerRoomGameOptions = Omit<
  MultiplayerRoomGameRendererProps,
  "game"
> & {
  game: MultiplayerRoomGameSnapshot | null | undefined;
};

function isPongMultiplayerGameSnapshot(
  game: MultiplayerRoomGameSnapshot | null | undefined,
): game is PongMultiplayerGameSnapshot {
  return game?.gameId === "pong";
}

function renderPongMultiplayerRoom({
  activeParticipant,
  game,
  lifecycleControls,
  room,
  sendGameInput,
}: MultiplayerRoomGameRendererProps) {
  if (!isPongMultiplayerGameSnapshot(game)) {
    return null;
  }

  function handlePongInput(input: PongMultiplayerClientInput) {
    return sendGameInput("pong", input);
  }

  return (
    <PongMultiplayerRoom
      activeParticipant={activeParticipant}
      game={game}
      lifecycleControls={lifecycleControls}
      onGameInput={handlePongInput}
      room={room}
    />
  );
}

const MULTIPLAYER_ROOM_GAME_RENDERERS: Partial<
  Record<GameId, MultiplayerRoomGameRenderer>
> = {
  pong: {
    gameId: "pong",
    render: renderPongMultiplayerRoom,
  },
};

export function getMultiplayerRoomGameRenderer(
  room: PrivateRoom,
  game: MultiplayerRoomGameSnapshot | null | undefined,
) {
  if (game === null || game === undefined || room.settings.gameId !== game.gameId) {
    return null;
  }

  return MULTIPLAYER_ROOM_GAME_RENDERERS[room.settings.gameId] ?? null;
}

export function renderMultiplayerRoomGame({
  activeParticipant,
  game,
  lifecycleControls,
  room,
  sendGameInput,
}: RenderMultiplayerRoomGameOptions) {
  const renderer = getMultiplayerRoomGameRenderer(room, game);

  if (renderer === null || game === null || game === undefined) {
    return null;
  }

  return renderer.render({
    activeParticipant,
    game,
    lifecycleControls,
    room,
    sendGameInput,
  });
}
