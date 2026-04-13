export function logEvent(level: "info" | "warn" | "error", event: string, details: Record<string, unknown> = {}): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details,
  };

  console.log(JSON.stringify(payload));
}
