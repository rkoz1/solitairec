type LogLevel = "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  action: string;
  details?: Record<string, unknown>;
  error?: unknown;
}

export function log({ level, action, details, error }: LogEntry) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    action,
    ...details,
    ...(error instanceof Error
      ? { error: error.message, stack: error.stack }
      : error
        ? { error: String(error) }
        : {}),
  };

  if (level === "error") {
    console.error(`[${action}]`, JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(`[${action}]`, JSON.stringify(entry));
  } else {
    console.log(`[${action}]`, JSON.stringify(entry));
  }
}
