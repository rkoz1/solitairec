"use client";

import { useEffect } from "react";

/**
 * Minimal popup callback page for social login.
 * Wix redirects here after OAuth. This page extracts the code/state
 * from the URL fragment, posts it to the opener window, and closes.
 */
export default function AuthTestCallbackPage() {
  useEffect(() => {
    if (!window.opener) {
      // Not in a popup — redirect to main auth test page
      window.location.href = "/dev/auth-test";
      return;
    }

    // Parse code and state from URL (fragment or query)
    const params = new URLSearchParams(
      window.location.hash
        ? window.location.hash.slice(1)
        : window.location.search,
    );

    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    window.opener.postMessage(
      { source: "wix-auth-callback", code, state, error, errorDescription },
      window.location.origin,
    );

    window.close();
  }, []);

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center">
      <p className="text-sm text-on-surface-variant">
        Completing sign in...
      </p>
    </main>
  );
}
