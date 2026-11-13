// Farm map jobs (fertiliser, spray, effluent…) recorded without signal are kept on this device
// and uploaded in order when it's back online. New jobs carry a clientId, so a retry never makes
// a second job. A change to a job that someone else changed meanwhile comes back as a conflict
// and is kept, flagged, for the person to look at: it is never forced over the newer version.
// (Task jobs have their own outbox in job-outbox.ts.)
import { useEffect, useState } from "react";

const KEY = "pulse-application-outbox";
export interface OutboxItem {
  id: string; method: string; url: string; body: unknown; label: string; createdAt: string;
  state: "pending" | "conflict" | "failed"; error?: string;
}

export class QueuedError extends Error {
  queued = true;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
const read = (): OutboxItem[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } };
const write = (items: OutboxItem[]) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: nothing kept */ } notify(); };

function enqueue(method: string, url: string, body: unknown, label: string) {
  write([...read(), { id: crypto.randomUUID(), method, url, body, label, createdAt: new Date().toISOString(), state: "pending" }]);
}

const sendNow = (method: string, url: string, body: unknown) =>
  fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });

/**
 * Send a job change now, or keep it on the device if there's no connection. Throws QueuedError
 * (with a message to show) when it was kept for later.
 */
export async function queued<T>(method: string, url: string, body: unknown, label: string): Promise<T> {
  const later = () => {
    enqueue(method, url, body, label);
    return new QueuedError(`${label} saved on this device. It will upload when you're back online.`);
  };
  if (!navigator.onLine) throw later();
  let res: Response;
  try {
    res = await sendNow(method, url, body);
  } catch {
    throw later();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error((data as any)?.error ?? `Request failed (${res.status})`), { status: res.status });
  return data as T;
}

let flushing = false;
export async function flushOutbox(onSynced?: () => void) {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  let synced = 0;
  try {
    for (const item of read().filter(i => i.state === "pending")) {
      let res: Response;
      try {
        res = await sendNow(item.method, item.url, item.body);
      } catch {
        break; // still offline: try again later, in the same order
      }
      if (res.ok) {
        write(read().filter(i => i.id !== item.id));
        synced++;
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = (data as any)?.error ?? `Request failed (${res.status})`;
        write(read().map(i => (i.id === item.id ? { ...i, state: res.status === 409 ? "conflict" : "failed", error: msg } : i)));
      }
    }
  } finally {
    flushing = false;
    if (synced) onSynced?.();
  }
}

export function discardOutboxItem(id: string) {
  write(read().filter(i => i.id !== id));
}

/**
 * What's waiting on this device; uploads it when the connection comes back
 */
export function useApplicationOutbox(onSynced?: () => void) {
  const [items, setItems] = useState<OutboxItem[]>(read);
  useEffect(() => {
    const update = () => setItems(read());
    listeners.add(update);
    const flush = () => flushOutbox(onSynced);
    window.addEventListener("online", flush);
    const timer = window.setInterval(() => { if (read().some(i => i.state === "pending")) flush(); }, 30_000);
    flush();
    return () => { listeners.delete(update); window.removeEventListener("online", flush); window.clearInterval(timer); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return { items, pending: items.filter(i => i.state === "pending"), problems: items.filter(i => i.state !== "pending"), discard: discardOutboxItem };
}

/**
 * Show the right message for a save: kept on the device (offline) or an error
 */
export function saveMessage(e: any, toast: { success: (m: string) => void; error: (m: string) => void }) {
  if (e?.queued) toast.success(e.message);
  else toast.error(e?.message ?? "Couldn't save");
  return !!e?.queued;
}
