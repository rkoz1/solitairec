"use server";

import { getServerWixClient } from "@/lib/wix-server-client";

export interface ChatMessage {
  _id: string;
  text: string;
  direction: "BUSINESS_TO_PARTICIPANT" | "PARTICIPANT_TO_BUSINESS";
  createdDate: string;
}

/**
 * Initialize a chat conversation. Creates a contact if needed,
 * then gets or creates the Inbox conversation.
 */
export async function initChat(
  info: { name: string; email: string }
): Promise<{ conversationId: string }> {
  const wix = getServerWixClient();

  // Create or find contact by email
  let contactId: string;
  try {
    const contactResult = await wix.contacts.createContact(
      {
        name: { first: info.name },
        emails: { items: [{ email: info.email }] },
      },
      { allowDuplicates: false }
    );
    contactId = contactResult.contact?._id ?? "";
  } catch (err) {
    // Duplicate contact — find existing by querying
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("already exists")) {
      // Search for existing contact by email
      const queryResult = await wix.contacts.queryContacts({
        filter: { "primaryInfo.email": { "$eq": info.email } },
      });
      contactId = queryResult.contacts?.[0]?._id ?? "";
    } else {
      throw err;
    }
  }

  if (!contactId) throw new Error("Failed to resolve contact ID");

  const result = await wix.conversations.getOrCreateConversation({ contactId });

  return {
    conversationId: result.conversation?._id ?? "",
  };
}

export async function sendChatMessage(
  conversationId: string,
  text: string
): Promise<void> {
  const wix = getServerWixClient();
  await wix.messages.sendMessage(conversationId, {
    content: {
      basic: {
        items: [{ text }],
      },
      previewText: text,
    },
    direction: "PARTICIPANT_TO_BUSINESS",
    visibility: "BUSINESS_AND_PARTICIPANT",
  });
}

export async function listChatMessages(
  conversationId: string
): Promise<ChatMessage[]> {
  const wix = getServerWixClient();
  const result = await wix.messages.listMessages(
    conversationId,
    "BUSINESS_AND_PARTICIPANT",
    {
      paging: { limit: 50 },
      sorting: { fieldName: "sequence", order: "ASC" },
    }
  );

  return (result.messages ?? []).map((m) => ({
    _id: m._id ?? "",
    text:
      m.content?.basic?.items?.[0]?.text ??
      m.content?.previewText ??
      "",
    direction: (m.direction ?? "PARTICIPANT_TO_BUSINESS") as ChatMessage["direction"],
    createdDate: m._createdDate
      ? new Date(m._createdDate).toISOString()
      : "",
  }));
}
