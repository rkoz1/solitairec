"use server";

import { getServerWixClient } from "@/lib/wix-server-client";

export async function submitContactForm(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const wix = getServerWixClient();

    // Create or find contact by email
    let contactId: string;
    try {
      const contactResult = await wix.contacts.createContact(
        {
          name: { first: data.name },
          emails: { items: [{ email: data.email }] },
        },
        { allowDuplicates: false }
      );
      contactId = contactResult.contact?._id ?? "";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already exists")) {
        const queryResult = await wix.contacts.queryContacts({
          filter: { "primaryInfo.email": { "$eq": data.email } },
        });
        contactId = queryResult.contacts?.[0]?._id ?? "";
      } else {
        throw err;
      }
    }

    if (!contactId) throw new Error("Failed to resolve contact ID");

    // Get or create inbox conversation for this contact
    const convo = await wix.conversations.getOrCreateConversation({ contactId });
    const conversationId = convo.conversation?._id ?? "";

    if (!conversationId) throw new Error("Failed to create conversation");

    // Send the message to Wix Inbox
    const text = `[Contact Form]\nSubject: ${data.subject}\n\n${data.message}`;
    await wix.messages.sendMessage(conversationId, {
      content: {
        basic: { items: [{ text }] },
        previewText: `Contact Form: ${data.subject}`,
      },
      direction: "PARTICIPANT_TO_BUSINESS",
      visibility: "BUSINESS_AND_PARTICIPANT",
    });

    return { success: true };
  } catch (err) {
    console.error("Contact form submission failed:", err);
    return {
      success: false,
      error: "Something went wrong. Please try again or email us directly.",
    };
  }
}
