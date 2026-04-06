import type { Metadata } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

export const metadata: Metadata = {
  title: "Refer Friends",
  description:
    "Refer friends to SolitaireC and get a 10% discount for each friend who places an order.",
  alternates: { canonical: `${SITE_URL}/refer-friends` },
};

export default function ReferFriendsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
