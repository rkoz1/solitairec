import { unstable_cache } from "next/cache";

/**
 * Cache wrapper that guarantees `unstable_cache` never sees a circular error
 * from the Wix SDK. Logs failures with a structured prefix for Vercel filtering.
 *
 * On error: sanitized error is re-thrown → `unstable_cache` serves stale data.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyParts: string[],
  options: { revalidate?: number | false; tags?: string[] },
): T {
  return unstable_cache(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (err) {
        const safe = sanitizeError(err);
        console.error(
          `[safeCache] ${keyParts.join("/")} revalidation failed:`,
          safe.message,
        );
        throw safe;
      }
    },
    keyParts,
    options,
  ) as unknown as T;
}

/** Retry once on transient network errors (stale sockets after Vercel serverless freeze/thaw). */
export async function fetchRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (isTransient(err)) {
      try {
        return await fn();
      } catch (retryErr: unknown) {
        throw sanitizeError(retryErr);
      }
    }
    throw sanitizeError(err);
  }
}

function isTransient(err: unknown): boolean {
  const code =
    (err as { cause?: { code?: string } })?.cause?.code ??
    (err as { code?: string })?.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "UNKNOWN" || code === "UND_ERR_SOCKET") {
    return true;
  }
  // Wix SDK wraps network errors in a TypeError with a self-referencing runtimeError
  if (err instanceof TypeError && "runtimeError" in err) {
    return true;
  }
  // Wix SDK errorTransformer crashes trying to JSON.stringify its own circular error
  if (err instanceof TypeError && /circular structure/i.test((err as Error).message)) {
    return true;
  }
  return false;
}

/** Strip circular references so Next.js unstable_cache can JSON.stringify errors */
function sanitizeError(err: unknown): Error {
  if (err instanceof Error) {
    try {
      JSON.stringify(err);
      return err;
    } catch {
      const clean = new Error(err.message);
      clean.name = err.name;
      if (err.stack) clean.stack = err.stack;
      return clean;
    }
  }
  return new Error(String(err));
}
