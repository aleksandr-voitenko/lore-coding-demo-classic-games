import type { BattleCityPlayer } from "./types";

export const BATTLE_CITY_ASSET_VERSION = "modern-v1";

export const BATTLE_CITY_PLAYER_ASSET_BY_POWER_TIER = {
  0: "tank-player-tier-0.png",
  1: "tank-player-tier-1.png",
  2: "tank-player-tier-2.png",
  3: "tank-player-tier-3.png",
} as const satisfies Record<BattleCityPlayer["powerTier"], string>;

export function getBattleCityAssetUrl(filename: string) {
  return `/images/battle-city/${filename}?v=${BATTLE_CITY_ASSET_VERSION}`;
}
