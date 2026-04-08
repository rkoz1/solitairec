"use client";

import { useEffect, useState } from "react";
import { getBrowserWixClient } from "@/lib/wix-browser-client";
import { getUserIdentity, parseWixTokenUid } from "@/lib/analytics";
import { useSearchParams } from "next/navigation";
import { useMember } from "@/contexts/MemberContext";

const DEBUG_KEY = "solitairec2026";

interface ServerData {
  ip: string;
  userAgent: string;
  fbc: string | null;
  fbp: string | null;
  capiConfigured: boolean;
  pixelId: string | null;
  clarityId: string | null;
  siteUrl: string | null;
  webhookSecretSet: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface mb-4 pb-2 border-b border-outline-variant/20">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, status }: { label: string; value: string; status?: "ok" | "warn" | "fail" }) {
  const color = status === "ok" ? "text-green-700" : status === "fail" ? "text-red-600" : status === "warn" ? "text-amber-600" : "text-on-surface";
  return (
    <div className="flex justify-between items-start gap-4 py-1.5">
      <span className="text-[10px] tracking-[0.15em] uppercase text-on-surface-variant shrink-0">{label}</span>
      <span className={`text-xs text-right break-all font-mono ${color}`}>{value}</span>
    </div>
  );
}

export default function DebugPage() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const { member, isLoggedIn, loading: memberLoading } = useMember();

  const [server, setServer] = useState<ServerData | null>(null);
  const [client, setClient] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (key !== DEBUG_KEY) return;

    // Fetch server-side data
    fetch("/api/debug/identity")
      .then((r) => r.json())
      .then(setServer)
      .catch(() => {});

    // Gather client-side data
    const data: Record<string, string> = {};

    // Consent
    data["cookie_consent"] = localStorage.getItem("cookie_consent") ?? "not set";

    // Meta Pixel
    data["fbq_loaded"] = typeof window.fbq === "function" ? "yes" : "no";

    // Clarity
    data["clarity_loaded"] = typeof window.clarity === "function" ? "yes" : "no";

    // Cookies
    const cookies = document.cookie;
    data["_fbc"] = cookies.match(/(?:^|;\s*)_fbc=([^;]*)/)?.[1] ?? "not set";
    data["_fbp"] = cookies.match(/(?:^|;\s*)_fbp=([^;]*)/)?.[1] ?? "not set";

    // Wix identity
    try {
      const identity = getUserIdentity();
      data["wix_user_id"] = identity.user_id ?? "null";
      data["wix_user_type"] = identity.user_type ?? "null";
    } catch {
      data["wix_user_id"] = "error";
      data["wix_user_type"] = "error";
    }

    // Wix tokens
    try {
      const wix = getBrowserWixClient();
      const tokens = wix.auth.getTokens();
      const raw = tokens as { accessToken?: { value?: string }; refreshToken?: { role?: string } };
      data["wix_token_role"] = raw.refreshToken?.role ?? "unknown";
      data["wix_token_uid"] = raw.accessToken?.value
        ? parseWixTokenUid(raw.accessToken.value) ?? "could not parse"
        : "no access token";
      data["wix_logged_in"] = wix.auth.loggedIn() ? "yes" : "no";
    } catch {
      data["wix_token_role"] = "error";
    }

    setClient(data);
    setLoading(false);
  }, [key]);

  if (key !== DEBUG_KEY) {
    return (
      <section className="px-6 pt-16 pb-24 max-w-lg mx-auto text-center">
        <p className="text-sm text-on-surface-variant">Not found.</p>
      </section>
    );
  }

  return (
    <section className="px-6 pt-12 pb-24 max-w-xl mx-auto">
      <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">Tracking Debug</h1>
      <div className="mt-3 w-12 h-[2px] bg-secondary mb-10" />

      {loading || memberLoading ? (
        <p className="text-sm text-on-surface-variant">Loading...</p>
      ) : (
        <>
          <Section title="Server-Side (what CAPI sees)">
            <Row label="IP Address" value={server?.ip ?? "loading..."} status={server?.ip ? "ok" : "warn"} />
            <Row label="User Agent" value={(server?.userAgent ?? "").slice(0, 80) + "..."} status={server?.userAgent ? "ok" : "warn"} />
            <Row label="_fbc cookie" value={server?.fbc ?? "not set"} status={server?.fbc ? "ok" : "warn"} />
            <Row label="_fbp cookie" value={server?.fbp ?? "not set"} status={server?.fbp ? "ok" : "warn"} />
            <Row label="CAPI Token" value={server?.capiConfigured ? "configured" : "MISSING"} status={server?.capiConfigured ? "ok" : "fail"} />
            <Row label="Pixel ID" value={server?.pixelId ?? "not set"} status={server?.pixelId ? "ok" : "fail"} />
            <Row label="Clarity ID" value={server?.clarityId ?? "not set"} status={server?.clarityId ? "ok" : "fail"} />
            <Row label="Site URL" value={server?.siteUrl ?? "not set"} />
            <Row label="Webhook Secret" value={server?.webhookSecretSet ? "set" : "MISSING"} status={server?.webhookSecretSet ? "ok" : "fail"} />
          </Section>

          <Section title="Client-Side (what Pixel sees)">
            <Row label="Cookie Consent" value={client.cookie_consent} status={client.cookie_consent === "accepted" ? "ok" : "warn"} />
            <Row label="Meta Pixel (fbq)" value={client.fbq_loaded} status={client.fbq_loaded === "yes" ? "ok" : "warn"} />
            <Row label="Clarity" value={client.clarity_loaded} status={client.clarity_loaded === "yes" ? "ok" : "warn"} />
            <Row label="_fbc (browser)" value={client._fbc} status={client._fbc !== "not set" ? "ok" : "warn"} />
            <Row label="_fbp (browser)" value={client._fbp} status={client._fbp !== "not set" ? "ok" : "warn"} />
          </Section>

          <Section title="User Identity">
            <Row label="Wix User ID" value={client.wix_user_id} status={client.wix_user_id !== "null" ? "ok" : "warn"} />
            <Row label="Wix User Type" value={client.wix_user_type} status={client.wix_user_type === "member" ? "ok" : "warn"} />
            <Row label="Wix Token Role" value={client.wix_token_role} />
            <Row label="Wix Token UID" value={client.wix_token_uid} />
            <Row label="Wix Logged In" value={client.wix_logged_in} status={client.wix_logged_in === "yes" ? "ok" : "warn"} />
          </Section>

          <Section title="Member Data (from MemberContext)">
            <Row label="Is Logged In" value={isLoggedIn ? "yes" : "no"} status={isLoggedIn ? "ok" : "warn"} />
            <Row label="Member ID" value={member?._id ?? "none"} />
            <Row label="Email" value={member?.loginEmail ?? "none"} status={member?.loginEmail ? "ok" : "warn"} />
            <Row label="First Name" value={member?.contact?.firstName ?? "none"} status={member?.contact?.firstName ? "ok" : "warn"} />
            <Row label="Last Name" value={member?.contact?.lastName ?? "none"} status={member?.contact?.lastName ? "ok" : "warn"} />
            <Row label="Phone" value={member?.contact?.phones?.[0] ?? "none"} />
          </Section>

          <div className="mt-8 p-4 bg-surface-container-low text-[10px] tracking-wide text-on-surface-variant">
            <p className="font-medium uppercase tracking-[0.2em] mb-2">EMQ Impact Summary</p>
            <p>Green = data sent to Meta CAPI for matching. Yellow = missing, reduces Event Match Quality.</p>
            <p className="mt-2">Key fields: email, phone, firstName, lastName, external_id, _fbc, _fbp, IP, user agent.</p>
          </div>
        </>
      )}
    </section>
  );
}
