"use client";

import { useState, type FormEvent } from "react";
import { submitContactForm } from "./actions";
import { trackAnalytics } from "@/lib/analytics";

type Status = "idle" | "submitting" | "success" | "error";

export default function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    const form = e.currentTarget;
    const data = new FormData(form);

    const result = await submitContactForm({
      name: data.get("name") as string,
      email: data.get("email") as string,
      subject: data.get("subject") as string,
      message: data.get("message") as string,
    });

    if (result.success) {
      setStatus("success");
      trackAnalytics("contact_form_submit", { subject: data.get("subject") as string });
      form.reset();
    } else {
      setStatus("error");
      setErrorMsg(result.error ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="contact-name"
          className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant"
        >
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          required
          className="w-full mt-2 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary"
          placeholder="Your name"
        />
      </div>

      <div>
        <label
          htmlFor="contact-email"
          className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant"
        >
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          className="w-full mt-2 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary"
          placeholder="your@email.com"
        />
      </div>

      <div>
        <label
          htmlFor="contact-subject"
          className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant"
        >
          Subject
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          required
          className="w-full mt-2 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary"
          placeholder="What is this regarding?"
        />
      </div>

      <div>
        <label
          htmlFor="contact-message"
          className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant"
        >
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          className="w-full mt-2 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary resize-none"
          placeholder="Type your message here..."
        />
      </div>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-on-surface text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {status === "submitting" ? "Sending..." : "Send Message"}
      </button>

      {status === "success" && (
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary text-center">
          Thank you — we&apos;ll get back to you shortly.
        </p>
      )}

      {status === "error" && (
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-red-600 text-center">
          {errorMsg}
        </p>
      )}
    </form>
  );
}
