import { useQuery } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchProducts, type LibraryProduct } from "@/lib/records";

export interface SprayProduct {
  product: string;
  activeIngredient?: string;
  rate: number | "";
  rateUnit: string;
}

const RATE_UNITS = ["L/ha", "mL/ha", "kg/ha", "g/ha", "mL/10L"];

/**
 * The products in one spray application (a tank mix), each with its own rate
 */
export function TankMixEditor({ value, onChange }: { value: SprayProduct[]; onChange: (v: SprayProduct[]) => void }) {
  const update = (i: number, patch: Partial<SprayProduct>) =>
    onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="space-y-2">
      <Label>Products *</Label>
      {value.map((p, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[2fr_2fr_1fr_1fr_auto] items-end rounded-md border p-2">
          <div className="space-y-1">
            <Label htmlFor={`spray-product-${i}`} className="text-xs">Chemical</Label>
            <Input id={`spray-product-${i}`} placeholder="e.g. Tordon Brushkiller" value={p.product}
              onChange={e => update(i, { product: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`spray-ai-${i}`} className="text-xs">Active ingredient</Label>
            <Input id={`spray-ai-${i}`} placeholder="e.g. triclopyr" value={p.activeIngredient ?? ""}
              onChange={e => update(i, { activeIngredient: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`spray-rate-${i}`} className="text-xs">Rate</Label>
            <Input id={`spray-rate-${i}`} type="number" inputMode="decimal" step="any" value={p.rate}
              onChange={e => update(i, { rate: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`spray-unit-${i}`} className="text-xs">Unit</Label>
            <select id={`spray-unit-${i}`} className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={p.rateUnit}
              onChange={e => update(i, { rateUnit: e.target.value })}>
              {RATE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove product"
            disabled={value.length === 1} onClick={() => onChange(value.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm"
        onClick={() => onChange([...value, { product: "", activeIngredient: "", rate: "", rateUnit: value[value.length - 1]?.rateUnit ?? "L/ha" }])}>
        <Plus className="h-4 w-4 mr-1" />Add product to tank mix
      </Button>
    </div>
  );
}

/**
 * Product name with suggestions from the library; picking one fills in its analysis
 */
export function ProductPicker({
  kind, value, onChange, onPick,
}: {
  kind: "fertiliser" | "effluent";
  value: string;
  onChange: (name: string) => void;
  onPick: (product: LibraryProduct) => void;
}) {
  const { data: products = [] } = useQuery({ queryKey: ["/api/records/products", kind], queryFn: () => fetchProducts(kind) });
  const listId = `product-library-${kind}`;
  const choose = (name: string) => {
    onChange(name);
    const match = products.find(p => p.name.toLowerCase() === name.trim().toLowerCase());
    if (match) onPick(match);
  };
  const picked = products.find(p => p.name.toLowerCase() === value.trim().toLowerCase());
  return (
    <div className="space-y-1">
      <Label htmlFor={`record-product-${kind}`}>Product{kind === "fertiliser" ? " *" : ""}</Label>
      <Input id={`record-product-${kind}`} list={listId} value={value} placeholder="Start typing, e.g. Urea"
        onChange={e => choose(e.target.value)} autoComplete="off" />
      <datalist id={listId}>
        {products.map(p => <option key={p.id} value={p.name} />)}
      </datalist>
      <p className="text-xs text-muted-foreground">
        {picked
          ? `Analysis filled in from the library${picked.notes ? ` (${picked.notes.toLowerCase()})` : ""}.`
          : "Pick from the list to fill in the analysis, or type your own product and enter it below."}
      </p>
    </div>
  );
}
