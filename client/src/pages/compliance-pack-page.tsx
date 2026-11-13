import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CircleSlash, Download, Printer, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { currentSeason, previousSeasons } from "@/components/records/SeasonPanel";
import { openEditRecord, openNewRecord } from "@/components/records/RecordFab";
import type { RecordType } from "@/lib/records";

type Status = "ok" | "attention" | "missing";
type Fix =
  | { kind: "new"; recordType: RecordType; details?: Record<string, unknown>; title?: string }
  | { kind: "edit"; recordId: string }
  | { kind: "link"; href: string; label: string };

interface Requirement {
  key: string; title: string; why: string; status: Status; summary: string; packSection?: string;
  issues: { title: string; problem: string; fix?: Fix }[];
}
interface Readiness {
  season: string; farmName: string | null; generatedAt: string;
  counts: Record<Status, number>; requirements: Requirement[];
}
interface PackSection { key: string; title: string; headers: string[]; rows: string[][] }
interface AuditPack { season: string; farmName: string | null; generatedAt: string; sections: PackSection[] }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

const STATUS = {
  ok: { label: "Ready", icon: CheckCircle2, className: "text-green-700 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/40 dark:border-green-900" },
  attention: { label: "Needs attention", icon: AlertTriangle, className: "text-amber-800 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-900" },
  missing: { label: "Missing", icon: CircleSlash, className: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-900" },
} as const;

// Everyday paperwork, one tap each
const QUICK_ADD: { type: RecordType; label: string }[] = [
  { type: "spray", label: "Spray" },
  { type: "fertiliser", label: "Fertiliser" },
  { type: "effluent", label: "Effluent" },
  { type: "feed_in", label: "Feed docket" },
  { type: "feed_out", label: "Feed out" },
  { type: "monthly_check", label: "Monthly check" },
  { type: "document", label: "Document" },
];

const csvUrl = (section: string, season: string) =>
  `/api/compliance/pack/${section}.csv?season=${encodeURIComponent(season)}`;

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Open the audit pack as a plain printable document (print, or save as PDF)
 */
function printPack(pack: AuditPack) {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error("Allow pop-ups for Pulse to print the audit pack");
    return;
  }
  const sections = pack.sections.map(s => `
    <section>
      <h2>${escapeHtml(s.title)}</h2>
      ${s.rows.length === 0 ? "<p class=\"none\">Nothing recorded this season.</p>" : `
      <table>
        <thead><tr>${s.headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
        <tbody>${s.rows.map(r => `<tr>${r.map(c => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>`}
    </section>`).join("");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8">
    <title>Audit pack ${escapeHtml(pack.season)}${pack.farmName ? ` - ${escapeHtml(pack.farmName)}` : ""}</title>
    <style>
      body { font: 11px/1.4 system-ui, sans-serif; color: #111; margin: 16px; }
      h1 { font-size: 18px; margin: 0 0 2px; } .meta { color: #555; margin: 0 0 16px; }
      h2 { font-size: 14px; margin: 18px 0 6px; } section { break-inside: auto; }
      table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #999; padding: 3px 5px; text-align: left; vertical-align: top; }
      th { background: #eee; } tr { break-inside: avoid; } .none { color: #555; font-style: italic; }
      @page { size: A4 landscape; margin: 12mm; }
    </style></head><body>
    <h1>Farm records audit pack</h1>
    <p class="meta">${escapeHtml(pack.farmName ?? "")} · Season ${escapeHtml(pack.season)} · Printed ${new Date(pack.generatedAt).toLocaleString()}</p>
    ${sections}
    <script>window.onload = () => window.print();</script>
    </body></html>`);
  win.document.close();
}

function FixButton({ fix }: { fix: Fix }) {
  if (fix.kind === "link") {
    return <Button asChild size="sm" variant="outline"><Link href={fix.href}>{fix.label}</Link></Button>;
  }
  if (fix.kind === "edit") {
    return <Button size="sm" variant="outline" onClick={() => openEditRecord(fix.recordId)}>Finish it</Button>;
  }
  return (
    <Button size="sm" className="bg-pulse-forest hover:bg-pulse-forest-dark"
      onClick={() => openNewRecord({ type: fix.recordType, details: fix.details as Record<string, any>, title: fix.title })}>
      Fill in
    </Button>
  );
}

function RequirementCard({ req, season }: { req: Requirement; season: string }) {
  const [showAll, setShowAll] = useState(false);
  const s = STATUS[req.status];
  const issues = showAll ? req.issues : req.issues.slice(0, 4);
  return (
    <article className="rounded-lg border bg-card p-4 space-y-3" data-testid={`requirement-${req.key}`}>
      <div className="flex flex-wrap items-start gap-3">
        <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium shrink-0", s.className)}>
          <s.icon className="h-3.5 w-3.5" aria-hidden />{s.label}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{req.title}</h3>
          <p className="text-sm">{req.summary}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{req.why}</p>
        </div>
        {req.packSection && (
          <Button asChild size="sm" variant="ghost">
            <a href={csvUrl(req.packSection, season)} download><Download className="h-4 w-4 mr-1" />CSV</a>
          </Button>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="divide-y rounded-md border">
          {issues.map((issue, i) => (
            <li key={`${issue.title}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{issue.title}</p>
                <p className="text-xs text-muted-foreground">{issue.problem}</p>
              </div>
              {issue.fix && <FixButton fix={issue.fix} />}
            </li>
          ))}
        </ul>
      )}
      {req.issues.length > 4 && (
        <button className="text-sm underline text-pulse-forest" onClick={() => setShowAll(v => !v)}>
          {showAll ? "Show fewer" : `Show all ${req.issues.length}`}
        </button>
      )}
    </article>
  );
}

/**
 * Audit readiness: every Dairy Diary / Farm Dairy Records requirement checked against the
 * farm's records, with one-tap fixes, and the audit pack to print or download
 */
export default function CompliancePackPage() {
  const [season, setSeason] = useState(currentSeason);
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/compliance", "readiness", season],
    queryFn: () => getJson<Readiness>(`/api/compliance/readiness?season=${encodeURIComponent(season)}`),
  });
  const [printing, setPrinting] = useState(false);

  const print = async () => {
    setPrinting(true);
    try {
      printPack(await getJson<AuditPack>(`/api/compliance/pack?season=${encodeURIComponent(season)}`));
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-pulse-forest">Compliance</h1>
          <p className="text-sm text-muted-foreground">What an auditor will ask to see, checked against your records.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="h-9 rounded-md border bg-background px-2 text-sm" value={season}
            onChange={e => setSeason(e.target.value)} aria-label="Season">
            {previousSeasons(4).map(s => <option key={s} value={s}>Season {s}</option>)}
          </select>
          <Button onClick={print} disabled={printing} variant="outline">
            <Printer className="h-4 w-4 mr-1" />{printing ? "Preparing…" : "Print audit pack"}
          </Button>
        </div>
      </header>

      <section aria-label="Add a record" className="flex flex-wrap gap-2">
        {QUICK_ADD.map(q => (
          <Button key={q.type} size="sm" variant="secondary" onClick={() => openNewRecord({ type: q.type })}>
            <Plus className="h-4 w-4 mr-1" />{q.label}
          </Button>
        ))}
      </section>

      {isLoading && <p className="text-sm text-muted-foreground">Checking your records…</p>}
      {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {(["ok", "attention", "missing"] as Status[]).map(k => (
              <div key={k} className={cn("rounded-lg border p-3", STATUS[k].className)}>
                <div className="text-2xl font-bold tabular-nums">{data.counts[k]}</div>
                <div className="text-sm">{STATUS[k].label}</div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[...data.requirements]
              .sort((a, b) => ["missing", "attention", "ok"].indexOf(a.status) - ["missing", "attention", "ok"].indexOf(b.status))
              .map(req => <RequirementCard key={req.key} req={req} season={season} />)}
          </div>
        </>
      )}
    </div>
  );
}
