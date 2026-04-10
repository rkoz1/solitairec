"use client";

import { useState, useEffect } from "react";
import { getCacheTags, revalidateCacheTag, revalidateAllCacheTags } from "./actions";

type CacheTag = { tag: string; label: string; ttl: string };

export default function CacheAdminPage() {
  const [passkey, setPasskey] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [tags, setTags] = useState<CacheTag[]>([]);
  const [revalidating, setRevalidating] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    timestamp: string;
  } | null>(null);

  useEffect(() => {
    getCacheTags().then((t) => setTags([...t]));
  }, []);

  async function handleRevalidate(tag: string) {
    setRevalidating(tag);
    const result = await revalidateCacheTag(passkey, tag);
    setLastResult({
      ...result,
      timestamp: new Date().toLocaleTimeString(),
    });
    setRevalidating(null);
    if (!result.success && result.message === "Invalid passkey.") {
      setAuthenticated(false);
    }
  }

  async function handleRevalidateAll() {
    setRevalidating("all");
    const result = await revalidateAllCacheTags(passkey);
    setLastResult({
      ...result,
      timestamp: new Date().toLocaleTimeString(),
    });
    setRevalidating(null);
    if (!result.success && result.message === "Invalid passkey.") {
      setAuthenticated(false);
    }
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-surface flex items-center justify-center px-4">
        <div className="w-full max-w-xs">
          <h1 className="font-serif italic text-2xl tracking-tight text-on-surface text-center">
            Cache Admin
          </h1>
          <div className="mt-3 mx-auto w-12 h-[2px] bg-secondary" />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (passkey.trim()) setAuthenticated(true);
            }}
            className="mt-10 space-y-4"
          >
            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
                Passkey
              </label>
              <input
                type="password"
                required
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                className="w-full bg-surface-container-low px-4 py-3.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-outline placeholder:text-on-surface-variant/40"
                placeholder="Enter admin passkey"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-on-surface text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase active:scale-[0.98]"
            >
              Enter
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-surface px-4 py-10 pb-20">
      <div className="max-w-lg mx-auto">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface text-center">
          Cache Admin
        </h1>
        <div className="mt-3 mx-auto w-12 h-[2px] bg-secondary" />

        {/* Result banner */}
        {lastResult && (
          <div
            className={`mt-6 p-3 text-sm ${lastResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
          >
            {lastResult.message}{" "}
            <span className="text-[10px] opacity-60">
              {lastResult.timestamp}
            </span>
          </div>
        )}

        {/* Purge all */}
        <div className="mt-8">
          <button
            onClick={handleRevalidateAll}
            disabled={revalidating !== null}
            className="w-full bg-secondary text-on-secondary py-4 text-xs tracking-[0.25em] font-bold uppercase active:scale-[0.98] disabled:opacity-50"
          >
            {revalidating === "all" ? "Purging..." : "Purge All Caches"}
          </button>
        </div>

        {/* Individual tags */}
        <div className="mt-8 space-y-2">
          {tags.map((t) => (
            <div
              key={t.tag}
              className="flex items-center justify-between bg-surface-container-low px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-on-surface">
                  {t.label}
                </p>
                <p className="text-[10px] tracking-[0.15em] text-on-surface-variant">
                  {t.tag} — TTL: {t.ttl}
                </p>
              </div>
              <button
                onClick={() => handleRevalidate(t.tag)}
                disabled={revalidating !== null}
                className="text-[10px] tracking-[0.2em] uppercase font-bold text-secondary underline underline-offset-4 disabled:opacity-50"
              >
                {revalidating === t.tag ? "..." : "Purge"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
