/** Retry once on transient network errors (stale sockets after Vercel serverless freeze/thaw). */
export async function fetchRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    const code =
      (err as { cause?: { code?: string } })?.cause?.code ??
      (err as { code?: string })?.code;
    if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "UNKNOWN") {
      return await fn();
    }
    throw err;
  }
}
