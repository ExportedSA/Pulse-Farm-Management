// The Shed page's link to Stride (docs/shed-link-protocol.md): draft rules and feed levels set here are
// sent to the farm's Stride, which drafts and feeds from them in the shed (and keeps a copy for when
// the internet drops). Staff can look; owners and managers change them.
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Link2, Link2Off } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";

type Lane = "LEFT" | "RIGHT" | "STRAIGHT";
type Condition = "milk_withholding" | "dose_due" | "in_group" | "heat" | "cow_numbers";
type Rule = {
  id: string; name: string; lane: Lane; priority: number; enabled: boolean; conditionType: Condition;
  groupId: string | null; withinHours: number | null; cowNumbers: string[] | null;
};
type Level = {
  id: string; animalId: string | null; groupId: string | null; gramsPerVisit: number; priority: number;
  enabled: boolean; validFrom: string | null; validTo: string | null; note: string | null;
};
type Group = { id: string; name: string };
type Animal = { id: string; visualId: string | null; cowId: string | null; eid: string | null; status: string };
type Snapshot = {
  version: string; generatedAt: string;
  herd: { eid: string; cowNumber: string | null }[];
  draft: { eid: string; lane: Lane; reason: string }[];
  feed: { eid: string; gramsPerVisit: number; reason: string }[];
};
type ShedEvent = {
  id: string; kind: "eid" | "draft" | "feed"; occurredAt: string; eid: string | null; reader: string | null;
  lane: string | null; source: string | null; reason: string | null; bail: number | null;
  targetGrams: number | null; actualGrams: number | null;
};

const LANES: { value: Lane; label: string }[] = [
  { value: "LEFT", label: "Left" }, { value: "RIGHT", label: "Right" }, { value: "STRAIGHT", label: "Straight" },
];
const CONDITIONS: { value: Condition; label: string }[] = [
  { value: "milk_withholding", label: "Milk not clear for the vat" },
  { value: "dose_due", label: "A treatment dose is due" },
  { value: "in_group", label: "In a group or mob" },
  { value: "heat", label: "Heat recorded recently" },
  { value: "cow_numbers", label: "Listed cow numbers" },
];
const laneLabel = (l: string | null) => LANES.find(x => x.value === l)?.label ?? l ?? "";

// "403: {"error":"..."}" from apiRequest -> the server's reason
function reason(e: unknown, fallback: string) {
  const text = e instanceof Error ? e.message : "";
  try {
    const body = JSON.parse(text.replace(/^\d{3}:\s*/, ""));
    if (typeof body?.error === "string") return body.error;
  } catch { /* not JSON */ }
  return fallback;
}

function useCanEdit() {
  const { data: farm } = useQuery<{ role?: string }>({ queryKey: ["/api/farms/current"] });
  return farm?.role === "owner" || farm?.role === "manager";
}

function useGroups() {
  return useQuery<Group[]>({ queryKey: ["/api/groups"] }).data ?? [];
}

function useAnimals() {
  return useQuery<Animal[]>({ queryKey: ["/api/animals"] }).data ?? [];
}

const cowNumber = (a: Animal) => a.visualId || a.cowId || "";

// ── Draft rules ──

function describeRule(r: Rule, groups: Group[]) {
  switch (r.conditionType) {
    case "milk_withholding": return "Milk not clear for the vat";
    case "dose_due": return `Treatment dose due within ${r.withinHours} h`;
    case "in_group": return `In ${groups.find(g => g.id === r.groupId)?.name ?? "a group"}`;
    case "heat": return `Heat recorded in the last ${r.withinHours} h`;
    case "cow_numbers": {
      const list = r.cowNumbers ?? [];
      return `Cows ${list.slice(0, 8).join(", ")}${list.length > 8 ? ` and ${list.length - 8} more` : ""}`;
    }
  }
}

const emptyRule = { name: "", lane: "LEFT" as Lane, priority: 0, enabled: true, conditionType: "milk_withholding" as Condition,
  groupId: "", withinHours: "", cowNumbers: "" };

export function DraftRulesPanel() {
  const canEdit = useCanEdit();
  const groups = useGroups();
  const { data: rules = [], isLoading } = useQuery<Rule[]>({ queryKey: ["/api/hardware/draft-rules"] });
  const [editing, setEditing] = useState<Rule | "new" | null>(null);
  const [form, setForm] = useState(emptyRule);

  const open = (rule: Rule | "new") => {
    setEditing(rule);
    setForm(rule === "new" ? emptyRule : {
      name: rule.name, lane: rule.lane, priority: rule.priority, enabled: rule.enabled, conditionType: rule.conditionType,
      groupId: rule.groupId ?? "", withinHours: rule.withinHours ? String(rule.withinHours) : "",
      cowNumbers: (rule.cowNumbers ?? []).join(", "),
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        name: form.name, lane: form.lane, priority: Number(form.priority) || 0, enabled: form.enabled,
        conditionType: form.conditionType,
        groupId: form.groupId || null,
        withinHours: form.withinHours ? Number(form.withinHours) : null,
        cowNumbers: form.cowNumbers.split(/[\s,]+/).map(s => s.trim()).filter(Boolean),
      };
      return editing && editing !== "new"
        ? apiRequest(`/api/hardware/draft-rules/${editing.id}`, "PUT", body)
        : apiRequest("/api/hardware/draft-rules", "POST", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/draft-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/snapshot"] });
      setEditing(null);
      toast.success("Draft rule saved. Stride gets it straight away when it's connected.");
    },
    onError: e => toast.error(reason(e, "Couldn't save the draft rule")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/hardware/draft-rules/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/draft-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/snapshot"] });
      toast.success("Draft rule removed");
    },
    onError: e => toast.error(reason(e, "Couldn't remove the draft rule")),
  });

  const toggle = useMutation({
    mutationFn: (r: Rule) => apiRequest(`/api/hardware/draft-rules/${r.id}`, "PUT", { ...r, enabled: !r.enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/draft-rules"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/snapshot"] });
    },
    onError: e => toast.error(reason(e, "Couldn't change the draft rule")),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Draft rules</CardTitle>
          <CardDescription>
            Stride sends each cow down the lane of the first rule she matches, highest priority first. Cows no rule
            matches are left to Stride's own rules and its default lane.
          </CardDescription>
        </div>
        {canEdit && <Button size="sm" onClick={() => open("new")}><Plus className="h-4 w-4 mr-1" />Add rule</Button>}
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No draft rules yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead><TableHead>Matches</TableHead><TableHead>Lane</TableHead>
                <TableHead className="text-right">Priority</TableHead><TableHead>On</TableHead>{canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map(r => (
                <TableRow key={r.id} className={r.enabled ? "" : "opacity-60"}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{describeRule(r, groups)}</TableCell>
                  <TableCell><Badge variant="outline">{laneLabel(r.lane)}</Badge></TableCell>
                  <TableCell className="text-right">{r.priority}</TableCell>
                  <TableCell>
                    <Switch checked={r.enabled} disabled={!canEdit || toggle.isPending} onCheckedChange={() => toggle.mutate(r)}
                      aria-label={`Rule ${r.name} on`} />
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => open(r)} aria-label={`Edit ${r.name}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)} aria-label={`Remove ${r.name}`}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === "new" ? "Add draft rule" : "Edit draft rule"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rule-name">Name</Label>
              <Input id="rule-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Withheld cows" />
            </div>
            <div className="grid gap-2">
              <Label>Draft a cow when</Label>
              <Select value={form.conditionType} onValueChange={v => setForm({ ...form, conditionType: v as Condition })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.conditionType === "in_group" && (
              <div className="grid gap-2">
                <Label>Group or mob</Label>
                <Select value={form.groupId} onValueChange={v => setForm({ ...form, groupId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                  <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {(form.conditionType === "dose_due" || form.conditionType === "heat") && (
              <div className="grid gap-2">
                <Label htmlFor="rule-hours">{form.conditionType === "heat" ? "Heat in the last (hours)" : "Dose due within (hours)"}</Label>
                <Input id="rule-hours" type="number" min={1} max={720} value={form.withinHours}
                  onChange={e => setForm({ ...form, withinHours: e.target.value })} />
              </div>
            )}
            {form.conditionType === "cow_numbers" && (
              <div className="grid gap-2">
                <Label htmlFor="rule-cows">Cow numbers</Label>
                <Textarea id="rule-cows" value={form.cowNumbers} onChange={e => setForm({ ...form, cowNumbers: e.target.value })}
                  placeholder="Separate with spaces, commas or new lines" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Lane</Label>
                <Select value={form.lane} onValueChange={v => setForm({ ...form, lane: v as Lane })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LANES.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rule-priority">Priority (higher first)</Label>
                <Input id="rule-priority" type="number" value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value as any })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="rule-on" checked={form.enabled} onCheckedChange={v => setForm({ ...form, enabled: v })} />
              <Label htmlFor="rule-on">On</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Feed levels ──

const emptyLevel = { target: "group" as "group" | "cow", groupId: "", cow: "", gramsPerVisit: "", priority: 0,
  enabled: true, validFrom: "", validTo: "", note: "" };

export function FeedLevelsPanel() {
  const canEdit = useCanEdit();
  const groups = useGroups();
  const animals = useAnimals();
  const { data: levels = [], isLoading } = useQuery<Level[]>({ queryKey: ["/api/hardware/feed-levels"] });
  const [editing, setEditing] = useState<Level | "new" | null>(null);
  const [form, setForm] = useState(emptyLevel);

  const animalById = useMemo(() => new Map(animals.map(a => [a.id, a])), [animals]);
  const cowMatch = form.cow.trim()
    ? animals.find(a => a.status === "active" && cowNumber(a).toLowerCase() === form.cow.trim().toLowerCase())
    : undefined;

  const open = (level: Level | "new") => {
    setEditing(level);
    setForm(level === "new" ? emptyLevel : {
      target: level.animalId ? "cow" : "group", groupId: level.groupId ?? "",
      cow: level.animalId ? cowNumber(animalById.get(level.animalId) ?? ({} as Animal)) : "",
      gramsPerVisit: String(level.gramsPerVisit), priority: level.priority, enabled: level.enabled,
      validFrom: level.validFrom ?? "", validTo: level.validTo ?? "", note: level.note ?? "",
    });
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        animalId: form.target === "cow" ? cowMatch?.id ?? null : null,
        groupId: form.target === "group" ? form.groupId || null : null,
        gramsPerVisit: Number(form.gramsPerVisit), priority: Number(form.priority) || 0, enabled: form.enabled,
        validFrom: form.validFrom || null, validTo: form.validTo || null, note: form.note || null,
      };
      return editing && editing !== "new"
        ? apiRequest(`/api/hardware/feed-levels/${editing.id}`, "PUT", body)
        : apiRequest("/api/hardware/feed-levels", "POST", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/feed-levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/snapshot"] });
      setEditing(null);
      toast.success("Feed level saved. Stride gets it straight away when it's connected.");
    },
    onError: e => toast.error(reason(e, "Couldn't save the feed level")),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/hardware/feed-levels/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/feed-levels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hardware/snapshot"] });
      toast.success("Feed level removed");
    },
    onError: e => toast.error(reason(e, "Couldn't remove the feed level")),
  });

  const targetName = (l: Level) => l.animalId
    ? `Cow ${cowNumber(animalById.get(l.animalId) ?? ({} as Animal)) || "?"}`
    : groups.find(g => g.id === l.groupId)?.name ?? "Group";
  const when = (l: Level) => l.validFrom || l.validTo ? `${l.validFrom ?? "…"} to ${l.validTo ?? "…"}` : "Always";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Feed levels</CardTitle>
          <CardDescription>
            Grams fed per bail visit. A cow's own level beats her group's; between groups, the higher priority wins.
            Cows with no level get no in-shed feed from Pulse.
          </CardDescription>
        </div>
        {canEdit && <Button size="sm" onClick={() => open("new")}><Plus className="h-4 w-4 mr-1" />Add level</Button>}
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : levels.length === 0 ? (
          <p className="text-sm text-muted-foreground">No feed levels yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>For</TableHead><TableHead className="text-right">Grams per visit</TableHead>
                <TableHead className="text-right">Priority</TableHead><TableHead>When</TableHead><TableHead>On</TableHead>
                {canEdit && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map(l => (
                <TableRow key={l.id} className={l.enabled ? "" : "opacity-60"}>
                  <TableCell className="font-medium">{targetName(l)}{l.note ? <span className="block text-xs text-muted-foreground">{l.note}</span> : null}</TableCell>
                  <TableCell className="text-right">{l.gramsPerVisit.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{l.priority}</TableCell>
                  <TableCell>{when(l)}</TableCell>
                  <TableCell>{l.enabled ? "Yes" : "No"}</TableCell>
                  {canEdit && (
                    <TableCell className="text-right whitespace-nowrap">
                      <Button variant="ghost" size="icon" onClick={() => open(l)} aria-label={`Edit level for ${targetName(l)}`}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(l.id)} aria-label={`Remove level for ${targetName(l)}`}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing === "new" ? "Add feed level" : "Edit feed level"}</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>For</Label>
              <Select value={form.target} onValueChange={v => setForm({ ...form, target: v as "group" | "cow" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="group">A group or mob</SelectItem>
                  <SelectItem value="cow">One cow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.target === "group" ? (
              <div className="grid gap-2">
                <Label>Group or mob</Label>
                <Select value={form.groupId} onValueChange={v => setForm({ ...form, groupId: v })}>
                  <SelectTrigger><SelectValue placeholder="Choose a group" /></SelectTrigger>
                  <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="level-cow">Cow number</Label>
                <Input id="level-cow" value={form.cow} onChange={e => setForm({ ...form, cow: e.target.value })} />
                {form.cow.trim() && !cowMatch && <p className="text-xs text-destructive">No current cow with that number</p>}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="level-grams">Grams per visit</Label>
                <Input id="level-grams" type="number" min={1} max={20000} value={form.gramsPerVisit}
                  onChange={e => setForm({ ...form, gramsPerVisit: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="level-priority">Priority</Label>
                <Input id="level-priority" type="number" value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value as any })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="level-from">From (optional)</Label>
                <Input id="level-from" type="date" value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="level-to">To (optional)</Label>
                <Input id="level-to" type="date" value={form.validTo} onChange={e => setForm({ ...form, validTo: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="level-note">Note (optional)</Label>
              <Input id="level-note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="level-on" checked={form.enabled} onCheckedChange={v => setForm({ ...form, enabled: v })} />
              <Label htmlFor="level-on">On</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()}
              disabled={save.isPending || !Number(form.gramsPerVisit) || (form.target === "cow" ? !cowMatch : !form.groupId)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── The link: is Stride connected, what it's been sent, what it reported ──

type Health = { ok: boolean; link?: { connected: boolean; hello?: { version?: string; remoteControl?: boolean } | null; status?: { gate?: string; at: string } | null } };

export function StrideLinkPanel() {
  const canEdit = useCanEdit();
  const health = useQuery<Health>({ queryKey: ["/api/hardware/health"], refetchInterval: 10_000 });
  const snapshot = useQuery<Snapshot>({ queryKey: ["/api/hardware/snapshot"], enabled: canEdit });
  const events = useQuery<ShedEvent[]>({ queryKey: ["/api/hardware/events"], refetchInterval: 15_000, retry: false });

  const noGateway = /no_gateway/.test(String((health.error as Error | null)?.message ?? ""));
  const link = health.data?.link;
  const cowOf = useMemo(() => new Map((snapshot.data?.herd ?? []).map(c => [c.eid, c.cowNumber])), [snapshot.data]);
  const cow = (eid: string | null) => (eid ? cowOf.get(eid) ?? eid : "Unknown cow");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {link?.connected ? <Link2 className="h-5 w-5 text-green-600" /> : <Link2Off className="h-5 w-5 text-muted-foreground" />}
            Stride link
          </CardTitle>
          <CardDescription>
            Stride, on the shed PC, connects to Pulse and drafts and feeds from the lists below. If the internet drops it
            keeps going from its last copy and sends what happened when it's back.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {noGateway ? (
            <p>No shed hardware is set up for this farm yet. Stride links in once the service operator gives this farm a Stride link token.</p>
          ) : !link ? (
            <p className="text-muted-foreground">This farm's shed hardware isn't a Stride link.</p>
          ) : link.connected ? (
            <>
              <p><Badge className="bg-green-600">Connected</Badge> {link.hello?.version ? `Stride ${link.hello.version}` : null}</p>
              <p>Remote control from Pulse: {link.hello?.remoteControl ? "allowed in Stride" : "off in Stride (it drafts and feeds from the lists; buttons here won't move anything)"}</p>
              {link.status?.gate && <p>Gate: {link.status.gate}</p>}
            </>
          ) : (
            <p><Badge variant="outline">Not connected</Badge> Stride isn't connected now. It keeps drafting and feeding from its last copy of the lists.</p>
          )}
        </CardContent>
      </Card>

      {canEdit && snapshot.data && (
        <Card>
          <CardHeader>
            <CardTitle>What Stride is sent now</CardTitle>
            <CardDescription>
              {snapshot.data.draft.length} cow{snapshot.data.draft.length === 1 ? "" : "s"} to draft and {snapshot.data.feed.length} with a feed level,
              out of {snapshot.data.herd.length} with an EID tag.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-2">
            <div>
              <h4 className="font-medium mb-2">Drafting</h4>
              {snapshot.data.draft.length === 0 ? <p className="text-sm text-muted-foreground">No cow matches a rule now.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Cow</TableHead><TableHead>Lane</TableHead><TableHead>Why</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {snapshot.data.draft.map(d => (
                      <TableRow key={d.eid}><TableCell>{cow(d.eid)}</TableCell><TableCell>{laneLabel(d.lane)}</TableCell><TableCell>{d.reason}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div>
              <h4 className="font-medium mb-2">Feeding</h4>
              {snapshot.data.feed.length === 0 ? <p className="text-sm text-muted-foreground">No cow has a feed level now.</p> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Cow</TableHead><TableHead className="text-right">Grams per visit</TableHead><TableHead>From</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {snapshot.data.feed.map(f => (
                      <TableRow key={f.eid}><TableCell>{cow(f.eid)}</TableCell><TableCell className="text-right">{f.gramsPerVisit.toLocaleString()}</TableCell><TableCell>{f.reason}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {!noGateway && (
        <Card>
          <CardHeader>
            <CardTitle>In the shed, last 24 hours</CardTitle>
            <CardDescription>Tag reads, drafts and feeds Stride reported.</CardDescription>
          </CardHeader>
          <CardContent>
            {(events.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Nothing reported yet.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Cow</TableHead><TableHead>What happened</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(events.data ?? []).slice(0, 200).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap">{new Date(e.occurredAt).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                      <TableCell>{cow(e.eid)}</TableCell>
                      <TableCell>
                        {e.kind === "eid" && `Tag read${e.reader ? ` at ${e.reader}` : ""}`}
                        {e.kind === "draft" && `Drafted ${laneLabel(e.lane).toLowerCase()}${e.source ? ` (${e.source})` : ""}${e.reason ? `: ${e.reason}` : ""}`}
                        {e.kind === "feed" && `Fed ${e.actualGrams ?? "?"} of ${e.targetGrams ?? "?"} g${e.bail ? ` at bail ${e.bail}` : ""}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
