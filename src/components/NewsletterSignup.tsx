"use client";

import { useState, useEffect } from "react";
import { subscribeToNewsletter } from "@/app/newsletter/actions";
import { isLoggedIn } from "@/lib/wix-auth";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

const UNSUB_KEY = "solitairec_newsletter_unsub";

export default function NewsletterSignup({ alwaysShow = false }: { alwaysShow?: boolean }) {
  const [email, setEmail] = useState("");
  const [memberEmail, setMemberEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<
    "loading" | "idle" | "submitting" | "success" | "already" | "error"
  >("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Detect logged-in member and auto-check subscription
  useEffect(() => {
    async function detect() {
      // Check local opt-out
      if (localStorage.getItem(UNSUB_KEY)) {
        setStatus("idle");
        return;
      }

      if (isLoggedIn()) {
        try {
          const wix = getBrowserWixClient();
          await ensureVisitorTokens(wix);
          const response = await wix.members.getCurrentMember({
            fieldsets: ["FULL"],
          });
          const member = (response as unknown as { member?: Record<string, unknown> }).member ?? response;
          const m = member as Record<string, unknown>;
          const contact = m.contact as Record<string, unknown> | undefined;
          const resolvedEmail = (m.loginEmail as string) ?? ((contact?.emails as string[])?.[0]) ?? "";

          if (resolvedEmail) {
            setMemberEmail(resolvedEmail);
            // Check if already subscribed
            const result = await subscribeToNewsletter(resolvedEmail);
            if (result.success && result.error === "already_subscribed") {
              setStatus("already");
            } else if (result.success) {
              setStatus("success");
              setTimeout(() => setStatus("already"), 3000);
            } else {
              setStatus("idle");
            }
            return;
          }
        } catch {
          // fall through to idle
        }
      }
      setStatus("idle");
    }
    detect();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const submitEmail = memberEmail ?? email.trim();
    if (!submitEmail) return;

    setStatus("submitting");
    setErrorMsg("");
    localStorage.removeItem(UNSUB_KEY);

    const result = await subscribeToNewsletter(submitEmail);

    if (result.success && result.error === "already_subscribed") {
      setStatus("already");
    } else if (result.success) {
      setStatus("success");
      setEmail("");
      setTimeout(() => setStatus("already"), 4000);
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong.");
    }
  }

  const [fading, setFading] = useState(false);

  // After successful subscribe, fade out the entire component
  useEffect(() => {
    if (status === "success") {
      const timer = setTimeout(() => setFading(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Don't render at all if already subscribed or fully faded
  if (!alwaysShow && (status === "loading" || status === "already")) return null;
  if (!alwaysShow && fading) return null;

  // Dedicated page: show thank-you when already subscribed
  if (alwaysShow && (status === "already" || fading)) {
    return (
      <div className="pt-8 pb-8">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          You&apos;re already subscribed — thank you for staying in touch with
          SolitaireC. We&apos;ll keep you updated on new arrivals, exclusive
          offers, and editorial stories.
        </p>
      </div>
    );
  }

  return (
    <div className={`${alwaysShow ? "pt-0" : "pt-28"} pb-8 transition-opacity duration-1000 ${status === "success" ? "opacity-100" : ""}`}>
      {!alwaysShow && (
        <>
          <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
            Stay in Touch
          </h2>
          <div className="mt-3 w-12 h-[2px] bg-secondary" />
        </>
      )}

      <p className={`${alwaysShow ? "mt-0" : "mt-6"} text-sm leading-relaxed text-on-surface-variant max-w-md`}>
        Be the first to know about new arrivals, exclusive offers, and
        editorial stories.
      </p>

      <div className="mt-8 max-w-md">
        {status === "success" ? (
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary py-5">
            Thank you for subscribing.
          </p>
        ) : memberEmail ? (
          <button
            onClick={handleSubmit as unknown as () => void}
            disabled={status === "submitting"}
            className="bg-on-surface text-on-primary px-6 py-3 text-[10px] tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {status === "submitting" ? "Subscribing..." : "Subscribe"}
          </button>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                required
                className="flex-1 bg-transparent px-0 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/30 focus:border-on-surface transition-colors"
              />
              <button
                type="submit"
                disabled={status === "submitting"}
                className="bg-on-surface text-on-primary px-6 py-3 text-[10px] tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                {status === "submitting" ? "..." : "Subscribe"}
              </button>
            </div>
          </form>
        )}

        {status === "error" && (
          <p className="mt-2 text-[10px] tracking-widest text-secondary">
            {errorMsg}
          </p>
        )}
      </div>
    </div>
  );
}
