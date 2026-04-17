// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { render, cleanup } from "@testing-library/react";

// ---------- Environment variable (must be set before the module loads) ----------
const PIXEL_ID = "205505954064502";
process.env.NEXT_PUBLIC_META_PIXEL_ID = PIXEL_ID;

// ---------- Module mocks ----------
// next/script: render inline children as a no-op so the real fbq queue shim
// doesn't execute in jsdom. We control window.fbq directly via tests.
vi.mock("next/script", () => ({
  default: () => null,
}));

// next/navigation: usePathname is controlled per-test via a mutable ref.
const pathnameRef = { current: "/" };
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameRef.current,
}));

// MemberContext: useMember returns whatever the test sets via memberRef.
type MemberState = {
  member: {
    loginEmail?: string;
    contact?: {
      firstName?: string;
      lastName?: string;
      emails?: string[];
      phones?: string[];
    };
  } | null;
  loading: boolean;
};
const memberRef: { current: MemberState } = {
  current: { member: null, loading: false },
};
vi.mock("@/contexts/MemberContext", () => ({
  useMember: () => memberRef.current,
}));

// wix-browser-client: return a stub client. parseWixTokenUid is mocked separately.
vi.mock("@/lib/wix-browser-client", () => ({
  getBrowserWixClient: () => ({
    auth: {
      getTokens: () => ({ accessToken: { value: "stub-token" } }),
    },
  }),
}));

// analytics: parseWixTokenUid returns a stable uid; resetUserIdentity is a spy.
const resetUserIdentity = vi.fn();
vi.mock("@/lib/analytics", () => ({
  parseWixTokenUid: () => "wix-uid-abc",
  resetUserIdentity,
}));

// meta-track: setMetaUserData / clearMetaUserData are spies.
const setMetaUserData = vi.fn();
const clearMetaUserData = vi.fn();
vi.mock("@/lib/meta-track", () => ({
  setMetaUserData,
  clearMetaUserData,
}));

// ---------- Helpers ----------
function installFbq(): Mock {
  const fbq = vi.fn();
  (window as unknown as { fbq: unknown }).fbq = fbq;
  return fbq;
}

function uninstallFbq() {
  delete (window as unknown as { fbq?: unknown }).fbq;
}

function installFetch(): Mock {
  const fetchMock = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 200 })),
  );
  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return fetchMock;
}

function setMember(state: MemberState) {
  memberRef.current = state;
}

function setPathname(path: string) {
  pathnameRef.current = path;
}

/** Drain whenFbqReady's polling loop + any microtasks. */
async function flushRetries(ms = 2100) {
  await vi.advanceTimersByTimeAsync(ms);
}

/** Get the last track-call's eventID from the fbq mock. */
function lastPageViewEventId(fbq: Mock): string | undefined {
  const trackCalls = fbq.mock.calls.filter((c) => c[0] === "track");
  const last = trackCalls[trackCalls.length - 1];
  return (last?.[3] as { eventID?: string } | undefined)?.eventID;
}

function allPageViewEventIds(fbq: Mock): string[] {
  return fbq.mock.calls
    .filter((c) => c[0] === "track" && c[1] === "PageView")
    .map((c) => (c[3] as { eventID: string }).eventID);
}

function capiBody(fetchMock: Mock, callIndex = 0): Record<string, unknown> {
  const call = fetchMock.mock.calls[callIndex];
  const init = call?.[1] as RequestInit | undefined;
  return JSON.parse(init?.body as string);
}

// ---------- Test suite ----------
describe("MetaPixel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    pathnameRef.current = "/";
    memberRef.current = { member: null, loading: false };
    setMetaUserData.mockClear();
    clearMetaUserData.mockClear();
    resetUserIdentity.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    uninstallFbq();
    vi.useRealTimers();
    vi.resetModules();
  });

  it("fires init + PageView once for an anonymous visitor (loading=false sync)", async () => {
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    // external_id comes from parseWixTokenUid stub even for anonymous
    expect(fbq).toHaveBeenCalledWith("init", PIXEL_ID, {
      external_id: "wix-uid-abc",
    });
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "PageView",
      {},
      expect.objectContaining({ eventID: expect.any(String) }),
    );

    // Exactly one init + one PageView
    expect(fbq.mock.calls.filter((c) => c[0] === "init")).toHaveLength(1);
    expect(allPageViewEventIds(fbq)).toHaveLength(1);

    // CAPI called once with matching eventId
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = capiBody(fetchMock);
    expect(body.eventName).toBe("PageView");
    expect(body.eventId).toBe(lastPageViewEventId(fbq));
    expect(body.externalId).toBe("wix-uid-abc");
    expect(body.userEmail).toBeUndefined();
  });

  it("includes em/fn/ln/ph in init and in the CAPI body for a logged-in member", async () => {
    setMember({
      member: {
        loginEmail: "alice@example.com",
        contact: {
          firstName: "Alice",
          lastName: "Smith",
          phones: ["+1 (555) 123-4567"],
        },
      },
      loading: false,
    });
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    expect(fbq).toHaveBeenCalledWith("init", PIXEL_ID, {
      external_id: "wix-uid-abc",
      em: "alice@example.com",
      fn: "Alice",
      ln: "Smith",
      ph: "15551234567",
    });

    const body = capiBody(fetchMock);
    expect(body.userEmail).toBe("alice@example.com");
    expect(body.firstName).toBe("Alice");
    expect(body.lastName).toBe("Smith");
    expect(body.userPhone).toBe("15551234567");
    expect(body.externalId).toBe("wix-uid-abc");
    expect(body.eventId).toBe(lastPageViewEventId(fbq));

    // setMetaUserData was called so trackMetaEvent has cached data
    expect(setMetaUserData).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
      }),
    );
  });

  it("waits for window.fbq (bounded retry) and fires when it appears", async () => {
    uninstallFbq(); // fbq missing on mount
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    // 1s in: still no fbq → nothing fired
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).not.toHaveBeenCalled();

    // Now inject fbq and advance one tick
    const fbq = installFbq();
    await vi.advanceTimersByTimeAsync(200);
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "PageView",
      {},
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after ~2s if window.fbq never loads", async () => {
    uninstallFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await vi.advanceTimersByTimeAsync(2500); // past the 20×100ms cap
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("safety timeout: fires PageView at 3s if member loading hangs", async () => {
    setMember({ member: null, loading: true }); // Effect A never unblocks
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);

    // Just before timeout — nothing fired
    await vi.advanceTimersByTimeAsync(2999);
    expect(
      fbq.mock.calls.filter((c) => c[0] === "track"),
    ).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();

    // Past timeout — init({}) + PageView fires
    await vi.advanceTimersByTimeAsync(300);
    expect(fbq).toHaveBeenCalledWith("init", PIXEL_ID, {});
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "PageView",
      {},
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("safety timeout is a no-op if Effect A already fired first PageView", async () => {
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries(); // Effect A fires first PageView immediately
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance past the 3s safety timeout — should NOT double-fire
    await vi.advanceTimersByTimeAsync(4000);
    expect(
      fbq.mock.calls.filter((c) => c[0] === "track" && c[1] === "PageView"),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("fires PageView on SPA navigation with a new eventId", async () => {
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    const { rerender } = render(<MetaPixel />);
    await flushRetries();
    const firstId = lastPageViewEventId(fbq);

    // Navigate SPA-style
    setPathname("/products/alpha");
    rerender(<MetaPixel />);
    await flushRetries();

    const ids = allPageViewEventIds(fbq);
    expect(ids).toHaveLength(2);
    expect(ids[1]).not.toBe(firstId);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Second CAPI eventId matches second pixel eventId
    expect(capiBody(fetchMock, 1).eventId).toBe(ids[1]);
  });

  it("does NOT double-fire when pathname doesn't change between renders", async () => {
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    const { rerender } = render(<MetaPixel />);
    await flushRetries();

    // Rerender without pathname change
    rerender(<MetaPixel />);
    await flushRetries();

    expect(allPageViewEventIds(fbq)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("pixel and CAPI share the same eventId for dedup", async () => {
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    const pixelId = lastPageViewEventId(fbq);
    const capiId = capiBody(fetchMock).eventId;
    expect(pixelId).toBeDefined();
    expect(pixelId).toBe(capiId);
  });

  it("auth-changed event resets state and re-fires on next member load", async () => {
    setMember({
      member: { loginEmail: "a@b.com", contact: {} },
      loading: false,
    });
    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    const { rerender } = render(<MetaPixel />);
    await flushRetries();
    expect(allPageViewEventIds(fbq)).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Simulate logout → auth-changed event
    window.dispatchEvent(new Event("auth-changed"));
    expect(clearMetaUserData).toHaveBeenCalled();
    expect(resetUserIdentity).toHaveBeenCalled();

    // Member becomes anonymous, rerender, expect a fresh PageView
    setMember({ member: null, loading: false });
    // Force Effect A to re-run by changing path (refs alone can't trigger)
    setPathname("/after-logout");
    rerender(<MetaPixel />);
    await flushRetries();

    expect(allPageViewEventIds(fbq).length).toBeGreaterThanOrEqual(2);
    const ids = allPageViewEventIds(fbq);
    expect(ids[1]).not.toBe(ids[0]);
  });

  it("renders nothing if NEXT_PUBLIC_META_PIXEL_ID is unset", async () => {
    const prev = process.env.NEXT_PUBLIC_META_PIXEL_ID;
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    vi.resetModules();

    const fbq = installFbq();
    const fetchMock = installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    expect(fbq).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.NEXT_PUBLIC_META_PIXEL_ID = prev;
  });

  it("grants consent on mount when localStorage has accepted", async () => {
    localStorage.setItem("cookie_consent", "accepted");
    const fbq = installFbq();
    installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    const consentCalls = fbq.mock.calls.filter(
      (c) => c[0] === "consent" && c[1] === "grant",
    );
    expect(consentCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("does not grant consent on mount when undecided", async () => {
    // No localStorage value
    const fbq = installFbq();
    installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    const grantCalls = fbq.mock.calls.filter(
      (c) => c[0] === "consent" && c[1] === "grant",
    );
    expect(grantCalls).toHaveLength(0);
  });

  it("grants consent on consent-changed event", async () => {
    const fbq = installFbq();
    installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    // Simulate consent acceptance
    localStorage.setItem("cookie_consent", "accepted");
    window.dispatchEvent(new Event("consent-changed"));
    await flushRetries();

    const grantCalls = fbq.mock.calls.filter(
      (c) => c[0] === "consent" && c[1] === "grant",
    );
    expect(grantCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("revokes consent on consent-changed event with rejected", async () => {
    const fbq = installFbq();
    installFetch();
    const { default: MetaPixel } = await import("../MetaPixel");

    render(<MetaPixel />);
    await flushRetries();

    localStorage.setItem("cookie_consent", "rejected");
    window.dispatchEvent(new Event("consent-changed"));
    await flushRetries();

    const revokeCalls = fbq.mock.calls.filter(
      (c) => c[0] === "consent" && c[1] === "revoke",
    );
    expect(revokeCalls.length).toBeGreaterThanOrEqual(1);
  });
});
