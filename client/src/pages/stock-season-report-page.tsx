import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_COLUMNS, type ReportRow } from "@shared/stock";

// A season's stock numbers per class, in the form farm accounts use: last season's closing, the
// move-up at the balance date, opening, natural increase, purchases, sales, killed, deaths and so
// on, and closing. Print, save as PDF, or download as CSV.

interface Report {
  farm: { name: string; naitNumber: string | null };
  balanceDate: string;
  season: { startsOn: string; endsOn: string; closedAt: string | null };
  rows: ReportRow[];
  balances: boolean;
  notCounted: { issues: number; killsheetHead: number; calves: number };
}

const day = (iso: string) => format(new Date(`${iso}T00:00:00`), "d MMMM yyyy");
const cell = (n: number | null | undefined) => (n ? n : "—");
const signed = (n: number | null) => (n == null ? "" : n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "—");
const sum = (rows: ReportRow[], pick: (r: ReportRow) => number | null | undefined) => rows.reduce((s, r) => s + (pick(r) ?? 0), 0);

function toCsv(r: Report, firstSeason: boolean) {
  const quote = (v: string | number | null) => (v == null ? "" : typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);
  const lead = firstSeason ? [] : ["Closing last season", "Rollover in", "Rollover out"];
  const header = ["Class", ...lead, "Opening", ...REPORT_COLUMNS.map(c => c.label), "Closing"];
  const line = (name: string, pick: (f: (r: ReportRow) => number | null | undefined) => number) => [
    name, ...(firstSeason ? [] : [pick(x => x.lastClosing), pick(x => x.rolledIn), pick(x => x.rolledOut)]), pick(x => x.opening),
    ...REPORT_COLUMNS.map(col => pick(x => x.byType[col.type] ?? 0)), pick(x => x.closing),
  ];
  const rows = r.rows.map(row => line(row.stockClass, f => f(row) ?? 0));
  const total = line("Total", f => sum(r.rows, f));
  return [header, ...rows, total].map(l => l.map(quote).join(",")).join("\r\n");
}

export default function StockSeasonReportPage() {
  const [, params] = useRoute("/app/stock-reconciliation/seasons/:id/report");
  const id = params?.id;
  const { data, error } = useQuery({
    queryKey: ["/api/stock-recon/seasons", id, "report"],
    queryFn: async () => {
      const res = await fetch(`/api/stock-recon/seasons/${id}/report`, { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Couldn't load the report");
      return body as Report;
    },
    enabled: !!id,
  });

  if (!data) return <div className="p-6 text-sm text-muted-foreground">{error ? (error as Error).message : "Loading the season report…"}</div>;

  const firstSeason = data.rows.every(r => r.lastClosing === null);
  const download = () => {
    const blob = new Blob([toCsv(data, firstSeason)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stock-reconciliation-${data.season.startsOn.slice(0, 4)}-${data.season.endsOn.slice(0, 4)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const { issues, killsheetHead, calves } = data.notCounted;
  const pending = [
    issues && `${issues} animal record${issues === 1 ? "" : "s"} that can't be counted properly`,
    killsheetHead && `${killsheetHead} head on killsheets`,
    calves && `${calves} calf${calves === 1 ? "" : "ves"} born with no calf in the register`,
  ].filter(Boolean);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4 print:p-0 print:max-w-none bg-white text-black">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/stock-reconciliation"><ArrowLeft className="h-4 w-4 mr-1" />Stock reconciliation</Link>
        </Button>
        <Button size="sm" variant="outline" className="ml-auto" onClick={download}><Download className="h-4 w-4 mr-1" />Download CSV</Button>
        <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />Print / save as PDF</Button>
      </div>
      <header className="border-b pb-2">
        <h1 className="text-2xl font-bold">Stock reconciliation · {data.farm.name}</h1>
        <p className="text-sm">
          Season {day(data.season.startsOn)} to {day(data.season.endsOn)}
          {data.farm.naitNumber && ` · NAIT location ${data.farm.naitNumber}`}
          {" · "}{data.season.closedAt ? `closed ${format(new Date(data.season.closedAt), "d MMM yyyy")}` : "not yet closed: numbers may change"}
        </p>
        <p className="text-xs mt-1">
          Head of cattle by IRD livestock class. Classes are as at the balance date at the end of the season; at each balance date
          every class moves up a year (rollover), so last season's closing numbers become this season's opening numbers one class up.
          Rollover in is head that moved up into a class from the class below; rollover out is head that moved up out of it.
        </p>
      </header>
      {(pending.length > 0 || !data.balances) && (
        <p className="text-sm border border-amber-400 bg-amber-50 p-2 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {!data.balances && "Some classes don't add up: check the opening numbers and movements. "}
            {pending.length > 0 && `Not yet counted in these numbers: ${pending.join("; ")}.`}
          </span>
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b align-bottom">
              <th className="py-1 pr-3">Class</th>
              {!firstSeason && <th className="pr-3 text-right">Closing last season</th>}
              {!firstSeason && <th className="pr-3 text-right">Rollover in</th>}
              {!firstSeason && <th className="pr-3 text-right">Rollover out</th>}
              <th className="pr-3 text-right">Opening</th>
              {REPORT_COLUMNS.map(c => <th key={c.type} className="pr-3 text-right">{c.label}</th>)}
              <th className="text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map(r => (
              <tr key={r.stockClass} className="border-b break-inside-avoid">
                <td className="py-1 pr-3 font-medium">{r.stockClass}{!r.balances && " ⚠"}</td>
                {!firstSeason && <td className="pr-3 text-right tabular-nums">{r.lastClosing ?? 0}</td>}
                {!firstSeason && <td className="pr-3 text-right tabular-nums">{signed(r.rolledIn)}</td>}
                {!firstSeason && <td className="pr-3 text-right tabular-nums">{signed(r.rolledOut == null ? null : -r.rolledOut)}</td>}
                <td className="pr-3 text-right tabular-nums">{r.opening}</td>
                {REPORT_COLUMNS.map(col => <td key={col.type} className="pr-3 text-right tabular-nums">{cell(r.byType[col.type])}</td>)}
                <td className="text-right tabular-nums font-semibold">{r.closing}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t-2">
              <td className="py-1 pr-3">Total</td>
              {!firstSeason && <td className="pr-3 text-right tabular-nums">{sum(data.rows, r => r.lastClosing)}</td>}
              {!firstSeason && <td className="pr-3 text-right tabular-nums">{signed(sum(data.rows, r => r.rolledIn))}</td>}
              {!firstSeason && <td className="pr-3 text-right tabular-nums">{signed(-sum(data.rows, r => r.rolledOut))}</td>}
              <td className="pr-3 text-right tabular-nums">{sum(data.rows, r => r.opening)}</td>
              {REPORT_COLUMNS.map(col => <td key={col.type} className="pr-3 text-right tabular-nums">{cell(sum(data.rows, r => r.byType[col.type]))}</td>)}
              <td className="text-right tabular-nums">{sum(data.rows, r => r.closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs">
        {firstSeason ? "Opening numbers are the head counted on the first day of the farm's first season in Pulse. " : ""}
        Natural increase is animals born on the farm during the season, including bobby calves. Killed (works) is stock sent to the
        works on a killsheet; killed for rations is stock killed on the farm for its own use. Adjustments are corrections to match stocktakes.
        For every class, opening plus what came in, less what went out, equals closing.
        Printed {format(new Date(), "d MMMM yyyy")} from Pulse.
      </p>
    </div>
  );
}
