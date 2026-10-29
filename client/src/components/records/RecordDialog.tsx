import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Camera, MapPin, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AreaGeometry } from "@shared/geo";
import { AreaDrawer } from "./AreaDrawer";
import { TankMixEditor, ProductPicker, type SprayProduct } from "./RecordInputs";
import {
  RECORD_TYPES,
  MONTHLY_CHECK_ITEMS,
  recordTypeDef,
  fetchTags,
  saveRecord,
  updateRecord,
  fetchRecord,
  type RecordType,
  type FieldDef,
} from "@/lib/records";

interface Paddock { id: string; name: string }

interface RecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: RecordType;
  // Starting values for a new record, e.g. the month a missing monthly check is for
  preset?: { details?: Record<string, any>; title?: string };
  // Open an existing record to finish or correct it
  editRecordId?: string | null;
}

const nowLocal = () => format(new Date(), "yyyy-MM-dd'T'HH:mm");

const emptySprayProduct = (): SprayProduct => ({ product: "", activeIngredient: "", rate: "", rateUnit: "L/ha" });

// What a fresh record of each type starts with
function initialDetails(type: RecordType): Record<string, any> {
  if (type === "spray") return { products: [emptySprayProduct()] };
  if (type === "fertiliser") return { amountUnit: "t" };
  return {};
}

/**
 * Checks beyond required fields: a spray needs at least one product with a rate,
 * fertiliser needs a product and either a rate or the total applied
 */
function extraProblems(type: RecordType, d: Record<string, any>): string[] {
  const has = (v: unknown) => v !== undefined && v !== null && v !== "";
  if (type === "spray") {
    const products: SprayProduct[] = d.products ?? [];
    if (!products.some(p => p.product.trim() && has(p.rate))) return ["at least one product with its rate"];
    if (products.some(p => p.product.trim() && !has(p.rate))) return ["a rate for every product"];
  }
  if (type === "fertiliser") {
    const problems = [];
    if (!has(d.product)) problems.push("Product");
    if (!has(d.rate) && !has(d.amountApplied)) problems.push("Rate or total applied");
    return problems;
  }
  return [];
}

function FieldInput({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
  const id = `record-field-${field.key}`;
  const label = (
    <Label htmlFor={id}>
      {field.label}{field.unit ? ` (${field.unit})` : ""}{field.required ? " *" : ""}
    </Label>
  );
  if (field.kind === "select") {
    return (
      <div className="space-y-1">
        {label}
        <Select value={value ?? ""} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue placeholder="Choose…" /></SelectTrigger>
          <SelectContent>
            {field.options!.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {label}
      <Input
        id={id}
        type={field.kind === "number" ? "number" : field.kind === "date" ? "date" : "text"}
        inputMode={field.kind === "number" ? "decimal" : undefined}
        step={field.kind === "number" ? "any" : undefined}
        placeholder={field.placeholder}
        value={value ?? ""}
        onChange={e => onChange(field.kind === "number" && e.target.value !== "" ? Number(e.target.value) : e.target.value)}
      />
    </div>
  );
}

/**
 * Capture a farm record: type, when, where (paddocks and/or a drawn area), details,
 * tags and evidence. Saves straight away, or keeps it on the device until there's signal.
 */
export function RecordDialog({ open, onOpenChange, initialType = "spray", preset, editRecordId }: RecordDialogProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<RecordType>(initialType);
  const [title, setTitle] = useState("");
  const [occurredAt, setOccurredAt] = useState(nowLocal);
  const [pastureIds, setPastureIds] = useState<string[]>([]);
  const [area, setArea] = useState<AreaGeometry | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [details, setDetails] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [attachedCount, setAttachedCount] = useState(0);
  const editing = Boolean(editRecordId);

  const def = recordTypeDef(type);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ["/api/records", editRecordId],
    queryFn: () => fetchRecord(editRecordId!),
    enabled: open && editing,
  });

  const { data: paddocks = [] } = useQuery<Paddock[]>({
    queryKey: ["/api/pastures", "for-records"],
    queryFn: async () => {
      const res = await fetch("/api/pastures", { credentials: "include" });
      const body = res.ok ? await res.json() : [];
      return (Array.isArray(body) ? body : body.pastures ?? []).map((p: any) => ({ id: p.id, name: p.name }));
    },
    enabled: open,
  });
  const { data: farmTags = [] } = useQuery({ queryKey: ["/api/tags"], queryFn: fetchTags, enabled: open });

  // Start each new record clean, with the type's usual tags (plus any preset)
  useEffect(() => {
    if (!open || editing) return;
    setType(initialType);
    setTitle(preset?.title ?? "");
    setOccurredAt(nowLocal());
    setPastureIds([]);
    setArea(null);
    setShowMap(recordTypeDef(initialType).mapped);
    setDetails({ ...initialDetails(initialType), ...(preset?.details ?? {}) });
    setNotes("");
    setTags(recordTypeDef(initialType).defaultTags);
    setFiles([]);
    setAttachedCount(0);
  }, [open, initialType, preset, editing]);

  // Editing: load what was saved
  useEffect(() => {
    if (!open || !editing || !existing) return;
    setType(existing.type);
    setTitle(existing.title);
    setOccurredAt(format(new Date(existing.occurredAt), "yyyy-MM-dd'T'HH:mm"));
    setPastureIds(existing.paddocks.map(p => p.id));
    setArea(existing.area);
    setShowMap(existing.area != null);
    setDetails(existing.type === "spray" && !Array.isArray(existing.details.products)
      ? { ...existing.details, products: [emptySprayProduct()] }
      : existing.details);
    setNotes(existing.notes ?? "");
    setTags(existing.tags.map(t => t.name));
    setFiles([]);
    setAttachedCount(existing.attachments.length);
  }, [open, editing, existing]);

  const changeType = (next: RecordType) => {
    setType(next);
    setDetails(initialDetails(next));
    setTags(prev => Array.from(new Set([...prev.filter(t => !def.defaultTags.includes(t)), ...recordTypeDef(next).defaultTags])));
    setShowMap(prev => prev || recordTypeDef(next).mapped);
  };

  const suggestedTitle = useMemo(() => {
    const main = def.titleFrom ? details[def.titleFrom] : "";
    const where = pastureIds.map(id => paddocks.find(p => p.id === id)?.name).filter(Boolean).join(", ");
    return [main || def.label, where && `– ${where}`].filter(Boolean).join(" ");
  }, [def, details, pastureIds, paddocks]);

  const missing = [
    ...def.fields.filter(f => f.required && (details[f.key] === undefined || details[f.key] === "")).map(f => f.label),
    ...extraProblems(type, details),
  ];

  // Sprays: the date stock can graze again
  const safeToGraze = type === "spray" && details.withholdingDays !== undefined && details.withholdingDays !== ""
    ? new Date(new Date(occurredAt).getTime() + Number(details.withholdingDays) * 24 * 60 * 60 * 1000)
    : null;

  const submit = async () => {
    if (missing.length > 0) {
      toast.error(`Fill in: ${missing.join(", ")}`);
      return;
    }
    if (def.type === "document" && files.length === 0 && attachedCount === 0) {
      toast.error("Attach the document (photo or PDF)");
      return;
    }
    setSaving(true);
    try {
      const draft = {
        type,
        title: (title || suggestedTitle).slice(0, 255),
        notes: notes || undefined,
        occurredAt: new Date(occurredAt).toISOString(),
        pastureIds,
        area,
        details: type === "spray"
          ? {
              ...details,
              products: (details.products as SprayProduct[]).filter(p => p.product.trim()),
              dateClear: safeToGraze ? format(safeToGraze, "yyyy-MM-dd") : undefined,
            }
          : details,
        tags,
      };
      if (editing) {
        await updateRecord(editRecordId!, draft, files);
        toast.success(`${def.label} record updated`);
        queryClient.invalidateQueries({ queryKey: ["/api/records"] });
        queryClient.invalidateQueries({ queryKey: ["/api/compliance"] });
        onOpenChange(false);
        return;
      }
      const result = await saveRecord(draft, files);
      if (result === "saved") {
        toast.success(`${def.label} record saved`);
        queryClient.invalidateQueries({ queryKey: ["/api/records"] });
        queryClient.invalidateQueries({ queryKey: ["/api/compliance"] });
      } else {
        toast.success("No signal: saved on this device. It will upload when you're back online.");
      }
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || "Couldn't save the record");
    } finally {
      setSaving(false);
    }
  };

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${def.label.toLowerCase()} record` : "New record"}</DialogTitle>
          <DialogDescription>What was done, where and when. Add a photo of the docket or label as evidence.</DialogDescription>
        </DialogHeader>

        {editing && loadingExisting ? (
          <p className="text-sm text-muted-foreground py-6">Loading the record…</p>
        ) : (
        <div className="space-y-5">
          {!editing && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Record type">
            {RECORD_TYPES.map(t => (
              <button
                key={t.type}
                type="button"
                role="radio"
                aria-checked={type === t.type}
                onClick={() => changeType(t.type)}
                className={cn(
                  "px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
                  type === t.type ? "text-white border-transparent" : "bg-background hover:bg-muted",
                )}
                style={type === t.type ? { backgroundColor: t.color } : undefined}
                data-testid={`record-type-${t.type}`}
              >
                {t.label}
              </button>
            ))}
          </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="record-when">When</Label>
              <Input id="record-when" type="datetime-local" value={occurredAt} max={nowLocal()} onChange={e => setOccurredAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="record-title">Title</Label>
              <Input id="record-title" placeholder={suggestedTitle} value={title} onChange={e => setTitle(e.target.value)} />
            </div>
          </div>

          {type === "spray" && (
            <TankMixEditor
              value={details.products ?? [emptySprayProduct()]}
              onChange={products => setDetails(d => ({ ...d, products }))}
            />
          )}

          {(type === "fertiliser" || type === "effluent") && (
            <ProductPicker
              kind={type}
              value={details.product ?? ""}
              onChange={product => setDetails(d => ({ ...d, product }))}
              onPick={p => setDetails(d => ({
                ...d,
                product: p.name,
                nPercent: p.nPercent ?? undefined,
                pPercent: p.pPercent ?? undefined,
                kPercent: p.kPercent ?? undefined,
                sPercent: p.sPercent ?? undefined,
              }))}
            />
          )}

          {type === "monthly_check" && (
            <Button type="button" variant="outline" size="sm"
              onClick={() => setDetails(d => ({ ...d, ...Object.fromEntries(MONTHLY_CHECK_ITEMS.map(i => [i.key, d[i.key] || "Pass"])) }))}>
              Mark the rest as passed
            </Button>
          )}

          {def.fields.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {def.fields.map(f => (
                <FieldInput key={f.key} field={f} value={details[f.key]} onChange={v => setDetails(d => ({ ...d, [f.key]: v }))} />
              ))}
            </div>
          )}

          {safeToGraze && (
            <p className="text-sm rounded-md border px-3 py-2 bg-muted">
              Safe to graze from <strong>{format(safeToGraze, "EEEE d MMMM")}</strong>. The area shows on the map as withheld until then.
            </p>
          )}

          {def.type !== "document" && (
            <div className="space-y-2">
              <Label>Paddocks</Label>
              {paddocks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No paddocks set up yet. Draw the area on the map instead.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {paddocks.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={pastureIds.includes(p.id)}
                      onClick={() => setPastureIds(ids => toggle(ids, p.id))}
                      className={cn("px-3 py-1 rounded-md border text-sm",
                        pastureIds.includes(p.id) ? "bg-pulse-forest text-white border-transparent" : "hover:bg-muted")}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
              {showMap ? (
                <AreaDrawer value={area} onChange={setArea} color={def.color} />
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={() => setShowMap(true)}>
                  <MapPin className="h-4 w-4 mr-1" />Draw the area on the map
                </Button>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {farmTags.map(t => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tags.includes(t.name)}
                  onClick={() => setTags(list => toggle(list, t.name))}
                  className={cn("px-2.5 py-1 rounded-full border text-xs font-medium",
                    tags.includes(t.name) ? "text-white border-transparent" : "hover:bg-muted")}
                  style={tags.includes(t.name) ? { backgroundColor: t.color ?? "#495057" } : undefined}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="record-files">Evidence</Label>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-muted">
                <Camera className="h-4 w-4" />Take photo
                <input type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files ?? [])].slice(0, 8)); e.target.value = ""; }} />
              </label>
              <label className="inline-flex items-center gap-1 px-3 py-2 rounded-md border text-sm cursor-pointer hover:bg-muted">
                <Paperclip className="h-4 w-4" />Attach file
                <input id="record-files" type="file" multiple accept="image/*,application/pdf,audio/*" className="sr-only"
                  onChange={e => { setFiles(f => [...f, ...Array.from(e.target.files ?? [])].slice(0, 8)); e.target.value = ""; }} />
              </label>
            </div>
            {attachedCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {attachedCount} file{attachedCount === 1 ? "" : "s"} already attached. Anything you add here is added to {attachedCount === 1 ? "it" : "them"}.
              </p>
            )}
            {files.length > 0 && (
              <ul className="space-y-1 text-sm">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center gap-2">
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-muted-foreground">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                    <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(list => list.filter((_, j) => j !== i))}>
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="record-notes">Notes</Label>
            <Textarea id="record-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving || (editing && !existing)} className="bg-pulse-forest hover:bg-pulse-forest-dark" data-testid="button-save-record">
            {saving ? "Saving…" : editing ? "Save changes" : "Save record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
