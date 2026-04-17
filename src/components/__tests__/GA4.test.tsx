// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

// ---------- Environment variable ----------
const GA4_ID = "G-TEST123";
process.env.NEXT_PUBLIC_GA4_ID = GA4_ID;

// ---------- Module mocks ----------
let lastInlineHtml: string | null = null;
vi.mock("next/script", () => ({
  default: (props: { dangerouslySetInnerHTML?: { __html: string }; src?: string }) => {
    if (props.dangerouslySetInnerHTML?.__html) {
      lastInlineHtml = props.dangerouslySetInnerHTML.__html;
    }
    return null;
  },
}));

const ga4Consent = vi.fn();
vi.mock("@/lib/ga4", () => ({ ga4Consent }));

// ---------- Helpers ----------
function installGtag() {
  const gtag = vi.fn();
  (window as unknown as { gtag: unknown }).gtag = gtag;
  (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  return gtag;
}

function uninstallGtag() {
  delete (window as unknown as { gtag?: unknown }).gtag;
  delete (window as unknown as { dataLayer?: unknown }).dataLayer;
}

/** Execute the consent portion of the inline script (after gtag setup). */
function execInlineConsentScript() {
  if (!lastInlineHtml) return;
  const idx = lastInlineHtml.indexOf("try {");
  if (idx === -1) return;
  // eslint-disable-next-line no-eval
  eval(lastInlineHtml.substring(idx));
}

// ---------- Tests ----------
describe("GA4", () => {
  beforeEach(() => {
    ga4Consent.mockClear();
    lastInlineHtml = null;
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    uninstallGtag();
    vi.resetModules();
  });

  it("inline script grants consent when localStorage has accepted", async () => {
    localStorage.setItem("cookie_consent", "accepted");
    const gtag = installGtag();
    const { default: GA4 } = await import("../GA4");

    render(<GA4 />);
    execInlineConsentScript();

    const consentCalls = gtag.mock.calls.filter(
      (c) => c[0] === "consent" && c[1] === "update",
    );
    expect(consentCalls).toHaveLength(1);
    expect(consentCalls[0][2]).toEqual({ analytics_storage: "granted" });
  });

  it("inline script does NOT grant consent when undecided", async () => {
    const gtag = installGtag();
    const { default: GA4 } = await import("../GA4");

    render(<GA4 />);
    execInlineConsentScript();

    const consentCalls = gtag.mock.calls.filter(
      (c) => c[0] === "consent" && c[1] === "update",
    );
    expect(consentCalls).toHaveLength(0);
  });

  it("consent-changed event triggers ga4Consent(true) for accepted", async () => {
    installGtag();
    const { default: GA4 } = await import("../GA4");

    render(<GA4 />);

    localStorage.setItem("cookie_consent", "accepted");
    window.dispatchEvent(new Event("consent-changed"));

    expect(ga4Consent).toHaveBeenCalledWith(true);
  });

  it("consent-changed event triggers ga4Consent(false) for rejected", async () => {
    installGtag();
    const { default: GA4 } = await import("../GA4");

    render(<GA4 />);

    localStorage.setItem("cookie_consent", "rejected");
    window.dispatchEvent(new Event("consent-changed"));

    expect(ga4Consent).toHaveBeenCalledWith(false);
  });

  it("renders nothing when GA4_ID is unset", async () => {
    const prev = process.env.NEXT_PUBLIC_GA4_ID;
    delete process.env.NEXT_PUBLIC_GA4_ID;
    vi.resetModules();

    const gtag = installGtag();
    const { default: GA4 } = await import("../GA4");

    render(<GA4 />);

    expect(gtag).not.toHaveBeenCalled();
    expect(ga4Consent).not.toHaveBeenCalled();
    expect(lastInlineHtml).toBeNull();

    process.env.NEXT_PUBLIC_GA4_ID = prev;
  });
});
