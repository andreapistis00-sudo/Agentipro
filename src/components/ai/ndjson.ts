// Lettura lato client degli stream NDJSON delle API AI.

/** Invia una POST JSON e invoca `onEvent` per ogni riga NDJSON ricevuta. Lancia Error con messaggio leggibile. */
export async function postNdjson<E>(url: string, body: unknown, onEvent: (e: E) => void, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? (res.status === 401 ? "Sessione scaduta: accedi di nuovo." : "Errore di rete. Riprova."));
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        try {
          onEvent(JSON.parse(line) as E);
        } catch {
          /* riga incompleta o non valida: ignorata */
        }
      }
    }
  }
  const rest = buf.trim();
  if (rest) {
    try {
      onEvent(JSON.parse(rest) as E);
    } catch {
      /* ignorata */
    }
  }
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback per contesti non sicuri (http su rete locale).
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
