"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  initChat,
  sendChatMessage,
  listChatMessages,
  type ChatMessage,
} from "@/app/chat/actions";
import { isLoggedIn } from "@/lib/wix-auth";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

const CONV_KEY_PREFIX = "solitairec_chat_conv_";
const POLL_INTERVAL = 5000;

function getConvKey(): string {
  // Scope the cache to the current auth state so logged-in users
  // don't see anonymous conversations and vice versa
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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsContact, setNeedsContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Initialize conversation when chat opens
  useEffect(() => {
    if (!open) return;

    async function init() {
      // Check for cached conversation
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

      // Logged-in member — pre-fill name/email and auto-start
      if (isLoggedIn()) {
        setLoading(true);
        try {
          const wix = getBrowserWixClient();
          await ensureVisitorTokens(wix);
          const memberResponse = await wix.members.getCurrentMember({
            fieldsets: ["FULL"],
          });
          // Response may be { member: {...} } or the member directly
          const member = (memberResponse as unknown as { member?: Record<string, unknown> }).member ?? memberResponse;
          const m = member as Record<string, unknown>;
          const contact = m.contact as Record<string, unknown> | undefined;
          const profile = m.profile as Record<string, unknown> | undefined;
          const name = (contact?.firstName as string) ?? (profile?.nickname as string) ?? "";
          const email = (m.loginEmail as string) ?? ((contact?.emails as string[])?.[0]) ?? "";

          if (name && email) {
            const result = await initChat({ name, email });
            setConversationId(result.conversationId);
            localStorage.setItem(getConvKey(), result.conversationId);
            // Load existing messages
            const msgs = await listChatMessages(result.conversationId);
            setMessages(msgs);
          } else {
            // Missing info — show form
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

      // Anonymous visitor — show contact form
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

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  async function handleSend() {
    if (!input.trim() || !conversationId || sending) return;

    const text = input.trim();
    setInput("");
    setSending(true);

    // Optimistic update
    const tempMsg: ChatMessage = {
      _id: `temp-${Date.now()}`,
      text,
      direction: "PARTICIPANT_TO_BUSINESS",
      createdDate: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      await sendChatMessage(conversationId, text);
      // Refresh to get the real message
      const msgs = await listChatMessages(conversationId);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      {/* Chat button */}
      <button
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close chat" : "Chat with us"}
        className="fixed right-4 bottom-20 z-[51] w-12 h-12 bg-on-surface text-on-primary flex items-center justify-center shadow-lg transition-all active:scale-95 hover:bg-secondary"
      >
        <span className="material-symbols-outlined text-[22px]">
          {open ? "close" : "chat"}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed right-4 bottom-[7.5rem] z-[51] w-80 h-[28rem] bg-white shadow-2xl flex flex-col">
          {/* Header */}
          <div className="bg-on-surface px-4 py-3 flex items-center justify-between shrink-0">
            <span className="font-serif font-bold text-xs tracking-[0.2em] text-on-primary">
              SOLITAIREC
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-on-primary/70 hover:text-on-primary transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
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
              <div className="pt-4 space-y-3">
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
              messages.map((msg) => {
                const isMe = msg.direction === "PARTICIPANT_TO_BUSINESS";
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
                      <p className="text-xs leading-relaxed">{msg.text}</p>
                      <p
                        className={`text-[9px] mt-1 ${
                          isMe ? "text-on-primary/50" : "text-on-surface-variant"
                        }`}
                      >
                        {formatTime(msg.createdDate)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 px-3 py-2 border-t border-outline-variant/20">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex gap-2"
            >
              <input
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
                className="text-on-surface disabled:text-on-surface-variant/30 transition-colors"
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
