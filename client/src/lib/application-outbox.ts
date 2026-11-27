// Farm map jobs (fertiliser, spray, effluent…) recorded without signal go through the app's one
// offline queue (outbox.ts). New jobs also carry a clientId, so a retry never makes a second job. A
// change to a job that someone else changed meanwhile comes back as a conflict and is kept, flagged,
// for the person to look at: it is never forced over the newer version.
// (Task jobs have their own outbox in job-outbox.ts, because they carry photos.)
import { useOutbox } from "./outbox";

export { queued, QueuedError, flushOutbox, discardOutboxItem, saveMessage, type OutboxItem } from "./outbox";

const isJob = (url: string) => url.startsWith("/api/applications");

/**
 * The farm map's jobs waiting on this device. The app's own <OutboxStatus /> sends them.
 */
export function useApplicationOutbox(onSynced?: () => void) {
  const outbox = useOutbox(synced => { if (synced.some(i => isJob(i.url))) onSynced?.(); }, false);
  const items = outbox.items.filter(i => isJob(i.url));
  return { ...outbox, items, pending: items.filter(i => i.state === "pending"), problems: items.filter(i => i.state !== "pending") };
}
