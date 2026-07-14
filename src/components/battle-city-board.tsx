"use client";

import { memo, type CSSProperties, type ReactNode } from "react";

import {
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_BULLET_RENDER_SIZE,
  BATTLE_CITY_CARRIER_FLASH_TICKS,
  BATTLE_CITY_ENEMY_SPAWN_TICKS,
  BATTLE_CITY_ENEMY_SCORE_POPUP_TICKS,
  BATTLE_CITY_PLAYER_SPAWN_TICKS,
  formatBattleCityStageLabel,
  getBattleCityReserveLives,
  type BattleCityBullet,
  type BattleCityDirection,
  type BattleCityEnemy,
  type BattleCityGameState,
  type BattleCityPlayer,
  type BattleCityPlayerId,
  type BattleCityPowerUpType,
  type BattleCityTerrain,
} from "@/lib/battle-city-game-engine";
import {
  BATTLE_CITY_TERRAIN_FRAGMENT_BITS,
  type BattleCityTerrainFragment,
} from "@/lib/battle-city/terrain-fragments";
import {
  BATTLE_CITY_PLAYER_2_ASSET_BY_POWER_TIER,
  BATTLE_CITY_PLAYER_ASSET_BY_POWER_TIER,
  getBattleCityAssetUrl,
} from "@/lib/battle-city/assets";
import { getGameCatalogEntry } from "@/lib/game-catalog";
import { cn } from "@/lib/utils";

type BattleCityBoardProps = {
  children?: ReactNode;
  game: BattleCityGameState;
};

type TerrainCellProps = {
  col: number;
  fragmentMask?: number;
  gameTick: number;
  row: number;
  terrain: Exclude<BattleCityTerrain, "empty" | "headquarters">;
};

type TankSpriteProps = {
  asset: string;
  children?: ReactNode;
  className?: string;
  col: number;
  dataCarrier?: boolean;
  dataCarrierActive?: boolean;
  dataExplosionTicks?: number;
  dataEnemyType?: BattleCityEnemy["type"];
  dataHitPoints?: number;
  dataMaxHitPoints?: number;
  dataMovementStunTicks?: number;
  dataPaletteId?: EnemyPaletteId;
  dataPlayerId?: BattleCityPlayerId;
  dataPowerTier?: BattleCityGameState["player"]["powerTier"];
  dataPlayerPhase?: BattleCityGameState["player"]["phase"];
  dataSpawning?: boolean;
  dataTestId: string;
  direction: BattleCityDirection;
  row: number;
  spriteClassName?: string;
  spriteHidden?: boolean;
  style?: CSSProperties;
};

type EnemyPaletteId = 0 | 1 | 2 | 3;
type TankExplosionFrame = "d" | "e" | "f1" | "f5" | "f9" | "hq";
type TankSpawnTile = "a1" | "a5" | "a9" | "ad";

const BATTLE_CITY_DISPLAY_NAME = getGameCatalogEntry("battle-city").label;
// Protection timers use the ROM's 64-frame clock, so its final count is the
// useful visual warning window before the player becomes vulnerable.
const BATTLE_CITY_SHIELD_EXPIRING_TICKS = 64;

const TERRAIN_ASSET_BY_TYPE = {
  brick: "terrain-brick.png",
  forest: "terrain-forest.png",
  ice: "terrain-ice.png",
  steel: "terrain-steel.png",
} as const satisfies Record<
  Exclude<BattleCityTerrain, "empty" | "headquarters" | "water">,
  string
>;

const ENEMY_ASSET_BY_TYPE = {
  armor: "tank-enemy-armor.png",
  basic: "tank-enemy-basic.png",
  fast: "tank-enemy-fast.png",
  power: "tank-enemy-power.png",
} as const satisfies Record<BattleCityEnemy["type"], string>;

const POWER_UP_ASSET_BY_TYPE = {
  clock: "power-up-timer.png",
  grenade: "power-up-grenade.png",
  helmet: "power-up-helmet.png",
  shovel: "power-up-shovel.png",
  star: "power-up-star.png",
  tank: "power-up-tank.png",
} as const satisfies Record<BattleCityPowerUpType, string>;

const ENEMY_POINT_TILE_BY_SCORE: Readonly<Record<number, string>> = {
  100: "b9",
  200: "bd",
  300: "c1",
  400: "c5",
};

const TANK_SPAWN_TILE_SEQUENCE: readonly TankSpawnTile[] = [
  "ad",
  "ad",
  "a9",
  "a9",
  "a5",
  "a5",
  "a1",
  "a1",
  "a1",
  "a5",
  "a5",
  "a9",
  "a9",
  "ad",
];

const STATUS_LABELS = {
  "game-over": "Game over",
  lost: "Game over",
  paused: "Paused",
  ready: "Ready",
  running: "Running",
  "stage-clear": "Stage clear",
  "stage-intro": "Stage intro",
  "stage-results": "Stage results",
} as const satisfies Record<BattleCityGameState["status"], string>;

const TERRAIN_FRAGMENT_CLIP_PATH: Readonly<
  Record<BattleCityTerrainFragment, string>
> = {
  "bottom-left": "inset(50% 50% 0 0)",
  "bottom-right": "inset(50% 0 0 50%)",
  "top-left": "inset(0 50% 50% 0)",
  "top-right": "inset(0 0 50% 50%)",
};

function getPositionStyle(row: number, col: number, size = 1): CSSProperties {
  return {
    height: `${(size / BATTLE_CITY_BOARD_SIZE) * 100}%`,
    left: `${(col / BATTLE_CITY_BOARD_SIZE) * 100}%`,
    top: `${(row / BATTLE_CITY_BOARD_SIZE) * 100}%`,
    width: `${(size / BATTLE_CITY_BOARD_SIZE) * 100}%`,
  };
}

function getCenteredPositionStyle(
  row: number,
  col: number,
  size: number,
): CSSProperties {
  return {
    height: `${(size / BATTLE_CITY_BOARD_SIZE) * 100}%`,
    left: `${(col / BATTLE_CITY_BOARD_SIZE) * 100}%`,
    top: `${(row / BATTLE_CITY_BOARD_SIZE) * 100}%`,
    transform: "translate(-50%, -50%)",
    width: `${(size / BATTLE_CITY_BOARD_SIZE) * 100}%`,
  };
}

function getDirectionRotation(direction: BattleCityDirection) {
  switch (direction) {
    case "up":
      return 0;
    case "right":
      return 90;
    case "down":
      return 180;
    case "left":
      return 270;
  }
}

function getTankSpawnTile(
  remainingTicks: number,
  totalTicks: number,
): TankSpawnTile {
  const elapsedTicks = Math.max(0, totalTicks - remainingTicks);
  return TANK_SPAWN_TILE_SEQUENCE[
    elapsedTicks % TANK_SPAWN_TILE_SEQUENCE.length
  ]!;
}

function getTankExplosionFrame(ticks: number): TankExplosionFrame {
  if (ticks >= 22) {
    return "f1";
  }
  if (ticks >= 19) {
    return "f5";
  }
  if (ticks >= 16) {
    return "f9";
  }
  if (ticks >= 13) {
    return "d";
  }
  if (ticks >= 10) {
    return "e";
  }
  if (ticks >= 7) {
    return "f9";
  }
  return "f1";
}

function getHeadquartersPosition(terrain: readonly (readonly BattleCityTerrain[])[]) {
  for (let row = 0; row < terrain.length; row += 1) {
    const col = terrain[row].indexOf("headquarters");

    if (col >= 0) {
      return { col, row };
    }
  }

  return { col: 12, row: 24 };
}

const TerrainUnderlay = memo(function TerrainUnderlay({
  gameTick,
  terrain,
  terrainFragments,
}: {
  gameTick: number;
  terrain: BattleCityGameState["terrain"];
  terrainFragments: BattleCityGameState["terrainFragments"];
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10"
      data-testid="battle-city-terrain-underlay"
    >
      {terrain.flatMap((terrainRow, row) =>
        terrainRow.map((terrainType, col) =>
          terrainType !== "empty" &&
          terrainType !== "headquarters" &&
          terrainType !== "forest" ? (
            <TerrainCell
              col={col}
              fragmentMask={terrainFragments[row]?.[col]}
              gameTick={gameTick}
              key={`${row}:${col}`}
              row={row}
              terrain={terrainType}
            />
          ) : null,
        ),
      )}
    </div>
  );
});

const ForestOverlay = memo(function ForestOverlay({
  gameTick,
  terrain,
}: {
  gameTick: number;
  terrain: BattleCityGameState["terrain"];
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30"
      data-testid="battle-city-forest-overlay"
    >
      {terrain.flatMap((terrainRow, row) =>
        terrainRow.map((terrainType, col) =>
          terrainType === "forest" ? (
            <TerrainCell
              col={col}
              gameTick={gameTick}
              key={`${row}:${col}`}
              row={row}
              terrain="forest"
            />
          ) : null,
        ),
      )}
    </div>
  );
});

const PowerUpOverlay = memo(function PowerUpOverlay({
  game,
}: {
  game: BattleCityGameState;
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[45]"
      data-testid="battle-city-power-up-overlay"
    >
      {game.activePowerUp ? (
        <span
          className="absolute animate-pulse bg-contain bg-center bg-no-repeat"
          data-power-up={game.activePowerUp.type}
          data-testid="battle-city-power-up"
          style={{
            ...getPositionStyle(
              game.activePowerUp.row,
              game.activePowerUp.col,
              2,
            ),
            backgroundImage: `url(${getBattleCityAssetUrl(
              POWER_UP_ASSET_BY_TYPE[game.activePowerUp.type],
            )})`,
          }}
        />
      ) : null}
      {game.powerUpScorePopup ? (
        <span
          className="absolute flex items-center justify-center font-mono text-[clamp(0.35rem,1.5vw,0.65rem)] font-bold leading-none text-white [text-shadow:1px_1px_0_#111827]"
          data-point-tile="3b"
          data-points="500"
          data-testid="battle-city-power-up-points"
          data-ticks-remaining={game.powerUpScorePopup.ticks}
          style={getPositionStyle(
            game.powerUpScorePopup.row,
            game.powerUpScorePopup.col,
            2,
          )}
        >
          500
        </span>
      ) : null}
    </div>
  );
});

export function BattleCityBoard({ children, game }: BattleCityBoardProps) {
  const headquarters = getHeadquartersPosition(game.terrain);
  const enemiesRemaining = Math.max(
    0,
    game.totalEnemyCount - game.spawnedEnemyCount,
  );
  const reserveLives = getBattleCityReserveLives(
    game.lives,
    game.player.phase,
  );
  const player2ReserveLives = game.player2
    ? getBattleCityReserveLives(
        game.player2Lives ?? 0,
        game.player2.phase,
      )
    : 0;
  const stageLabel = formatBattleCityStageLabel(game.stage, game.cycle);
  const statusLabel = STATUS_LABELS[game.status];
  const player2Summary = game.player2
    ? ` Player 2 score ${game.player2Score ?? 0}. Reserve lives ${player2ReserveLives}. Power tier ${game.player2.powerTier} of 3.`
    : "";
  const boardAriaLabel = game.player2
    ? `${BATTLE_CITY_DISPLAY_NAME} board. Stage ${stageLabel}. Player 1 score ${game.score}. Reserve lives ${reserveLives}. Power tier ${game.player.powerTier} of 3.${player2Summary} ${enemiesRemaining} reinforcements waiting. Headquarters ${game.baseAlive ? "intact" : "destroyed"}. ${statusLabel}.`
    : `${BATTLE_CITY_DISPLAY_NAME} board. Stage ${stageLabel}. Score ${game.score}. Reserve lives ${reserveLives}. Power tier ${game.player.powerTier} of 3. ${enemiesRemaining} reinforcements waiting. Headquarters ${game.baseAlive ? "intact" : "destroyed"}. ${statusLabel}.`;

  return (
    <div className="relative w-full overflow-hidden rounded-md border border-[var(--battle-city-board-border)] bg-[var(--battle-city-board)] p-2 shadow-[0_24px_70px_color-mix(in_oklch,var(--battle-city-board)_45%,transparent)]">
      <div className="relative aspect-square w-full overflow-hidden rounded-[0.375rem] bg-[var(--battle-city-board)]">
        <div
          aria-label={boardAriaLabel}
          className="absolute inset-0"
          data-testid="battle-city-board"
          role="img"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(var(--battle-city-grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--battle-city-grid-line) 1px, transparent 1px)",
              backgroundSize: `${100 / BATTLE_CITY_BOARD_SIZE}% ${100 / BATTLE_CITY_BOARD_SIZE}%`,
            }}
          />

          <TerrainUnderlay
            gameTick={game.tick}
            terrain={game.terrain}
            terrainFragments={game.terrainFragments}
          />

          <Headquarters
            alive={game.baseAlive}
            col={headquarters.col}
            explosionTicks={game.baseExplosionTicks}
            row={headquarters.row}
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-20"
            data-testid="battle-city-entity-layer"
          >
            <BattleCityPlayerTank
              asset={
                BATTLE_CITY_PLAYER_ASSET_BY_POWER_TIER[game.player.powerTier]
              }
              gameTick={game.tick}
              player={game.player}
              playerId="player1"
            />

            {game.player2 ? (
              <BattleCityPlayerTank
                asset={
                  BATTLE_CITY_PLAYER_2_ASSET_BY_POWER_TIER[
                    game.player2.powerTier
                  ]
                }
                gameTick={game.tick}
                player={game.player2}
                playerId="player2"
              />
            ) : null}

            {game.enemies.map((enemy) => (
              <EnemyTank enemy={enemy} gameTick={game.tick} key={enemy.id} />
            ))}

            {game.bullets.map((bullet) => (
              <BattleCityBulletSprite bullet={bullet} key={bullet.id} />
            ))}
          </div>

          <ForestOverlay gameTick={game.tick} terrain={game.terrain} />
          <PowerUpOverlay game={game} />

          {game.playerGameOverMessage ? (
            <BattleCityPlayerGameOverMessage
              message={game.playerGameOverMessage}
            />
          ) : null}

          {game.freezeTicks > 0 ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-40 border-2 border-cyan-200/65 bg-cyan-300/5 shadow-[inset_0_0_28px_rgba(103,232,249,0.2)]"
              data-ticks-remaining={game.freezeTicks}
              data-testid="battle-city-freeze-effect"
            />
          ) : null}
        </div>

        {children ? (
          <div
            className="absolute inset-0 z-50"
            data-testid="battle-city-overlay-layer"
          >
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BattleCityPlayerGameOverMessage({
  message,
}: {
  message: NonNullable<BattleCityGameState["playerGameOverMessage"]>;
}) {
  const col =
    message.playerId === "player1"
      ? 1 + message.movementPixels / 8
      : 21 - message.movementPixels / 8;

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute z-40 whitespace-nowrap font-mono text-[clamp(0.5rem,2.2vw,1rem)] font-bold leading-none tracking-tighter text-[var(--battle-city-board-text)] [text-shadow:0_1px_0_black]"
      data-col={col}
      data-player-id={message.playerId}
      data-testid="battle-city-player-game-over-message"
      data-ticks-remaining={message.ticksRemaining}
      style={{
        left: `${(col / BATTLE_CITY_BOARD_SIZE) * 100}%`,
        top: `${(24 / BATTLE_CITY_BOARD_SIZE) * 100}%`,
      }}
    >
      GAME OVER
    </span>
  );
}

function BattleCityPlayerTank({
  asset,
  gameTick,
  player,
  playerId,
}: {
  asset: string;
  gameTick: number;
  player: BattleCityPlayer;
  playerId: BattleCityPlayerId;
}) {
  const protectionTicks = Math.max(
    player.invulnerabilityTicks,
    player.shieldTicks,
  );
  const isShieldExpiring =
    protectionTicks > 0 &&
    protectionTicks <= BATTLE_CITY_SHIELD_EXPIRING_TICKS;
  const movementStunTicks = player.movementStunTicks ?? 0;
  const isStunBlinkHidden =
    movementStunTicks > 0 && Math.floor(gameTick / 8) % 2 === 1;
  const testId =
    playerId === "player1" ? "battle-city-player" : "battle-city-player-2";

  return (
    <TankSprite
      asset={asset}
      col={player.col}
      dataExplosionTicks={
        player.phase === "exploding" ? player.phaseTicks : undefined
      }
      dataMovementStunTicks={movementStunTicks}
      dataPlayerId={playerId}
      dataPlayerPhase={player.phase}
      dataPowerTier={player.powerTier}
      dataTestId={testId}
      direction={player.direction}
      row={player.row}
      spriteHidden={
        player.phase !== "active" ||
        isStunBlinkHidden
      }
    >
      {player.phase === "exploding" ? (
        <TankExplosion ticks={player.phaseTicks} />
      ) : null}
      {player.phase === "spawning" ? (
        <TankSpawnEffect
          remainingTicks={player.phaseTicks}
          testId={`${testId}-spawn`}
          totalTicks={BATTLE_CITY_PLAYER_SPAWN_TICKS}
        />
      ) : null}
      {player.phase === "active" && protectionTicks > 0 ? (
        <span
          className="battle-city-shield-effect"
          data-shield-expiring={isShieldExpiring}
          data-shield-source={player.shieldTicks > 0 ? "helmet" : "spawn"}
          data-testid={`${testId}-shield`}
        />
      ) : null}
    </TankSprite>
  );
}

function BattleCityBulletSprite({ bullet }: { bullet: BattleCityBullet }) {
  const isImpact = bullet.impactTicks > 0;
  const impactPhase = isImpact ? Math.ceil(bullet.impactTicks / 3) : 0;
  const renderSize = isImpact
    ? impactPhase === 2
      ? 1.5
      : 1
    : BATTLE_CITY_BULLET_RENDER_SIZE;

  return (
    <span
      className="absolute flex items-center justify-center"
      data-can-destroy-steel={bullet.canDestroySteel}
      data-col={bullet.col}
      data-direction={bullet.direction}
      data-impact-phase={impactPhase}
      data-impact-ticks={bullet.impactTicks}
      data-newborn={bullet.isNewborn}
      data-owner={bullet.owner}
      data-row={bullet.row}
      data-slot={bullet.slot}
      data-strength={bullet.strength}
      data-testid="battle-city-bullet"
      style={getCenteredPositionStyle(
        bullet.row,
        bullet.col,
        renderSize,
      )}
    >
      {isImpact ? (
        <span
          className="size-full bg-contain bg-center bg-no-repeat"
          data-testid="battle-city-bullet-impact"
          style={{
            backgroundImage: `url(${getBattleCityAssetUrl(
              "effect-bullet-impact.png",
            )})`,
          }}
        />
      ) : (
        <span
          className="block size-full bg-contain bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${getBattleCityAssetUrl("projectile.png")})`,
            filter:
              bullet.strength === 2
                ? "drop-shadow(0 0 0.12rem rgba(255, 247, 204, 0.9))"
                : undefined,
            transform: `rotate(${getDirectionRotation(bullet.direction)}deg)`,
          }}
        />
      )}
    </span>
  );
}

function TerrainCell({
  col,
  fragmentMask,
  gameTick,
  row,
  terrain,
}: TerrainCellProps) {
  const backgroundTilingStyle = {
    backgroundPosition: `${col % 2 === 0 ? "0%" : "100%"} ${
      row % 2 === 0 ? "0%" : "100%"
    }`,
    backgroundSize: "200% 200%",
  } satisfies CSSProperties;

  if (terrain === "water") {
    const activeWaterFrame = (gameTick >> 5) & 1;

    return (
      <span
        className="absolute"
        data-col={col}
        data-row={row}
        data-terrain={terrain}
        style={getPositionStyle(row, col)}
      >
        {/* Keep both assets mounted so a frame swap cannot expose the board
            while the browser decodes the newly selected background image. */}
        {([0, 1] as const).map((frame) => (
          <span
            className={cn(
              "absolute inset-0 bg-no-repeat [image-rendering:pixelated]",
              activeWaterFrame === frame ? "opacity-100" : "opacity-0",
            )}
            data-active={activeWaterFrame === frame}
            data-water-frame={frame}
            key={frame}
            style={{
              ...backgroundTilingStyle,
              backgroundImage: `url(${getBattleCityAssetUrl(
                `terrain-water-${frame}.png`,
              )})`,
            }}
          />
        ))}
      </span>
    );
  }

  const backgroundStyle = {
    ...backgroundTilingStyle,
    backgroundImage: `url(${getBattleCityAssetUrl(
      TERRAIN_ASSET_BY_TYPE[terrain],
    )})`,
  } satisfies CSSProperties;

  if ((terrain === "brick" || terrain === "steel") && fragmentMask !== undefined) {
    return (
      <span
        className="absolute"
        data-col={col}
        data-fragment-mask={fragmentMask}
        data-row={row}
        data-terrain={terrain}
        style={getPositionStyle(row, col)}
      >
        {(Object.entries(BATTLE_CITY_TERRAIN_FRAGMENT_BITS) as Array<
          [BattleCityTerrainFragment, number]
        >).map(([fragment, bit]) =>
          (fragmentMask & bit) !== 0 ? (
            <span
              className="absolute inset-0 bg-no-repeat [image-rendering:pixelated]"
              data-terrain-fragment={fragment}
              key={fragment}
              style={{
                ...backgroundStyle,
                clipPath: TERRAIN_FRAGMENT_CLIP_PATH[fragment],
              }}
            />
          ) : null,
        )}
      </span>
    );
  }

  return (
    <span
      className="absolute bg-no-repeat [image-rendering:pixelated]"
      data-col={col}
      data-row={row}
      data-terrain={terrain}
      style={{
        ...getPositionStyle(row, col),
        ...backgroundStyle,
      }}
    />
  );
}

function TankSprite({
  asset,
  children,
  className,
  col,
  dataCarrier,
  dataCarrierActive,
  dataExplosionTicks,
  dataEnemyType,
  dataHitPoints,
  dataMaxHitPoints,
  dataMovementStunTicks,
  dataPaletteId,
  dataPlayerId,
  dataPowerTier,
  dataPlayerPhase,
  dataSpawning,
  dataTestId,
  direction,
  row,
  spriteClassName,
  spriteHidden,
  style,
}: TankSpriteProps) {
  return (
    <span
      className={cn("absolute will-change-[left,top]", className)}
      data-carrier={dataCarrier}
      data-carrier-active={dataCarrierActive}
      data-col={col}
      data-direction={direction}
      data-enemy-type={dataEnemyType}
      data-explosion-ticks={dataExplosionTicks}
      data-hit-points={dataHitPoints}
      data-max-hit-points={dataMaxHitPoints}
      data-movement-stun-ticks={dataMovementStunTicks}
      data-palette-id={dataPaletteId}
      data-player-id={dataPlayerId}
      data-power-tier={dataPowerTier}
      data-player-phase={dataPlayerPhase}
      data-row={row}
      data-spawning={dataSpawning}
      data-testid={dataTestId}
      style={{ ...getPositionStyle(row, col, 2), ...style }}
    >
      <span
        className={cn(
          "absolute inset-0 bg-contain bg-center bg-no-repeat",
          spriteClassName,
          spriteHidden && "opacity-0",
        )}
        style={{
          backgroundImage: `url(${getBattleCityAssetUrl(asset)})`,
          transform: `rotate(${getDirectionRotation(direction)}deg)`,
        }}
      />
      {children}
    </span>
  );
}

function getEnemyPaletteId(
  enemy: BattleCityEnemy,
  gameTick: number,
  isActiveCarrier: boolean,
): EnemyPaletteId {
  if (enemy.spawnTicks > 0 || enemy.explosionTicks > 0) {
    return 2;
  }

  if (isActiveCarrier) {
    return Math.floor(gameTick / BATTLE_CITY_CARRIER_FLASH_TICKS) % 2 === 0
      ? 2
      : 3;
  }

  if (enemy.type !== "armor") {
    return 2;
  }

  const alternateFrame = gameTick % 2 === 1;

  switch (enemy.hitPoints) {
    case 4:
      return alternateFrame ? 2 : 1;
    case 3:
      return alternateFrame ? 2 : 0;
    case 2:
      return alternateFrame ? 1 : 0;
    default:
      return 2;
  }
}

function EnemyTank({
  enemy,
  gameTick,
}: {
  enemy: BattleCityEnemy;
  gameTick: number;
}) {
  const isActiveCarrier =
    enemy.isCarrier &&
    !enemy.hasDroppedPowerUp &&
    enemy.explosionTicks === 0 &&
    enemy.spawnTicks === 0;
  const isShowingPoints =
    enemy.destructionPoints !== null &&
    enemy.explosionTicks > 0 &&
    enemy.explosionTicks <= BATTLE_CITY_ENEMY_SCORE_POPUP_TICKS;
  const isShowingExplosion =
    enemy.explosionTicks > 0 && !isShowingPoints;
  const isCarrierFlashFrame =
    Math.floor(gameTick / BATTLE_CITY_CARRIER_FLASH_TICKS) % 2 === 1;
  const paletteId = getEnemyPaletteId(enemy, gameTick, isActiveCarrier);

  return (
    <TankSprite
      asset={ENEMY_ASSET_BY_TYPE[enemy.type]}
      col={enemy.col}
      dataCarrier={enemy.isCarrier}
      dataCarrierActive={isActiveCarrier}
      dataExplosionTicks={enemy.explosionTicks}
      dataEnemyType={enemy.type}
      dataHitPoints={enemy.hitPoints}
      dataMaxHitPoints={enemy.maxHitPoints}
      dataPaletteId={paletteId}
      dataSpawning={enemy.spawnTicks > 0}
      dataTestId="battle-city-enemy"
      direction={enemy.direction}
      row={enemy.row}
      spriteClassName={cn(
        enemy.type === "armor" &&
          `battle-city-enemy-palette--${paletteId}`,
        isActiveCarrier && "battle-city-carrier-texture",
        isActiveCarrier &&
          isCarrierFlashFrame &&
          "battle-city-carrier-texture--flash",
      )}
      spriteHidden={enemy.explosionTicks > 0 || enemy.spawnTicks > 0}
    >
      {isShowingExplosion ? (
        <TankExplosion ticks={enemy.explosionTicks} />
      ) : null}
      {isShowingPoints && enemy.destructionPoints !== null ? (
        <EnemyPoints points={enemy.destructionPoints} />
      ) : null}
      {enemy.spawnTicks > 0 ? (
        <TankSpawnEffect
          remainingTicks={enemy.spawnTicks}
          testId="battle-city-enemy-spawn"
          totalTicks={BATTLE_CITY_ENEMY_SPAWN_TICKS}
        />
      ) : null}
    </TankSprite>
  );
}

function EnemyPoints({ points }: { points: number }) {
  return (
    <span
      aria-hidden="true"
      className="absolute inset-0 flex items-center justify-center font-mono text-[clamp(0.35rem,1.5vw,0.65rem)] font-bold leading-none text-white [text-shadow:1px_1px_0_#111827]"
      data-point-tile={ENEMY_POINT_TILE_BY_SCORE[points]}
      data-points={points}
      data-testid="battle-city-enemy-points"
    >
      {points}
    </span>
  );
}

function TankSpawnEffect({
  remainingTicks,
  testId,
  totalTicks,
}: {
  remainingTicks: number;
  testId: string;
  totalTicks: number;
}) {
  const tile = getTankSpawnTile(remainingTicks, totalTicks);

  return (
    <span
      className="battle-city-spawn-effect bg-contain bg-center bg-no-repeat"
      data-spawn-tile={tile}
      data-testid={testId}
      style={{
        backgroundImage: `url(${getBattleCityAssetUrl("effect-spawn.png")})`,
      }}
    />
  );
}

function TankExplosion({
  ticks,
  variant = "tank",
}: {
  ticks: number;
  variant?: "headquarters" | "tank";
}) {
  const frame = variant === "headquarters" ? "hq" : getTankExplosionFrame(ticks);

  return (
    <span
      className="battle-city-explosion bg-contain bg-center bg-no-repeat"
      data-explosion-frame={frame}
      data-testid="battle-city-tank-explosion"
      style={{
        backgroundImage: `url(${getBattleCityAssetUrl(
          "effect-tank-explosion.png",
        )})`,
      }}
    />
  );
}

function Headquarters({
  alive,
  col,
  explosionTicks,
  row,
}: {
  alive: boolean;
  col: number;
  explosionTicks: number;
  row: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="absolute z-15 bg-contain bg-center bg-no-repeat"
      data-headquarters-state={alive ? "intact" : "destroyed"}
      data-explosion-ticks={explosionTicks}
      data-testid="battle-city-headquarters"
      style={{
        ...getPositionStyle(row, col, 2),
        backgroundImage: `url(${getBattleCityAssetUrl(
          alive ? "headquarters-intact.png" : "headquarters-destroyed.png",
        )})`,
      }}
    >
      {explosionTicks > 0 ? (
        <TankExplosion ticks={explosionTicks} variant="headquarters" />
      ) : null}
    </span>
  );
}
