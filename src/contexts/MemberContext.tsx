"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getBrowserWixClient, ensureVisitorTokens } from "@/lib/wix-browser-client";
import { isLoggedIn } from "@/lib/wix-auth";

export interface MemberData {
  _id?: string;
  loginEmail?: string;
  contact?: {
    firstName?: string;
    lastName?: string;
    emails?: string[];
    phones?: string[];
    addresses?: Record<string, unknown>[];
  };
  profile?: {
    nickname?: string;
  };
}

interface MemberContextValue {
  member: MemberData | null;
  isLoggedIn: boolean;
  loading: boolean;
  refetch: () => void;
}

const MemberContext = createContext<MemberContextValue>({
  member: null,
  isLoggedIn: false,
  loading: true,
  refetch: () => {},
});

export function MemberProvider({ children }: { children: ReactNode }) {
  const [member, setMember] = useState<MemberData | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchMember = useCallback(async (reason?: string) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[MemberContext] fetching...${reason ? ` (${reason})` : ""}`);
    }

    if (!isLoggedIn()) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[MemberContext] no member (visitor)");
      }
      setMember(null);
      setLoggedIn(false);
      setLoading(false);
      return;
    }

    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const response = await wix.members.getCurrentMember({ fieldsets: ["FULL"] });
      const res = response as { member?: MemberData } & MemberData;
      const m = res.member ?? res;

      setMember(m);
      setLoggedIn(true);

      if (process.env.NODE_ENV === "development") {
        console.debug("[MemberContext] loaded:", {
          memberId: m._id,
          email: m.loginEmail ?? m.contact?.emails?.[0],
          firstName: m.contact?.firstName,
          isLoggedIn: true,
        });
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.debug("[MemberContext] error:", err instanceof Error ? err.message : err);
      }
      setMember(null);
      setLoggedIn(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMember("initial");

    const handler = () => {
      if (process.env.NODE_ENV === "development") {
        console.debug("[MemberContext] re-fetching (auth-changed)");
      }
      setLoading(true);
      fetchMember("auth-changed");
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, [fetchMember]);

  return (
    <MemberContext.Provider value={{ member, isLoggedIn: loggedIn, loading, refetch: () => fetchMember("manual") }}>
      {children}
    </MemberContext.Provider>
  );
}

export function useMember() {
  return useContext(MemberContext);
}
