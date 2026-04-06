/** Retry once on transient network errors (stale sockets after Vercel serverless freeze/thaw). */
export async function fetchRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: unknown) {
    if (isTransient(err)) {
      return await fn();
    }
    throw err;
  }
}

function isTransient(err: unknown): boolean {
  const code =
    (err as { cause?: { code?: string } })?.cause?.code ??
    (err as { code?: string })?.code;
  if (code === "ECONNRESET" || code === "ETIMEDOUT" || code === "UNKNOWN" || code === "UND_ERR_SOCKET") {
    return true;
  }
  // Wix SDK wraps network errors in a TypeError with circular runtimeError,
  // then JSON.stringify fails — detect that serialization failure
  const msg = (err as { message?: string })?.message ?? "";
  if (msg.includes("circular structure")) {
    return true;
  }
  return false;
}
