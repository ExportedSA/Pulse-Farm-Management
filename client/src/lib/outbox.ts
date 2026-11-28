// One offline queue for every form (build guide F4).
//
// A save goes through send(): it gets a request id (the Idempotency-Key header) and is sent now when
// there's signal. Without signal, or when the connection drops on the way, it is kept on this device
// with the same id and sent in order once the phone is back online. The server does a save once per
// request id (server/middleware/request-receipts.ts), so a retry after a lost answer never makes a
// second record. What's waiting, and anything the server refused, is shown by <OutboxStatus />.
//
// The list is kept in localStorage. A save with photos or files goes through sendForm(): its files
// are kept in IndexedDB under the same request id, and the form is put back together when it sends.
import { useEffect, useState } from "react";

const KEY = "pulse-outbox";
const OLD_KEY = "pulse-application-outbox"; // farm map jobs, before every form shared this queue

/** A file kept with a queued save: which form field it goes in, and its name and type */
export interface OutboxFile { field: string; name: string; type: string }

export interface OutboxItem {
  id: string; method: string; url: string; body: unknown; label: string; createdAt: string;
  state: "pending" | "conflict" | "failed"; error?: string;
  /** Why the last try didn't go through (no signal, signed out…), while it's still pending */
  note?: string;
  /** A form with files (sendForm): body is then its text fields, and the files are in IndexedDB */
  files?: OutboxFile[];
}

/** Where the files of queued saves are kept, by request id */
export interface OutboxFileStore {
  put(id: string, blobs: Blob[]): Promise<void>;
  get(id: string): Promise<Blob[] | undefined>;
  remove(id: string): Promise<void>;
}

function idbFiles(): OutboxFileStore {
  const open = () => new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open("pulse-outbox-files", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const run = async <T,>(mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction("files", mode);
      const req = op(tx.objectStore("files"));
      tx.oncomplete = () => { resolve(req.result as T); db.close(); };
      tx.onerror = () => { reject(tx.error); db.close(); };
    });
  };
  return {
    put: (id, blobs) => run<void>("readwrite", s => s.put(blobs, id)).then(() => undefined),
    get: id => run<Blob[] | undefined>("readonly", s => s.get(id)),
    remove: id => run<void>("readwrite", s => s.delete(id)).then(() => undefined),
  };
}

/** The file store in use (IndexedDB; a test can put another in) */
export const outboxFiles: { store: OutboxFileStore } = { store: idbFiles() };
const dropFiles = (item: Pick<OutboxItem, "id" | "files"> | undefined) => {
  if (item?.files) void outboxFiles.store.remove(item.id).catch(() => {});
};

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
/** Saves still to send (not ones the server refused, which wait for the person) */
const waiting = () => read().some(i => i.state === "pending");

function enqueue(item: Omit<OutboxItem, "createdAt" | "state">) {
  write([...read(), { ...item, createdAt: new Date().toISOString(), state: "pending" }]);
}

function sendNow(method: string, url: string, body: unknown, requestId: string, files?: { meta: OutboxFile[]; blobs: Blob[] }) {
  if (!files) {
    return fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
  // A form: its text fields, then its files (the browser sets the Content-Type with the boundary)
  const form = new FormData();
  for (const [k, v] of Object.entries((body ?? {}) as Record<string, string>)) form.append(k, v);
  files.meta.forEach((f, i) => form.append(f.field, files.blobs[i], f.name));
  return fetch(url, { method, credentials: "include", headers: { "Idempotency-Key": requestId }, body: form });
}

const queuedMessage = (label: string) => `${label} saved on this device. It will send when you're back online.`;

/** The server's answer to a save sent now: its body, or an Error with `status` when it was refused */
async function answerOf<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = (data as any)?.error ?? (data as any)?.message ?? `Request failed (${res.status})`;
    throw Object.assign(new Error(typeof message === "string" ? message : `Request failed (${res.status})`), { status: res.status });
  }
  return data as T;
}

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
    return new QueuedError(queuedMessage(opts.label), id);
  };
  if (!navigator.onLine) throw later();
  // Older saves still waiting go first, so this one (a dose for a treatment not sent yet, say) waits
  // behind them
  if (waiting()) {
    const kept = later();
    void flushOutbox();
    throw kept;
  }
  let res: Response;
  try {
    res = await sendNow(method, url, body, id);
  } catch {
    throw later();
  }
  return answerOf<T>(res);
}

/** A file for sendForm(): the form field it goes in, and its name (default: the file's own) */
export interface FormFile { field: string; file: Blob; name?: string }

/**
 * A save with photos or files (a multipart form): sent now, or kept on this device with its files
 * and sent once back online, like send(). Text fields are sent as they are; put JSON in one as text.
 */
export async function sendForm<T = any>(method: string, url: string, fields: Record<string, string>, files: FormFile[], opts: SendOptions): Promise<T> {
  const id = opts.requestId ?? newRequestId();
  const meta: OutboxFile[] = files.map((f, i) => ({
    field: f.field,
    name: f.name ?? (f.file as File).name ?? `file-${i + 1}`,
    type: f.file.type,
  }));
  const blobs = files.map(f => f.file);
  const later = async () => {
    try {
      await outboxFiles.store.put(id, blobs);
    } catch {
      return Object.assign(new Error("No signal, and this device can't keep the files. Try again when you're back online."), { status: 0 });
    }
    enqueue({ id, method, url, body: fields, files: meta, label: opts.label });
    return new QueuedError(queuedMessage(opts.label), id);
  };
  if (!navigator.onLine) throw await later();
  if (waiting()) {
    const kept = await later();
    void flushOutbox();
    throw kept;
  }
  let res: Response;
  try {
    res = await sendNow(method, url, fields, id, { meta, blobs });
  } catch {
    throw await later();
  }
  return answerOf<T>(res);
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
      let files: { meta: OutboxFile[]; blobs: Blob[] } | undefined;
      if (item.files) {
        const blobs = item.files.length ? await outboxFiles.store.get(item.id).catch(() => undefined) : [];
        if (!blobs || blobs.length !== item.files.length) {
          update(item.id, { state: "failed", error: "Its photos or files are no longer on this device", note: undefined });
          continue;
        }
        files = { meta: item.files, blobs };
      }
      let res: Response;
      try {
        res = await sendNow(item.method, item.url, item.body, item.id, files);
      } catch {
        update(item.id, { note: "No connection yet" });
        break; // still offline: try again later, in the same order
      }
      if (res.ok) {
        write(read().filter(i => i.id !== item.id));
        dropFiles(item);
        synced.push(item);
        continue;
      }
      const data = await res.json().catch(() => ({}));
      const msg = (data as any)?.error ?? (data as any)?.message ?? `Request failed (${res.status})`;
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
  dropFiles(read().find(i => i.id === id));
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
