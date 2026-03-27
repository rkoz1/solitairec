"use server";

import { getServerWixClient } from "@/lib/wix-server-client";

export async function subscribeToNewsletter(
  email: string
): Promise<{ success: boolean; error?: string }> {
  const trimmed = email.trim().toLowerCase();

  if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  try {
    const wix = getServerWixClient();
    await wix.contacts.createContact(
      {
        emails: { items: [{ email: trimmed }] },
      },
      { allowDuplicates: false }
    );
    return { success: true };
  } catch (error) {
    // Duplicate contact = already subscribed — treat as success
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("already exists")) {
      return { success: true, error: "already_subscribed" };
    }
    console.error("Newsletter subscription failed:", error);
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
