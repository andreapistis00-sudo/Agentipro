"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp, CalendarRange, Mail, Menu, MessageCircleQuestion, PhoneCall, Plus, Square, User, X, BellPlus, ClipboardList,
} from "lucide-react";
import { Badge, Button, Dialog, Spinner, useToast } from "@/components/ui";
import type { ChatEvent, ChatMessageView, ConversationSummary } from "@/lib/ai/schemas";
import { postNdjson } from "../ndjson";
import { isNoCredits } from "@/components/credits/no-credits";
import { ConversationList } from "./conversation-list";
import { AssistantMark, MessageItem, type UiMessage } from "./message-item";

export type ChatLead = { id: string; name: string; category: string | null; city: string | null };

type Props = {
  userName: string;
  demo: boolean;
  profileIncomplete: boolean;
  initialConversations: ConversationSummary[];
  initialConversationId: string | null;
  initialMessages: ChatMessageView[];
  initialLead: ChatLead | null;
};

function setUrl(params: { c?: string | null; leadId?: string | null }, mode: "push" | "replace" = "replace") {
  const url = new URL(window.location.href);
  url.search = "";
  if (params.c) url.searchParams.set("c", params.c);
  else if (params.leadId) url.searchParams.set("leadId", params.leadId);
  const next = url.pathname + url.search;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
}

function suggestionsFor(lead: ChatLead | null) {
  if (lead) {
    return [
      { icon: ClipboardList, text: `Cosa devo sapere prima di visitare ${lead.name}?` },
      { icon: Mail, text: `Scrivimi un'email di primo contatto per ${lead.name}` },
      { icon: BellPlus, text: "Ricordami di richiamarlo venerdì" },
      { icon: MessageCircleQuestion, text: "Come rispondo se mi dice «ho già un fornitore»?" },
    ];
  }
  return [
    { icon: PhoneCall, text: "Chi dovrei chiamare oggi?" },
    { icon: Mail, text: "Scrivimi un'email di primo contatto per un nuovo cliente" },
    { icon: MessageCircleQuestion, text: "Come rispondo a «costa troppo»?" },
    { icon: CalendarRange, text: "Prepara un piano visite per questa settimana" },
  ];
}

export function ChatApp({ userName, demo, profileIncomplete, initialConversations, initialConversationId, initialMessages, initialLead }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages);
  const [lead, setLead] = useState<ChatLead | null>(initialLead);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toDelete, setToDelete] = useState<ConversationSummary | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  /* ---------- scroll automatico finché l'utente è in fondo ---------- */
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  /* ---------- textarea auto-altezza ---------- */
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Props aggiornate dal server (navigazione con Link verso ?leadId= / ?c=, refresh): si applicano solo se
  // indicano davvero un'altra conversazione, così gli aggiornamenti dell'URL fatti da qui non azzerano la chat.
  const serverKey = `${initialConversationId ?? ""}|${initialLead?.id ?? ""}`;
  const lastServerKey = useRef(serverKey);
  useEffect(() => {
    if (serverKey === lastServerKey.current) return;
    lastServerKey.current = serverKey;
    if (sending || initialConversationId === activeId) {
      setConversations(initialConversations);
      return;
    }
    setConversations(initialConversations);
    setActiveId(initialConversationId);
    setMessages(initialMessages);
    setLead(initialLead);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reagisce solo al cambio di destinazione
  }, [serverKey]);

  const patchLast = useCallback((fn: (m: UiMessage) => UiMessage) => {
    setMessages((ms) => (ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1])] : ms));
  }, []);

  /* ---------- invio ---------- */
  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    stickRef.current = true;
    const now = new Date().toISOString();
    setMessages((ms) => [
      ...ms,
      { id: `u-${Date.now()}`, role: "user", content: message, createdAt: now },
      { id: "pending", role: "assistant", content: "", createdAt: now, streaming: true, actions: [], sources: [], status: null, demo },
    ]);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let convId = activeId;
    let completed = false;
    try {
      await postNdjson<ChatEvent>(
        "/api/ai/chat",
        { message, ...(convId ? { conversationId: convId } : lead ? { leadId: lead.id } : {}) },
        (e) => {
          switch (e.type) {
            case "start":
              if (!convId) {
                convId = e.conversationId;
                setActiveId(e.conversationId);
                setConversations((cs) => [
                  { id: e.conversationId, title: e.title, leadId: lead?.id ?? null, updatedAt: new Date().toISOString(), lead: lead ? { id: lead.id, name: lead.name } : null },
                  ...cs,
                ]);
                setUrl({ c: e.conversationId });
              }
              break;
            case "delta":
              patchLast((m) => ({ ...m, content: m.content + e.text }));
              break;
            case "status":
              patchLast((m) => ({ ...m, status: e.message }));
              break;
            case "action":
              patchLast((m) => ({ ...m, actions: [...(m.actions ?? []), e.action] }));
              if (e.action.write && e.action.ok) toast(e.action.label);
              break;
            case "source":
              patchLast((m) => (m.sources?.some((s) => s.url === e.source.url) ? m : { ...m, sources: [...(m.sources ?? []), e.source] }));
              break;
            case "title":
              setConversations((cs) => cs.map((c) => (c.id === convId ? { ...c, title: e.title } : c)));
              break;
            case "done":
              completed = true;
              patchLast((m) => ({ ...m, id: e.messageId, streaming: false, status: null }));
              setConversations((cs) => {
                const c = cs.find((x) => x.id === e.conversationId);
                return c ? [{ ...c, updatedAt: new Date().toISOString() }, ...cs.filter((x) => x.id !== c.id)] : cs;
              });
              break;
            case "error":
              throw new Error(e.message);
          }
        },
        ctrl.signal,
      );
      if (!completed) throw new Error("La risposta si è interrotta. Riprova.");
      if (!demo) router.refresh(); // aggiorna il saldo crediti nella navigazione
    } catch (err) {
      if (ctrl.signal.aborted) {
        patchLast((m) => ({ ...m, streaming: false, status: null, content: m.content || "_Risposta interrotta._" }));
      } else {
        patchLast((m) => ({ ...m, streaming: false, status: null, error: err instanceof Error ? err.message : "Errore imprevisto", noCredits: isNoCredits(err) }));
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function retry() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMessages((ms) => ms.slice(0, -2));
    void send(lastUser.content);
  }

  /* ---------- conversazioni ---------- */
  async function select(id: string) {
    setDrawer(false);
    if (id === activeId || sending) return;
    setLoadingConv(true);
    setActiveId(id);
    setMessages([]);
    setUrl({ c: id }, "push");
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Conversazione non disponibile");
      setMessages(data.messages);
      setLead(data.lead ?? null);
      stickRef.current = true;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Errore", "error");
      setActiveId(null);
    } finally {
      setLoadingConv(false);
    }
  }

  function startNew() {
    setDrawer(false);
    if (sending) abortRef.current?.abort();
    setActiveId(null);
    setMessages([]);
    setLead(null);
    setUrl({}, "push");
    setTimeout(() => taRef.current?.focus(), 50);
  }

  async function rename(id: string, title: string) {
    const prev = conversations;
    setConversations((cs) => cs.map((c) => (c.id === id ? { ...c, title } : c)));
    const res = await fetch(`/api/conversations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    if (!res.ok) {
      setConversations(prev);
      toast("Rinomina non riuscita", "error");
    }
  }

  async function confirmDelete() {
    const c = toDelete;
    if (!c) return;
    setToDelete(null);
    const res = await fetch(`/api/conversations/${c.id}`, { method: "DELETE" });
    if (!res.ok) return toast("Eliminazione non riuscita", "error");
    setConversations((cs) => cs.filter((x) => x.id !== c.id));
    if (c.id === activeId) startNew();
    toast("Conversazione eliminata", "info");
  }

  // Navigazione indietro/avanti del browser tra conversazioni.
  useEffect(() => {
    const onPop = () => {
      const c = new URL(window.location.href).searchParams.get("c");
      if (c && c !== activeId) void select(c);
      if (!c && activeId) {
        setActiveId(null);
        setMessages([]);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  });

  const listProps = {
    conversations, activeId, onSelect: select, onNew: startNew, onRename: rename,
    onDelete: (id: string) => setToDelete(conversations.find((c) => c.id === id) ?? null),
  };
  const empty = messages.length === 0 && !loadingConv;
  const suggestions = suggestionsFor(lead);

  return (
    <div className="-mx-4 -mb-12 -mt-6 flex h-[calc(100dvh-3.5rem-4rem)] min-h-[420px] sm:-mx-6 lg:-mx-10 lg:-mb-12 lg:-mt-10 lg:h-dvh">
      {/* Sidebar desktop */}
      <aside className="hidden w-[272px] shrink-0 border-r border-line bg-bg lg:block">
        <div className="flex h-14 items-center px-5">
          <h1 className="font-display text-[22px] leading-none tracking-tight">Assistente</h1>
        </div>
        <div className="h-[calc(100%-3.5rem)]"><ConversationList {...listProps} /></div>
      </aside>

      {/* Drawer mobile */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Conversazioni">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[320px] flex-col bg-bg shadow-pop">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <span className="font-display text-[20px]">Conversazioni</span>
              <button onClick={() => setDrawer(false)} className="rounded-full p-2 text-ink-2 hover:bg-surface-2" aria-label="Chiudi"><X className="h-5 w-5" /></button>
            </div>
            <div className="min-h-0 flex-1"><ConversationList {...listProps} touch /></div>
          </div>
        </div>
      )}

      {/* Area chat */}
      <section className="flex min-w-0 flex-1 flex-col bg-surface/40" aria-label="Chat">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-bg/80 px-3 backdrop-blur sm:px-5">
          <button onClick={() => setDrawer(true)} className="rounded-full p-2 text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Apri conversazioni">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14.5px] font-semibold">{active?.title ?? "Nuova conversazione"}</div>
          </div>
          {lead && <LeadChip lead={lead} removable={!activeId} onRemove={() => { setLead(null); setUrl({}); }} className="hidden max-w-[45%] sm:inline-flex" />}
          {demo && <Badge tone="warn" className="shrink-0" title="Nessuna chiave API: risposte dimostrative basate sui dati reali del tuo CRM">Demo</Badge>}
          <button onClick={startNew} className="rounded-full p-2 text-ink-2 hover:bg-surface-2 lg:hidden" aria-label="Nuova conversazione">
            <Plus className="h-5 w-5" />
          </button>
        </header>

        {lead && (
          <div className="flex shrink-0 items-center gap-2 border-b border-line bg-bg/80 px-4 py-2 text-[12px] text-ink-3 sm:hidden">
            Contesto:
            <LeadChip lead={lead} removable={!activeId} onRemove={() => { setLead(null); setUrl({}); }} className="inline-flex min-w-0" />
          </div>
        )}

        <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            {loadingConv && (
              <div className="flex justify-center py-16"><Spinner className="h-5 w-5" /></div>
            )}
            {empty && (
              <div className="flex min-h-[50dvh] flex-col justify-center py-4">
                <AssistantMark className="mb-5 h-10 w-10 rounded-xl" />
                <h2 className="font-display text-[30px] leading-tight tracking-tight sm:text-[36px]">
                  Ciao {userName}, {lead ? <>parliamo di <span className="text-accent">{lead.name}</span>.</> : "da dove partiamo oggi?"}
                </h2>
                <p className="mt-2 max-w-xl text-[14.5px] text-ink-2">
                  {lead
                    ? `Conosco la scheda e lo storico di questo cliente${lead.city ? ` (${lead.city})` : ""}: chiedimi un messaggio, una strategia o di registrare un promemoria.`
                    : "Conosco il tuo CRM e il tuo profilo: chiedimi chi contattare, testi pronti da inviare, come gestire un'obiezione o un giro visite."}
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {suggestions.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      onClick={() => send(text)}
                      className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left text-[14px] leading-snug shadow-card transition hover:border-line-strong hover:bg-surface-2"
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3 group-hover:text-accent" aria-hidden />
                      <span>{text}</span>
                    </button>
                  ))}
                </div>
                {profileIncomplete && (
                  <p className="mt-5 text-[13px] text-ink-3">
                    Suggerimento: <Link href="/app/settings" className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink">completa il profilo</Link> con ciò che vendi e il tuo cliente ideale per risposte più precise.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-6">
              {messages.map((m, i) => (
                <MessageItem key={m.id + i} message={m} onRetry={i === messages.length - 1 && m.error ? retry : undefined} />
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-line bg-bg/80 px-3 pb-3 pt-3 backdrop-blur sm:px-6">
          <form
            className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-[22px] border border-line-strong bg-surface p-1.5 pl-4 shadow-card focus-within:border-ink/40 focus-within:ring-4 focus-within:ring-ink/5"
            onSubmit={(e) => { e.preventDefault(); void send(input); }}
          >
            <label htmlFor="chat-input" className="sr-only">Scrivi un messaggio</label>
            <textarea
              id="chat-input"
              ref={taRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder={lead ? `Chiedi qualcosa su ${lead.name}…` : "Scrivi una richiesta…"}
              maxLength={8000}
              className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-ink placeholder:text-ink-3 focus:outline-none focus-visible:outline-none"
            />
            {sending ? (
              <Button type="button" size="icon" variant="outline" onClick={() => abortRef.current?.abort()} aria-label="Interrompi la risposta">
                <Square className="h-3.5 w-3.5 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Invia">
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </form>
          <p className="mx-auto mt-1.5 hidden max-w-3xl text-center text-[11.5px] text-ink-3 sm:block">
            Invio per inviare · Maiusc+Invio per andare a capo · L&apos;AI può sbagliare: verifica i dati importanti.
          </p>
        </div>
      </section>

      <Dialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} title="Eliminare la conversazione?">
        <p className="text-sm text-ink-2">«{toDelete?.title}» e tutti i suoi messaggi verranno eliminati definitivamente.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setToDelete(null)}>Annulla</Button>
          <Button variant="danger" onClick={confirmDelete}><X className="h-4 w-4" aria-hidden />Elimina</Button>
        </div>
      </Dialog>
    </div>
  );
}

function LeadChip({ lead, removable, onRemove, className }: { lead: ChatLead; removable: boolean; onRemove: () => void; className?: string }) {
  return (
    <span className={`items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft py-1 pl-2.5 pr-1.5 text-[12.5px] font-medium text-accent ${className ?? ""}`}>
      <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <Link href={`/app/leads/${lead.id}`} className="truncate hover:underline" title={`Apri la scheda di ${lead.name}`}>{lead.name}</Link>
      {removable ? (
        <button onClick={onRemove} className="rounded-full p-0.5 hover:bg-accent/10" aria-label="Rimuovi il cliente dal contesto">
          <X className="h-3.5 w-3.5" />
        </button>
      ) : <span className="w-1" aria-hidden />}
    </span>
  );
}
