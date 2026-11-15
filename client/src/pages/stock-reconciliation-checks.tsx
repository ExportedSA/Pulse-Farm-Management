import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { STOCK_CLASSES, STOCK_MOVEMENT_LABELS, type MobCheck, type RolloverPlan, type StockMovementType } from "@shared/stock";

// The parts of stock reconciliation that check the tally against other records: the move-up at
// the balance date (checked before a season closes), killsheets and calvings not yet counted,
// mobs against the class totals, and NAIT.

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const day = (iso: string) => format(new Date(`${iso.slice(0, 10)}T00:00:00`), "d MMM yyyy");
const todayIso = () => format(new Date(), "yyyy-MM-dd");
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["/api/stock-recon"] });
}

// ----- The move-up at the balance date -----

interface RolloverPreview {
  season: { id: string; startsOn: string; endsOn: string; closed: boolean };
  next: { startsOn: string; endsOn: string };
  plan: RolloverPlan;
  register: { moves: { from: string; to: string; head: number }[]; opening: Record<string, number> };
  mobs: { id: string; name: string; from: string; to: string; head: number }[];
  negative: { stockClass: string; closing: number }[];
  issues: number;
}

/** Shows what closing the season moves up, class by class, and closes it once confirmed */
export function RolloverDialog({ open, onOpenChange, seasonId, seasonLabel }: {
  open: boolean; onOpenChange: (v: boolean) => void; seasonId: string; seasonLabel: string;
}) {
  const refresh = useRefresh();
  const [moveMobs, setMoveMobs] = useState(true);
  const [checked, setChecked] = useState(false);
  useEffect(() => { if (open) { setMoveMobs(true); setChecked(false); } }, [open]);
  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/stock-recon", "rollover", seasonId],
    queryFn: () => api<RolloverPreview>(`/api/stock-recon/seasons/${seasonId}/rollover`),
    enabled: open,
  });
  const close = useMutation({
    mutationFn: () => api<{ mobsMoved: number }>(`/api/stock-recon/seasons/${seasonId}/close`, json("POST", { confirm: true, moveMobs })),
    onSuccess: r => {
      toast.success(`Season closed and the next one opened${r.mobsMoved ? `; ${plural(r.mobsMoved, "mob")} moved up` : ""}`);
      refresh();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const openingRows = data ? Object.entries(data.plan.opening) : [];
  const registerTotal = data ? Object.values(data.register.opening).reduce((s, n) => s + n, 0) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Close the {seasonLabel} and move stock up</DialogTitle>
          <DialogDescription>
            At the balance date each class moves up a year: this season's calves become rising two-year stock, rising two-year
            heifers join the mixed-age cows. Check the numbers below before you confirm. You can reopen the season later to correct it.
          </DialogDescription>
        </DialogHeader>
        {isLoading && <p className="text-sm text-muted-foreground">Working out the move-up…</p>}
        {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}
        {data && (
          <div className="space-y-4 text-sm">
            {data.negative.length > 0 && (
              <p className="rounded-md border border-red-300 bg-red-50 p-3 text-red-900">
                Can't close yet: more stock left than was on hand in {data.negative.map(n => `${n.stockClass} (${n.closing})`).join(", ")}.
                Check the opening numbers and movements.
              </p>
            )}
            <div>
              <h3 className="font-medium mb-1">Moving up on {day(data.next.startsOn)}</h3>
              {data.plan.moves.length === 0 ? <p className="text-muted-foreground">Nothing moves up.</p> : (
                <ul className="divide-y rounded-md border">
                  {data.plan.moves.map(m => (
                    <li key={m.from} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="tabular-nums font-semibold w-12 text-right">{m.head}</span>
                      <span>{m.from}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /><span>{m.to}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.plan.stay.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Staying where they are: {data.plan.stay.map(s => `${s.head} ${s.stockClass}`).join(", ")}.
                </p>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-1">The {data.next.startsOn.slice(0, 4)}–{data.next.endsOn.slice(2, 4)} season opens with</h3>
              <table className="w-full">
                <thead><tr className="text-left border-b text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Class</th><th className="text-right font-medium">Head</th>
                  <th className="text-right font-medium" title="Animals in the register, by their class that day">In the register</th>
                </tr></thead>
                <tbody>
                  {openingRows.map(([c, n]) => {
                    const reg = data.register.opening[c] ?? 0;
                    return (
                      <tr key={c} className="border-b">
                        <td className="py-1">{c}</td>
                        <td className="text-right tabular-nums font-semibold">{n}</td>
                        <td className={cn("text-right tabular-nums", reg === n ? "text-muted-foreground" : "text-amber-800")}>{reg}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {registerTotal > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {plural(data.register.moves.reduce((s, m) => s + m.head, 0), "animal")} in the register move up with their class.
                  The register is lower than the tally when some stock isn't recorded animal by animal.
                </p>
              )}
            </div>
            {data.mobs.length > 0 && (
              <div className="space-y-1">
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-1" checked={moveMobs} onChange={e => setMoveMobs(e.target.checked)} />
                  <span>
                    Move these mobs up too: {data.mobs.map(m => `${m.name} (${m.from} → ${m.to})`).join("; ")}.
                    <span className="block text-xs text-muted-foreground">If you reopen the season later, mobs aren't moved back: check them then.</span>
                  </span>
                </label>
              </div>
            )}
            {data.issues > 0 && (
              <p className="text-amber-800">{plural(data.issues, "animal record")} can't be counted properly yet (listed on the page). Fix them first if they belong to this season.</p>
            )}
            <label className="flex items-start gap-2 font-medium">
              <input type="checkbox" className="mt-1" checked={checked} onChange={e => setChecked(e.target.checked)} />
              I've checked the move-up and the opening numbers for next season
            </label>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => close.mutate()}
            disabled={!data || !checked || data.negative.length > 0 || close.isPending}>
            <Lock className="h-4 w-4 mr-1" />Close season and move up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Killsheets and calvings not yet counted -----

export interface ToCount {
  killsheets: {
    id: string; date: string; processorName: string; lotNumber: string | null; animalCount: number;
    inRegister: number; counted: number; uncounted: number; stillOnFarm: { id: string; animal: string }[];
  }[];
  calvings: { id: string; date: string; calfSex: string | null; dam: string | null; stockClass: string | null }[];
}

function KillsheetDialog({ killsheet, onClose }: { killsheet: ToCount["killsheets"][number] | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [lines, setLines] = useState([{ stockClass: "Mixed-age cows", quantity: "" as number | "" }]);
  useEffect(() => { if (killsheet) setLines([{ stockClass: "Mixed-age cows", quantity: killsheet.uncounted }]); }, [killsheet]);
  const save = useMutation({
    mutationFn: () => api(`/api/stock-recon/killsheets/${killsheet!.id}/count`, json("POST", {
      lines: lines.filter(l => l.quantity !== "" && Number(l.quantity) > 0).map(l => ({ stockClass: l.stockClass, quantity: Number(l.quantity) })),
    })),
    onSuccess: () => { toast.success("Killsheet counted"); refresh(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!killsheet} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Count the killsheet</DialogTitle>
          <DialogDescription>
            {killsheet && `${killsheet.processorName}, ${day(killsheet.date)}: ${plural(killsheet.uncounted, "head", "head")} not in the animal register.`} Which classes were they?
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <select aria-label="Stock class" className={selectClass} value={line.stockClass}
                onChange={e => setLines(ls => ls.map((l, j) => (j === i ? { ...l, stockClass: e.target.value } : l)))}>
                {STOCK_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <Input aria-label="Head" type="number" min={1} inputMode="numeric" className="w-24" value={line.quantity}
                onChange={e => setLines(ls => ls.map((l, j) => (j === i ? { ...l, quantity: e.target.value === "" ? "" : Number(e.target.value) } : l)))} />
              {lines.length > 1 && (
                <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, { stockClass: STOCK_CLASSES[0], quantity: "" }])}>
            <Plus className="h-4 w-4 mr-1" />Another class
          </Button>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => save.mutate()} disabled={save.isPending}>Count as sent to the works</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Killsheets and calvings in the season that the tally doesn't count yet, each counted with one click */
export function RecordsToCount({ toCount, closed }: { toCount: ToCount; closed: boolean }) {
  const refresh = useRefresh();
  const [killsheet, setKillsheet] = useState<ToCount["killsheets"][number] | null>(null);
  const [leftOn, setLeftOn] = useState("");
  const markLeft = useMutation({
    mutationFn: (id: string) => api<{ marked: number }>(`/api/stock-recon/killsheets/${id}/mark-left`, { method: "POST" }),
    onSuccess: r => { toast.success(`${plural(r.marked, "animal")} recorded as sent to the works`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const countCalves = useMutation({
    mutationFn: (outcome: "sale" | "death") => api<{ counted: number; skipped: string[] }>("/api/stock-recon/calvings/count", json("POST", {
      calvingIds: toCount.calvings.map(c => c.id), outcome, leftOn: leftOn || null,
    })),
    onSuccess: r => {
      toast.success(`${plural(r.counted, "calf", "calves")} counted`);
      if (r.skipped.length) toast.warning(`Not counted: ${r.skipped.slice(0, 3).join("; ")}${r.skipped.length > 3 ? "…" : ""}`);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (toCount.killsheets.length === 0 && toCount.calvings.length === 0) return null;
  const heifers = toCount.calvings.filter(c => c.calfSex === "heifer").length;
  const bulls = toCount.calvings.filter(c => c.calfSex === "bull").length;
  const unknown = toCount.calvings.length - heifers - bulls;

  return (
    <section className="rounded-lg border border-sky-300 bg-sky-50 dark:bg-sky-950/30 p-3 space-y-3" aria-labelledby="to-count-heading">
      <h2 id="to-count-heading" className="font-semibold">From your records, not yet in the tally</h2>
      {toCount.killsheets.map(k => (
        <div key={k.id} className="text-sm space-y-1">
          <p>
            <Link href="/app/financial" className="font-medium underline">Killsheet from {k.processorName}</Link>, {day(k.date)}
            {k.lotNumber && ` (lot ${k.lotNumber})`}: {k.animalCount} head, {k.inRegister} in the animal register
            {k.counted > 0 && `, ${k.counted} counted here`}.
          </p>
          {k.uncounted > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span>{plural(k.uncounted, "head", "head")} not counted yet.</span>
              {!closed && <Button size="sm" variant="outline" onClick={() => setKillsheet(k)}>Count {k.uncounted} as sent to the works</Button>}
            </div>
          )}
          {k.uncounted < 0 && (
            <p className="text-amber-800">{plural(-k.uncounted, "more head", "more head")} counted than the killsheet lists: check the killsheet's head count, or remove the extra movement.</p>
          )}
          {k.stillOnFarm.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-amber-800">
                Still on the farm in the register: {k.stillOnFarm.slice(0, 8).map(a => a.animal).join(", ")}{k.stillOnFarm.length > 8 ? "…" : ""}.
              </span>
              {!closed && (
                <Button size="sm" variant="outline" onClick={() => markLeft.mutate(k.id)} disabled={markLeft.isPending}>
                  Record {k.stillOnFarm.length === 1 ? "it" : `these ${k.stillOnFarm.length}`} as sent to the works on {day(k.date)}
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
      {toCount.calvings.length > 0 && (
        <div className="text-sm space-y-2">
          <p>
            <span className="font-medium">{plural(toCount.calvings.length, "calf", "calves")} born</span> with no calf in the animal register
            ({[heifers && `${heifers} heifer`, bulls && `${bulls} bull`, unknown && `${unknown} sex not recorded`].filter(Boolean).join(", ")}),
            {" "}from {day(toCount.calvings[0].date)} to {day(toCount.calvings[toCount.calvings.length - 1].date)}.
            Calves you're rearing belong in the register; add them there with the calving. Bobby calves and calves that died can be counted here:
            each counts as born, then sold or died.
          </p>
          {!closed && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor="calves-left" className="text-xs">Day they left (empty: the day each was born)</Label>
                <Input id="calves-left" type="date" className="w-44" max={todayIso()} value={leftOn} onChange={e => setLeftOn(e.target.value)} />
              </div>
              <Button size="sm" variant="outline" onClick={() => countCalves.mutate("sale")} disabled={countCalves.isPending}>Count as bobby calves sold</Button>
              <Button size="sm" variant="outline" onClick={() => countCalves.mutate("death")} disabled={countCalves.isPending}>Count as died</Button>
            </div>
          )}
          {unknown > 0 && <p className="text-xs text-amber-800">Calves with no sex on the calving record can't be classed: add it on the calving record first.</p>}
        </div>
      )}
      <KillsheetDialog killsheet={killsheet} onClose={() => setKillsheet(null)} />
    </section>
  );
}

// ----- Mobs against the tally -----

/** Where the mobs don't add up to the class totals, in words */
export function MobDifferences({ check }: { check: MobCheck }) {
  const off = check.classes.filter(c => c.difference !== 0);
  if (off.length === 0 && check.unclassed.length === 0 && check.countMismatch.length === 0) {
    return (
      <p className="text-sm text-green-800 dark:text-green-300 flex items-center gap-1">
        <CheckCircle2 className="h-4 w-4" />Every class's mobs add up to its tally.
      </p>
    );
  }
  return (
    <ul className="text-sm space-y-1 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3">
      {off.map(c => (
        <li key={c.stockClass}>
          <span className="font-medium">{c.stockClass}</span>:{" "}
          {c.mobs === 0
            ? `${c.tally} in the tally but not in any mob.`
            : c.tally === 0
              ? `${c.mobs} in mobs but none in the tally.`
              : `mobs have ${c.mobs}, the tally has ${c.tally}: ${Math.abs(c.difference)} ${c.difference < 0 ? "not in a mob" : "more in mobs than in the tally"}.`}
        </li>
      ))}
      {check.unclassed.map(m => (
        <li key={m.id}><span className="font-medium">{m.name}</span> ({m.head} head) has no class, so it isn't counted against any class.</li>
      ))}
      {check.countMismatch.map(m => (
        <li key={m.id}>
          <span className="font-medium">{m.name}</span>: head count {m.headCount}, but {m.tagged} animals are tagged into it
          ({Math.abs(m.difference)} {m.difference > 0 ? "not tagged" : "more tagged"}).
        </li>
      ))}
    </ul>
  );
}

// ----- NAIT -----

interface NaitCheckData {
  season: { startsOn: string; endsOn: string };
  snapshot: null | {
    id: string; asAt: string; fileName: string | null; head: number; registerThatDay: number; tallyThatDay: number | null; matched: number;
    onlyInNait: { id: string; visualId?: string | null; birthDate?: string | null; sex?: string | null }[]; onlyInNaitCount: number;
    onlyInPulse: { id: string; animal: string }[]; onlyInPulseCount: number;
  };
  registration: { hasRecords: boolean; onFarm: number; unregistered: { id: string; animal: string }[]; unregisteredCount: number };
  movements: { missing: { animalId: string; animal: string; type: StockMovementType; date: string; naitStatus: string }[]; missingCount: number };
}

function NaitUpload({ onDone }: { onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [asAt, setAsAt] = useState(todayIso);
  const upload = useMutation({
    mutationFn: () => {
      if (!file) throw new Error("Choose NAIT's CSV file");
      const form = new FormData();
      form.append("asAt", asAt);
      form.append("file", file);
      return api<{ head: number; columns: { id: string } }>("/api/stock-recon/nait/snapshots", { method: "POST", body: form });
    },
    onSuccess: r => { toast.success(`NAIT's list read: ${plural(r.head, "animal")} (by ${r.columns.id})`); setFile(null); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="nait-file" className="text-xs">NAIT's list of animals at your location (CSV)</Label>
        <Input id="nait-file" type="file" accept=".csv,text/csv,.txt" className="w-72" onChange={e => setFile(e.target.files?.[0] ?? null)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="nait-asat" className="text-xs">Downloaded on</Label>
        <Input id="nait-asat" type="date" className="w-40" max={todayIso()} value={asAt} onChange={e => setAsAt(e.target.value)} />
      </div>
      <Button size="sm" variant="outline" onClick={() => upload.mutate()} disabled={!file || upload.isPending}>
        <Upload className="h-4 w-4 mr-1" />{upload.isPending ? "Reading…" : "Check against NAIT"}
      </Button>
    </div>
  );
}

const ANIMAL_LIST = 12;
function AnimalList({ items, total }: { items: { id: string; animal: string }[]; total: number }) {
  return (
    <>
      {items.slice(0, ANIMAL_LIST).map((a, i) => (
        <span key={a.id}>{i > 0 && ", "}<Link href={`/app/animals/${a.id}`} className="underline">{a.animal}</Link></span>
      ))}
      {total > ANIMAL_LIST && ` and ${total - ANIMAL_LIST} more`}
    </>
  );
}

/** Pulse's numbers against NAIT, from what Pulse has, and what's missing to check more */
export function NaitCheck({ seasonId, manual }: { seasonId: string; manual: { count: number; countedAt: string; tally: number } | null }) {
  const queryClient = useQueryClient();
  const key = ["/api/stock-recon", "nait", seasonId];
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => api<NaitCheckData>(`/api/stock-recon/nait?season=${seasonId}`) });
  const reload = () => queryClient.invalidateQueries({ queryKey: key });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/stock-recon/nait/snapshots/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("NAIT list removed"); reload(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = data?.snapshot;
  const problems = (s ? s.onlyInNaitCount + s.onlyInPulseCount : 0) + (data?.registration.unregisteredCount ?? 0) + (data?.movements.missingCount ?? 0);

  return (
    <section className="space-y-3 rounded-lg border bg-card p-3" aria-labelledby="nait-heading">
      <div>
        <h2 id="nait-heading" className="font-semibold">NAIT check</h2>
        <p className="text-xs text-muted-foreground">
          Pulse isn't connected to NAIT itself (that needs access approved by OSPRI, which runs NAIT), so it can't pull your NAIT
          movements. It checks against what it has: NAIT's list of animals at your location (download it from NAIT and upload it here),
          the NAIT registrations and movements recorded in Pulse, and the NAIT count you enter.
        </p>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Checking…</p>}
      {data && (
        <div className="space-y-3 text-sm">
          {manual && (
            <p className={manual.count === manual.tally ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300"}>
              NAIT count you entered: {manual.count} cattle on {day(manual.countedAt)}; the tally that day was {manual.tally}
              {manual.count === manual.tally ? ", matching." : ` (${Math.abs(manual.count - manual.tally)} ${manual.count > manual.tally ? "more" : "fewer"} in NAIT).`}
            </p>
          )}

          {s ? (
            <div className="space-y-1">
              <p>
                <span className="font-medium">NAIT's list from {day(s.asAt)}</span>{s.fileName && ` (${s.fileName})`}: {plural(s.head, "animal")}.
                {" "}On the farm in Pulse that day: {s.registerThatDay} in the register{s.tallyThatDay != null && `, ${s.tallyThatDay} in the tally`}.
                {" "}{s.matched} matched by tag.
                <Button variant="ghost" size="sm" className="h-auto p-0 ml-2 underline" onClick={() => remove.mutate(s.id)}>Remove</Button>
              </p>
              {s.onlyInNaitCount > 0 && (
                <p className="text-amber-800 dark:text-amber-300">
                  In NAIT but not on the farm in Pulse ({s.onlyInNaitCount}): {s.onlyInNait.slice(0, ANIMAL_LIST).map(n => n.visualId || n.id).join(", ")}
                  {s.onlyInNaitCount > ANIMAL_LIST && ` and ${s.onlyInNaitCount - ANIMAL_LIST} more`}. Either they're missing from the register, they've
                  left and NAIT wasn't told, or their tags in Pulse don't match NAIT.
                </p>
              )}
              {s.onlyInPulseCount > 0 && (
                <p className="text-amber-800 dark:text-amber-300">
                  On the farm in Pulse but not in NAIT's list ({s.onlyInPulseCount}): <AnimalList items={s.onlyInPulse} total={s.onlyInPulseCount} />.
                  {" "}Check they're registered and moved to your location in NAIT, and that their RFID or lifetime ID is in Pulse.
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">No NAIT list uploaded yet.</p>
          )}
          <NaitUpload onDone={reload} />

          {data.registration.hasRecords ? (
            data.registration.unregisteredCount > 0 ? (
              <p className="text-amber-800 dark:text-amber-300">
                On the farm but not recorded as registered with NAIT in Pulse ({data.registration.unregisteredCount} of {data.registration.onFarm}):{" "}
                <AnimalList items={data.registration.unregistered} total={data.registration.unregisteredCount} />.
              </p>
            ) : <p className="text-muted-foreground">Every animal on the farm is recorded as registered with NAIT.</p>
          ) : (
            <p className="text-muted-foreground">Pulse has no NAIT registrations recorded for this farm, so registrations can't be checked here.</p>
          )}

          {data.movements.missingCount > 0 ? (
            <div>
              <p className="text-amber-800 dark:text-amber-300">
                Arrivals and deaths from {day(data.season.startsOn)} with no NAIT movement recorded in Pulse ({data.movements.missingCount}).
                The farm receiving stock records the move in NAIT, and deaths on the farm are recorded too:
              </p>
              <ul className="list-disc pl-5">
                {data.movements.missing.slice(0, ANIMAL_LIST).map(m => (
                  <li key={`${m.animalId}-${m.type}`}>
                    <Link href={`/app/animals/${m.animalId}`} className="underline">{m.animal}</Link>: {STOCK_MOVEMENT_LABELS[m.type]?.toLowerCase() ?? m.type} on {day(m.date)} ({m.naitStatus})
                  </li>
                ))}
                {data.movements.missingCount > ANIMAL_LIST && <li>and {data.movements.missingCount - ANIMAL_LIST} more</li>}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground">Every arrival and death in the register this season has a NAIT movement recorded in Pulse.</p>
          )}
          {problems === 0 && s && (
            <p className="text-green-800 dark:text-green-300 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />Pulse and NAIT agree.</p>
          )}
          {problems > 0 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Fix each one in NAIT or in Pulse, then upload a fresh list from NAIT.</p>
          )}
        </div>
      )}
    </section>
  );
}
