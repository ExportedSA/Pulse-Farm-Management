import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Camera, ClipboardCheck, Paperclip, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ASD_TYPES, STOCK_CLASSES, STOCK_IN_TYPES, STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES, type StockMovementType,
} from "@shared/stock";

interface ClassTally {
  stockClass: string; counted: { count: number; countedAt: string } | null; in: number; out: number; tally: number;
}
interface Movement {
  id: string; type: StockMovementType; date: string; asdNumber: string | null; otherParty: string | null;
  otherPartyNait: string | null; notes: string | null;
  lines: { stockClass: string | null; quantity: number }[];
  attachments: { id: string; kind: string; url: string; fileName: string | null }[];
}
interface Reconciliation { classes: ClassTally[]; totalTally: number; registerActive: number; movements: Movement[] }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

const today = () => format(new Date(), "yyyy-MM-dd");
const isIn = (type: StockMovementType) => (STOCK_IN_TYPES as readonly string[]).includes(type);
const QUERY_KEY = ["/api/stock-recon"];

const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";

/**
 * Photograph the ASD, then enter what it says while looking at the photo
 */
function MovementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [type, setType] = useState<StockMovementType>("purchase");
  const [date, setDate] = useState(today);
  const [asdNumber, setAsdNumber] = useState("");
  const [otherParty, setOtherParty] = useState("");
  const [otherPartyNait, setOtherPartyNait] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ stockClass: STOCK_CLASSES[0], quantity: "" as number | "" }]);

  useEffect(() => {
    if (!open) return;
    setFiles([]); setType("purchase"); setDate(today()); setAsdNumber(""); setOtherParty(""); setOtherPartyNait(""); setNotes("");
    setLines([{ stockClass: STOCK_CLASSES[0], quantity: "" }]);
  }, [open]);

  const preview = useMemo(() => {
    const image = files.find(f => f.type.startsWith("image/"));
    return image ? URL.createObjectURL(image) : null;
  }, [files]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const needsAsd = ASD_TYPES.includes(type);
  const save = useMutation({
    mutationFn: async () => {
      const filled = lines.filter(l => l.quantity !== "");
      if (filled.length === 0) throw new Error("Enter the number of head for at least one class");
      if (needsAsd && files.length === 0 && !asdNumber.trim()) throw new Error("Add a photo of the ASD, or its number");
      const form = new FormData();
      form.append("data", JSON.stringify({
        type, date, asdNumber: asdNumber.trim() || null, otherParty: otherParty.trim() || null,
        otherPartyNait: otherPartyNait.trim() || null, notes: notes.trim() || null,
        lines: filled.map(l => ({ stockClass: l.stockClass, quantity: Number(l.quantity) })),
      }));
      files.forEach(f => form.append("files", f));
      return api("/api/stock-recon/movements", { method: "POST", body: form });
    },
    onSuccess: () => {
      toast.success("Stock movement saved and tallies updated");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["/api/compliance"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFiles = (list: FileList | null) => setFiles(f => [...f, ...Array.from(list ?? [])].slice(0, 8));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock movement</DialogTitle>
          <DialogDescription>Take a photo of the ASD, then fill in the numbers from it. The photo is kept as your evidence.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer bg-pulse-forest text-white">
                <Camera className="h-4 w-4" />Photograph ASD
                <input type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
              <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-muted">
                <Paperclip className="h-4 w-4" />Attach file
                <input type="file" multiple accept="image/*,application/pdf" className="sr-only"
                  onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            {preview ? (
              <a href={preview} target="_blank" rel="noreferrer">
                <img src={preview} alt="ASD photo" className="w-full max-h-[55vh] object-contain rounded-md border bg-muted" />
              </a>
            ) : (
              <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                The ASD photo shows here so you can read it while you fill in the form.
              </div>
            )}
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                    <span className="truncate flex-1">{f.name}</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(l => l.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="move-type">Movement</Label>
                <select id="move-type" className={selectClass} value={type} onChange={e => setType(e.target.value as StockMovementType)}>
                  {STOCK_MOVEMENT_TYPES.map(t => <option key={t} value={t}>{STOCK_MOVEMENT_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="move-date">Date moved</Label>
                <Input id="move-date" type="date" max={today()} value={date} onChange={e => setDate(e.target.value)} />
              </div>
            </div>
            {needsAsd && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="move-asd">ASD number</Label>
                    <Input id="move-asd" value={asdNumber} onChange={e => setAsdNumber(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="move-nait">{isIn(type) ? "From" : "To"} NAIT number</Label>
                    <Input id="move-nait" inputMode="numeric" value={otherPartyNait} onChange={e => setOtherPartyNait(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="move-party">{isIn(type) ? "From (farm or seller)" : "To (farm, buyer or works)"}</Label>
                  <Input id="move-party" value={otherParty} onChange={e => setOtherParty(e.target.value)} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Stock {type === "adjustment" && "(use a minus number to take stock off)"}</Label>
              {lines.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <select aria-label="Stock class" className={selectClass} value={line.stockClass}
                    onChange={e => setLines(ls => ls.map((l, j) => (j === i ? { ...l, stockClass: e.target.value } : l)))}>
                    {STOCK_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Input aria-label="Head" type="number" inputMode="numeric" className="w-24" placeholder="Head"
                    value={line.quantity}
                    onChange={e => setLines(ls => ls.map((l, j) => (j === i ? { ...l, quantity: e.target.value === "" ? "" : Number(e.target.value) } : l)))} />
                  {lines.length > 1 && (
                    <Button variant="ghost" size="icon" aria-label="Remove line" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, { stockClass: STOCK_CLASSES[0], quantity: "" }])}>
                <Plus className="h-4 w-4 mr-1" />Another class
              </Button>
            </div>
            <div className="space-y-1">
              <Label htmlFor="move-notes">Notes</Label>
              <Textarea id="move-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save movement"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CountDialog({ open, onOpenChange, initialClass }: { open: boolean; onOpenChange: (v: boolean) => void; initialClass?: string }) {
  const queryClient = useQueryClient();
  const [stockClass, setStockClass] = useState(STOCK_CLASSES[0]);
  const [count, setCount] = useState<number | "">("");
  const [countedAt, setCountedAt] = useState(today);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (!open) return;
    setStockClass(initialClass ?? STOCK_CLASSES[0]); setCount(""); setCountedAt(today()); setNotes("");
  }, [open, initialClass]);
  const save = useMutation({
    mutationFn: () => {
      if (count === "") throw new Error("Enter how many were counted");
      return api("/api/stock-recon/counts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockClass, count, countedAt, notes: notes || null }),
      });
    },
    onSuccess: () => {
      toast.success("Stocktake saved");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Stocktake</DialogTitle>
          <DialogDescription>How many were counted on farm. The tally starts again from this count.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="count-class">Stock class</Label>
            <select id="count-class" className={selectClass} value={stockClass} onChange={e => setStockClass(e.target.value)}>
              {Array.from(new Set([...STOCK_CLASSES, stockClass])).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="count-head">Head counted</Label>
              <Input id="count-head" type="number" inputMode="numeric" min={0} value={count}
                onChange={e => setCount(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="count-date">Date</Label>
              <Input id="count-date" type="date" max={today()} value={countedAt} onChange={e => setCountedAt(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="count-notes">Notes</Label>
            <Textarea id="count-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => save.mutate()} disabled={save.isPending}>Save count</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementRow({ m, onDelete }: { m: Movement; onDelete: (id: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const sign = m.type === "adjustment" ? "" : isIn(m.type) ? "+" : "−";
  return (
    <li className="flex flex-wrap items-start gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className={cn(m.type !== "adjustment" && (isIn(m.type) ? "text-green-700" : "text-red-700"))}>
            {STOCK_MOVEMENT_LABELS[m.type] ?? m.type}
          </span>
          {" · "}{m.lines.map(l => `${sign}${l.quantity} ${l.stockClass ?? "unclassified"}`).join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(new Date(m.date), "d MMM yyyy")}
          {m.otherParty && ` · ${isIn(m.type) ? "from" : "to"} ${m.otherParty}`}
          {m.otherPartyNait && ` (NAIT ${m.otherPartyNait})`}
          {m.asdNumber && ` · ASD ${m.asdNumber}`}
          {ASD_TYPES.includes(m.type) && !m.asdNumber && m.attachments.length === 0 && (
            <span className="text-amber-700 font-medium"> · no ASD</span>
          )}
        </p>
        {m.notes && <p className="text-xs mt-0.5">{m.notes}</p>}
      </div>
      <div className="flex items-center gap-2">
        {m.attachments.map(a => (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.fileName ?? "ASD"}>
            {a.kind === "photo"
              ? <img src={a.url} alt="ASD photo" className="h-12 w-12 rounded object-cover border" loading="lazy" />
              : <span className="text-xs underline">{a.fileName ?? "ASD"}</span>}
          </a>
        ))}
        {confirming ? (
          <>
            <Button variant="destructive" size="sm" onClick={() => onDelete(m.id)}>Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Delete movement" onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}

/**
 * Stock tallies by class: last stocktake plus every movement since, each backed by its ASD
 */
export default function StockReconciliationPage() {
  const queryClient = useQueryClient();
  const [moving, setMoving] = useState(false);
  const [counting, setCounting] = useState<{ open: boolean; stockClass?: string }>({ open: false });
  const { data, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: () => api<Reconciliation>("/api/stock-recon") });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/stock-recon/movements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Movement removed");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const difference = data ? data.totalTally - data.registerActive : 0;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-pulse-forest">Stock reconciliation</h1>
          <p className="text-sm text-muted-foreground">Photograph each ASD as stock comes and goes; the tallies update straight away.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setCounting({ open: true })}>
            <ClipboardCheck className="h-4 w-4 mr-1" />Stocktake
          </Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => setMoving(true)}>
            <Camera className="h-4 w-4 mr-1" />Record movement
          </Button>
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Adding up the stock…</p>}
      {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

      {data && (
        <>
          <section className="rounded-lg border bg-card overflow-x-auto" aria-labelledby="tally-heading">
            <h2 id="tally-heading" className="sr-only">Tallies</h2>
            {data.classes.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No stock recorded yet. Start with a stocktake of each class, then record movements as they happen.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Class</th>
                    <th className="px-3 py-2 font-medium">Last stocktake</th>
                    <th className="px-3 py-2 font-medium text-right">In</th>
                    <th className="px-3 py-2 font-medium text-right">Out</th>
                    <th className="px-3 py-2 font-medium text-right">On farm now</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.classes.map(c => (
                    <tr key={c.stockClass}>
                      <td className="px-3 py-2 font-medium">{c.stockClass}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {c.counted ? `${c.counted.count} on ${format(new Date(c.counted.countedAt), "d MMM yyyy")}` : "Not counted"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-700">{c.in ? `+${c.in}` : "0"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-700">{c.out ? `−${c.out}` : "0"}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", c.tally < 0 && "text-red-700")}>{c.tally}</td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setCounting({ open: true, stockClass: c.stockClass })}>Count</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t font-semibold">
                  <tr>
                    <td className="px-3 py-2" colSpan={4}>Total on farm</td>
                    <td className="px-3 py-2 text-right tabular-nums">{data.totalTally}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </section>

          {data.classes.length > 0 && (
            <p className={cn("text-sm", difference !== 0 ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
              The animal register has {data.registerActive} active animal{data.registerActive === 1 ? "" : "s"}
              {difference === 0
                ? ", matching the tally."
                : `: ${Math.abs(difference)} ${difference > 0 ? "fewer than" : "more than"} the tally. Check for animals not yet in the register, or ones still listed after leaving.`}
            </p>
          )}

          <section className="space-y-2" aria-labelledby="movements-heading">
            <h2 id="movements-heading" className="font-semibold">Movements</h2>
            {data.movements.length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {data.movements.map(m => <MovementRow key={m.id} m={m} onDelete={id => remove.mutate(id)} />)}
              </ul>
            )}
          </section>
        </>
      )}

      <MovementDialog open={moving} onOpenChange={setMoving} />
      <CountDialog open={counting.open} initialClass={counting.stockClass} onOpenChange={open => setCounting(c => ({ ...c, open }))} />
    </div>
  );
}
