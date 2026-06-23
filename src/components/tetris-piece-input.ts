import {
  createHeldDirectionMovementKeyGetter,
  createHeldDirectionMovementState,
  type HeldDirectionMovementState,
} from "./game-input";

const TETRIS_PIECE_MOVEMENT_DIRECTIONS = ["left", "right"] as const;

export type TetrisPieceMovementDirection =
  (typeof TETRIS_PIECE_MOVEMENT_DIRECTIONS)[number];

export type TetrisPieceMovementState =
  HeldDirectionMovementState<TetrisPieceMovementDirection>;

export function createTetrisPieceMovementState(): TetrisPieceMovementState {
  return createHeldDirectionMovementState(TETRIS_PIECE_MOVEMENT_DIRECTIONS);
}

export const getTetrisPieceMovementKey = createHeldDirectionMovementKeyGetter({
  left: ["ArrowLeft", "a"],
  right: ["ArrowRight", "d"],
});
