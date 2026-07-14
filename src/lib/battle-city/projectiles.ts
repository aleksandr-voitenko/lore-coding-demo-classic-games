import {
  BATTLE_CITY_BOARD_SIZE,
  BATTLE_CITY_BULLET_COLLISION_DISTANCE,
  BATTLE_CITY_BULLET_IMPACT_TICKS,
  BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
  BATTLE_CITY_FRIENDLY_FIRE_STUN_TICKS,
  BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS,
  BATTLE_CITY_PIXEL_STEP,
  BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
} from "./constants";
import {
  bulletHitsTank,
  DIRECTION_DELTAS,
  isPointInsideBoard,
  normalizeCoordinate,
  POSITION_EPSILON,
} from "./geometry";
import { selectBattleCityPowerUp } from "./power-ups";
import { addScore, EMPTY_KILL_COUNTS } from "./scoring";
import { isActiveEnemy, isBattleCityMultiplayerGame } from "./state";
import { applyBattleCityTerrainBulletImpact } from "./terrain-fragments";
import type {
  BattleCityBullet,
  BattleCityGameState,
  BattleCityPlayer,
  BattleCityPlayerId,
  BattleCityPowerUp,
  BattleCityRandom,
  BattleCityTerrain,
} from "./types";

export function advanceBullets(
  game: BattleCityGameState,
  random: BattleCityRandom,
): BattleCityGameState {
  let bullets = game.bullets.map((bullet) => ({ ...bullet }));
  let terrain = game.terrain;
  let terrainFragments = game.terrainFragments;
  const enemies = game.enemies.map((enemy) => ({ ...enemy }));
  let player = { ...game.player };
  let player2 = game.player2 ? { ...game.player2 } : null;
  let activePowerUp = game.activePowerUp;
  let powerUpScorePopup = game.powerUpScorePopup;
  let nextPowerUpId = game.nextPowerUpId;
  const destroyedEnemyCount = game.destroyedEnemyCount;
  let score = game.score;
  let lives = game.lives;
  let bonusLifeAwarded = game.bonusLifeAwarded;
  let player2Score = game.player2Score ?? 0;
  let player2Lives = game.player2Lives ?? 0;
  let player2BonusLifeAwarded = game.player2BonusLifeAwarded ?? false;
  let baseAlive = game.baseAlive;
  let baseExplosionTicks = game.baseExplosionTicks;
  const status = game.status;
  let stageKillCounts = { ...game.stageKillCounts };
  let player2StageKillCounts = {
    ...(game.player2StageKillCounts ?? EMPTY_KILL_COUNTS),
  };
  let stageOutcome = game.stageOutcome;
  const stageTransitionTicks = game.stageTransitionTicks;
  // The ROM moves every pre-existing shell through its complete frame distance
  // before its separate terrain, shell, and tank collision passes. Resolving
  // between one-pixel substeps changes which simultaneous impact wins.
  const collisionTestIds = new Set<string>();
  bullets = sortBulletsBySlot(
    bullets.map((bullet) => {
      if (bullet.impactTicks > 0) {
        return bullet;
      }
      collisionTestIds.add(bullet.id);
      if (bullet.isNewborn) {
        return { ...bullet, isNewborn: false };
      }
      const delta = DIRECTION_DELTAS[bullet.direction];
      const moved = {
        ...bullet,
        col: normalizeCoordinate(bullet.col + delta.col * bullet.speed),
        row: normalizeCoordinate(bullet.row + delta.row * bullet.speed),
      };
      if (!isPointInsideBoard(moved.row, moved.col)) {
        return createBulletImpact({
          ...moved,
          col: Math.min(BATTLE_CITY_BOARD_SIZE, Math.max(0, moved.col)),
          row: Math.min(BATTLE_CITY_BOARD_SIZE, Math.max(0, moved.row)),
        });
      }
      return moved;
    }),
  );

  const afterTerrain: BattleCityBullet[] = [];
  for (const bullet of bullets) {
    if (
      bullet.impactTicks > 0 ||
      !collisionTestIds.has(bullet.id) ||
      !shouldResolveBulletTerrain(bullet, game.tick)
    ) {
      afterTerrain.push(bullet);
      continue;
    }

    const terrainImpact = applyBattleCityTerrainBulletImpact(
      terrainFragments,
      terrain,
      {
        col: bullet.col,
        direction: bullet.direction,
        isMaximumPower: bullet.strength === 2,
        row: bullet.row,
      },
    );
    let didImpactTerrain = terrainImpact.didCollide;
    if (terrainImpact.didCollide) {
      terrainFragments = terrainImpact.fragments;
      for (const cell of terrainImpact.cells) {
        if (cell.previousMask !== 0 && cell.nextMask === 0) {
          terrain = replaceTerrainCell(
            terrain,
            cell.cellRow,
            cell.cellCol,
            "empty",
          );
        }
      }
    }

    const hitsHeadquarters = terrainImpact.impacts.some(
      ({ cellCol, cellRow }) =>
        terrain[cellRow]?.[cellCol] === "headquarters",
    );
    if (hitsHeadquarters) {
      didImpactTerrain = true;
      if (baseAlive) {
        baseAlive = false;
        baseExplosionTicks = BATTLE_CITY_HEADQUARTERS_EXPLOSION_TICKS;
        stageOutcome = "lost";
      }
    }
    if (didImpactTerrain) {
      afterTerrain.push(createBulletImpact(bullet));
      continue;
    }

    afterTerrain.push(bullet);
  }

  const cancelledIds = findCancelledBulletIds(afterTerrain);
  const afterBulletCollisions = afterTerrain.filter(
    (bullet) => !cancelledIds.has(bullet.id),
  );
  // Replay schema V1 was recorded with the original solo slot-sorted pass.
  // Keep it byte-for-byte in behavior while multiplayer uses the ROM's full
  // cross-player object-slot ordering below.
  if (!isBattleCityMultiplayerGame(game)) {
    const survivingBullets: BattleCityBullet[] = [];
    for (const bullet of afterBulletCollisions) {
      if (bullet.impactTicks > 0 || !collisionTestIds.has(bullet.id)) {
        survivingBullets.push(bullet);
        continue;
      }

      if (bullet.owner === "player") {
        const enemyIndex = enemies.findIndex(
          (enemy) => isActiveEnemy(enemy) && bulletHitsTank(bullet, enemy),
        );
        if (enemyIndex >= 0) {
          const enemy = enemies[enemyIndex]!;
          if (enemy.isCarrier && !enemy.hasDroppedPowerUp) {
            activePowerUp = createRandomPowerUp(
              player,
              null,
              nextPowerUpId,
              random,
            );
            nextPowerUpId += 1;
            powerUpScorePopup = null;
          }
          const hitPoints = enemy.hitPoints - 1;
          if (hitPoints <= 0) {
            enemies[enemyIndex] = {
              ...enemy,
              destructionPoints: enemy.score,
              explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
              hasDroppedPowerUp: enemy.hasDroppedPowerUp || enemy.isCarrier,
              hitPoints: 0,
            };
            stageKillCounts = {
              ...stageKillCounts,
              [enemy.type]: stageKillCounts[enemy.type] + 1,
            };
            const scored = addScore(
              score,
              lives,
              bonusLifeAwarded,
              enemy.score,
              { canAwardBonusLife: baseAlive && status !== "game-over" },
            );
            score = scored.score;
            lives = scored.lives;
            bonusLifeAwarded = scored.bonusLifeAwarded;
          } else {
            enemies[enemyIndex] = {
              ...enemy,
              hasDroppedPowerUp: enemy.hasDroppedPowerUp || enemy.isCarrier,
              hitPoints,
            };
          }
          survivingBullets.push(createBulletImpact(bullet));
          continue;
        }
      } else if (
        player.phase === "active" &&
        bulletHitsTank(bullet, player)
      ) {
        if (player.invulnerabilityTicks === 0 && player.shieldTicks === 0) {
          player = {
            ...player,
            iceSlideDirection: null,
            iceSlideStepsRemaining: 0,
            phase: "exploding",
            phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
            powerTier: 0,
            shieldTicks: 0,
          };
          survivingBullets.push(createBulletImpact(bullet));
        }
        continue;
      }

      survivingBullets.push(bullet);
    }

    return {
      ...game,
      activePowerUp,
      baseAlive,
      baseExplosionTicks,
      bonusLifeAwarded,
      bullets: sortBulletsBySlot(survivingBullets),
      destroyedEnemyCount,
      enemies,
      lives,
      nextPowerUpId,
      player,
      powerUpScorePopup,
      score,
      stageKillCounts,
      stageOutcome,
      stageTransitionTicks,
      status,
      terrain,
      terrainFragments,
    };
  }
  const bulletState = new Map(
    afterBulletCollisions.map((bullet) => [bullet.id, bullet]),
  );
  const getBulletInSlot = (slot: number) =>
    [...bulletState.values()].find((bullet) => bullet.slot === slot);
  const canResolveTankCollision = (bullet: BattleCityBullet) =>
    bullet.impactTicks === 0 && collisionTestIds.has(bullet.id);

  // The ROM resolves enemy shells against Player 2 and then Player 1 before
  // any player shell can hit an enemy or teammate.
  const enemyBulletIds = afterBulletCollisions
    .filter((bullet) => bullet.owner === "enemy")
    .map((bullet) => bullet.id);
  const enemyShellTargets: readonly BattleCityPlayerId[] = player2
    ? ["player2", "player1"]
    : ["player1"];
  for (const targetId of enemyShellTargets) {
    for (const bulletId of enemyBulletIds) {
      const bullet = bulletState.get(bulletId);
      const target = targetId === "player1" ? player : player2;
      if (
        bullet === undefined ||
        target === null ||
        target.phase !== "active" ||
        !canResolveTankCollision(bullet) ||
        !bulletHitsTank(bullet, target)
      ) {
        continue;
      }
      if (target.invulnerabilityTicks > 0 || target.shieldTicks > 0) {
        bulletState.delete(bulletId);
        continue;
      }

      const explodingPlayer: BattleCityPlayer = {
        ...target,
        iceSlideDirection: null,
        iceSlideStepsRemaining: 0,
        movementStunTicks: 0,
        phase: "exploding",
        phaseTicks: BATTLE_CITY_PLAYER_EXPLOSION_TICKS,
        powerTier: 0,
        shieldTicks: 0,
      };
      if (targetId === "player1") {
        player = explodingPlayer;
      } else {
        player2 = explodingPlayer;
      }
      bulletState.set(bulletId, createBulletImpact(bullet));
    }
  }

  // Next, each enemy slot scans player shell slots in the hardware order.
  const playerBulletSlots = [9, 8, 1, 0] as const;
  const enemyIndexes = enemies
    .map((_, index) => index)
    .sort((first, second) => enemies[second]!.slot - enemies[first]!.slot);
  for (const enemyIndex of enemyIndexes) {
    for (const bulletSlot of playerBulletSlots) {
      const enemy = enemies[enemyIndex]!;
      const bullet = getBulletInSlot(bulletSlot);
      if (!isActiveEnemy(enemy)) {
        break;
      }
      if (
        bullet === undefined ||
        (bullet.owner !== "player" && bullet.owner !== "player2") ||
        !canResolveTankCollision(bullet) ||
        !bulletHitsTank(bullet, enemy)
      ) {
        continue;
      }

      const shooterId: BattleCityPlayerId =
        bullet.owner === "player" ? "player1" : "player2";
      if (enemy.isCarrier && !enemy.hasDroppedPowerUp) {
        activePowerUp = createRandomPowerUp(
          player,
          player2,
          nextPowerUpId,
          random,
        );
        nextPowerUpId += 1;
        powerUpScorePopup = null;
      }
      const hitPoints = enemy.hitPoints - 1;
      if (hitPoints <= 0) {
        enemies[enemyIndex] = {
          ...enemy,
          destructionPoints: enemy.score,
          explosionTicks: BATTLE_CITY_ENEMY_EXPLOSION_TICKS,
          hasDroppedPowerUp: enemy.hasDroppedPowerUp || enemy.isCarrier,
          hitPoints: 0,
        };
        if (shooterId === "player1") {
          stageKillCounts = {
            ...stageKillCounts,
            [enemy.type]: stageKillCounts[enemy.type] + 1,
          };
          const scored = addScore(
            score,
            lives,
            bonusLifeAwarded,
            enemy.score,
            { canAwardBonusLife: baseAlive && status !== "game-over" },
          );
          score = scored.score;
          lives = scored.lives;
          bonusLifeAwarded = scored.bonusLifeAwarded;
        } else {
          player2StageKillCounts = {
            ...player2StageKillCounts,
            [enemy.type]: player2StageKillCounts[enemy.type] + 1,
          };
          const scored = addScore(
            player2Score,
            player2Lives,
            player2BonusLifeAwarded,
            enemy.score,
            { canAwardBonusLife: baseAlive && status !== "game-over" },
          );
          player2Score = scored.score;
          player2Lives = scored.lives;
          player2BonusLifeAwarded = scored.bonusLifeAwarded;
        }
      } else {
        enemies[enemyIndex] = {
          ...enemy,
          hasDroppedPowerUp: enemy.hasDroppedPowerUp || enemy.isCarrier,
          hitPoints,
        };
      }
      bulletState.set(bullet.id, createBulletImpact(bullet));
    }
  }

  // Friendly fire is the final tank-collision pass, again visiting Player 2
  // before Player 1. Protection clears the shell without an impact sprite.
  if (player2 !== null) {
    for (const targetId of ["player2", "player1"] as const) {
      for (const bulletSlot of playerBulletSlots) {
        const target = targetId === "player1" ? player : player2;
        const friendlyOwner = targetId === "player1" ? "player2" : "player";
        const bullet = getBulletInSlot(bulletSlot);
        if (
          target.phase !== "active" ||
          bullet === undefined ||
          bullet.owner !== friendlyOwner ||
          !canResolveTankCollision(bullet) ||
          !bulletHitsTank(bullet, target)
        ) {
          continue;
        }
        if (target.invulnerabilityTicks > 0 || target.shieldTicks > 0) {
          bulletState.delete(bullet.id);
          continue;
        }
        const newlyStunned = (target.movementStunTicks ?? 0) === 0;
        if (newlyStunned) {
          const stunnedPlayer: BattleCityPlayer = {
            ...target,
            movementStunTicks: BATTLE_CITY_FRIENDLY_FIRE_STUN_TICKS,
          };
          if (targetId === "player1") {
            player = stunnedPlayer;
          } else {
            player2 = stunnedPlayer;
          }
        }
        bulletState.set(bullet.id, createBulletImpact(bullet));
        if (newlyStunned) {
          break;
        }
      }
    }
  }

  bullets = sortBulletsBySlot([...bulletState.values()]);

  const multiplayerFields =
    player2 === null
      ? {}
      : {
          player2,
          player2BonusLifeAwarded,
          player2Lives,
          player2Score,
          player2StageKillCounts,
        };

  return {
    ...game,
    activePowerUp,
    baseAlive,
    baseExplosionTicks,
    bonusLifeAwarded,
    bullets,
    destroyedEnemyCount,
    enemies,
    lives,
    nextPowerUpId,
    player,
    powerUpScorePopup,
    score,
    stageKillCounts,
    stageOutcome,
    stageTransitionTicks,
    status,
    terrain,
    terrainFragments,
    ...multiplayerFields,
  };
}

function findCancelledBulletIds(bullets: BattleCityBullet[]): Set<string> {
  const cancelled = new Set<string>();
  // The hardware's outer loop visits only player slots (9, 8, 1, 0). A
  // player shell cleared as the inner member of an earlier pass is skipped,
  // but a player shell that clears itself may still clear additional enemy
  // shells during the remainder of its current inner loop.
  for (const first of bullets) {
    if (
      first.owner === "enemy" ||
      first.impactTicks > 0 ||
      cancelled.has(first.id)
    ) {
      continue;
    }
    for (const second of bullets) {
      if (
        second.id === first.id ||
        second.impactTicks > 0 ||
        second.owner === first.owner ||
        cancelled.has(second.id)
      ) {
        continue;
      }
      if (
        Math.abs(first.col - second.col) <
          BATTLE_CITY_BULLET_COLLISION_DISTANCE &&
        Math.abs(first.row - second.row) <
          BATTLE_CITY_BULLET_COLLISION_DISTANCE
      ) {
        cancelled.add(first.id);
        cancelled.add(second.id);
      }
    }
  }
  return cancelled;
}

function shouldResolveBulletTerrain(
  bullet: BattleCityBullet,
  tick: number,
): boolean {
  const isFast =
    bullet.speed > BATTLE_CITY_PIXEL_STEP * 2 + POSITION_EPSILON ||
    bullet.strength === 2;
  return isFast || ((bullet.slot ^ Math.max(0, tick)) & 1) === 1;
}

export function sortBulletsBySlot(
  bullets: BattleCityBullet[],
): BattleCityBullet[] {
  return [...bullets].sort((first, second) => second.slot - first.slot);
}

function createRandomPowerUp(
  player: BattleCityPlayer,
  player2: BattleCityPlayer | null,
  nextPowerUpId: number,
  random: BattleCityRandom,
): BattleCityPowerUp {
  const activePlayers = [player, player2]
    .filter((candidate): candidate is BattleCityPlayer => candidate !== null)
    .filter((candidate) => candidate.phase === "active");
  // The multiplayer ROM ignores both inactive tank slots, so an empty list
  // deliberately permits every canonical position. Solo retains its V1
  // fallback to the stored player position for replay compatibility.
  const { type, ...position } = selectBattleCityPowerUp(
    player2 !== null ? activePlayers : [player],
    random,
  );
  return {
    ...position,
    id: `power-up-${nextPowerUpId}`,
    type,
  };
}

function replaceTerrainCell(
  terrain: BattleCityTerrain[][],
  row: number,
  col: number,
  value: BattleCityTerrain,
): BattleCityTerrain[][] {
  const next = terrain.map((terrainRow) => [...terrainRow]);
  next[row]![col] = value;
  return next;
}

function createBulletImpact(bullet: BattleCityBullet): BattleCityBullet {
  return {
    ...bullet,
    impactTicks: BATTLE_CITY_BULLET_IMPACT_TICKS,
    isNewborn: false,
  };
}
