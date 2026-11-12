import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Camera, ClipboardCheck, FileText, Lock, Paperclip, Plus, Trash2, Unlock, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ASD_TYPES, STOCK_CLASSES, STOCK_MOVEMENT_LABELS, STOCK_MOVEMENT_TYPES, isStockIn, isValidBalanceDate, rollForward,
  type ClassTotals, type StockMovementType,
} from "@shared/stock";

// Stock reconciliation by season: opening numbers per class, movements (entered here with their
// ASD, or made from the animal register), closing numbers, and checks against stocktakes, NAIT,
// mobs and the register. Closing a season moves each class up to open the next.

interface Movement {
  id: string; recordId: string | null; animalId: string | null; animal: string | null; type: StockMovementType; date: string;
  asdNumber: string | null; otherParty: string | null; otherPartyNait: string | null; notes: string | null;
  lines: { stockClass: string | null; quantity: number }[];
  attachments: { id: string; kind: string; url: string; fileName: string | null }[];
}
interface Season { id: string; startsOn: string; endsOn: string; closed: boolean }
interface Mob { id: string; name: string; stockClass: string | null; headCount: number | null; tagged: number; head: number; pasture: string | null; currentPastureId: string | null }
interface Issue { animalId: string; animal: string; problem: string }
interface View {
  balanceDate: string; today: string; issues: Issue[]; seasons: Season[];
  start?: { choices: { startsOn: string; endsOn: string }[]; registerOpening: Record<string, Record<string, number>> };
  season: null | {
    id: string; startsOn: string; endsOn: string; closedAt: string | null; asAt: string;
    canClose: boolean; canReopen: boolean; openingEditable: boolean; changedSinceClose: string[];
  };
  classes?: ClassTotals[];
  totals?: { opening: number; closing: number };
  checks?: {
    register: Record<string, number>;
    mobs: Mob[];
    stocktakes: { id: string; stockClass: string; count: number; countedAt: string; tally: number; difference: number }[];
    nait: { id: string; count: number; countedAt: string; tally: number } | null;
  };
  movements?: Movement[];
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const today = () => format(new Date(), "yyyy-MM-dd");
const day = (iso: string) => format(new Date(`${iso}T00:00:00`), "d MMM yyyy");
const ROOT_KEY = ["/api/stock-recon"];
const selectClass = "h-9 w-full rounded-md border bg-background px-2 text-sm";
const seasonName = (s: { startsOn: string; endsOn: string }) => `${s.startsOn.slice(0, 4)}–${s.endsOn.slice(2, 4)} season`;
const balanceText = (mmdd: string) => format(new Date(`2001-${mmdd}T00:00:00`), "d MMMM");

// Long side of a stored ASD photo: plenty to read the form, small enough to upload on farm signal
const ASD_MAX_PX = 2400;

/**
 * ASD photos are kept as PNG. Images the browser can't decode (e.g. HEIC outside Safari) are kept as they are.
 */
async function toPng(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/png") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, ASD_MAX_PX / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".png", { type: "image/png" });
  } catch {
    return file;
  }
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ROOT_KEY });
}

function AsdPhotos({ files, setFiles }: { files: File[]; setFiles: (f: (old: File[]) => File[]) => void }) {
  const addFiles = async (list: FileList | null) => {
    const converted = await Promise.all(Array.from(list ?? []).map(toPng));
    setFiles(f => [...f, ...converted].slice(0, 8));
  };
  const preview = useMemo(() => {
    const image = files.find(f => f.type.startsWith("image/"));
    return image ? URL.createObjectURL(image) : null;
  }, [files]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
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
  );
}

/**
 * Photograph the ASD, then enter what it says while looking at the photo
 */
function MovementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const refresh = useRefresh();
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
      refresh();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock movement</DialogTitle>
          <DialogDescription>
            For stock that isn't in the animal register. Animals in the register are counted from their own records:
            record their arrival or departure there. Take a photo of the ASD, then fill in the numbers from it.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-2">
          <AsdPhotos files={files} setFiles={setFiles} />
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
                    <Label htmlFor="move-nait">{isStockIn(type) ? "From" : "To"} NAIT number</Label>
                    <Input id="move-nait" inputMode="numeric" value={otherPartyNait} onChange={e => setOtherPartyNait(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="move-party">{isStockIn(type) ? "From (farm or seller)" : "To (farm, buyer or works)"}</Label>
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

/** Add or correct the ASD for a movement, including one made from an animal's record */
function AsdDialog({ movement, onClose }: { movement: Movement | null; onClose: () => void }) {
  const refresh = useRefresh();
  const [files, setFiles] = useState<File[]>([]);
  const [asdNumber, setAsdNumber] = useState("");
  const [otherParty, setOtherParty] = useState("");
  const [otherPartyNait, setOtherPartyNait] = useState("");
  useEffect(() => {
    if (!movement) return;
    setFiles([]); setAsdNumber(movement.asdNumber ?? ""); setOtherParty(movement.otherParty ?? ""); setOtherPartyNait(movement.otherPartyNait ?? "");
  }, [movement]);
  const save = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("data", JSON.stringify({ asdNumber: asdNumber.trim() || null, otherParty: otherParty.trim() || null, otherPartyNait: otherPartyNait.trim() || null }));
      files.forEach(f => form.append("files", f));
      return api(`/api/stock-recon/movements/${movement!.id}`, { method: "PATCH", body: form });
    },
    onSuccess: () => { toast.success("ASD saved"); refresh(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const incoming = movement ? isStockIn(movement.type) : true;
  return (
    <Dialog open={!!movement} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{movement ? `ASD for ${STOCK_MOVEMENT_LABELS[movement.type].toLowerCase()} on ${day(movement.date)}` : "ASD"}</DialogTitle>
          <DialogDescription>{movement?.animal ? `Animal ${movement.animal}.` : ""} The photo is kept in Records (Documents) with this movement.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-5 md:grid-cols-2">
          <AsdPhotos files={files} setFiles={setFiles} />
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="asd-number">ASD number</Label>
              <Input id="asd-number" value={asdNumber} onChange={e => setAsdNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="asd-party">{incoming ? "From (farm or seller)" : "To (farm, buyer or works)"}</Label>
              <Input id="asd-party" value={otherParty} onChange={e => setOtherParty(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="asd-nait">{incoming ? "From" : "To"} NAIT number</Label>
              <Input id="asd-nait" inputMode="numeric" value={otherPartyNait} onChange={e => setOtherPartyNait(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => save.mutate()} disabled={save.isPending}>Save ASD</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CountDialog({ open, onOpenChange, initialClass, kind }: {
  open: boolean; onOpenChange: (v: boolean) => void; initialClass?: string; kind: "stocktake" | "nait";
}) {
  const refresh = useRefresh();
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
      if (count === "") throw new Error(kind === "nait" ? "Enter NAIT's number of animals" : "Enter how many were counted");
      return api("/api/stock-recon/counts", json("POST", { kind, stockClass: kind === "nait" ? null : stockClass, count, countedAt, notes: notes || null }));
    },
    onSuccess: () => { toast.success(kind === "nait" ? "NAIT count saved" : "Stocktake saved"); refresh(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{kind === "nait" ? "NAIT count" : "Stocktake"}</DialogTitle>
          <DialogDescription>
            {kind === "nait"
              ? "How many cattle NAIT shows at this farm's location. It's compared with the tally of all classes."
              : "How many were counted on farm. It's compared with the tally; nothing changes unless you adjust the tally to match."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {kind === "stocktake" && (
            <div className="space-y-1">
              <Label htmlFor="count-class">Stock class</Label>
              <select id="count-class" className={selectClass} value={stockClass} onChange={e => setStockClass(e.target.value)}>
                {Array.from(new Set([...STOCK_CLASSES, stockClass])).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="count-head">{kind === "nait" ? "Animals in NAIT" : "Head counted"}</Label>
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

/** Head per class: for the first season's opening numbers */
function OpeningInputs({ value, onChange }: { value: Record<string, number | "">; onChange: (v: Record<string, number | "">) => void }) {
  const [extra, setExtra] = useState("");
  const classes = Array.from(new Set([...STOCK_CLASSES, ...Object.keys(value)]));
  return (
    <div className="space-y-2">
      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
        {classes.map(c => (
          <label key={c} className="flex items-center justify-between gap-2 text-sm">
            <span>{c}</span>
            <Input type="number" inputMode="numeric" min={0} className="w-24" aria-label={`${c} opening head`}
              value={value[c] ?? ""} onChange={e => onChange({ ...value, [c]: e.target.value === "" ? "" : Number(e.target.value) })} />
          </label>
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <Input placeholder="Another class (e.g. Dairy grazers)" value={extra} onChange={e => setExtra(e.target.value)} className="max-w-xs" />
        <Button variant="outline" size="sm" disabled={!extra.trim()} onClick={() => { onChange({ ...value, [extra.trim()]: "" }); setExtra(""); }}>
          <Plus className="h-4 w-4 mr-1" />Add class
        </Button>
      </div>
    </div>
  );
}

const cleanOpening = (v: Record<string, number | "">) =>
  Object.fromEntries(Object.entries(v).filter(([, n]) => n !== "" && Number(n) > 0).map(([c, n]) => [c, Number(n)]));

function StartSeason({ view }: { view: View }) {
  const refresh = useRefresh();
  const choices = view.start!.choices;
  const [startsOn, setStartsOn] = useState(choices[0].startsOn);
  const [opening, setOpening] = useState<Record<string, number | "">>({});
  const [balance, setBalance] = useState(view.balanceDate);
  useEffect(() => { setOpening(view.start!.registerOpening[startsOn] ?? {}); }, [startsOn, view]);

  const saveBalance = useMutation({
    mutationFn: () => api("/api/stock-recon/balance-date", json("PUT", { balanceDate: balance })),
    onSuccess: () => { toast.success("Balance date saved"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const start = useMutation({
    mutationFn: () => api("/api/stock-recon/seasons", json("POST", { startsOn, opening: cleanOpening(opening) })),
    onSuccess: () => { toast.success("Season started"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const fromRegister = Object.values(view.start!.registerOpening[startsOn] ?? {}).some(n => n > 0);

  return (
    <section className="rounded-lg border bg-card p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Start your first season</h2>
        <p className="text-sm text-muted-foreground">
          Stock is reconciled season by season, each one ending on the farm's balance date. Enter how many head were on the farm in
          each class on the season's first day. After that, the numbers carry on by themselves.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="balance-date">Balance date (month-day)</Label>
          <div className="flex gap-2">
            <Input id="balance-date" className="w-28" value={balance} onChange={e => setBalance(e.target.value)} placeholder="05-31" />
            <Button variant="outline" size="sm" disabled={balance === view.balanceDate || !isValidBalanceDate(balance) || saveBalance.isPending}
              onClick={() => saveBalance.mutate()}>Save</Button>
          </div>
          <p className="text-xs text-muted-foreground">Seasons end on {isValidBalanceDate(view.balanceDate) ? balanceText(view.balanceDate) : view.balanceDate}. Most dairy farms balance on 31 May.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="season-start">Season</Label>
          <select id="season-start" className={selectClass} value={startsOn} onChange={e => setStartsOn(e.target.value)}>
            {choices.map(c => <option key={c.startsOn} value={c.startsOn}>{seasonName(c)}: {day(c.startsOn)} to {day(c.endsOn)}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Opening head on {day(startsOn)}</h3>
        {fromRegister && (
          <p className="text-xs text-muted-foreground">Filled in from the animal register on that day. Add any stock that isn't in the register.</p>
        )}
        <OpeningInputs value={opening} onChange={setOpening} />
      </div>
      <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => start.mutate()} disabled={start.isPending}>
        Start the {seasonName(choices.find(c => c.startsOn === startsOn)!)}
      </Button>
    </section>
  );
}

function OpeningDialog({ open, onOpenChange, seasonId, classes }: { open: boolean; onOpenChange: (v: boolean) => void; seasonId: string; classes: ClassTotals[] }) {
  const refresh = useRefresh();
  const [opening, setOpening] = useState<Record<string, number | "">>({});
  useEffect(() => {
    if (open) setOpening(Object.fromEntries(classes.filter(c => c.opening > 0).map(c => [c.stockClass, c.opening])));
  }, [open, classes]);
  const save = useMutation({
    mutationFn: () => api(`/api/stock-recon/seasons/${seasonId}/opening`, json("PUT", { opening: cleanOpening(opening) })),
    onSuccess: () => { toast.success("Opening numbers saved"); refresh(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Opening numbers</DialogTitle>
          <DialogDescription>Head on the farm in each class on the first day of the season.</DialogDescription>
        </DialogHeader>
        <OpeningInputs value={opening} onChange={setOpening} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({ open, onOpenChange, view }: { open: boolean; onOpenChange: (v: boolean) => void; view: View }) {
  const refresh = useRefresh();
  const season = view.season!;
  const closing = Object.fromEntries((view.classes ?? []).map(c => [c.stockClass, c.closing]));
  const next = rollForward(closing);
  const close = useMutation({
    mutationFn: () => api(`/api/stock-recon/seasons/${season.id}/close`, { method: "POST" }),
    onSuccess: () => { toast.success("Season closed; the next one is open"); refresh(); onOpenChange(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Close the {seasonName(season)}</DialogTitle>
          <DialogDescription>
            It closes on the numbers below, and the next season opens with each class moved up a year. You can reopen it to correct it later.
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b"><th className="py-1">Next season opens with</th><th className="text-right">Head</th></tr></thead>
          <tbody>
            {Object.entries(next).map(([c, n]) => <tr key={c} className="border-b"><td className="py-1">{c}</td><td className="text-right tabular-nums">{n}</td></tr>)}
          </tbody>
        </table>
        {view.issues.length > 0 && (
          <p className="text-sm text-amber-800">{view.issues.length} animal record{view.issues.length === 1 ? "" : "s"} can't be counted properly yet (listed on the page). Fix them first if they belong to this season.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => close.mutate()} disabled={close.isPending}>
            <Lock className="h-4 w-4 mr-1" />Close season
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MobDialog({ mob, onClose }: { mob: Mob | "new" | null; onClose: () => void }) {
  const refresh = useRefresh();
  const { data: pastures = [] } = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/pastures"], queryFn: () => api("/api/pastures"), enabled: !!mob });
  const [name, setName] = useState("");
  const [stockClass, setStockClass] = useState(STOCK_CLASSES[2]);
  const [headCount, setHeadCount] = useState<number | "">("");
  const [pastureId, setPastureId] = useState("");
  useEffect(() => {
    if (!mob) return;
    const m = mob === "new" ? null : mob;
    setName(m?.name ?? ""); setStockClass(m?.stockClass ?? STOCK_CLASSES[2]); setHeadCount(m?.headCount ?? ""); setPastureId(m?.currentPastureId ?? "");
  }, [mob]);
  const save = useMutation({
    mutationFn: () => {
      if (!name.trim()) throw new Error("Give the mob a name");
      const body = { name: name.trim(), isMob: true, stockClass, headCount: headCount === "" ? null : headCount, currentPastureId: pastureId || null };
      return mob === "new" ? api("/api/groups", json("POST", body)) : api(`/api/groups/${(mob as Mob).id}`, json("PUT", body));
    },
    onSuccess: () => { toast.success("Mob saved"); refresh(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={!!mob} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{mob === "new" ? "New mob" : "Mob"}</DialogTitle>
          <DialogDescription>Stock run together. Each class's mobs should add up to its tally.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="mob-name">Name</Label>
            <Input id="mob-name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Milkers, R1 heifers at runoff" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="mob-class">Class</Label>
            <select id="mob-class" className={selectClass} value={stockClass} onChange={e => setStockClass(e.target.value)}>
              {STOCK_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="mob-head">Head</Label>
              <Input id="mob-head" type="number" min={0} inputMode="numeric" value={headCount} placeholder="Count tagged"
                onChange={e => setHeadCount(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mob-paddock">Paddock</Label>
              <select id="mob-paddock" className={selectClass} value={pastureId} onChange={e => setPastureId(e.target.value)}>
                <option value="">Not recorded</option>
                {pastures.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Leave Head empty to count the tagged animals in the group instead.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => save.mutate()} disabled={save.isPending}>Save mob</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovementRow({ m, onDelete, onAsd }: { m: Movement; onDelete: (id: string) => void; onAsd: (m: Movement) => void }) {
  const [confirming, setConfirming] = useState(false);
  const signed = (q: number) => {
    const up = m.type === "adjustment" ? q > 0 : isStockIn(m.type);
    return `${up ? "+" : "−"}${Math.abs(q)}`;
  };
  const missingAsd = ASD_TYPES.includes(m.type) && !m.asdNumber && m.attachments.length === 0;
  return (
    <li className="flex flex-wrap items-start gap-3 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <span className={cn(m.type !== "adjustment" && (isStockIn(m.type) ? "text-green-700" : "text-red-700"))}>
            {STOCK_MOVEMENT_LABELS[m.type] ?? m.type}
          </span>
          {" · "}{m.lines.map(l => `${signed(l.quantity)} ${l.stockClass ?? "unclassified"}`).join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">
          {day(m.date)}
          {m.animalId && <> · animal <Link href={`/app/animals/${m.animalId}`} className="underline">{m.animal}</Link></>}
          {m.otherParty && ` · ${isStockIn(m.type) ? "from" : "to"} ${m.otherParty}`}
          {m.otherPartyNait && ` (NAIT ${m.otherPartyNait})`}
          {m.asdNumber && ` · ASD ${m.asdNumber}`}
          {missingAsd && <span className="text-amber-700 font-medium"> · no ASD</span>}
        </p>
        {m.notes && <p className="text-xs mt-0.5">{m.notes}</p>}
        {m.recordId && <Link href="/app/records#documents" className="text-xs underline text-pulse-forest">ASD record in Records</Link>}
      </div>
      <div className="flex items-center gap-2">
        {m.attachments.map(a => (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.fileName ?? "ASD"}>
            {a.kind === "photo"
              ? <img src={a.url} alt="ASD photo" className="h-12 w-12 rounded object-cover border" loading="lazy" />
              : <span className="text-xs underline">{a.fileName ?? "ASD"}</span>}
          </a>
        ))}
        {ASD_TYPES.includes(m.type) && (
          <Button variant="outline" size="sm" onClick={() => onAsd(m)}>{missingAsd ? "Add ASD" : "ASD"}</Button>
        )}
        {!m.animalId && (confirming ? (
          <>
            <Button variant="destructive" size="sm" onClick={() => onDelete(m.id)}>Delete</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Keep</Button>
          </>
        ) : (
          <Button variant="ghost" size="icon" aria-label="Delete movement" onClick={() => setConfirming(true)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ))}
      </div>
    </li>
  );
}

const diffClass = (a: number, b: number) => (a === b ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300 font-medium");

/**
 * Stock reconciliation by season, checked against stocktakes, NAIT, mobs and the register
 */
export default function StockReconciliationPage() {
  const refresh = useRefresh();
  const [seasonId, setSeasonId] = useState<string | undefined>();
  const [moving, setMoving] = useState(false);
  const [counting, setCounting] = useState<{ open: boolean; stockClass?: string; kind: "stocktake" | "nait" }>({ open: false, kind: "stocktake" });
  const [asdFor, setAsdFor] = useState<Movement | null>(null);
  const [mobFor, setMobFor] = useState<Mob | "new" | null>(null);
  const [editingOpening, setEditingOpening] = useState(false);
  const [closing, setClosing] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: [...ROOT_KEY, seasonId ?? "current"],
    queryFn: () => api<View>(`/api/stock-recon${seasonId ? `?season=${seasonId}` : ""}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/stock-recon/movements/${id}`, { method: "DELETE" }),
    onSuccess: () => { toast.success("Movement removed"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const adjust = useMutation({
    mutationFn: (countId: string) => api<{ difference: number }>(`/api/stock-recon/counts/${countId}/adjust`, { method: "POST" }),
    onSuccess: r => { toast.success(r.difference ? `Tally adjusted by ${r.difference > 0 ? "+" : ""}${r.difference}` : "Already matches"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reopen = useMutation({
    mutationFn: (id: string) => api(`/api/stock-recon/seasons/${id}/reopen`, { method: "POST" }),
    onSuccess: () => { toast.success("Season reopened"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const season = data?.season;
  const checks = data?.checks;
  const isCurrent = !!season && !season.closedAt && season.asAt === data?.today;
  const mobsByClass = useMemo(() => {
    const out: Record<string, number> = {};
    for (const m of checks?.mobs ?? []) if (m.stockClass) out[m.stockClass] = (out[m.stockClass] ?? 0) + m.head;
    return out;
  }, [checks]);
  const hasMobs = (checks?.mobs.length ?? 0) > 0;
  // Classes with animals in the register or in mobs but none in the tally still get a row, so the difference shows
  const rows = useMemo(() => {
    const list = [...(data?.classes ?? [])];
    const extra = Array.from(new Set([...Object.keys(checks?.register ?? {}), ...Object.keys(mobsByClass)]));
    for (const c of extra) {
      if (!list.some(r => r.stockClass === c)) list.push({ stockClass: c, opening: 0, byType: {}, in: 0, out: 0, closing: 0 });
    }
    const order = (c: string) => (STOCK_CLASSES.includes(c) ? STOCK_CLASSES.indexOf(c) : 1e3);
    return list.sort((a, b) => order(a.stockClass) - order(b.stockClass));
  }, [data, checks, mobsByClass]);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-pulse-forest">Stock reconciliation</h1>
          <p className="text-sm text-muted-foreground">
            Season by season, by IRD class. Animals in the register count themselves; record other stock here with its ASD.
          </p>
        </div>
        {season && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCounting({ open: true, kind: "stocktake" })}>
              <ClipboardCheck className="h-4 w-4 mr-1" />Stocktake
            </Button>
            <Button variant="outline" onClick={() => setCounting({ open: true, kind: "nait" })}>NAIT count</Button>
            <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => setMoving(true)}>
              <Camera className="h-4 w-4 mr-1" />Record movement
            </Button>
          </div>
        )}
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Adding up the stock…</p>}
      {error && <p className="text-sm text-red-700">{(error as Error).message}</p>}

      {data && !season && data.start && <StartSeason view={data} />}

      {data && season && (
        <>
          <section className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
            <select aria-label="Season" className="h-9 rounded-md border bg-background px-2 text-sm font-medium" value={season.id}
              onChange={e => setSeasonId(e.target.value)}>
              {data.seasons.map(s => <option key={s.id} value={s.id}>{seasonName(s)}{s.closed ? " (closed)" : ""}</option>)}
            </select>
            <span className="text-sm text-muted-foreground">
              {day(season.startsOn)} to {day(season.endsOn)}
              {season.closedAt ? ` · closed ${format(new Date(season.closedAt), "d MMM yyyy")}` : isCurrent ? " · on hand today" : ` · as at ${day(season.asAt)}`}
            </span>
            <div className="ml-auto flex flex-wrap gap-2">
              {season.openingEditable && <Button variant="outline" size="sm" onClick={() => setEditingOpening(true)}>Opening numbers</Button>}
              <Button asChild variant="outline" size="sm">
                <Link href={`/app/stock-reconciliation/seasons/${season.id}/report`}><FileText className="h-4 w-4 mr-1" />Season report</Link>
              </Button>
              {season.canClose && (
                <Button size="sm" className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => setClosing(true)}>
                  <Lock className="h-4 w-4 mr-1" />Close season
                </Button>
              )}
              {season.canReopen && (
                <Button variant="outline" size="sm" onClick={() => reopen.mutate(season.id)} disabled={reopen.isPending}>
                  <Unlock className="h-4 w-4 mr-1" />Reopen
                </Button>
              )}
            </div>
          </section>

          {season.changedSinceClose.length > 0 && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Movements in this season have changed since it was closed ({season.changedSinceClose.join(", ")}). Reopen and close it again
              to carry the change into the next season.
            </p>
          )}

          <section className="rounded-lg border bg-card overflow-x-auto" aria-labelledby="tally-heading">
            <h2 id="tally-heading" className="sr-only">Tallies</h2>
            {rows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No stock in this season yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Class</th>
                    <th className="px-3 py-2 font-medium text-right">Opening</th>
                    <th className="px-3 py-2 font-medium text-right">In</th>
                    <th className="px-3 py-2 font-medium text-right">Out</th>
                    <th className="px-3 py-2 font-medium text-right">{season.closedAt ? "Closing" : isCurrent ? "On hand" : "Closing"}</th>
                    <th className="px-3 py-2 font-medium text-right" title="Animals in the register on that day">Register</th>
                    {hasMobs && <th className="px-3 py-2 font-medium text-right">Mobs</th>}
                    <th className="px-3 py-2 font-medium">Last stocktake</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map(c => {
                    const reg = checks!.register[c.stockClass] ?? 0;
                    const st = checks!.stocktakes.find(s => s.stockClass === c.stockClass);
                    return (
                      <tr key={c.stockClass}>
                        <td className="px-3 py-2 font-medium">{c.stockClass}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c.opening}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-700">{c.in ? `+${c.in}` : "0"}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-700">{c.out ? `−${c.out}` : "0"}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums font-semibold", c.closing < 0 && "text-red-700")}>{c.closing}</td>
                        <td className={cn("px-3 py-2 text-right tabular-nums", diffClass(reg, c.closing))}>{reg}</td>
                        {hasMobs && <td className={cn("px-3 py-2 text-right tabular-nums", diffClass(mobsByClass[c.stockClass] ?? 0, c.closing))}>{mobsByClass[c.stockClass] ?? 0}</td>}
                        <td className="px-3 py-2">
                          {st ? (
                            <span className={st.difference ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground"}>
                              {st.count} on {day(st.countedAt)}{st.difference ? ` (${st.difference > 0 ? "+" : ""}${st.difference})` : " ✓"}
                              {st.difference !== 0 && !season.closedAt && (
                                <Button variant="ghost" size="sm" className="h-auto p-0 ml-2 underline" onClick={() => adjust.mutate(st.id)}>Adjust tally</Button>
                              )}
                            </span>
                          ) : !season.closedAt ? (
                            <Button size="sm" variant="ghost" className="h-auto p-0" onClick={() => setCounting({ open: true, stockClass: c.stockClass, kind: "stocktake" })}>Count</Button>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t font-semibold">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{data.totals!.opening}</td>
                    <td colSpan={2} />
                    <td className="px-3 py-2 text-right tabular-nums">{data.totals!.closing}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Object.values(checks!.register).reduce((s, n) => s + n, 0)}</td>
                    {hasMobs && <td className="px-3 py-2 text-right tabular-nums">{checks!.mobs.reduce((s, m) => s + m.head, 0)}</td>}
                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </section>
          <p className="text-xs text-muted-foreground">
            Register is the animals recorded individually in Pulse; it's lower than the tally when some stock isn't tagged in the register.
          </p>

          {checks!.nait && (
            <p className={cn("text-sm", checks!.nait.count === checks!.nait.tally ? "text-muted-foreground" : "text-amber-800 dark:text-amber-300")}>
              NAIT showed {checks!.nait.count} cattle at the farm's location on {day(checks!.nait.countedAt)}; the tally that day was {checks!.nait.tally}
              {checks!.nait.count === checks!.nait.tally ? ", matching." : `: ${Math.abs(checks!.nait.count - checks!.nait.tally)} ${checks!.nait.count > checks!.nait.tally ? "more in NAIT" : "fewer in NAIT"}. Check for movements not yet recorded in NAIT or here.`}
            </p>
          )}

          {data.issues.length > 0 && (
            <section className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-1 dark:bg-amber-950/30">
              <h2 className="font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1">
                <AlertTriangle className="h-4 w-4" />{data.issues.length} animal record{data.issues.length === 1 ? "" : "s"} can't be counted properly
              </h2>
              <ul className="text-sm space-y-0.5">
                {data.issues.slice(0, 20).map(i => (
                  <li key={`${i.animalId}-${i.problem}`}>
                    <Link href={`/app/animals/${i.animalId}`} className="underline font-medium">{i.animal}</Link>: {i.problem}
                  </li>
                ))}
                {data.issues.length > 20 && <li className="text-muted-foreground">and {data.issues.length - 20} more</li>}
              </ul>
            </section>
          )}

          <section className="space-y-2" aria-labelledby="mobs-heading">
            <div className="flex items-center justify-between">
              <h2 id="mobs-heading" className="font-semibold flex items-center gap-1"><Users className="h-4 w-4" />Mobs</h2>
              <Button variant="outline" size="sm" onClick={() => setMobFor("new")}><Plus className="h-4 w-4 mr-1" />Mob</Button>
            </div>
            {checks!.mobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No mobs yet. Add the mobs you run, and each class's mobs are checked against its tally.</p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {checks!.mobs.map(m => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <span className="font-medium flex-1">{m.name}</span>
                    <span className="text-muted-foreground">{m.stockClass ?? "no class"}</span>
                    <span className="tabular-nums">{m.head} head{m.headCount == null ? " (tagged)" : ""}</span>
                    <span className="text-muted-foreground">{m.pasture ?? "paddock not recorded"}</span>
                    <Button variant="ghost" size="sm" onClick={() => setMobFor(m)}>Edit</Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2" aria-labelledby="movements-heading">
            <h2 id="movements-heading" className="font-semibold">Movements this season</h2>
            {(data.movements ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">None recorded yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {data.movements!.map(m => <MovementRow key={m.id} m={m} onDelete={id => remove.mutate(id)} onAsd={setAsdFor} />)}
              </ul>
            )}
          </section>

          <OpeningDialog open={editingOpening} onOpenChange={setEditingOpening} seasonId={season.id} classes={data.classes ?? []} />
          {season.canClose && <CloseDialog open={closing} onOpenChange={setClosing} view={data} />}
        </>
      )}

      <MovementDialog open={moving} onOpenChange={setMoving} />
      <CountDialog open={counting.open} kind={counting.kind} initialClass={counting.stockClass} onOpenChange={open => setCounting(c => ({ ...c, open }))} />
      <AsdDialog movement={asdFor} onClose={() => setAsdFor(null)} />
      <MobDialog mob={mobFor} onClose={() => setMobFor(null)} />
    </div>
  );
}
