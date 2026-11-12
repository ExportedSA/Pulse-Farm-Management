import { Link, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REPORT_COLUMNS, type ClassTotals } from "@shared/stock";

// A season's stock numbers per class, in the form farm accounts use: opening, natural increase,
// purchases, sales, deaths and so on, and closing. Print, save as PDF, or download as CSV.

interface Report {
  farm: { name: string; naitNumber: string | null };
  season: { startsOn: string; endsOn: string; closedAt: string | null };
  classes: ClassTotals[];
}

const day = (iso: string) => format(new Date(`${iso}T00:00:00`), "d MMMM yyyy");
const cell = (n: number | undefined) => (n ? n : "—");

function toCsv(r: Report) {
  const quote = (v: string | number) => (typeof v === "number" ? String(v) : `"${v.replace(/"/g, '""')}"`);
  const header = ["Class", "Opening", ...REPORT_COLUMNS.map(c => c.label), "Closing"];
  const rows = r.classes.map(c => [c.stockClass, c.opening, ...REPORT_COLUMNS.map(col => c.byType[col.type] ?? 0), c.closing]);
  const total = ["Total", sum(r.classes, c => c.opening), ...REPORT_COLUMNS.map(col => sum(r.classes, c => c.byType[col.type] ?? 0)), sum(r.classes, c => c.closing)];
  return [header, ...rows, total].map(line => line.map(quote).join(",")).join("\r\n");
}

const sum = (classes: ClassTotals[], pick: (c: ClassTotals) => number) => classes.reduce((s, c) => s + pick(c), 0);

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

  const download = () => {
    const blob = new Blob([toCsv(data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stock-reconciliation-${data.season.startsOn.slice(0, 4)}-${data.season.endsOn.slice(0, 4)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
        <p className="text-xs mt-1">Head of cattle by IRD livestock class. Classes are as at the balance date at the end of the season.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left border-b align-bottom">
              <th className="py-1 pr-3">Class</th>
              <th className="pr-3 text-right">Opening</th>
              {REPORT_COLUMNS.map(c => <th key={c.type} className="pr-3 text-right">{c.label}</th>)}
              <th className="text-right">Closing</th>
            </tr>
          </thead>
          <tbody>
            {data.classes.map(c => (
              <tr key={c.stockClass} className="border-b break-inside-avoid">
                <td className="py-1 pr-3 font-medium">{c.stockClass}</td>
                <td className="pr-3 text-right tabular-nums">{c.opening}</td>
                {REPORT_COLUMNS.map(col => <td key={col.type} className="pr-3 text-right tabular-nums">{cell(c.byType[col.type])}</td>)}
                <td className="text-right tabular-nums font-semibold">{c.closing}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold border-t-2">
              <td className="py-1 pr-3">Total</td>
              <td className="pr-3 text-right tabular-nums">{sum(data.classes, c => c.opening)}</td>
              {REPORT_COLUMNS.map(col => <td key={col.type} className="pr-3 text-right tabular-nums">{cell(sum(data.classes, c => c.byType[col.type] ?? 0))}</td>)}
              <td className="text-right tabular-nums">{sum(data.classes, c => c.closing)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs">
        Natural increase is animals born on the farm during the season. Adjustments are corrections to match stocktakes.
        Printed {format(new Date(), "d MMMM yyyy")} from Pulse.
      </p>
    </div>
  );
}
