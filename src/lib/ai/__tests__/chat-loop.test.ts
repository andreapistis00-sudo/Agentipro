import { beforeEach, describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";

vi.mock("server-only", () => ({}));

const db = vi.hoisted(() => ({
  message: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  conversation: { update: vi.fn() },
  lead: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ db }));

// Client Anthropic finto: ogni chiamata a beta.messages.stream restituisce la prossima risposta in coda.
type Msg = Anthropic.Beta.BetaMessage;
const api = vi.hoisted(() => ({ responses: [] as unknown[], calls: [] as unknown[] }));
vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  const stream = (params: unknown) => {
    // Copia profonda: la richiesta va confrontata così com'era al momento dell'invio.
    api.calls.push(structuredClone(params));
    const handlers: Record<string, ((...a: unknown[]) => void)[]> = {};
    const msg = api.responses.shift() as Msg;
    return {
      on(evt: string, fn: (...a: unknown[]) => void) {
        (handlers[evt] ??= []).push(fn);
        return this;
      },
      async finalMessage() {
        for (const b of msg.content) {
          if (b.type === "text") handlers.text?.forEach((h) => h(b.text));
          handlers.contentBlock?.forEach((h) => h(b));
        }
        return msg;
      },
    };
  };
  return { ...actual, isAiDemo: () => false, anthropic: () => ({ beta: { messages: { stream } } }) };
});

const exec = vi.hoisted(() => vi.fn());
vi.mock("../tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../tools")>();
  return { ...actual, executeCrmTool: exec };
});

import { buildHistory, echoContent, runChat } from "../chat";

const USER = { id: "u1", name: "Mario Rossi", company: null, sector: null, products: "Caffè", idealCustomer: null, territory: null, tone: null };
const CONV = { id: "c1", userId: "u1", title: "Test", leadId: null, createdAt: new Date(), updatedAt: new Date() };

function message(content: unknown[], stop_reason: Msg["stop_reason"]): Msg {
  return { id: "msg", type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason, stop_sequence: null, usage: {} } as unknown as Msg;
}

type Req = { messages: Anthropic.Beta.BetaMessageParam[]; tools: { name: string }[]; thinking: unknown; system: string; model: string };

beforeEach(() => {
  vi.clearAllMocks();
  api.responses = [];
  api.calls = [];
  db.message.findMany.mockResolvedValue([]);
  db.message.findFirst.mockResolvedValue(null);
  db.message.create.mockResolvedValue({ id: "m-assistant" });
  exec.mockImplementation(async (_u: string, name: string) =>
    name === "list_due_followups"
      ? { content: JSON.stringify({ error: "boom" }), isError: true, action: { tool: name, label: name, write: false, ok: false } }
      : { content: JSON.stringify({ leads: [] }), isError: false, action: { tool: name, label: name, write: false, ok: true } },
  );
});

describe("loop della chat (Opus 5.5)", () => {
  it("tool_use → un solo messaggio user con tutti i tool_result, pause_turn → ripresa senza messaggi aggiunti", async () => {
    const r1 = message([
      { type: "thinking", thinking: "", signature: "sig1" },
      { type: "text", text: "Controllo il CRM." },
      { type: "tool_use", id: "t1", name: "search_crm_leads", input: { orderBy: "score" } },
      { type: "tool_use", id: "t2", name: "list_due_followups", input: { days: 3 } },
    ], "tool_use");
    const r2 = message([
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: "bar milano" } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", title: "Fonte", url: "https://esempio.it", encrypted_content: "x", page_age: null }] },
    ], "pause_turn");
    const r3 = message([{ type: "thinking", thinking: "", signature: "sig3" }, { type: "text", text: "Ecco chi chiamare." }], "end_turn");
    api.responses.push(r1, r2, r3);

    const emit = vi.fn();
    await runChat({ user: USER, conversation: CONV, isNew: false, message: "Chi chiamo oggi?", emit, signal: new AbortController().signal }, "m-user");

    expect(api.calls).toHaveLength(3);
    const [c1, c2, c3] = api.calls as Req[];

    // Parametri compatibili con Opus 5.5: thinking adattivo, nessun budget/temperature/tool_choice forzato.
    expect(c1.model).toBe("claude-opus-5-5");
    expect(c1).not.toHaveProperty("temperature");
    expect(c1).not.toHaveProperty("tool_choice");
    expect(c1.thinking).toMatchObject({ type: "adaptive" });
    expect(c1.tools.map((t) => t.name)).toContain("web_search");
    expect(c1.messages).toEqual([{ role: "user", content: "Chi chiamo oggi?" }]);

    // Secondo giro: risposta del modello replicata invariata + un solo messaggio con entrambi i tool_result.
    expect(c2.messages).toEqual([
      { role: "user", content: "Chi chiamo oggi?" },
      { role: "assistant", content: r1.content },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "t1", content: JSON.stringify({ leads: [] }) },
          { type: "tool_result", tool_use_id: "t2", content: JSON.stringify({ error: "boom" }), is_error: true },
        ],
      },
    ]);
    // pause_turn: si rimanda il turno così com'è, senza un nuovo messaggio utente.
    expect(c3.messages).toEqual([...c2.messages, { role: "assistant", content: r2.content }]);
    // Prefisso stabile tra le chiamate (system e tools identici).
    expect(c2.system).toBe(c1.system);
    expect(c3.tools).toEqual(c1.tools);

    // Salvataggio: i content block del turno vengono conservati per il replay.
    const saved = db.message.create.mock.calls[0][0].data;
    expect(saved.content).toContain("Ecco chi chiamare.");
    const raw = JSON.parse(saved.raw);
    expect(raw.system).toBe(c1.system);
    expect(raw.messages).toEqual([...c3.messages.slice(1), { role: "assistant", content: r3.content }]);
    expect(emit).toHaveBeenCalledWith({ type: "done", conversationId: "c1", messageId: "m-assistant" });

    // Turno successivo: la cronologia ricostruita è esattamente l'ultima richiesta + la risposta finale (append-only).
    const history = buildHistory([
      { role: "user", content: "Chi chiamo oggi?", raw: JSON.stringify({ v: 1, api: "Chi chiamo oggi?" }) },
      { role: "assistant", content: saved.content, raw: saved.raw },
    ]);
    expect(history).toEqual([...c3.messages, { role: "assistant", content: r3.content }]);
  });

  it("su refusal non esegue i tool e non salva i content block", async () => {
    api.responses.push(message([{ type: "tool_use", id: "t1", name: "search_crm_leads", input: {} }], "refusal"));
    await runChat({ user: USER, conversation: CONV, isNew: false, message: "x", emit: vi.fn(), signal: new AbortController().signal }, "m-user");
    expect(exec).not.toHaveBeenCalled();
    const raw = JSON.parse(db.message.create.mock.calls[0][0].data.raw);
    expect(raw.stopped).toBe("refusal");
    expect(raw.messages).toBeUndefined();
  });

  it("con max_tokens su un tool_use non esegue il tool troncato", async () => {
    api.responses.push(message([{ type: "text", text: "Ok" }, { type: "tool_use", id: "t1", name: "add_activity", input: { leadId: "l" } }], "max_tokens"));
    await runChat({ user: USER, conversation: CONV, isNew: false, message: "x", emit: vi.fn(), signal: new AbortController().signal }, "m-user");
    expect(exec).not.toHaveBeenCalled();
    const raw = JSON.parse(db.message.create.mock.calls[0][0].data.raw);
    expect(raw.stopped).toBe("max_tokens");
    expect(raw.messages).toEqual([]);
  });
});

describe("buildHistory", () => {
  const u = (t: string) => ({ role: "user", content: t, raw: JSON.stringify({ v: 1, api: t }) });
  const a = (raw: object, content = "risposta") => ({ role: "assistant", content, raw: JSON.stringify({ v: 1, ...raw }) });

  it("esclude i turni rifiutati insieme alla domanda", () => {
    const h = buildHistory([u("uno"), a({ messages: [{ role: "assistant", content: [{ type: "text", text: "ok" }] }] }), u("due"), a({ stopped: "refusal" }, "Mi dispiace"), u("tre")]);
    expect(h.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(h[2].content).toBe("tre");
  });

  it("con la finestra scorrevole toglie i thinking e non inizia con tool_result orfani", () => {
    const turn = [
      { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "s" }, { type: "tool_use", id: "t1", name: "x", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "{}" }] },
      { role: "assistant", content: [{ type: "thinking", thinking: "", signature: "s2" }, { type: "text", text: "fine" }] },
    ];
    const h = buildHistory([a({ messages: turn }), u("nuova")], { stripThinking: true });
    expect(h).toEqual([{ role: "user", content: "nuova" }]);
    const h2 = buildHistory([u("prima"), a({ messages: turn })], { stripThinking: true });
    expect(JSON.stringify(h2)).not.toContain("thinking");
    expect(h2).toHaveLength(4);
  });
});

describe("echoContent", () => {
  it("senza fallback restituisce il contenuto invariato", () => {
    const c = [{ type: "thinking", thinking: "", signature: "s" }, { type: "text", text: "a" }] as Anthropic.Beta.BetaContentBlock[];
    expect(echoContent(c)).toBe(c);
  });

  it("dopo un fallback omette thinking e tool_use del modello che ha declinato", () => {
    const c = [
      { type: "thinking", thinking: "", signature: "s" },
      { type: "text", text: "parziale" },
      { type: "tool_use", id: "t0", name: "x", input: {} },
      { type: "server_tool_use", id: "s0", name: "web_search", input: {} },
      { type: "fallback", from: { model: "claude-opus-5-5" }, to: { model: "claude-opus-5" } },
      { type: "thinking", thinking: "", signature: "s2" },
      { type: "tool_use", id: "t1", name: "y", input: {} },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    expect(echoContent(c).map((b) => b.type)).toEqual(["text", "fallback", "thinking", "tool_use"]);
  });
});
