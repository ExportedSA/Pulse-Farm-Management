import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Map as MapIcon, Square } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InviteStaff } from "@/components/invite-staff";
import { OpeningStockStep } from "@/components/setup/opening-stock-step";

// /app/setup - Setting up a farm on Pulse: its details and NAIT number, the boundary and
// paddocks (drawn with the farm map tools), opening stock numbers (Phase 1 fills that step),
// and inviting staff. Progress is kept with the farm, so setup can be left and picked up later.

interface CurrentFarm {
  id: string;
  name: string;
  location: string | null;
  address: string | null;
  naitNumber: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  role: string;
  settings: { areaHa?: number | null; onboarding?: { step?: string; skipped?: string[]; completedAt?: string | null } } | null;
}

interface MapState {
  layers: { id: string; key: string }[];
  paddocks: { id: string; boundaryId: string | null; areaHa: number | null }[];
  features: { layerId: string; kind: string; areaHa: number | null }[];
}

const STEPS = [
  { key: "details", title: "Farm details" },
  { key: "map", title: "Boundary and paddocks" },
  { key: "stock", title: "Opening stock numbers" },
  { key: "people", title: "Invite your team" },
  { key: "done", title: "Finished" },
] as const;
type StepKey = typeof STEPS[number]["key"];

async function patchFarm(body: Record<string, unknown>) {
  const res = await fetch("/api/farms/current", {
    method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.details?.[0]?.message ?? out.error ?? "Couldn't save");
  return out as CurrentFarm;
}

const fmtHa = (n: number) => `${n.toLocaleString("en-NZ", { maximumFractionDigits: 1 })} ha`;

export default function OnboardingWizard() {
  const queryClient = useQueryClient();
  const { data: farm, isLoading } = useQuery<CurrentFarm>({ queryKey: ["/api/farms/current"] });
  const [step, setStep] = useState<StepKey>("details");
  const [started, setStarted] = useState(false);

  // Pick up where the farm left off
  useEffect(() => {
    if (!farm || started) return;
    setStarted(true);
    const saved = farm.settings?.onboarding;
    if (saved?.completedAt) setStep("done");
    else if (saved?.step && STEPS.some(s => s.key === saved.step)) setStep(saved.step as StepKey);
  }, [farm, started]);

  if (isLoading || !farm) {
    return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const manages = farm.role === "owner" || farm.role === "manager";
  if (!manages) {
    return (
      <div className="p-4 md:p-8 max-w-3xl mx-auto">
        <Card className="p-6 text-sm text-muted-foreground">Farm setup is done by the farm's owner or manager.</Card>
      </div>
    );
  }

  const index = STEPS.findIndex(s => s.key === step);
  const skipped = farm.settings?.onboarding?.skipped ?? [];

  const go = async (next: StepKey, opts: { skip?: boolean } = {}) => {
    const onboarding: Record<string, unknown> = { step: next };
    if (opts.skip && !skipped.includes(step)) onboarding.skipped = [...skipped, step];
    if (!opts.skip && skipped.includes(step)) onboarding.skipped = skipped.filter(s => s !== step);
    if (next === "done") onboarding.completedAt = new Date().toISOString();
    try {
      const updated = await patchFarm({ onboarding });
      queryClient.setQueryData(["/api/farms/current"], updated);
    } catch (err: any) {
      toast.error(err.message);
      return;
    }
    setStep(next);
    window.scrollTo({ top: 0 });
  };
  const nextKey = STEPS[Math.min(index + 1, STEPS.length - 1)].key;
  const backKey = STEPS[Math.max(index - 1, 0)].key;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Set up {farm.name}</h1>
        <p className="text-sm text-muted-foreground">A few steps to get your farm ready. You can leave and come back to this from Setup in the menu.</p>
      </div>

      <ol className="flex flex-wrap gap-2 text-sm" aria-label="Setup steps">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <button
              type="button"
              onClick={() => setStep(s.key)}
              aria-current={s.key === step ? "step" : undefined}
              className={"flex items-center gap-1 rounded-full border px-3 py-1 " + (s.key === step ? "border-pulse-forest bg-emerald-50 font-medium" : "text-muted-foreground")}
            >
              {i < index && !skipped.includes(s.key) ? <Check className="h-3 w-3" /> : <span className="text-xs">{i + 1}</span>}
              {s.title}{skipped.includes(s.key) && i < index ? " (skipped)" : ""}
            </button>
          </li>
        ))}
      </ol>

      {step === "details" && <DetailsStep farm={farm} onSaved={updated => { queryClient.setQueryData(["/api/farms/current"], updated); queryClient.invalidateQueries({ queryKey: ["/api/farms"] }); go("map"); }} />}

      {step === "map" && (
        <StepCard title="Boundary and paddocks" description="Draw your farm boundary and paddocks on the satellite map. Pulse uses them for grazing, jobs, spreading and the hazard map.">
          <MapStep areaHa={farm.settings?.areaHa ?? null} />
          <StepButtons onBack={() => setStep(backKey)} onNext={() => go(nextKey)} onSkip={() => go(nextKey, { skip: true })} />
        </StepCard>
      )}

      {step === "stock" && (
        <StepCard title="Opening stock numbers" description="How many of each class of stock you had at your balance date.">
          <OpeningStockStep onDone={() => go(nextKey)} />
          <StepButtons onBack={() => setStep(backKey)} onSkip={() => go(nextKey, { skip: true })} />
        </StepCard>
      )}

      {step === "people" && (
        <StepCard title="Invite your team" description="Each person gets an email with a link to join this farm. Choose what they can do: managers can change farm settings, workers record day-to-day work, viewers can only look, contractors see only the jobs shared with them.">
          <InviteStaff farmId={farm.id} isOwner={farm.role === "owner"} />
          <StepButtons onBack={() => setStep(backKey)} onNext={() => go(nextKey)} nextLabel="Finish setup" />
        </StepCard>
      )}

      {step === "done" && (
        <StepCard title="Your farm is set up" description="You can change any of this later.">
          {skipped.length > 0 && (
            <p className="text-sm">Skipped for now: {skipped.map(k => STEPS.find(s => s.key === k)?.title ?? k).join(", ")}. Click a step above to go back to it.</p>
          )}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild className="bg-emerald-700 hover:bg-emerald-800"><a href="/">Go to the dashboard</a></Button>
            <Button asChild variant="outline"><a href="/app/animals">Add or import animals</a></Button>
            <Button asChild variant="outline"><a href="/app/farm-map">Open the farm map</a></Button>
          </div>
        </StepCard>
      )}
    </div>
  );
}

function StepCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function StepButtons({ onBack, onNext, onSkip, nextLabel = "Next" }: { onBack?: () => void; onNext?: () => void; onSkip?: () => void; nextLabel?: string }) {
  return (
    <div className="flex flex-wrap gap-2 pt-4 border-t">
      {onBack && <Button variant="outline" onClick={onBack}>Back</Button>}
      <span className="grow" />
      {onSkip && <Button variant="ghost" onClick={onSkip}>Skip for now</Button>}
      {onNext && <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={onNext}>{nextLabel}</Button>}
    </div>
  );
}

function DetailsStep({ farm, onSaved }: { farm: CurrentFarm; onSaved: (f: CurrentFarm) => void }) {
  const [form, setForm] = useState({
    name: farm.name ?? "",
    location: farm.location ?? "",
    address: farm.address ?? "",
    naitNumber: farm.naitNumber ?? "",
    contactEmail: farm.contactEmail ?? "",
    contactPhone: farm.contactPhone ?? "",
    areaHa: farm.settings?.areaHa != null ? String(farm.settings.areaHa) : "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const blank = (s: string) => (s.trim() === "" ? null : s.trim());

  return (
    <StepCard title="Farm details" description="The farm's name, where it is, and its NAIT location number.">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={async e => {
        e.preventDefault();
        if (!form.name.trim()) return toast.error("Give the farm a name");
        const area = form.areaHa.trim() === "" ? null : Number(form.areaHa);
        if (area !== null && !(area > 0)) return toast.error("Enter the farm's area in hectares, or leave it blank");
        setBusy(true);
        try {
          onSaved(await patchFarm({
            name: form.name.trim(), location: blank(form.location), address: blank(form.address), naitNumber: blank(form.naitNumber),
            contactEmail: blank(form.contactEmail), contactPhone: blank(form.contactPhone), areaHa: area,
          }));
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setBusy(false);
        }
      }}>
        <Field id="fd-name" label="Farm name"><Input id="fd-name" value={form.name} onChange={set("name")} required /></Field>
        <Field id="fd-loc" label="District or area"><Input id="fd-loc" value={form.location} onChange={set("location")} /></Field>
        <Field id="fd-addr" label="Address" wide><Input id="fd-addr" value={form.address} onChange={set("address")} autoComplete="street-address" /></Field>
        <Field id="fd-nait" label="NAIT location number" hint="From your NAIT account. Leave it blank if you don't have it to hand.">
          <Input id="fd-nait" value={form.naitNumber} onChange={set("naitNumber")} maxLength={50} />
        </Field>
        <Field id="fd-area" label="Total farm area (hectares)" hint="Sets your onboarding fee band. You can check it against the boundary you draw next.">
          <Input id="fd-area" type="number" inputMode="decimal" min="0" step="any" value={form.areaHa} onChange={set("areaHa")} />
        </Field>
        <Field id="fd-email" label="Farm contact email"><Input id="fd-email" type="email" value={form.contactEmail} onChange={set("contactEmail")} /></Field>
        <Field id="fd-phone" label="Farm contact phone"><Input id="fd-phone" type="tel" value={form.contactPhone} onChange={set("contactPhone")} /></Field>
        <div className="sm:col-span-2 flex justify-end border-t pt-4">
          <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save and continue"}</Button>
        </div>
      </form>
    </StepCard>
  );
}

function Field({ id, label, hint, wide, children }: { id: string; label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={"space-y-1" + (wide ? " sm:col-span-2" : "")}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function MapStep({ areaHa }: { areaHa: number | null }) {
  const { data: map, isLoading } = useQuery<MapState>({ queryKey: ["/api/farm-map"] });
  if (isLoading || !map) return <Loader2 className="h-5 w-5 animate-spin" />;
  const boundaryLayer = map.layers.find(l => l.key === "boundary");
  const boundaries = map.features.filter(f => f.layerId === boundaryLayer?.id && (f.kind === "polygon" || f.kind === "circle"));
  const boundaryHa = boundaries.reduce((sum, f) => sum + (f.areaHa ?? 0), 0);
  const drawnPaddocks = map.paddocks.filter(p => p.boundaryId);
  const paddockHa = drawnPaddocks.reduce((sum, p) => sum + (p.areaHa ?? 0), 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="rounded-md border p-4 space-y-2">
        <p className="font-medium flex items-center gap-2">{boundaries.length > 0 && <Check className="h-4 w-4 text-emerald-700" />}Farm boundary</p>
        <p className="text-sm text-muted-foreground">
          {boundaries.length > 0 ? `Drawn: ${fmtHa(boundaryHa)}.` : "Not drawn yet."}
          {boundaries.length > 0 && areaHa != null && ` You gave the farm's area as ${fmtHa(areaHa)}.`}
        </p>
        <Button asChild variant="outline" size="sm"><a href="/app/farm-map?draw=boundary&from=setup"><Square className="h-4 w-4 mr-1" />{boundaries.length > 0 ? "Redraw on the map" : "Draw the boundary"}</a></Button>
      </div>
      <div className="rounded-md border p-4 space-y-2">
        <p className="font-medium flex items-center gap-2">{drawnPaddocks.length > 0 && <Check className="h-4 w-4 text-emerald-700" />}Paddocks</p>
        <p className="text-sm text-muted-foreground">
          {drawnPaddocks.length > 0 ? `${drawnPaddocks.length} drawn, ${fmtHa(paddockHa)} in all.` : "None drawn yet."}
          {map.paddocks.length > drawnPaddocks.length && ` ${map.paddocks.length - drawnPaddocks.length} more listed without a boundary.`}
        </p>
        <Button asChild variant="outline" size="sm"><a href="/app/farm-map?draw=paddock&from=setup"><MapIcon className="h-4 w-4 mr-1" />Draw paddocks</a></Button>
      </div>
      <p className="sm:col-span-2 text-xs text-muted-foreground">Already have your paddocks in a map file (KML, KMZ or GeoJSON)? Use Import on the farm map.</p>
    </div>
  );
}
