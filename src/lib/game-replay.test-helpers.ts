export function withReplayElapsed(
  events: Array<Record<string, unknown> & { tick?: number }>,
) {
  return events.map((event, index) => ({
    ...event,
    elapsedMs: Math.max(0, (event.tick ?? 0) * 1_000 + index),
  }));
}
