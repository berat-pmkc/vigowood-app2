"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Send, Trash2, User, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  getAgentChatHistory,
  sendChatMessage,
  clearChatHistory,
  type OpsAgent,
  type AgentChatMessage,
} from "../actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

// ─── Agent Card ──────────────────────────────────────────────

function AgentCard({
  agent,
  isSelected,
  lastMessage,
  onClick,
}: {
  agent: OpsAgent;
  isSelected: boolean;
  lastMessage?: AgentChatMessage;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        isSelected
          ? "border-vw-primary bg-vw-primary/10"
          : "border-border hover:bg-muted/50"
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vw-primary/20 text-vw-dark">
        <Bot className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{agent.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
            {agent.department}
          </Badge>
        </div>
        {lastMessage ? (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
            {lastMessage.role === "user" ? "Siz: " : ""}
            {lastMessage.content}
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground italic">
            Henüz mesaj yok
          </p>
        )}
      </div>
    </button>
  );
}

// ─── Message Bubble ──────────────────────────────────────────

function MessageBubble({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === "user";
  const meta = message.metadata as Record<string, unknown> | null;

  return (
    <div className={cn("flex gap-2.5 mb-4", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vw-primary/20 text-vw-dark mt-0.5">
          <Bot className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm",
          isUser
            ? "bg-vw-info text-white rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] opacity-60">
            {new Date(message.created_at).toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {meta?.total_tokens ? (
            <span className="text-[10px] opacity-50">
              {Number(meta.total_tokens).toLocaleString("tr-TR")} token
              {meta.cost_estimate
                ? ` · $${Number(meta.cost_estimate).toFixed(4)}`
                : ""}
            </span>
          ) : null}
        </div>
      </div>
      {isUser && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vw-deep/20 text-vw-dark mt-0.5">
          <User className="h-3.5 w-3.5" />
        </div>
      )}
    </div>
  );
}

// ─── Typing Indicator ────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-2.5 mb-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-vw-primary/20 text-vw-dark mt-0.5">
        <Bot className="h-3.5 w-3.5" />
      </div>
      <div className="bg-muted rounded-xl rounded-bl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:0ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:150ms]" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ─── Main Chat Client ────────────────────────────────────────

export function ChatClient({ agents }: { agents: OpsAgent[] }) {
  const [selectedAgent, setSelectedAgent] = useState<OpsAgent | null>(null);
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [lastMessages, setLastMessages] = useState<
    Record<string, AgentChatMessage>
  >({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [waitingReply, setWaitingReply] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, waitingReply, scrollToBottom]);

  // Load chat history when agent is selected
  const selectAgent = useCallback(async (agent: OpsAgent) => {
    setSelectedAgent(agent);
    setLoading(true);
    setMessages([]);
    setWaitingReply(false);
    setInput("");
    try {
      const history = await getAgentChatHistory(agent.id);
      setMessages(history);
      // Check if last message is from user (unanswered)
      if (history.length > 0 && history[history.length - 1].role === "user") {
        setWaitingReply(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!selectedAgent) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`agent-chat-${selectedAgent.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "agent_chats",
          filter: `agent_id=eq.${selectedAgent.id}`,
        },
        (payload) => {
          const msg = payload.new as AgentChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          // Update last messages for sidebar
          setLastMessages((prev) => ({
            ...prev,
            [msg.agent_id]: msg,
          }));
          if (msg.role === "assistant") {
            setWaitingReply(false);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedAgent]);

  // Fallback polling when waiting for reply
  useEffect(() => {
    if (waitingReply && selectedAgent) {
      pollRef.current = setInterval(async () => {
        const history = await getAgentChatHistory(selectedAgent.id);
        setMessages(history);
        if (
          history.length > 0 &&
          history[history.length - 1].role === "assistant"
        ) {
          setWaitingReply(false);
        }
      }, 3000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [waitingReply, selectedAgent]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!selectedAgent || !input.trim() || sending || waitingReply) return;

    const content = input.trim();
    setInput("");
    setSending(true);

    // Optimistic add
    const optimistic: AgentChatMessage = {
      id: `temp-${Date.now()}`,
      agent_id: selectedAgent.id,
      user_id: null,
      role: "user",
      content,
      metadata: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setLastMessages((prev) => ({
      ...prev,
      [selectedAgent.id]: optimistic,
    }));

    try {
      const result = await sendChatMessage(selectedAgent.id, content);
      if (!result.success) {
        toast.error(result.error ?? "Mesaj gönderilemedi");
        // Remove optimistic message
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(content);
        return;
      }
      setWaitingReply(true);

      // Fire-and-forget: trigger AI response
      // Realtime subscription will pick up the assistant message automatically
      fetch("/api/ops/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: selectedAgent.id }),
      }).then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? "Asistan yanıt veremedi");
          setWaitingReply(false);
        }
      }).catch(() => {
        toast.error("Asistan yanıt veremedi");
        setWaitingReply(false);
      });
    } catch {
      toast.error("Mesaj gönderilemedi");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(content);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [selectedAgent, input, sending, waitingReply]);

  // Keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  // Clear history
  const handleClear = async () => {
    if (!selectedAgent) return;
    const result = await clearChatHistory(selectedAgent.id);
    if (result.success) {
      setMessages([]);
      setWaitingReply(false);
      setLastMessages((prev) => {
        const updated = { ...prev };
        delete updated[selectedAgent.id];
        return updated;
      });
      toast.success("Sohbet geçmişi temizlendi");
    } else {
      toast.error(result.error ?? "Silinemedi");
    }
  };

  return (
    <div className="flex h-[calc(100vh-180px)] gap-4">
      {/* ── Left Panel: Agent List ── */}
      <div className="w-[280px] shrink-0 flex flex-col border rounded-lg">
        <div className="p-3 border-b">
          <h3 className="font-medium text-sm text-vw-dark">Asistanlar</h3>
        </div>
        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1.5">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isSelected={selectedAgent?.id === agent.id}
                lastMessage={lastMessages[agent.id]}
                onClick={() => selectAgent(agent)}
              />
            ))}
            {agents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aktif asistan bulunamadı
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ── Right Panel: Chat Area ── */}
      <div className="flex-1 flex flex-col border rounded-lg">
        {selectedAgent ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-vw-primary/20 text-vw-dark">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{selectedAgent.name}</h3>
                  <p className="text-xs text-muted-foreground">
                    {selectedAgent.department}
                    {selectedAgent.description
                      ? ` · ${selectedAgent.description.slice(0, 60)}...`
                      : ""}
                  </p>
                </div>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Sohbet geçmişini sil?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {selectedAgent.name} ile olan tüm mesajlar silinecek. Bu
                      işlem geri alınamaz.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>İptal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClear}>
                      Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Bot className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">
                    {selectedAgent.name} ile sohbete başlayın
                  </p>
                  <p className="text-xs mt-1 opacity-70">
                    Bir mesaj yazarak başlayabilirsiniz
                  </p>
                </div>
              ) : (
                <div>
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  {waitingReply && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input */}
            <div className="border-t p-3">
              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Mesajınızı yazın... (Ctrl+Enter ile gönderin)"
                  className="min-h-[60px] max-h-[120px] resize-none"
                  disabled={sending || waitingReply}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || sending || waitingReply}
                  size="icon"
                  className="h-[60px] w-[60px] shrink-0 bg-vw-info hover:bg-vw-info/90"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Bot className="h-16 w-16 mb-4 opacity-20" />
            <h3 className="font-medium text-lg">Bir asistan seçin</h3>
            <p className="text-sm mt-1">
              Soldaki listeden bir asistan seçerek sohbete başlayın
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
