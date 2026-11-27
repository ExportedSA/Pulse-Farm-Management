// One offline queue for every form (build guide F4).
//
// A save goes through send(): it gets a request id (the Idempotency-Key header) and is sent now when
// there's signal. Without signal, or when the connection drops on the way, it is kept on this device
// with the same id and sent in order once the phone is back online. The server does a save once per
// request id (server/middleware/request-receipts.ts), so a retry after a lost answer never makes a
// second record. What's waiting, and anything the server refused, is shown by <OutboxStatus />.
//
// Kept in localStorage, so only JSON saves queue; photos and files need signal.
import { useEffect, useState } from "react";

const KEY = "pulse-outbox";
const OLD_KEY = "pulse-application-outbox"; // farm map jobs, before every form shared this queue

export interface OutboxItem {
  id: string; method: string; url: string; body: unknown; label: string; createdAt: string;
  state: "pending" | "conflict" | "failed"; error?: string;
  /** Why the last try didn't go through (no signal, signed out…), while it's still pending */
  note?: string;
}

export class QueuedError extends Error {
  queued = true;
  constructor(message: string, public requestId: string) {
    super(message);
  }
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

function load(key: string): OutboxItem[] {
  try { return JSON.parse(localStorage.getItem(key) ?? "[]"); } catch { return []; }
}
function read(): OutboxItem[] {
  const items = load(KEY);
  const old = load(OLD_KEY);
  if (!old.length) return items;
  // Jobs queued before the change join this queue, ahead of anything newer
  const merged = [...old.filter(o => !items.some(i => i.id === o.id)), ...items];
  try { localStorage.setItem(KEY, JSON.stringify(merged)); localStorage.removeItem(OLD_KEY); } catch { /* kept where it was */ }
  return merged;
}
const write = (items: OutboxItem[]) => {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* private mode: nothing kept */ }
  notify();
};
const update = (id: string, patch: Partial<OutboxItem>) => write(read().map(i => (i.id === id ? { ...i, ...patch } : i)));

export const newRequestId = () => crypto.randomUUID();

function enqueue(item: Omit<OutboxItem, "createdAt" | "state">) {
  write([...read(), { ...item, createdAt: new Date().toISOString(), state: "pending" }]);
}

const sendNow = (method: string, url: string, body: unknown, requestId: string) =>
  fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

export interface SendOptions {
  /** What it is, for the waiting list: "Treatment for cow 123" */
  label: string;
  /** The request id, when the caller needs it before sending (default: a new one) */
  requestId?: string;
}

/**
 * Save now, or keep it on this device when there's no connection. Throws QueuedError (with a
 * message to show) when it was kept for later; throws an Error with `status` when the server refused.
 */
export async function send<T = any>(method: string, url: string, body: unknown, opts: SendOptions): Promise<T> {
  const id = opts.requestId ?? newRequestId();
  const later = () => {
    enqueue({ id, method, url, body, label: opts.label });
    return new QueuedError(`${opts.label} saved on this device. It will send when you're back online.`, id);
  };
  if (!navigator.onLine) throw later();
  let res: Response;
  try {
    res = await sendNow(method, url, body, id);
  } catch {
    throw later();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as any)?.error ?? `Request failed (${res.status})`;
    throw Object.assign(new Error(typeof message === "string" ? message : `Request failed (${res.status})`), { status: res.status });
  }
  return data as T;
}

/** The same as send(), for code written before every form shared the queue */
export const queued = <T,>(method: string, url: string, body: unknown, label: string) => send<T>(method, url, body, { label });

let flushing = false;
const syncedListeners = new Set<(items: OutboxItem[]) => void>();

/** Sends what's waiting, oldest first. Stops at the first save that can't go yet, to keep the order. */
export async function flushOutbox(onSynced?: () => void) {
  if (flushing || !navigator.onLine) return;
  flushing = true;
  const synced: OutboxItem[] = [];
  try {
    for (const item of read().filter(i => i.state === "pending")) {
      let res: Response;
      try {
        res = await sendNow(item.method, item.url, item.body, item.id);
      } catch {
        update(item.id, { note: "No connection yet" });
        break; // still offline: try again later, in the same order
      }
      if (res.ok) {
        write(read().filter(i => i.id !== item.id));
        synced.push(item);
        continue;
      }
      const data = await res.json().catch(() => ({}));
      const msg = (data as any)?.error ?? `Request failed (${res.status})`;
      // Not refused, just not yet: still being saved from an earlier try, signed out, or the server
      // is busy. Kept, in order, for the next try.
      if ((res.status === 409 && (data as any)?.code === "request_in_progress") || res.status === 401 || res.status === 429 || res.status >= 500) {
        update(item.id, { note: res.status === 401 ? "Sign in again to send this" : msg });
        break;
      }
      update(item.id, { state: res.status === 409 ? "conflict" : "failed", error: msg, note: undefined });
    }
  } finally {
    flushing = false;
    if (synced.length) {
      onSynced?.();
      syncedListeners.forEach(l => l(synced));
    }
  }
}

/** Told which saves have just reached the server */
export function onOutboxSynced(cb: (items: OutboxItem[]) => void) {
  syncedListeners.add(cb);
  return () => { syncedListeners.delete(cb); };
}

export function discardOutboxItem(id: string) {
  write(read().filter(i => i.id !== id));
}

/** Try a refused save again, e.g. after fixing what was wrong elsewhere */
export function retryOutboxItem(id: string) {
  update(id, { state: "pending", error: undefined });
  void flushOutbox();
}

export const outboxHas = (id: string) => read().some(i => i.id === id);

/**
 * What's waiting on this device. With `drive`, it also sends it when the connection comes back,
 * and every 30 seconds while anything is waiting (the app mounts one of these for all forms).
 */
export function useOutbox(onSynced?: (items: OutboxItem[]) => void, drive = true) {
  const [items, setItems] = useState<OutboxItem[]>(read);
  useEffect(() => {
    const refresh = () => setItems(read());
    listeners.add(refresh);
    // Another tab changed the queue
    const storage = (e: StorageEvent) => { if (e.key === KEY) refresh(); };
    window.addEventListener("storage", storage);
    const off = onSynced ? onOutboxSynced(onSynced) : () => {};
    if (!drive) return () => { listeners.delete(refresh); window.removeEventListener("storage", storage); off(); };
    const flush = () => void flushOutbox();
    window.addEventListener("online", flush);
    const timer = window.setInterval(() => { if (read().some(i => i.state === "pending")) flush(); }, 30_000);
    flush();
    return () => {
      listeners.delete(refresh);
      window.removeEventListener("storage", storage);
      window.removeEventListener("online", flush);
      window.clearInterval(timer);
      off();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    items,
    pending: items.filter(i => i.state === "pending"),
    problems: items.filter(i => i.state !== "pending"),
    discard: discardOutboxItem,
    retry: retryOutboxItem,
  };
}

/**
 * Show the right message for a save: kept on the device (offline) or an error
 */
export function saveMessage(e: any, toast: { success: (m: string) => void; error: (m: string) => void }) {
  if (e?.queued) toast.success(e.message);
  else toast.error(e?.message ?? "Couldn't save");
  return !!e?.queued;
}
