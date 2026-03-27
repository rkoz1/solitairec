"use server";

import { getServerWixClient } from "@/lib/wix-server-client";

export interface ChatMessage {
  _id: string;
  text: string;
  imageUrl?: string;
  direction: "BUSINESS_TO_PARTICIPANT" | "PARTICIPANT_TO_BUSINESS";
  createdDate: string;
}

/**
 * Initialize a chat conversation. Creates a contact if needed,
 * then gets or creates the Inbox conversation.
 */
export interface BusinessInfo {
  name: string;
  avatar?: string;
}

export async function initChat(
  info: { name: string; email: string }
): Promise<{ conversationId: string; business?: BusinessInfo }> {
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

  const biz = result.conversation?.businessDisplayData;
  return {
    conversationId: result.conversation?._id ?? "",
    business: biz?.name ? { name: biz.name, avatar: biz.imageUrl ?? undefined } : undefined,
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

export async function getUploadUrl(
  mimeType: string,
  fileName: string
): Promise<{ uploadUrl: string }> {
  const wix = getServerWixClient();
  const result = await wix.files.generateFileUploadUrl(mimeType, { fileName });
  return { uploadUrl: result.uploadUrl ?? "" };
}

export async function sendChatAttachment(
  conversationId: string,
  url: string,
  filename: string,
  isImage: boolean
): Promise<void> {
  const wix = getServerWixClient();

  const item: Record<string, unknown> = isImage
    ? { image: { url, filename } }
    : { file: { url, filename } };

  await wix.messages.sendMessage(conversationId, {
    content: {
      basic: { items: [item] },
      previewText: isImage ? `[Image: ${filename}]` : `[File: ${filename}]`,
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

  return (result.messages ?? []).map((m) => {
    const firstItem = m.content?.basic?.items?.[0] as Record<string, unknown> | undefined;
    let text = "";
    let imageUrl: string | undefined;

    if (firstItem?.text) {
      text = firstItem.text as string;
    } else if (firstItem?.image) {
      const img = firstItem.image as { url?: string; filename?: string };
      imageUrl = img.url;
      text = img.filename ?? "Photo";
    } else if (firstItem?.file) {
      const file = firstItem.file as { filename?: string };
      text = `[File: ${file.filename ?? "attachment"}]`;
    } else {
      text = m.content?.previewText ?? "";
    }

    return {
      _id: m._id ?? "",
      text,
      imageUrl,
      direction: (m.direction ?? "PARTICIPANT_TO_BUSINESS") as ChatMessage["direction"],
      createdDate: m._createdDate
        ? new Date(m._createdDate).toISOString()
        : "",
    };
  });
}
