const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const MONTH_MS = 30 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

function formatElapsedUnit(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? "" : "s"} ago`;
}

export function formatProfileLastPlayed(value: string, now: Date = new Date()) {
  const playedAtMs = new Date(value).getTime();
  const nowMs = now.getTime();
  const elapsedMs = nowMs - playedAtMs;

  if (!Number.isFinite(playedAtMs) || !Number.isFinite(nowMs) || elapsedMs < MINUTE_MS) {
    return "moments ago";
  }

  if (elapsedMs < HOUR_MS) {
    return formatElapsedUnit(Math.floor(elapsedMs / MINUTE_MS), "minute");
  }

  if (elapsedMs < DAY_MS) {
    return formatElapsedUnit(Math.floor(elapsedMs / HOUR_MS), "hour");
  }

  if (elapsedMs < MONTH_MS) {
    return formatElapsedUnit(Math.floor(elapsedMs / DAY_MS), "day");
  }

  if (elapsedMs < YEAR_MS) {
    return formatElapsedUnit(Math.floor(elapsedMs / MONTH_MS), "month");
  }

  return formatElapsedUnit(Math.floor(elapsedMs / YEAR_MS), "year");
}
