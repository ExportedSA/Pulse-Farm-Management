// Starting and finishing jobs without signal: the action (with its photos) is kept on the
// device and sent when the phone is back online. The last job list is kept too, so the
// jobs can still be seen in a paddock with no coverage.

export type JobAction =
  | { kind: "start"; jobId: string }
  | { kind: "complete"; jobId: string; note?: string; latitude?: number | null; longitude?: number | null };

interface QueuedJobAction {
  id: string;
  action: JobAction;
  files: { name: string; type: string; blob: Blob }[];
  createdAt: string;
}

const DB = "pulse-jobs";
const STORE = "outbox";
const EVENT = "pulse:job-outbox";
const CACHE_KEY = "pulse-jobs-cache";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const notify = () => window.dispatchEvent(new Event(EVENT));
export const onJobOutboxChange = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export const listJobOutbox = () => store<QueuedJobAction[]>("readonly", s => s.getAll() as IDBRequest<QueuedJobAction[]>);

async function errorFrom(res: Response): Promise<Error & { status: number }> {
  const body = await res.json().catch(() => ({}));
  const message = body?.details?.[0]?.message ?? body?.error ?? `Request failed (${res.status})`;
  return Object.assign(new Error(message), { status: res.status });
}

async function send(action: JobAction, files: Blob[] | File[], names?: string[]): Promise<any> {
  if (action.kind === "start") {
    const res = await fetch(`/api/jobs/${action.jobId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "in-progress" }),
    });
    if (!res.ok) throw await errorFrom(res);
    return res.json();
  }
  const form = new FormData();
  if (action.note) form.append("note", action.note);
  if (action.latitude != null) form.append("latitude", String(action.latitude));
  if (action.longitude != null) form.append("longitude", String(action.longitude));
  files.forEach((f, i) => form.append("photos", f, names?.[i] ?? (f as File).name ?? `photo-${i + 1}.jpg`));
  const res = await fetch(`/api/jobs/${action.jobId}/complete`, { method: "POST", credentials: "include", body: form });
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

/**
 * Send now when there's signal; otherwise keep it on the device. A refusal from the server
 * (e.g. an unticked checklist item) is shown to the person rather than queued.
 */
export async function sendJobAction(action: JobAction, files: File[] = []): Promise<{ queued: false; job: any } | { queued: true }> {
  if (navigator.onLine) {
    try {
      return { queued: false, job: await send(action, files) };
    } catch (error: any) {
      if (error?.status) throw error;
    }
  }
  const item: QueuedJobAction = {
    id: crypto.randomUUID(),
    action,
    files: files.map(f => ({ name: f.name, type: f.type, blob: f })),
    createdAt: new Date().toISOString(),
  };
  await store("readwrite", s => s.put(item));
  notify();
  return { queued: true };
}

let draining = false;

/**
 * Send whatever was saved offline, oldest first. Completing is safe to repeat on the server.
 * Actions the server refuses are dropped (and returned) so they don't block the rest.
 */
export async function drainJobOutbox(): Promise<{ sent: number; refused: { action: JobAction; error: string }[] }> {
  const result = { sent: 0, refused: [] as { action: JobAction; error: string }[] };
  if (draining || !navigator.onLine) return result;
  draining = true;
  try {
    const items = (await listJobOutbox()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of items) {
      try {
        await send(item.action, item.files.map(f => f.blob), item.files.map(f => f.name));
        result.sent++;
      } catch (error: any) {
        if (!error?.status) break; // still no connection
        result.refused.push({ action: item.action, error: error.message });
      }
      await store("readwrite", s => s.delete(item.id));
      notify();
    }
  } finally {
    draining = false;
  }
  return result;
}

export function cacheJobs(jobs: unknown[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), jobs }));
  } catch {
    // Storage full or private mode: the list just won't be there offline
  }
}

export function cachedJobs<T>(): { savedAt: string; jobs: T[] } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
