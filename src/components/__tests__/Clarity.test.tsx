// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";

// ---------- Environment variable (must be set before the module loads) ----------
const CLARITY_ID = "w6h2oz2zah";
process.env.NEXT_PUBLIC_CLARITY_ID = CLARITY_ID;

// ---------- Module mocks ----------
// next/script: capture dangerouslySetInnerHTML so we can execute the inline
// consent logic in tests, while avoiding real DOM script injection.
let lastInlineHtml: string | null = null;
vi.mock("next/script", () => ({
  default: (props: { dangerouslySetInnerHTML?: { __html: string } }) => {
    lastInlineHtml = props.dangerouslySetInnerHTML?.__html ?? null;
    return null;
  },
}));

// next/navigation
const pathnameRef = { current: "/" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

// MemberContext
type MemberState = {
  member: {
    _id?: string;
    loginEmail?: string;
    contact?: { firstName?: string; lastName?: string };
  } | null;
  loading: boolean;
};
const memberRef: { current: MemberState } = {
  current: { member: null, loading: false },
};
vi.mock("@/contexts/MemberContext", () => ({
  useMember: () => memberRef.current,
}));

// analytics
const resetUserIdentity = vi.fn();
vi.mock("@/lib/analytics", () => ({
  getUserIdentity: () => ({ user_id: "wix-uid-123", user_type: userTypeRef.current }),
  resetUserIdentity,
}));
const userTypeRef = { current: "visitor" as "visitor" | "member" };

// clarity lib — spy on clarityConsent so we can verify the React useEffect calls
const clarityConsent = vi.fn();
vi.mock("@/lib/clarity", () => ({
  clarityConsent,
}));

// ---------- Helpers ----------
function installClarity() {
  const clarity = vi.fn();
  (window as unknown as { clarity: unknown }).clarity = clarity;
  return clarity;
}

function uninstallClarity() {
  delete (window as unknown as { clarity?: unknown }).clarity;
}

function setMember(state: MemberState) {
  memberRef.current = state;
}

function setPathname(path: string) {
  pathnameRef.current = path;
}

function setUserType(type: "visitor" | "member") {
  userTypeRef.current = type;
}

/** Execute only the consent portion of the inline script (after the SDK loader IIFE). */
function execInlineConsentScript() {
  if (!lastInlineHtml) return;
  // The inline script has two parts:
  // 1. The Clarity SDK loader IIFE: (function(c,l,a,r,i,t,y){...})(window,...);
  // 2. The consent block: try { var cs = ... } catch(e) {}
  // We only want to run part 2. Split on the closing of the IIFE.
  const idx = lastInlineHtml.indexOf("try {");
  if (idx === -1) return;
  const consentCode = lastInlineHtml.substring(idx);
  // eslint-disable-next-line no-eval
  eval(consentCode);
}

// ---------- Test suite ----------
describe("Clarity", () => {
  beforeEach(() => {
    pathnameRef.current = "/";
    memberRef.current = { member: null, loading: false };
    userTypeRef.current = "visitor";
    clarityConsent.mockClear();
    resetUserIdentity.mockClear();
    lastInlineHtml = null;
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    uninstallClarity();
    vi.resetModules();
  });

  it("inline script queues consentv2 with analytical:true when consent is accepted", async () => {
    localStorage.setItem("cookie_consent", "accepted");
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);
    execInlineConsentScript();

    // The inline script should have called window.clarity("consentv2", ...)
    const consentCalls = clarity.mock.calls.filter(
      (c) => c[0] === "consentv2",
    );
    expect(consentCalls).toHaveLength(1);
    expect(consentCalls[0][1]).toEqual({ analytical: true });
  });

  it("inline script queues consentv2 with analytical:false when consent is rejected", async () => {
    localStorage.setItem("cookie_consent", "rejected");
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);
    execInlineConsentScript();

    const consentCalls = clarity.mock.calls.filter(
      (c) => c[0] === "consentv2",
    );
    expect(consentCalls).toHaveLength(1);
    expect(consentCalls[0][1]).toEqual({ analytical: false });
  });

  it("inline script does NOT queue consentv2 when consent is undecided", async () => {
    // No localStorage value set — undecided
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);
    execInlineConsentScript();

    const consentCalls = clarity.mock.calls.filter(
      (c) => c[0] === "consentv2",
    );
    expect(consentCalls).toHaveLength(0);
  });

  it("consent-changed event triggers clarityConsent(true) for accepted", async () => {
    installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    // Simulate user accepting cookies
    localStorage.setItem("cookie_consent", "accepted");
    window.dispatchEvent(new Event("consent-changed"));

    expect(clarityConsent).toHaveBeenCalledWith(true);
  });

  it("consent-changed event triggers clarityConsent(false) for rejected", async () => {
    installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    localStorage.setItem("cookie_consent", "rejected");
    window.dispatchEvent(new Event("consent-changed"));

    expect(clarityConsent).toHaveBeenCalledWith(false);
  });

  it("identifies user on mount with member data", async () => {
    setUserType("member");
    setMember({
      member: {
        _id: "member-456",
        loginEmail: "alice@example.com",
        contact: { firstName: "Alice", lastName: "Smith" },
      },
      loading: false,
    });
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    // identify call: (clarityId, undefined, pathname, friendlyName)
    const identifyCalls = clarity.mock.calls.filter(
      (c) => c[0] === "identify",
    );
    expect(identifyCalls).toHaveLength(1);
    expect(identifyCalls[0][1]).toBe("member-456");
    expect(identifyCalls[0][3]).toBe("/");
    expect(identifyCalls[0][4]).toBe("Alice Smith");

    // set user_type and member_id
    const setCalls = clarity.mock.calls.filter((c) => c[0] === "set");
    expect(setCalls).toContainEqual(["set", "user_type", "member"]);
    expect(setCalls).toContainEqual(["set", "member_id", "member-456"]);
  });

  it("uses fallback 'Visitor' name for anonymous users", async () => {
    setUserType("visitor");
    setMember({ member: null, loading: false });
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    const identifyCalls = clarity.mock.calls.filter(
      (c) => c[0] === "identify",
    );
    expect(identifyCalls).toHaveLength(1);
    expect(identifyCalls[0][1]).toBe("wix-uid-123");
    expect(identifyCalls[0][4]).toBe("Visitor");
  });

  it("uses fallback 'Member' name when member has no contact name", async () => {
    setUserType("member");
    setMember({ member: { _id: "m-789" }, loading: false });
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    const identifyCalls = clarity.mock.calls.filter(
      (c) => c[0] === "identify",
    );
    expect(identifyCalls).toHaveLength(1);
    expect(identifyCalls[0][4]).toBe("Member");
  });

  it("re-identifies on route change with new pathname", async () => {
    setUserType("visitor");
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    const { rerender } = render(<Clarity />);

    // Navigate
    setPathname("/products/alpha");
    rerender(<Clarity />);

    const identifyCalls = clarity.mock.calls.filter(
      (c) => c[0] === "identify",
    );
    expect(identifyCalls).toHaveLength(2);
    expect(identifyCalls[0][3]).toBe("/");
    expect(identifyCalls[1][3]).toBe("/products/alpha");
  });

  it("re-identifies on auth-changed event and resets identity", async () => {
    setUserType("member");
    setMember({
      member: { _id: "m-1", contact: { firstName: "Bob" } },
      loading: false,
    });
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    // Simulate logout
    window.dispatchEvent(new Event("auth-changed"));

    expect(resetUserIdentity).toHaveBeenCalled();
    // Should have called identify again (once on mount, once on auth-changed)
    const identifyCalls = clarity.mock.calls.filter(
      (c) => c[0] === "identify",
    );
    expect(identifyCalls.length).toBeGreaterThanOrEqual(2);
  });

  it("does not identify when loading is true", async () => {
    setMember({ member: null, loading: true });
    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    const identifyCalls = clarity.mock.calls.filter(
      (c) => c[0] === "identify",
    );
    expect(identifyCalls).toHaveLength(0);
  });

  it("renders nothing when CLARITY_ID is unset", async () => {
    const prev = process.env.NEXT_PUBLIC_CLARITY_ID;
    delete process.env.NEXT_PUBLIC_CLARITY_ID;
    vi.resetModules();

    const clarity = installClarity();
    const { default: Clarity } = await import("../Clarity");

    render(<Clarity />);

    // No identify, no consent calls
    expect(clarity).not.toHaveBeenCalled();
    expect(clarityConsent).not.toHaveBeenCalled();
    expect(lastInlineHtml).toBeNull();

    process.env.NEXT_PUBLIC_CLARITY_ID = prev;
  });
});
