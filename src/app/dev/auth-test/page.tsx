"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

const TOKENS_KEY = "wix_tokens";

type AuthResult =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "success"; email: string }
  | { state: "pending"; message: string }
  | { state: "error"; message: string };

declare global {
  interface Window {
    grecaptcha: {
      ready: (cb: () => void) => void;
      execute: (
        siteKey: string,
        options: { action: string },
      ) => Promise<string>;
    };
  }
}

function getInvisibleCaptchaKey(): string | null {
  try {
    const wix = getBrowserWixClient();
    return (wix.auth as any).captchaInvisibleSiteKey || null;
  } catch {
    return null;
  }
}

async function getInvisibleCaptchaToken(siteKey: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.grecaptcha) {
      reject(new Error("reCAPTCHA not loaded"));
      return;
    }
    window.grecaptcha.ready(async () => {
      try {
        const token = await window.grecaptcha.execute(siteKey, {
          action: "login",
        });
        resolve(token);
      } catch (err) {
        reject(err);
      }
    });
  });
}

const ERROR_MESSAGES: Record<string, string> = {
  invalidEmail: "No account found with this email.",
  invalidPassword: "Incorrect password.",
  resetPassword: "Password reset required. Use the Wix login to reset.",
  emailAlreadyExists: "This email is already registered. Try signing in.",
  missingCaptchaToken: "Captcha validation failed. Please try again.",
  invalidCaptchaToken: "Captcha validation failed. Please try again.",
};

function handleStateMachine(
  response: any,
  setResult: (r: AuthResult) => void,
  onSuccess: (sessionToken: string) => void,
) {
  switch (response.loginState) {
    case "SUCCESS":
      onSuccess(response.data.sessionToken);
      break;
    case "EMAIL_VERIFICATION_REQUIRED":
      setResult({
        state: "pending",
        message: "Check your email to verify your account.",
      });
      break;
    case "OWNER_APPROVAL_REQUIRED":
      setResult({
        state: "pending",
        message: "Account created. Awaiting approval.",
      });
      break;
    case "USER_CAPTCHA_REQUIRED":
    case "SILENT_CAPTCHA_REQUIRED":
      setResult({
        state: "error",
        message:
          "Captcha challenge required. The invisible reCAPTCHA was not accepted.",
      });
      break;
    case "FAILURE": {
      const errorCode =
        "errorCode" in response ? response.errorCode : undefined;
      setResult({
        state: "error",
        message:
          (errorCode && ERROR_MESSAGES[errorCode]) ||
          `Failed (${errorCode || "unknown"}).`,
      });
      break;
    }
    default:
      setResult({
        state: "error",
        message: `Unexpected state: ${response.loginState}`,
      });
  }
}

export default function AuthTestPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [result, setResult] = useState<AuthResult>({ state: "idle" });
  const [captchaSiteKey, setCaptchaSiteKey] = useState<string | null>(null);
  const [recaptchaReady, setRecaptchaReady] = useState(false);
  const oauthDataRef = useRef<any>(null);

  useEffect(() => {
    const key = getInvisibleCaptchaKey();
    setCaptchaSiteKey(key);
  }, []);

  const onRecaptchaLoad = useCallback(() => {
    setRecaptchaReady(true);
  }, []);

  async function getCaptchaTokens() {
    if (!captchaSiteKey || !recaptchaReady) return undefined;
    try {
      const token = await getInvisibleCaptchaToken(captchaSiteKey);
      return { invisibleRecaptchaToken: token };
    } catch {
      return undefined;
    }
  }

  async function completeLogin(sessionToken: string, loginEmail: string) {
    const wix = getBrowserWixClient();
    const tokens = await wix.auth.getMemberTokensForDirectLogin(sessionToken);
    wix.auth.setTokens(tokens);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    window.dispatchEvent(new Event("auth-changed"));
    setResult({ state: "success", email: loginEmail });
    setTimeout(() => router.push("/account"), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult({ state: "loading" });

    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const captchaTokens = await getCaptchaTokens();

      if (mode === "login") {
        const response = await wix.auth.login({
          email,
          password,
          captchaTokens,
        });
        handleStateMachine(response, setResult, (sessionToken) =>
          completeLogin(sessionToken, email),
        );
      } else {
        const response = await wix.auth.register({
          email,
          password,
          captchaTokens,
          profile: {
            firstName: firstName || undefined,
            lastName: lastName || undefined,
          },
        });
        handleStateMachine(response, setResult, (sessionToken) =>
          completeLogin(sessionToken, email),
        );
      }
    } catch (err) {
      setResult({
        state: "error",
        message: err instanceof Error ? err.message : "Authentication failed.",
      });
    }
  }

  async function handleSocialLogin() {
    setResult({ state: "loading" });

    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      const redirectUri = `${window.location.origin}/auth/callback`;
      const oauthData = wix.auth.generateOAuthData(redirectUri);
      oauthDataRef.current = oauthData;

      const { authUrl } = await wix.auth.getAuthUrl(oauthData, {
        responseMode: "web_message",
      });

      const popup = window.open(
        authUrl,
        "wix-auth",
        "width=500,height=600,left=200,top=100",
      );

      if (!popup) {
        setResult({
          state: "error",
          message: "Popup blocked. Please allow popups for this site.",
        });
        return;
      }

      function onMessage(event: MessageEvent) {
        // Wix posts back the auth code via postMessage
        if (!event.data?.code && !event.data?.error) return;

        window.removeEventListener("message", onMessage);

        if (event.data.error) {
          setResult({
            state: "error",
            message: event.data.errorDescription || event.data.error,
          });
          return;
        }

        const { code, state } = event.data;
        const storedOauthData = oauthDataRef.current;

        if (!storedOauthData) {
          setResult({ state: "error", message: "Missing OAuth data." });
          return;
        }

        wix.auth
          .getMemberTokens(code, state, storedOauthData)
          .then((tokens: any) => {
            wix.auth.setTokens(tokens);
            localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
            window.dispatchEvent(new Event("auth-changed"));
            setResult({ state: "success", email: "social login" });
            setTimeout(() => router.push("/account"), 2000);
          })
          .catch((err: any) => {
            setResult({
              state: "error",
              message:
                err instanceof Error ? err.message : "Token exchange failed.",
            });
          });
      }

      window.addEventListener("message", onMessage);

      // Poll for popup close (user may close it manually)
      const pollTimer = setInterval(() => {
        if (popup.closed) {
          clearInterval(pollTimer);
          window.removeEventListener("message", onMessage);
          setResult((prev) =>
            prev.state === "loading" ? { state: "idle" } : prev,
          );
        }
      }, 500);
    } catch (err) {
      setResult({
        state: "error",
        message: err instanceof Error ? err.message : "Social login failed.",
      });
    }
  }

  const isLoading = result.state === "loading";

  return (
    <>
      {captchaSiteKey && (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${captchaSiteKey}`}
          onLoad={onRecaptchaLoad}
        />
      )}
      <main className="min-h-screen bg-surface flex items-center justify-center px-4 pb-20">
        <div className="w-full max-w-sm">
          <h1 className="font-serif italic text-2xl tracking-tight text-on-surface text-center">
            {mode === "login" ? "Sign In" : "Create Account"}
          </h1>
          <div className="mt-3 mx-auto w-12 h-[2px] bg-secondary" />
          <p className="mt-4 text-center text-[10px] tracking-[0.25em] uppercase font-medium text-secondary">
            Hidden test page — Direct SDK auth
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            {mode === "register" && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full bg-surface-container-low px-4 py-3.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-outline placeholder:text-on-surface-variant/40"
                    placeholder="First"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full bg-surface-container-low px-4 py-3.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-outline placeholder:text-on-surface-variant/40"
                    placeholder="Last"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-low px-4 py-3.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-outline placeholder:text-on-surface-variant/40"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-container-low px-4 py-3.5 text-sm text-on-surface outline-none focus:ring-1 focus:ring-outline placeholder:text-on-surface-variant/40"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase active:scale-[0.98] disabled:opacity-50"
            >
              {isLoading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-on-surface-variant">
            {mode === "login" ? (
              <>
                No account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setResult({ state: "idle" });
                  }}
                  className="underline underline-offset-4"
                >
                  Create one
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setResult({ state: "idle" });
                  }}
                  className="underline underline-offset-4"
                >
                  Sign in
                </button>
              </>
            )}
          </p>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-surface-container-high" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
              or
            </span>
            <div className="flex-1 h-px bg-surface-container-high" />
          </div>

          {/* Social login via Wix popup */}
          <button
            type="button"
            onClick={handleSocialLogin}
            disabled={isLoading}
            className="mt-8 w-full border border-outline-variant/30 bg-surface-container-lowest py-4 text-xs tracking-[0.2em] uppercase font-medium text-on-surface active:scale-[0.98] disabled:opacity-50"
          >
            Continue with Google / Social
          </button>
          <p className="mt-2 text-center text-[10px] text-on-surface-variant/50">
            Opens Wix login popup with social providers
          </p>

          {/* Result messages */}
          {result.state === "success" && (
            <div className="mt-6 bg-green-50 p-4">
              <p className="text-sm text-green-800 font-medium">
                Authenticated as {result.email}
              </p>
              <p className="text-xs text-green-600 mt-1">
                Redirecting to account...
              </p>
            </div>
          )}

          {result.state === "pending" && (
            <div className="mt-6 bg-amber-50 p-4">
              <p className="text-sm text-amber-800">{result.message}</p>
            </div>
          )}

          {result.state === "error" && (
            <div className="mt-6 bg-red-50 p-4">
              <p className="text-sm text-red-800">{result.message}</p>
            </div>
          )}

          <div className="mt-10 text-center text-[10px] tracking-[0.15em] text-on-surface-variant/50 space-y-1">
            <p>This page is not linked anywhere. For testing only.</p>
            <p>
              Captcha:{" "}
              {captchaSiteKey
                ? recaptchaReady
                  ? "invisible reCAPTCHA loaded"
                  : "loading reCAPTCHA..."
                : "no site key found"}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
