"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  initChat,
  sendChatMessage,
  getUploadUrl,
  sendChatAttachment,
  listChatMessages,
  type ChatMessage,
  type BusinessInfo,
} from "@/app/chat/actions";
import { useMember } from "@/contexts/MemberContext";

const CONV_KEY_PREFIX = "solitairec_chat_conv_";

// Business hours: 9am–6pm HKT (UTC+8), Monday–Saturday
function isBusinessHours(): boolean {
  const now = new Date();
  const hkt = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Hong_Kong" }));
  const day = hkt.getDay(); // 0=Sun
  const hour = hkt.getHours();
  return day >= 1 && day <= 6 && hour >= 9 && hour < 18;
}
const POLL_INTERVAL = 5000;

function getConvKey(): string {
  const tokens = localStorage.getItem("wix_tokens");
  if (tokens) {
    try {
      const parsed = JSON.parse(tokens);
      const memberId = parsed?.memberId ?? parsed?.accessToken?.value?.slice(0, 12) ?? "member";
      return CONV_KEY_PREFIX + memberId;
    } catch {
      // fall through
    }
  }
  return CONV_KEY_PREFIX + "anon";
}

export default function WixChat() {
  const { member: ctxMember, isLoggedIn: memberLoggedIn } = useMember();
  const [open, setOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const pathname = usePathname();

  // Close chat on route change or when another overlay opens
  useEffect(() => {
    setOpen(false);
    setFullscreen(false);
  }, [pathname]);

  useEffect(() => {
    const handler = () => {
      setOpen(false);
      setFullscreen(false);
    };
    window.addEventListener("overlay-opened", handler);
    return () => window.removeEventListener("overlay-opened", handler);
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsContact, setNeedsContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [business, setBusiness] = useState<BusinessInfo | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Initialize conversation when chat opens
  useEffect(() => {
    if (!open) return;

    async function init() {
      const cached = localStorage.getItem(getConvKey());
      if (cached) {
        setConversationId(cached);
        setLoading(true);
        try {
          const msgs = await listChatMessages(cached);
          setMessages(msgs);
        } catch {
          localStorage.removeItem(getConvKey());
        }
        setLoading(false);
        return;
      }

      if (memberLoggedIn && ctxMember) {
        setLoading(true);
        try {
          const name = ctxMember.contact?.firstName ?? ctxMember.profile?.nickname ?? "";
          const email = ctxMember.loginEmail ?? ctxMember.contact?.emails?.[0] ?? "";

          if (name && email) {
            const result = await initChat({ name, email });
            setConversationId(result.conversationId);
            if (result.business) setBusiness(result.business);
            localStorage.setItem(getConvKey(), result.conversationId);
            const msgs = await listChatMessages(result.conversationId);
            setMessages(msgs);
          } else {
            setContactName(name);
            setContactEmail(email);
            setNeedsContact(true);
          }
        } catch (err) {
          console.error("Failed to initialize chat:", err);
          setNeedsContact(true);
        }
        setLoading(false);
        return;
      }

      setNeedsContact(true);
    }
    init();
  }, [open]);

  async function handleContactSubmit() {
    if (!contactName.trim() || !contactEmail.trim()) return;
    setLoading(true);
    setNeedsContact(false);
    try {
      const result = await initChat({
        name: contactName.trim(),
        email: contactEmail.trim(),
      });
      setConversationId(result.conversationId);
      if (result.business) setBusiness(result.business);
      localStorage.setItem(getConvKey(), result.conversationId);
    } catch (err) {
      console.error("Failed to start chat:", err);
      setNeedsContact(true);
    }
    setLoading(false);
  }

  // Poll for new messages
  useEffect(() => {
    if (!open || !conversationId) return;

    pollRef.current = setInterval(async () => {
      try {
        const msgs = await listChatMessages(conversationId);
        setMessages(msgs);
      } catch {
        // ignore poll errors
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [open, conversationId]);

  useEffect(() => {
    // Small delay to allow images to render before scrolling
    const timer = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timer);
  }, [messages, scrollToBottom]);

  // Auto-focus input when conversation is ready
  useEffect(() => {
    if (open && conversationId && !loading && !needsContact) {
      requestAnimationFrame(() => chatInputRef.current?.focus());
    }
  }, [open, conversationId, loading, needsContact]);

  async function handleSend() {
    if (!input.trim() || !conversationId || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    const tempMsg: ChatMessage = {
      _id: `temp-${Date.now()}`,
      text,
      direction: "PARTICIPANT_TO_BUSINESS",
      createdDate: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await sendChatMessage(conversationId, text);
      const msgs = await listChatMessages(conversationId);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;
    e.target.value = "";

    const isImage = file.type.startsWith("image/");
    setSending(true);

    // Optimistic update — show local preview for images, filename for files
    const tempId = `temp-${Date.now()}`;
    const localPreview = isImage ? URL.createObjectURL(file) : undefined;
    const tempMsg: ChatMessage = {
      _id: tempId,
      text: isImage ? "Uploading..." : `Uploading ${file.name}...`,
      imageUrl: localPreview,
      direction: "PARTICIPANT_TO_BUSINESS",
      createdDate: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      // 1. Get upload URL from Wix Media
      const { uploadUrl } = await getUploadUrl(file.type, file.name);

      // 2. PUT file to Wix upload URL
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) throw new Error("Upload failed");

      const uploadResult = await uploadResponse.json();
      // Wix returns the file descriptor with the URL
      const mediaUrl =
        uploadResult.file?.url ??
        uploadResult.fileDescriptors?.[0]?.url ??
        uploadResult.url ??
        "";

      if (!mediaUrl) throw new Error("No media URL returned");

      // 3. Send message with the Wix media URL
      await sendChatAttachment(conversationId, mediaUrl, file.name, isImage);

      // Clean up local preview
      if (localPreview) URL.revokeObjectURL(localPreview);

      const msgs = await listChatMessages(conversationId);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to send attachment:", err);
      // Remove temp message on failure
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
      if (localPreview) URL.revokeObjectURL(localPreview);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Panel sizing
  const panelClass = fullscreen
    ? "fixed inset-0 z-[60] bg-white flex flex-col"
    : "fixed right-4 bottom-[7.5rem] z-[51] w-80 h-[28rem] bg-white shadow-2xl flex flex-col";

  return (
    <>
      {/* Chat button */}
      {!fullscreen && (
        <button
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close chat" : "Chat with us"}
          className="fixed right-4 bottom-20 z-[51] w-12 h-12 bg-on-surface text-on-primary flex items-center justify-center shadow-lg transition-all active:scale-95 hover:bg-secondary"
        >
          <span className="material-symbols-outlined text-[22px]">
            {open ? "close" : "chat"}
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className={panelClass}>
          {/* Header */}
          <div className="bg-on-surface px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                {business?.avatar ? (
                  <img src={business.avatar} alt="" className="w-8 h-8 object-cover" />
                ) : (
                  <div className="w-8 h-8 bg-on-primary/20 flex items-center justify-center">
                    <span className="font-serif font-bold text-[10px] text-on-primary">S</span>
                  </div>
                )}
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-on-surface ${isBusinessHours() ? "bg-green-400" : "bg-on-primary/30"}`} style={{ borderRadius: "50%" }} />
              </div>
              <div>
                <p className="font-serif font-bold text-xs tracking-[0.15em] text-on-primary">
                  {business?.name ?? "SOLITAIREC"}
                </p>
                <p className="text-[9px] text-on-primary/60">
                  Typically replies within a few hours
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setFullscreen(!fullscreen)}
                className="text-on-primary/70 hover:text-on-primary transition-colors"
                aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {fullscreen ? "close_fullscreen" : "open_in_full"}
                </span>
              </button>
              <button
                onClick={() => {
                  setOpen(false);
                  setFullscreen(false);
                }}
                className="text-on-primary/70 hover:text-on-primary transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">
                  close
                </span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {loading ? (
              <div className="flex justify-center pt-12">
                <span className="font-serif text-xl text-on-surface animate-brand-pulse">
                  S
                </span>
              </div>
            ) : needsContact ? (
              <div className={`pt-4 space-y-3 ${fullscreen ? "max-w-md mx-auto w-full" : ""}`}>
                <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary">
                  Before we chat
                </p>
                <input
                  type="text"
                  placeholder="Your name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="w-full bg-surface-container-low px-3 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
                />
                <input
                  type="email"
                  placeholder="Your email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  className="w-full bg-surface-container-low px-3 py-2.5 text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
                />
                <button
                  onClick={handleContactSubmit}
                  disabled={!contactName.trim() || !contactEmail.trim()}
                  className="w-full bg-on-surface text-on-primary py-3 text-[10px] tracking-[0.25em] font-bold uppercase disabled:opacity-50"
                >
                  Start Chat
                </button>
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-[10px] tracking-widest text-on-surface-variant pt-8">
                Send us a message and we will get back to you.
              </p>
            ) : (
              <div className={fullscreen ? "max-w-2xl mx-auto w-full space-y-3" : "space-y-3"}>
                {messages.map((msg) => {
                  const isMe = msg.direction === "PARTICIPANT_TO_BUSINESS";
                  const isTemp = msg._id.startsWith("temp-");
                  return (
                    <div
                      key={msg._id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] px-3 py-2 ${
                          isMe
                            ? "bg-on-surface text-on-primary"
                            : "bg-surface-container-low text-on-surface"
                        }`}
                      >
                        {msg.imageUrl ? (
                          <div className="relative">
                            {isTemp ? (
                              <img
                                src={msg.imageUrl}
                                alt={msg.text}
                                className="max-w-full max-h-40 object-contain opacity-60"
                              />
                            ) : (
                              <a href={msg.imageUrl} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={msg.imageUrl}
                                  alt={msg.text}
                                  className="max-w-full max-h-40 object-contain"
                                />
                              </a>
                            )}
                            {isTemp && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="font-serif text-sm text-white animate-brand-pulse">
                                  S
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className={`text-xs leading-relaxed whitespace-pre-wrap ${isTemp ? "opacity-60" : ""}`}>
                            {msg.text}
                          </p>
                        )}
                        <p
                          className={`text-[9px] mt-1 ${
                            isMe ? "text-on-primary/50" : "text-on-surface-variant"
                          }`}
                        >
                          {isTemp ? "Sending..." : formatTime(msg.createdDate)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`shrink-0 px-3 py-2 border-t border-outline-variant/20 ${fullscreen ? "max-w-2xl mx-auto w-full" : ""}`}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-1"
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={!conversationId || loading || sending}
                className="text-on-surface-variant hover:text-on-surface disabled:text-on-surface-variant/30 transition-colors shrink-0"
                aria-label="Attach file"
              >
                <span className="material-symbols-outlined text-[20px]">
                  attach_file
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={chatInputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent text-xs text-on-surface placeholder:text-on-surface-variant/50 outline-none py-2"
                disabled={!conversationId || loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending || !conversationId}
                className="text-on-surface disabled:text-on-surface-variant/30 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[20px]">
                  send
                </span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

