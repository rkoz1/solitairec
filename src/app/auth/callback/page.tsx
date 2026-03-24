"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { handleCallback } from "@/lib/wix-auth";
import LoadingIndicator from "@/components/LoadingIndicator";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback().then((result) => {
      if (result.success) {
        router.push("/account");
      } else {
        setError(result.error ?? "Authentication failed.");
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <section className="px-5">
        <div className="pt-12 pb-10">
          <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
            Sign In Failed
          </h2>
          <div className="mt-3 w-12 h-[2px] bg-secondary" />
        </div>
        <div className="max-w-md">
          <p className="text-sm leading-relaxed text-on-surface-variant">{error}</p>
          <Link
            href="/account"
            className="mt-8 inline-block text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
          >
            Try Again
          </Link>
        </div>
      </section>
    );
  }

  return <LoadingIndicator />;
}
