import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Search as SearchIcon } from "lucide-react";
import { recordTypeDef, detailSummary, type FarmRecord } from "@/lib/records";

// Any button can open search: window.dispatchEvent(new Event(OPEN_SEARCH_EVENT))
export const OPEN_SEARCH_EVENT = "pulse:open-search";

interface SearchResponse {
  total: number;
  results: {
    records: FarmRecord[];
    jobs: { id: string; title: string; status: string; location: string | null; tags: string[] }[];
    tasks: { id: string; title: string; status: string; tags: string[] }[];
    animals: { id: string; name: string | null; visualId: string | null; eid: string | null; tags: string[] }[];
    paddocks: { id: string; name: string; paddockNumber: number | null }[];
    messages: { id: string; body: string; channelName: string; author: string | null; createdAt: string }[];
  };
}

interface Item { kind: string; key: string; label: string; detail?: string; tags?: string[]; href: string }

function toItems(data: SearchResponse): Item[] {
  const r = data.results;
  return [
    ...r.records.map(x => ({
      kind: recordTypeDef(x.type).label, key: `r-${x.id}`, label: x.title,
      detail: [format(new Date(x.occurredAt), "d MMM yyyy"), detailSummary(x)].filter(Boolean).join(" · "),
      tags: x.tags.map(t => t.name), href: "/app/records",
    })),
    ...r.jobs.map(x => ({ kind: "Job", key: `j-${x.id}`, label: x.title, detail: [x.status, x.location].filter(Boolean).join(" · "), tags: x.tags, href: "/app/jobs" })),
    ...r.tasks.map(x => ({ kind: "Task", key: `t-${x.id}`, label: x.title, detail: x.status, tags: x.tags, href: "/app/tasks" })),
    ...r.animals.map(x => ({
      kind: "Animal", key: `a-${x.id}`, label: x.name || x.visualId || x.eid || "Animal",
      detail: [x.visualId && `Tag ${x.visualId}`, x.eid && `EID ${x.eid}`].filter(Boolean).join(" · "), tags: x.tags, href: `/app/animals/${x.id}`,
    })),
    ...r.paddocks.map(x => ({ kind: "Paddock", key: `p-${x.id}`, label: x.name, detail: x.paddockNumber != null ? `Paddock ${x.paddockNumber}` : undefined, href: "/app/pastures" })),
    ...r.messages.map(x => ({
      kind: "Chat", key: `m-${x.id}`, label: x.body.length > 90 ? `${x.body.slice(0, 90)}…` : x.body,
      detail: `${x.author ?? "Someone"} in ${x.channelName} · ${format(new Date(x.createdAt), "d MMM")}`, href: "/app/chat",
    })),
  ];
}

export default function GlobalSearch() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const box = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const show = () => { setOpen(true); setTimeout(() => box.current?.focus(), 0); };
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); show(); }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, []);

  useEffect(() => {
    const text = q.trim();
    if (text.length < 2) { setItems([]); setStatus("idle"); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`, { credentials: "include" });
        if (!res.ok) throw new Error();
        const data: SearchResponse = await res.json();
        if (!cancelled) { setItems(toItems(data)); setStatus("done"); }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  if (!open) return null;
  const go = (href: string) => { setOpen(false); setLocation(href); };

  return (
    <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)}>
      <div
        role="dialog"
        aria-label="Search the farm"
        className="absolute left-1/2 top-16 sm:top-24 -translate-x-1/2 w-[min(720px,94vw)] rounded-2xl border border-border bg-card p-3 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground ml-1" />
          <input
            ref={box}
            id="global-search"
            className="h-10 flex-1 rounded-xl border border-border bg-background px-3"
            placeholder="Search records, jobs, animals, paddocks, chat…"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <span className="hidden sm:inline text-xs text-muted-foreground px-2 py-1 rounded-md border border-border">Ctrl K</span>
        </div>
        <div className="mt-2 max-h-[60vh] overflow-auto">
          {status === "idle" && <p className="text-sm text-muted-foreground px-2 py-6">Type at least 2 characters, e.g. "tordon", "fencing", "PKE" or a cow's tag.</p>}
          {status === "loading" && items.length === 0 && <p className="text-sm text-muted-foreground px-2 py-6">Searching…</p>}
          {status === "error" && <p className="text-sm text-red-700 px-2 py-6">Search isn't available right now. Check your connection and try again.</p>}
          {status === "done" && items.length === 0 && <p className="text-sm text-muted-foreground px-2 py-6">Nothing found for "{q.trim()}".</p>}
          {items.map(it => (
            <button
              key={it.key}
              type="button"
              onClick={() => go(it.href)}
              className="w-full text-left flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-muted focus-visible:bg-muted"
            >
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground w-24 shrink-0 pt-0.5">{it.kind}</span>
              <span className="min-w-0 flex-1">
                <span className="font-medium block truncate">{it.label}</span>
                {it.detail && <span className="text-xs text-muted-foreground block truncate">{it.detail}</span>}
              </span>
              {it.tags && it.tags.length > 0 && (
                <span className="hidden sm:flex gap-1 shrink-0">
                  {it.tags.slice(0, 3).map(t => <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-muted">{t}</span>)}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
