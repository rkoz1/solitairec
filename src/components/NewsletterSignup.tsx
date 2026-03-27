"use client";

import { useState } from "react";
import { subscribeToNewsletter } from "@/app/newsletter/actions";

export default function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "already" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("submitting");
    setErrorMsg("");

    const result = await subscribeToNewsletter(email);

    if (result.success && result.error === "already_subscribed") {
      setStatus("already");
      setEmail("");
      setTimeout(() => setStatus("idle"), 4000);
    } else if (result.success) {
      setStatus("success");
      setEmail("");
      setTimeout(() => setStatus("idle"), 4000);
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong.");
    }
  }

  return (
    <div className="pt-28 pb-8">
      <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
        Stay in Touch
      </h2>
      <div className="mt-3 w-12 h-[2px] bg-secondary" />

      <p className="mt-6 text-sm leading-relaxed text-on-surface-variant max-w-md">
        Be the first to know about new arrivals, exclusive offers, and
        editorial stories.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 max-w-md">
        {status === "success" ? (
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary py-5">
            Thank you for subscribing.
          </p>
        ) : status === "already" ? (
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface-variant py-5">
            You are already subscribed. Thank you for your support.
          </p>
        ) : (
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
        )}

        {status === "error" && (
          <p className="mt-2 text-[10px] tracking-widest text-secondary">
            {errorMsg}
          </p>
        )}
      </form>
    </div>
  );
}
