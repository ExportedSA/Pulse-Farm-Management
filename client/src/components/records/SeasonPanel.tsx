import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFarm } from "@/lib/farm-context";
import { fetchSeasonSummary } from "@/lib/records";

// NZ dairy seasons start 1 June
function currentSeason(): string {
  const now = new Date();
  const start = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function previousSeasons(count: number): string[] {
  const start = Number(currentSeason().slice(0, 4));
  return Array.from({ length: count }, (_, i) => `${start - i}/${String((start - i + 1) % 100).padStart(2, "0")}`);
}

/**
 * Edit the farm's effective (grazed) area, used for per-hectare totals
 */
function EffectiveAreaEditor({ current, onSaved }: { current: number | null; onSaved: () => void }) {
  const { currentFarm } = useFarm();
  const [value, setValue] = useState(current != null ? String(current) : "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const ha = Number(value);
    if (!currentFarm || !Number.isFinite(ha) || ha <= 0) {
      toast.error("Enter the effective area in hectares");
      return;
    }
    setSaving(true);
    try {
      // Merge into the farm's existing settings rather than replacing them
      const farmRes = await fetch(`/api/farms/${currentFarm.id}`, { credentials: "include" });
      const farm = (await farmRes.json()).data;
      const res = await fetch(`/api/farms/${currentFarm.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { ...(farm?.settings ?? {}), effectiveAreaHa: ha } }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Couldn't save");
      toast.success("Effective area saved");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex items-center gap-2">
      <Input id="effective-area" type="number" inputMode="decimal" className="h-8 w-24" value={value}
        onChange={e => setValue(e.target.value)} aria-label="Effective area in hectares" />
      <span className="text-sm">ha</span>
      <Button size="sm" variant="outline" onClick={save} disabled={saving}>Save</Button>
    </div>
  );
}

/**
 * Season totals that Fonterra's Farm Dairy Records ask for, built from the farm's records
 */
export function SeasonPanel() {
  const queryClient = useQueryClient();
  const [season, setSeason] = useState(currentSeason);
  const [editingArea, setEditingArea] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["/api/records", "summary", season],
    queryFn: () => fetchSeasonSummary(season),
  });

  if (isLoading || !data) {
    return <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">Working out the season…</section>;
  }

  const n = data.nitrogen;
  const nPct = n.syntheticKgPerHa != null ? Math.min(100, (n.syntheticKgPerHa / n.capKgPerHa) * 100) : 0;
  const nLevel = n.syntheticKgPerHa == null ? "unknown" : n.syntheticKgPerHa > n.capKgPerHa ? "over" : n.syntheticKgPerHa > n.capKgPerHa * 0.85 ? "near" : "ok";

  return (
    <section className="rounded-lg border bg-card p-4 space-y-4" aria-labelledby="season-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="season-heading" className="font-semibold">Season {data.season}</h2>
        <select id="season-select" className="h-8 rounded-md border bg-background px-2 text-sm" value={season}
          onChange={e => setSeason(e.target.value)} aria-label="Season">
          {previousSeasons(4).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted-foreground">Synthetic nitrogen applied</span>
            <span className="text-xs text-muted-foreground">cap {n.capKgPerHa} kg N/ha</span>
          </div>
          <div className="text-2xl font-bold tabular-nums">
            {n.syntheticKgPerHa != null ? `${n.syntheticKgPerHa} kg N/ha` : "—"}
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden" role="meter" aria-valuemin={0}
            aria-valuemax={n.capKgPerHa} aria-valuenow={n.syntheticKgPerHa ?? 0} aria-label="Nitrogen against the cap">
            <div className={cn("h-full rounded-full",
              nLevel === "over" ? "bg-red-600" : nLevel === "near" ? "bg-amber-500" : "bg-pulse-forest")}
              style={{ width: `${nPct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {n.syntheticKg.toLocaleString()} kg N from fertiliser
            {n.effluentKg > 0 && ` · plus ${n.effluentKg.toLocaleString()} kg N from effluent (${n.totalKgPerHa} kg N/ha total)`}
            {nLevel === "near" && " · close to the cap"}
            {nLevel === "over" && " · over the cap"}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">Imported supplement fed</span>
          <div className="text-2xl font-bold tabular-nums">{data.feed.importedFedT} t</div>
          <p className="text-xs text-muted-foreground">
            {data.feed.homeGrownSupplementPct != null
              ? `${data.feed.homeGrownSupplementPct}% of supplement fed was home-grown`
              : `${data.feed.boughtInT} t bought in`}
          </p>
        </div>

        <div className="space-y-1">
          <span className="text-sm text-muted-foreground">Spray applications</span>
          <div className="text-2xl font-bold tabular-nums">{data.spray.applications}</div>
          <p className={cn("text-xs", data.spray.activeWithholding > 0 ? "text-red-700 font-medium" : "text-muted-foreground")}>
            {data.spray.activeWithholding > 0
              ? `${data.spray.activeWithholding} area${data.spray.activeWithholding === 1 ? "" : "s"} not yet safe to graze`
              : "No areas in withholding"}
            {` · ${data.monthlyChecks} monthly check${data.monthlyChecks === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-x-8 gap-y-3 text-sm border-t pt-3">
        <div className="space-y-1">
          <span className="text-muted-foreground">Effective area</span>
          {editingArea ? (
            <EffectiveAreaEditor current={data.effectiveAreaHa} onSaved={() => {
              setEditingArea(false);
              queryClient.invalidateQueries({ queryKey: ["/api/records", "summary"] });
            }} />
          ) : (
            <p>
              {data.effectiveAreaHa != null ? `${data.effectiveAreaHa} ha (${data.effectiveAreaSource})` : "Not set"}{" "}
              <button className="underline text-pulse-forest" onClick={() => setEditingArea(true)}>Change</button>
            </p>
          )}
        </div>
        <div className="space-y-1 min-w-0">
          <span className="text-muted-foreground">Feed on hand</span>
          {data.feedOnHand.length === 0 ? (
            <p>Nothing recorded. Feed in and baleage made add to it; feed out takes from it.</p>
          ) : (
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {data.feedOnHand.map(f => (
                <li key={`${f.product}-${f.unit}`} className={cn("tabular-nums", f.quantity < 0 && "text-red-700")}>
                  {f.product}: {f.quantity} {f.unit}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {data.incomplete.length > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          {data.incomplete.length} fertiliser/effluent record{data.incomplete.length === 1 ? " isn't" : "s aren't"} counted yet:{" "}
          {data.incomplete.slice(0, 3).map(i => `"${i.title}" ${i.reason}`).join("; ")}
          {data.incomplete.length > 3 && "…"}
        </p>
      )}
    </section>
  );
}
