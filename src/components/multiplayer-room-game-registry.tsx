"use client";

import type { ComponentType, ReactNode } from "react";

import { PongMultiplayerRoom } from "@/components/pong-multiplayer-room";
import { SpaceInvadersMultiplayerRoom } from "@/components/space-invaders-multiplayer-room";
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
import type {
  SpaceInvadersMultiplayerClientInput,
  SpaceInvadersMultiplayerGameSnapshot,
} from "@/lib/space-invaders-multiplayer";

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
  View: ComponentType<MultiplayerRoomGameRendererProps>;
};

type MultiplayerRoomGameRendererViewProps = MultiplayerRoomGameRendererProps & {
  renderer: MultiplayerRoomGameRenderer;
};

function isPongMultiplayerGameSnapshot(
  game: MultiplayerRoomGameSnapshot | null | undefined,
): game is PongMultiplayerGameSnapshot {
  return game?.gameId === "pong";
}

function isSpaceInvadersMultiplayerGameSnapshot(
  game: MultiplayerRoomGameSnapshot | null | undefined,
): game is SpaceInvadersMultiplayerGameSnapshot {
  return game?.gameId === "space-invaders";
}

function PongMultiplayerRoomRendererView({
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

function SpaceInvadersMultiplayerRoomRendererView({
  activeParticipant,
  game,
  lifecycleControls,
  room,
  sendGameInput,
}: MultiplayerRoomGameRendererProps) {
  if (!isSpaceInvadersMultiplayerGameSnapshot(game)) {
    return null;
  }

  function handleSpaceInvadersInput(input: SpaceInvadersMultiplayerClientInput) {
    return sendGameInput("space-invaders", input);
  }

  return (
    <SpaceInvadersMultiplayerRoom
      activeParticipant={activeParticipant}
      game={game}
      lifecycleControls={lifecycleControls}
      onGameInput={handleSpaceInvadersInput}
      room={room}
    />
  );
}

const MULTIPLAYER_ROOM_GAME_RENDERERS: Partial<
  Record<GameId, MultiplayerRoomGameRenderer>
> = {
  pong: {
    gameId: "pong",
    View: PongMultiplayerRoomRendererView,
  },
  "space-invaders": {
    gameId: "space-invaders",
    View: SpaceInvadersMultiplayerRoomRendererView,
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

export function MultiplayerRoomGameRendererView({
  activeParticipant,
  game,
  lifecycleControls,
  renderer,
  room,
  sendGameInput,
}: MultiplayerRoomGameRendererViewProps) {
  const RendererView = renderer.View;

  return (
    <RendererView
      activeParticipant={activeParticipant}
      game={game}
      lifecycleControls={lifecycleControls}
      room={room}
      sendGameInput={sendGameInput}
    />
  );
}
