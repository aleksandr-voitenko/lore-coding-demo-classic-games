"use client";

import type { ComponentType, ReactNode } from "react";

import { AsteroidsMultiplayerRoom } from "@/components/asteroids-multiplayer-room";
import { BattleCityMultiplayerRoom } from "@/components/battle-city-multiplayer-room";
import { PongMultiplayerRoom } from "@/components/pong-multiplayer-room";
import { SpaceInvadersMultiplayerRoom } from "@/components/space-invaders-multiplayer-room";
import type { GameId } from "@/lib/game-catalog";
import type {
  AsteroidsMultiplayerClientInput,
  AsteroidsMultiplayerGameSnapshot,
} from "@/lib/asteroids-multiplayer";
import type {
  BattleCityMultiplayerClientInput,
  BattleCityMultiplayerGameSnapshot,
} from "@/lib/battle-city-multiplayer";
import {
  isMultiplayerGameId,
  type MultiplayerGameId,
} from "@/lib/multiplayer/game-registry";
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
  onProjectionReconcile?: () => void;
  room: PrivateRoom;
  sendGameInput: MultiplayerRoomGameInputSender;
};

export type MultiplayerRoomGameRenderer = {
  gameId: MultiplayerGameId;
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

function isAsteroidsMultiplayerGameSnapshot(
  game: MultiplayerRoomGameSnapshot | null | undefined,
): game is AsteroidsMultiplayerGameSnapshot {
  return game?.gameId === "asteroids";
}

function isBattleCityMultiplayerGameSnapshot(
  game: MultiplayerRoomGameSnapshot | null | undefined,
): game is BattleCityMultiplayerGameSnapshot {
  return game?.gameId === "battle-city";
}

function PongMultiplayerRoomRendererView({
  activeParticipant,
  game,
  lifecycleControls,
  onProjectionReconcile,
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
      onProjectionReconcile={onProjectionReconcile}
      onGameInput={handlePongInput}
      room={room}
    />
  );
}

function SpaceInvadersMultiplayerRoomRendererView({
  activeParticipant,
  game,
  lifecycleControls,
  onProjectionReconcile,
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
      onProjectionReconcile={onProjectionReconcile}
      onGameInput={handleSpaceInvadersInput}
      room={room}
    />
  );
}

function AsteroidsMultiplayerRoomRendererView({
  activeParticipant,
  game,
  lifecycleControls,
  onProjectionReconcile,
  room,
  sendGameInput,
}: MultiplayerRoomGameRendererProps) {
  if (!isAsteroidsMultiplayerGameSnapshot(game)) {
    return null;
  }

  function handleAsteroidsInput(input: AsteroidsMultiplayerClientInput) {
    return sendGameInput("asteroids", input);
  }

  return (
    <AsteroidsMultiplayerRoom
      activeParticipant={activeParticipant}
      game={game}
      lifecycleControls={lifecycleControls}
      onProjectionReconcile={onProjectionReconcile}
      onGameInput={handleAsteroidsInput}
      room={room}
    />
  );
}

function BattleCityMultiplayerRoomRendererView({
  activeParticipant,
  game,
  lifecycleControls,
  onProjectionReconcile,
  room,
  sendGameInput,
}: MultiplayerRoomGameRendererProps) {
  if (!isBattleCityMultiplayerGameSnapshot(game)) {
    return null;
  }

  function handleBattleCityInput(input: BattleCityMultiplayerClientInput) {
    return sendGameInput("battle-city", input);
  }

  return (
    <BattleCityMultiplayerRoom
      activeParticipant={activeParticipant}
      game={game}
      lifecycleControls={lifecycleControls}
      onProjectionReconcile={onProjectionReconcile}
      onGameInput={handleBattleCityInput}
      room={room}
    />
  );
}

const MULTIPLAYER_ROOM_GAME_RENDERERS: Readonly<
  Record<MultiplayerGameId, MultiplayerRoomGameRenderer>
> = {
  asteroids: {
    gameId: "asteroids",
    View: AsteroidsMultiplayerRoomRendererView,
  },
  "battle-city": {
    gameId: "battle-city",
    View: BattleCityMultiplayerRoomRendererView,
  },
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
  if (
    game === null ||
    game === undefined ||
    room.settings.gameId !== game.gameId ||
    room.matchId !== game.matchId
  ) {
    return null;
  }

  if (!isMultiplayerGameId(room.settings.gameId)) {
    return null;
  }

  return MULTIPLAYER_ROOM_GAME_RENDERERS[room.settings.gameId] ?? null;
}

export function MultiplayerRoomGameRendererView({
  activeParticipant,
  game,
  lifecycleControls,
  onProjectionReconcile,
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
      onProjectionReconcile={onProjectionReconcile}
      room={room}
      sendGameInput={sendGameInput}
    />
  );
}
