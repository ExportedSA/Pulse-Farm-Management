import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format, subDays, subMonths } from "date-fns";
import { FileText, ImageIcon, Map as MapIcon, List, Mic, Plus, Search, Pencil, Trash2, CloudUpload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RecordsMap, type MapFeature } from "@/components/records/RecordsMap";
import { NEW_RECORD_EVENT, openEditRecord } from "@/components/records/RecordFab";
import { SeasonPanel } from "@/components/records/SeasonPanel";
import { fetchPaddockMap, PADDOCK_MAP_KEY } from "@/lib/paddock-map";
import type { MapJob } from "@/components/jobs/JobsMap";
import {
  RECORD_TYPES,
  recordTypeDef,
  detailSummary,
  fetchRecords,
  fetchTags,
  deleteRecord,
  listOutbox,
  onOutboxChange,
  discardOutboxItem,
  type FarmRecord,
  type RecordType,
} from "@/lib/records";

// Tabs group record types the way people look for them
const TABS: { key: string; label: string; types: RecordType[]; newType: RecordType }[] = [
  { key: "all", label: "All", types: [], newType: "spray" },
  { key: "spray", label: "Spray", types: ["spray"], newType: "spray" },
  { key: "fertiliser", label: "Fertiliser", types: ["fertiliser"], newType: "fertiliser" },
  { key: "feed", label: "Feed", types: ["feed_in", "feed_out", "baleage"], newType: "feed_in" },
  { key: "effluent", label: "Effluent", types: ["effluent"], newType: "effluent" },
  { key: "work", label: "Work & events", types: ["fencing", "job_done", "maintenance", "medical", "health_safety", "note"], newType: "job_done" },
  { key: "checks", label: "Monthly checks", types: ["monthly_check"], newType: "monthly_check" },
  { key: "documents", label: "Documents", types: ["document"], newType: "document" },
];

const MAPPED_TYPES = RECORD_TYPES.filter(t => t.mapped);

// NZ dairy season starts 1 June
const seasonStart = () => {
  const now = new Date();
  return new Date(now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1, 5, 1);
};
const RANGES: { key: string; label: string; from: () => Date | null }[] = [
  { key: "30d", label: "Last 30 days", from: () => subDays(new Date(), 30) },
  { key: "season", label: "This season", from: seasonStart },
  { key: "12m", label: "Last 12 months", from: () => subMonths(new Date(), 12) },
  { key: "all", label: "All time", from: () => null },
];

function readHashTab(): string {
  const key = window.location.hash.replace("#", "");
  return TABS.some(t => t.key === key) ? key : "all";
}

function RecordCard({ record, onDelete }: { record: FarmRecord; onDelete: (r: FarmRecord) => void }) {
  const def = recordTypeDef(record.type);
  const summary = detailSummary(record);
  const [confirming, setConfirming] = useState(false);
  const photos = record.attachments.filter(a => a.kind === "photo");
  const others = record.attachments.filter(a => a.kind !== "photo");
  return (
    <article className="rounded-lg border bg-card p-4 grid gap-2" data-testid={`record-${record.id}`}>
      <div className="flex items-start gap-3">
        <span className="mt-1 h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: def.color }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h3 className="font-semibold">{record.title}</h3>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">{def.label}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(record.occurredAt), "EEE d MMM yyyy, h:mm a")} · {record.recordedBy.name}
            {record.paddocks.length > 0 && ` · ${record.paddocks.map(p => p.name).join(", ")}`}
            {record.areaHa != null && ` · ${record.areaHa.toFixed(2)} ha`}
          </p>
          {summary && <p className="text-sm mt-1">{summary}</p>}
          {record.notes && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{record.notes}</p>}
        </div>
        {confirming ? (
          <div className="flex gap-1">
            <Button variant="destructive" size="sm" onClick={() => onDelete(record)}>Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
          </div>
        ) : (
          <div className="flex">
            <Button variant="ghost" size="icon" aria-label="Edit record" onClick={() => openEditRecord(record.id)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" aria-label="Delete record" onClick={() => setConfirming(true)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {(record.tags.length > 0 || photos.length > 0 || others.length > 0) && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          {record.tags.map(t => (
            <span key={t.id} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color ?? "#495057" }}>{t.name}</span>
          ))}
          {photos.map(p => (
            <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={p.caption ?? p.fileName ?? "Photo"}>
              <img src={p.url} alt={p.caption ?? "Record photo"} className="h-12 w-12 rounded object-cover border" loading="lazy" />
            </a>
          ))}
          {others.map(a => (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs underline">
              {a.kind === "voice" ? <Mic className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
              {a.fileName ?? (a.kind === "voice" ? "Voice note" : "Document")}
            </a>
          ))}
        </div>
      )}
    </article>
  );
}

export default function RecordsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState(readHashTab);
  const [view, setView] = useState<"list" | "map">("list");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [range, setRange] = useState("season");
  const [layers, setLayers] = useState<string[]>(MAPPED_TYPES.map(t => t.type));
  const [showPaddocks, setShowPaddocks] = useState(true);
  const [showJobs, setShowJobs] = useState(true);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof listOutbox>>>([]);

  const current = TABS.find(t => t.key === tab)!;

  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    history.replaceState(null, "", tab === "all" ? window.location.pathname : `#${tab}`);
  }, [tab]);

  useEffect(() => {
    const refresh = () => listOutbox().then(setPending);
    refresh();
    return onOutboxChange(refresh);
  }, []);

  const { data: tags = [] } = useQuery({ queryKey: ["/api/tags"], queryFn: fetchTags });

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: "100" });
    if (current.types.length) p.set("type", current.types.join(","));
    if (query) p.set("q", query);
    if (tagFilter.length) p.set("tags", tagFilter.join(","));
    return p;
  }, [current, query, tagFilter]);

  const { data: records = [], isLoading, error } = useQuery({
    queryKey: ["/api/records", params.toString()],
    queryFn: () => fetchRecords(params),
  });

  const mapParams = useMemo(() => {
    const p = new URLSearchParams({ type: layers.join(",") });
    const from = RANGES.find(r => r.key === range)!.from();
    if (from) p.set("from", from.toISOString());
    return p;
  }, [layers, range]);

  const { data: mapData } = useQuery<{ features: MapFeature[] }>({
    queryKey: ["/api/records", "map", mapParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/records/map?${mapParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Couldn't load the map layers");
      return res.json();
    },
    enabled: view === "map" && layers.length > 0,
  });

  const { data: paddockMap } = useQuery({ queryKey: PADDOCK_MAP_KEY, queryFn: fetchPaddockMap, enabled: view === "map" });
  // Jobs not yet done that have a pin
  const { data: openJobs = [] } = useQuery<MapJob[]>({
    queryKey: ["/api/jobs", "map-layer"],
    queryFn: async () => {
      const res = await fetch("/api/jobs", { credentials: "include" });
      if (!res.ok) return [];
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      return (await res.json())
        .filter((j: any) => j.latitude != null && j.longitude != null && j.status !== "completed" && j.status !== "cancelled")
        .map((j: any) => ({
          id: j.id, title: j.title, status: j.status, priority: j.priority, latitude: j.latitude, longitude: j.longitude,
          assignedToNames: j.assignedToNames, overdue: (j.endDate || j.startDate) < today,
        }));
    },
    enabled: view === "map" && showJobs,
  });

  const remove = useMutation({
    mutationFn: (r: FarmRecord) => deleteRecord(r.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/records"] });
      toast.success("Record removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendingHere = pending.filter(p => current.types.length === 0 || current.types.includes(p.draft.type));
  const activeWithholding = (mapData?.features ?? []).filter(f => f.properties.withholdingActive);

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-pulse-forest">Records</h1>
          <p className="text-sm text-muted-foreground">Sprays, fertiliser, feed, effluent, work done and documents, with their evidence.</p>
        </div>
        <Button
          className="bg-pulse-forest hover:bg-pulse-forest-dark"
          onClick={() => window.dispatchEvent(new CustomEvent(NEW_RECORD_EVENT, { detail: { type: current.newType } }))}
        >
          <Plus className="h-4 w-4 mr-1" />New {current.key === "all" ? "record" : recordTypeDef(current.newType).label.toLowerCase()}
        </Button>
      </div>

      <SeasonPanel />

      <div className="flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Record categories">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn("px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px",
              tab === t.key ? "border-pulse-forest text-pulse-forest" : "border-transparent text-muted-foreground hover:text-foreground")}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="records-search"
            className="pl-9"
            placeholder="Search products, suppliers, dockets, notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-md border overflow-hidden" role="group" aria-label="View">
          <button className={cn("px-3 py-2 text-sm flex items-center gap-1", view === "list" && "bg-muted")} onClick={() => setView("list")} aria-pressed={view === "list"}>
            <List className="h-4 w-4" />List
          </button>
          <button className={cn("px-3 py-2 text-sm flex items-center gap-1", view === "map" && "bg-muted")} onClick={() => setView("map")} aria-pressed={view === "map"}>
            <MapIcon className="h-4 w-4" />Map
          </button>
        </div>
      </div>

      {tags.length > 0 && view === "list" && (
        <div className="flex flex-wrap gap-2" aria-label="Filter by tag">
          {tags.map(t => {
            const on = tagFilter.includes(t.slug);
            return (
              <button
                key={t.id}
                onClick={() => setTagFilter(f => (on ? f.filter(s => s !== t.slug) : [...f, t.slug]))}
                aria-pressed={on}
                className={cn("text-xs px-2.5 py-1 rounded-full border", on ? "text-white border-transparent" : "hover:bg-muted")}
                style={on ? { backgroundColor: t.color ?? "#495057" } : undefined}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      )}

      {view === "map" ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {MAPPED_TYPES.map(t => {
              const on = layers.includes(t.type);
              return (
                <button
                  key={t.type}
                  onClick={() => setLayers(l => (on ? l.filter(x => x !== t.type) : [...l, t.type]))}
                  aria-pressed={on}
                  className={cn("text-sm px-3 py-1 rounded-full border flex items-center gap-1.5", !on && "opacity-50")}
                >
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: t.color }} />{t.label}
                </button>
              );
            })}
            <button
              onClick={() => setShowPaddocks(v => !v)}
              aria-pressed={showPaddocks}
              className={cn("text-sm px-3 py-1 rounded-full border flex items-center gap-1.5", !showPaddocks && "opacity-50")}
            >
              <span className="h-2.5 w-2.5 rounded-sm border border-gray-500" />Paddocks
            </button>
            <button
              onClick={() => setShowJobs(v => !v)}
              aria-pressed={showJobs}
              className={cn("text-sm px-3 py-1 rounded-full border flex items-center gap-1.5", !showJobs && "opacity-50")}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />Open jobs
            </button>
            <select
              id="records-map-range"
              className="ml-auto h-9 rounded-md border bg-background px-2 text-sm"
              value={range}
              onChange={e => setRange(e.target.value)}
              aria-label="Date range"
            >
              {RANGES.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          {activeWithholding.length > 0 && (
            <p className="text-sm rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2 dark:bg-red-950 dark:text-red-200 dark:border-red-900">
              {activeWithholding.length} sprayed area{activeWithholding.length === 1 ? " is" : "s are"} still in grazing withholding (red dashed outline).
            </p>
          )}
          <RecordsMap
            features={mapData?.features ?? []}
            paddocks={showPaddocks ? paddockMap?.features ?? [] : []}
            jobs={showJobs ? openJobs : []}
          />
          <p className="text-xs text-muted-foreground">
            {mapData ? `${mapData.features.length} mapped record${mapData.features.length === 1 ? "" : "s"}. ` : ""}
            Tap an area for its date, product and rate, or a pin for its job. Records without a drawn area appear in the list only.
            {paddockMap && paddockMap.unmapped.length > 0 && ` ${paddockMap.unmapped.length} paddock${paddockMap.unmapped.length === 1 ? " isn't" : "s aren't"} drawn yet (Pastures → Draw on map).`}
          </p>
        </section>
      ) : (
        <section className="space-y-3" aria-live="polite">
          {pendingHere.map(p => (
            <article key={p.clientId} className="rounded-lg border border-dashed border-amber-400 bg-amber-50 dark:bg-amber-950/40 p-4 flex items-start gap-3">
              <CloudUpload className="h-5 w-5 text-amber-700 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{p.draft.title}</p>
                <p className="text-sm text-muted-foreground">
                  {recordTypeDef(p.draft.type).label} · saved on this device {format(new Date(p.createdAt), "d MMM, h:mm a")} ·{" "}
                  {p.error ? <span className="text-red-700">Not accepted: {p.error}</span> : "uploads when you're back online"}
                  {p.files.length > 0 && <> · <ImageIcon className="inline h-3.5 w-3.5" /> {p.files.length}</>}
                </p>
              </div>
              {p.error && (
                <Button variant="ghost" size="sm" onClick={() => discardOutboxItem(p.clientId)}>Discard</Button>
              )}
            </article>
          ))}

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading records…</p>
          ) : error ? (
            <p className="text-sm text-red-700">{(error as Error).message}</p>
          ) : records.length === 0 && pendingHere.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center space-y-2">
              <p className="font-medium">{query || tagFilter.length ? "No records match" : `No ${current.key === "all" ? "" : current.label.toLowerCase() + " "}records yet`}</p>
              <p className="text-sm text-muted-foreground">
                {query || tagFilter.length
                  ? "Try other words or fewer tags."
                  : "Use the Record button to log what was done, where, and attach the docket or label."}
              </p>
            </div>
          ) : (
            records.map(r => (
              <RecordCard
                key={r.id}
                record={r}
                onDelete={rec => remove.mutate(rec)}
              />
            ))
          )}
          {records.length > 0 && <Badge variant="outline">{records.length} shown</Badge>}
        </section>
      )}
    </div>
  );
}
