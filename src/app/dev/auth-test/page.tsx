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
        message: "Captcha validation failed. Please try again.",
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
    setCaptchaSiteKey(getInvisibleCaptchaKey());
  }, []);

  const onRecaptchaLoad = useCallback(() => {
    setRecaptchaReady(true);
  }, []);

  async function getCaptchaTokens(action: string) {
    if (!captchaSiteKey || !recaptchaReady) return undefined;
    try {
      const token = await new Promise<string>((resolve, reject) => {
        window.grecaptcha.ready(async () => {
          try {
            resolve(
              await window.grecaptcha.execute(captchaSiteKey!, { action }),
            );
          } catch (err) {
            reject(err);
          }
        });
      });
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

      if (mode === "login") {
        const captchaTokens = await getCaptchaTokens("login");
        const response = await wix.auth.login({
          email,
          password,
          captchaTokens,
        });
        handleStateMachine(response, setResult, (sessionToken) =>
          completeLogin(sessionToken, email),
        );
      } else {
        const captchaTokens = await getCaptchaTokens("signup");
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

      const redirectUri = `${window.location.origin}/dev/auth-test/callback`;
      const oauthData = wix.auth.generateOAuthData(redirectUri);
      oauthDataRef.current = oauthData;

      const { authUrl } = await wix.auth.getAuthUrl(oauthData, {
        prompt: "login",
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
        if (event.origin !== window.location.origin) return;
        if (event.data?.source !== "wix-auth-callback") return;

        window.removeEventListener("message", onMessage);
        clearInterval(pollTimer);

        if (event.data.error) {
          setResult({
            state: "error",
            message: event.data.errorDescription || event.data.error,
          });
          return;
        }

        const { code, state } = event.data;
        const storedOauthData = oauthDataRef.current;

        if (!storedOauthData || !code) {
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

      <main className="min-h-screen bg-surface flex items-center justify-center px-4 pb-20 pt-10">
        <div className="w-full max-w-sm">
          <h1 className="font-serif italic text-2xl tracking-tight text-on-surface text-center">
            Welcome
          </h1>
          <div className="mt-3 mx-auto w-12 h-[2px] bg-secondary" />
          <p className="mt-4 text-center text-sm leading-relaxed text-on-surface-variant">
            {mode === "login"
              ? "Sign in to your account"
              : "Create your account to get started"}
          </p>

          {/* Social buttons */}
          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={handleSocialLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 border border-outline-variant/30 bg-surface-container-lowest py-4 text-xs tracking-[0.15em] uppercase font-medium text-on-surface active:scale-[0.98] disabled:opacity-50 transition-colors hover:bg-surface-container-low"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={handleSocialLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 border border-outline-variant/30 bg-surface-container-lowest py-4 text-xs tracking-[0.15em] uppercase font-medium text-on-surface active:scale-[0.98] disabled:opacity-50 transition-colors hover:bg-surface-container-low"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073c0 6.026 4.388 11.022 10.125 11.927v-8.437H7.078v-3.49h3.047V9.41c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796v8.437C19.612 23.095 24 18.1 24 12.073z" />
              </svg>
              Continue with Facebook
            </button>
          </div>

          {/* Divider */}
          <div className="mt-8 flex items-center gap-4">
            <div className="flex-1 h-px bg-surface-container-high" />
            <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
              or continue with email
            </span>
            <div className="flex-1 h-px bg-surface-container-high" />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
                placeholder={
                  mode === "register" ? "Create a password" : undefined
                }
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase active:scale-[0.98] disabled:opacity-50 transition-opacity"
            >
              {isLoading
                ? "Please wait..."
                : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>
          </form>

          {/* Mode toggle */}
          <p className="mt-5 text-center text-xs text-on-surface-variant">
            {mode === "login" ? (
              <>
                New here?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setResult({ state: "idle" });
                  }}
                  className="underline underline-offset-4 font-medium"
                >
                  Create an account
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
                  className="underline underline-offset-4 font-medium"
                >
                  Sign in
                </button>
              </>
            )}
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
        </div>
      </main>
    </>
  );
}
