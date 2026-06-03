import {
  DIVER_INVADER_COUNT,
  INVADER_GAP_X,
  INVADER_GAP_Y,
  INVADER_HEIGHT,
  INVADER_TOP,
  INVADER_WIDTH,
  INVADER_X,
  SPACE_INVADERS_ALIEN_COUNT_OPTIONS,
  SPACE_INVADERS_ARMORED_ALIEN_COUNT,
  SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS,
  SPACE_INVADERS_BOARD_WIDTH,
  SPACE_INVADERS_COLUMNS,
  SPACE_INVADERS_REVENGE_ALIEN_COUNT,
  SPACE_INVADERS_ROWS,
  SPACE_INVADERS_SHIELD_BEARER_COUNT,
  SPACE_INVADERS_SPLITTER_ALIEN_COUNT,
  SPLITTER_FRAGMENT_GAP_X,
  SPLITTER_FRAGMENT_HEIGHT,
  SPLITTER_FRAGMENT_WIDTH,
} from "./constants";
import { clamp, getEntityCenterX } from "./geometry";
import { getRandomIndex } from "./random";
import type {
  SpaceInvader,
  SpaceInvaderKind,
  SpaceInvadersRandomSource,
} from "./types";

export function createSpaceInvadersFormation({
  boardWidth = SPACE_INVADERS_BOARD_WIDTH,
  columns = SPACE_INVADERS_COLUMNS,
  random = Math.random,
  rows = SPACE_INVADERS_ROWS,
}: {
  boardWidth?: number;
  columns?: number;
  random?: SpaceInvadersRandomSource;
  rows?: number;
} = {}) {
  const formationWidth = columns * INVADER_WIDTH + (columns - 1) * INVADER_GAP_X;
  const startX = Math.max(INVADER_X, (boardWidth - formationWidth) / 2);
  const shieldBearerInvaderIds = selectShieldBearerInvaderIds({
    columns,
    random,
    rows,
  });
  const revengeAlienIds = selectRevengeAlienIds({
    columns,
    excludedIds: shieldBearerInvaderIds,
    random,
    rows,
  });
  const splitterAlienIds = selectSplitterAlienIds({
    columns,
    excludedIds: new Set([...shieldBearerInvaderIds, ...revengeAlienIds]),
    random,
    rows,
  });
  const armoredAlienIds = selectArmoredAlienIds({
    columns,
    excludedIds: new Set([
      ...shieldBearerInvaderIds,
      ...revengeAlienIds,
      ...splitterAlienIds,
    ]),
    random,
    rows,
  });
  const specialInvaderIds = new Set([
    ...shieldBearerInvaderIds,
    ...revengeAlienIds,
    ...splitterAlienIds,
    ...armoredAlienIds,
  ]);
  const diverInvaderIds = selectDiverInvaderIds(
    rows,
    columns,
    random,
    specialInvaderIds,
  );

  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column): SpaceInvader => {
      const id = `${row}:${column}`;
      const kind: SpaceInvaderKind = shieldBearerInvaderIds.has(id)
        ? "shield-bearer"
        : revengeAlienIds.has(id)
          ? "revenge"
        : splitterAlienIds.has(id)
          ? "splitter"
        : armoredAlienIds.has(id)
          ? "armored"
        : diverInvaderIds.has(id)
          ? "diver"
          : "standard";
      const x = startX + column * (INVADER_WIDTH + INVADER_GAP_X);
      const y = INVADER_TOP + row * (INVADER_HEIGHT + INVADER_GAP_Y);

      return {
        column,
        direction: 1,
        height: INVADER_HEIGHT,
        hitPoints: getInitialInvaderHitPoints(kind),
        id,
        isActive: true,
        isDiving: false,
        kind,
        points: getInvaderPoints(row),
        row,
        width: INVADER_WIDTH,
        x,
        y,
      };
    }),
  ).flat();
}

export function createSpaceInvadersSplitterFragments(
  destroyedInvaders: SpaceInvader[],
  boardWidth: number,
) {
  return destroyedInvaders
    .filter((invader) => invader.kind === "splitter")
    .flatMap((invader) => [
      createSpaceInvadersSplitterFragment(invader, "left", boardWidth),
      createSpaceInvadersSplitterFragment(invader, "right", boardWidth),
    ]);
}

function createSpaceInvadersSplitterFragment(
  invader: SpaceInvader,
  side: "left" | "right",
  boardWidth: number,
): SpaceInvader {
  const invaderCenterX = getEntityCenterX(invader);
  const invaderCenterY = invader.y + invader.height / 2;
  const centerOffset =
    side === "left"
      ? -(SPLITTER_FRAGMENT_WIDTH + SPLITTER_FRAGMENT_GAP_X) / 2
      : (SPLITTER_FRAGMENT_WIDTH + SPLITTER_FRAGMENT_GAP_X) / 2;

  return {
    column: invader.column,
    direction: side === "left" ? -1 : 1,
    height: SPLITTER_FRAGMENT_HEIGHT,
    hitPoints: 1,
    id: `${invader.id}:split-${side}`,
    isActive: true,
    isDiving: true,
    kind: "splitter-fragment",
    points: getSplitterFragmentPoints(invader),
    row: invader.row,
    width: SPLITTER_FRAGMENT_WIDTH,
    x: clamp(
      invaderCenterX + centerOffset - SPLITTER_FRAGMENT_WIDTH / 2,
      0,
      boardWidth - SPLITTER_FRAGMENT_WIDTH,
    ),
    y: invaderCenterY - SPLITTER_FRAGMENT_HEIGHT / 2,
  };
}

function getSplitterFragmentPoints(invader: Pick<SpaceInvader, "points">) {
  return Math.max(5, Math.floor(invader.points / 2));
}

export function getInvaderPoints(row: number) {
  if (row === 0) {
    return 30;
  }

  if (row <= 2) {
    return 20;
  }

  return 10;
}

export function getInitialInvaderHitPoints(kind: SpaceInvaderKind) {
  return kind === "armored" ? SPACE_INVADERS_ARMORED_ALIEN_HIT_POINTS : 1;
}

export function getInvaderHitPointsAfterPlayerShot(invader: SpaceInvader) {
  return invader.kind === "armored" ? Math.max(0, invader.hitPoints - 1) : 0;
}

function selectDiverInvaderIds(
  rows: number,
  columns: number,
  random: SpaceInvadersRandomSource,
  excludedIds = new Set<string>(),
) {
  const candidates = Array.from({ length: Math.max(0, rows - 1) }, (_, row) =>
    Array.from({ length: columns }, (_, column) => `${row}:${column}`),
  )
    .flat()
    .filter((id) => !excludedIds.has(id));
  const selectedCount = Math.min(DIVER_INVADER_COUNT, candidates.length);
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function selectShieldBearerInvaderIds({
  columns,
  random,
  rows,
}: {
  columns: number;
  random: SpaceInvadersRandomSource;
  rows: number;
}) {
  const candidates = Array.from({ length: Math.max(0, rows - 2) }, (_, index) =>
    Array.from({ length: columns }, (_, column) => `${index + 1}:${column}`),
  ).flat();
  const selectedCount = Math.min(SPACE_INVADERS_SHIELD_BEARER_COUNT, candidates.length);
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function selectRevengeAlienIds({
  columns,
  excludedIds,
  random,
  rows,
}: {
  columns: number;
  excludedIds: Set<string>;
  random: SpaceInvadersRandomSource;
  rows: number;
}) {
  const unavailableIds = getUnavailableRevengeAlienIds(excludedIds, columns);
  const middleRowIds = Array.from({ length: Math.max(0, rows - 2) }, (_, index) =>
    Array.from({ length: columns }, (_, column) => `${index + 1}:${column}`),
  ).flat();
  const preferredCandidates = middleRowIds.filter((id) => !unavailableIds.has(id));
  const fallbackCandidates = middleRowIds.filter(
    (id) => !excludedIds.has(id) && unavailableIds.has(id),
  );
  const candidates = [...preferredCandidates, ...fallbackCandidates];
  const nonBottomSlotCount = Math.max(0, rows - 1) * columns;
  const maximumRevengeAlienCount = Math.max(
    0,
    nonBottomSlotCount - excludedIds.size - DIVER_INVADER_COUNT,
  );
  const selectedCount = Math.min(
    SPACE_INVADERS_REVENGE_ALIEN_COUNT,
    maximumRevengeAlienCount,
    candidates.length,
  );
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function selectSplitterAlienIds({
  columns,
  excludedIds,
  random,
  rows,
}: {
  columns: number;
  excludedIds: Set<string>;
  random: SpaceInvadersRandomSource;
  rows: number;
}) {
  const candidates = Array.from({ length: Math.max(0, rows - 2) }, (_, index) =>
    Array.from({ length: columns }, (_, column) => `${index + 1}:${column}`),
  )
    .flat()
    .filter((id) => !excludedIds.has(id));
  const nonBottomSlotCount = Math.max(0, rows - 1) * columns;
  const maximumSplitterAlienCount = Math.max(
    0,
    nonBottomSlotCount - excludedIds.size - DIVER_INVADER_COUNT,
  );
  const selectedCount = Math.min(
    SPACE_INVADERS_SPLITTER_ALIEN_COUNT,
    maximumSplitterAlienCount,
    candidates.length,
  );
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function selectArmoredAlienIds({
  columns,
  excludedIds,
  random,
  rows,
}: {
  columns: number;
  excludedIds: Set<string>;
  random: SpaceInvadersRandomSource;
  rows: number;
}) {
  const candidates = Array.from({ length: Math.max(0, rows - 2) }, (_, index) =>
    Array.from({ length: columns }, (_, column) => `${index + 1}:${column}`),
  )
    .flat()
    .filter((id) => !excludedIds.has(id));
  const nonBottomSlotCount = Math.max(0, rows - 1) * columns;
  const maximumArmoredAlienCount = Math.max(
    0,
    nonBottomSlotCount - excludedIds.size - DIVER_INVADER_COUNT,
  );
  const selectedCount = Math.min(
    SPACE_INVADERS_ARMORED_ALIEN_COUNT,
    maximumArmoredAlienCount,
    candidates.length,
  );
  const selectedIds = new Set<string>();

  for (let selectedIndex = 0; selectedIndex < selectedCount; selectedIndex += 1) {
    const candidateIndex = getRandomIndex(candidates.length, random);
    const [selectedId] = candidates.splice(candidateIndex, 1);

    if (selectedId !== undefined) {
      selectedIds.add(selectedId);
    }
  }

  return selectedIds;
}

function getUnavailableRevengeAlienIds(excludedIds: Set<string>, columns: number) {
  const unavailableIds = new Set<string>(excludedIds);

  for (const id of excludedIds) {
    const [row, column] = getInvaderGridPositionFromId(id);

    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      const unavailableColumn = column + columnOffset;

      if (unavailableColumn >= 0 && unavailableColumn < columns) {
        unavailableIds.add(`${row}:${unavailableColumn}`);
      }
    }
  }

  return unavailableIds;
}

function getInvaderGridPositionFromId(id: string) {
  const [row = "0", column = "0"] = id.split(":");

  return [Number(row), Number(column)] as const;
}

export function isSpaceInvaderShielded(
  invader: SpaceInvader,
  invaders: SpaceInvader[],
) {
  if (!invader.isActive || invader.kind === "shield-bearer") {
    return false;
  }

  const invaderCenterX = getEntityCenterX(invader);
  const maximumShieldDistanceX = INVADER_WIDTH + INVADER_GAP_X + 1;

  return invaders.some(
    (candidate) =>
      candidate.isActive &&
      candidate.kind === "shield-bearer" &&
      candidate.row === invader.row &&
      Math.abs(getEntityCenterX(candidate) - invaderCenterX) <=
        maximumShieldDistanceX,
  );
}

export function getSpaceInvadersFormationSpec(alienCount: number) {
  const normalizedAlienCount = Number.isFinite(alienCount)
    ? Math.max(1, Math.floor(alienCount))
    : SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS;

  return (
    SPACE_INVADERS_ALIEN_COUNT_OPTIONS.find(
      (option) => option.alienCount === normalizedAlienCount,
    ) ??
    SPACE_INVADERS_ALIEN_COUNT_OPTIONS.find(
      (option) => option.alienCount === SPACE_INVADERS_COLUMNS * SPACE_INVADERS_ROWS,
    ) ??
    SPACE_INVADERS_ALIEN_COUNT_OPTIONS[SPACE_INVADERS_ALIEN_COUNT_OPTIONS.length - 1]
  );
}
