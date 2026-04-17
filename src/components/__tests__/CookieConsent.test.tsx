// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, cleanup, fireEvent, screen } from "@testing-library/react";

// Mock next/link to a plain anchor
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

import CookieConsent from "../CookieConsent";

describe("CookieConsent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows banner when no consent stored", () => {
    render(<CookieConsent />);
    expect(screen.getByText("OK")).toBeDefined();
    expect(screen.getByText("No thanks")).toBeDefined();
  });

  it("hides banner when consent is already accepted", () => {
    localStorage.setItem("cookie_consent", "accepted");
    render(<CookieConsent />);
    expect(screen.queryByText("OK")).toBeNull();
  });

  it("hides banner when consent is already rejected", () => {
    localStorage.setItem("cookie_consent", "rejected");
    render(<CookieConsent />);
    expect(screen.queryByText("OK")).toBeNull();
  });

  it("clicking OK sets accepted and dispatches consent-changed", () => {
    const handler = vi.fn();
    window.addEventListener("consent-changed", handler);

    render(<CookieConsent />);
    fireEvent.click(screen.getByText("OK"));

    expect(localStorage.getItem("cookie_consent")).toBe("accepted");
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener("consent-changed", handler);
  });

  it("clicking No thanks sets rejected and dispatches consent-changed", () => {
    const handler = vi.fn();
    window.addEventListener("consent-changed", handler);

    render(<CookieConsent />);
    fireEvent.click(screen.getByText("No thanks"));

    expect(localStorage.getItem("cookie_consent")).toBe("rejected");
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener("consent-changed", handler);
  });

  it("auto-accepts after 10 seconds and dispatches consent-changed", () => {
    const handler = vi.fn();
    window.addEventListener("consent-changed", handler);

    render(<CookieConsent />);

    // Not yet at 10s
    vi.advanceTimersByTime(9999);
    expect(localStorage.getItem("cookie_consent")).toBeNull();
    expect(handler).not.toHaveBeenCalled();

    // At 10s
    vi.advanceTimersByTime(1);
    expect(localStorage.getItem("cookie_consent")).toBe("accepted");
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener("consent-changed", handler);
  });

  it("clicking OK cancels the auto-accept timer", () => {
    render(<CookieConsent />);
    fireEvent.click(screen.getByText("OK"));

    // Advance past auto-accept delay — should not fire again
    vi.advanceTimersByTime(15000);

    // consent-changed should have fired exactly once (from the click)
    expect(localStorage.getItem("cookie_consent")).toBe("accepted");
  });

  it("clicking No thanks cancels the auto-accept timer", () => {
    render(<CookieConsent />);
    fireEvent.click(screen.getByText("No thanks"));

    // Advance past auto-accept delay — should NOT override to accepted
    vi.advanceTimersByTime(15000);

    expect(localStorage.getItem("cookie_consent")).toBe("rejected");
  });
});
