import { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Archive, FileText, FolderOpen, MapPin, Paperclip, Plus, Printer, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFarm } from '@/lib/farm-context';
import { FARM_MAP_KEY } from '@/lib/farm-map';
import { HazardFields } from '@/components/farm-map/SafetyPanels';
import {
  DOCUMENTS_KEY, HAZARD_CATEGORIES, HAZARD_STATUSES, HAZARDS_KEY, SAFETY_DOCUMENT_TYPES, hazardCategoryLabel, riskColour, riskText,
  safety, safetyDocumentLabel, type Hazard, type HazardInput,
} from '@/lib/safety';

// Health & Safety: the farm's hazard register (each hazard can be placed on the farm map),
// incidents, and the farm's own safety documents. Everything here is saved to the farm.

interface Incident {
  id: string; type: string; description: string; severity: string; status: string; occurredAt: string; location: string | null; createdAt: string;
}

const INCIDENT_TYPES = [
  { key: 'injury', label: 'Injury' },
  { key: 'near_miss', label: 'Near miss' },
  { key: 'vehicle', label: 'Vehicle or quad bike' },
  { key: 'machinery', label: 'Machinery' },
  { key: 'livestock', label: 'Livestock' },
  { key: 'chemical', label: 'Chemical' },
  { key: 'property_damage', label: 'Property damage' },
  { key: 'environmental', label: 'Environmental' },
  { key: 'other', label: 'Other' },
];
const SEVERITIES = ['minor', 'moderate', 'major', 'critical'] as const;
const INCIDENT_STATUS_LABEL: Record<string, string> = { open: 'Open', investigating: 'Investigating', resolved: 'Resolved', closed: 'Closed' };

const today = () => new Date().toISOString().slice(0, 10);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'include', ...init });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}
const send = <T,>(method: string, url: string, body?: unknown) =>
  api<T>(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

export default function CompliancePage() {
  const { currentFarm } = useFarm();
  const role = currentFarm?.role;
  const canManage = role === 'owner' || role === 'manager';
  const canReport = canManage || role === 'worker';
  const { data: hazards = [] } = useQuery({ queryKey: [...HAZARDS_KEY, 'all'], queryFn: () => safety.hazards(true) });
  const { data: incidents = [] } = useQuery({ queryKey: ['/api/compliance/incidents'], queryFn: () => api<Incident[]>('/api/compliance/incidents') });
  const openHazards = hazards.filter(h => h.status !== 'resolved').length;
  const openIncidents = incidents.filter(i => i.status === 'open' || i.status === 'investigating').length;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Health &amp; safety</h1>
          <p className="text-muted-foreground mt-1">The farm's hazards, incidents and safety documents</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/app/farm-map"><MapPin className="h-4 w-4 mr-1" />Hazards on the map</Link></Button>
          <Button asChild variant="outline"><Link href="/app/farm-map/hazards/print"><Printer className="h-4 w-4 mr-1" />Print hazard map</Link></Button>
        </div>
      </div>

      <Tabs defaultValue="hazards" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hazards"><AlertTriangle className="h-4 w-4 mr-2" />Hazards ({openHazards})</TabsTrigger>
          <TabsTrigger value="incidents"><FileText className="h-4 w-4 mr-2" />Incidents ({openIncidents})</TabsTrigger>
          <TabsTrigger value="documents"><FolderOpen className="h-4 w-4 mr-2" />Documents</TabsTrigger>
        </TabsList>
        <TabsContent value="hazards" className="mt-6"><HazardRegister hazards={hazards} canManage={canManage} canReport={canReport} /></TabsContent>
        <TabsContent value="incidents" className="mt-6"><Incidents incidents={incidents} canManage={canManage} canReport={canReport} /></TabsContent>
        <TabsContent value="documents" className="mt-6"><Documents canManage={canManage} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Hazard register =====

function HazardRegister({ hazards, canManage, canReport }: { hazards: Hazard[]; canManage: boolean; canReport: boolean }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'open' | 'all' | Hazard['status']>('open');
  const [category, setCategory] = useState('all');
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const shown = hazards.filter(h => (status === 'all' || (status === 'open' ? h.status !== 'resolved' : h.status === status)) && (category === 'all' || h.type === category));
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: HAZARDS_KEY }), queryClient.invalidateQueries({ queryKey: FARM_MAP_KEY })]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={status} onChange={e => setStatus(e.target.value as any)} aria-label="Status">
          <option value="open">Open (active and monitoring)</option>
          {HAZARD_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          <option value="all">All</option>
        </select>
        <select className="h-9 rounded-md border bg-background px-2 text-sm" value={category} onChange={e => setCategory(e.target.value)} aria-label="Kind">
          <option value="all">Every kind</option>
          {HAZARD_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {canReport && !adding && <Button className="ml-auto bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => { setAdding(true); setJustAdded(null); }}><Plus className="h-4 w-4 mr-1" />Report a hazard</Button>}
      </div>

      {justAdded && (
        <Card className="p-3 flex flex-wrap items-center gap-2 bg-green-50 dark:bg-green-950/30">
          <span className="text-sm">Hazard added to the register.</span>
          {canManage && <Button asChild size="sm" variant="outline"><Link href={`/app/farm-map?hazard=${justAdded}&place=1`}><MapPin className="h-4 w-4 mr-1" />Place it on the map</Link></Button>}
          <Button size="sm" variant="ghost" onClick={() => setJustAdded(null)}><X className="h-4 w-4" /></Button>
        </Card>
      )}
      {adding && <NewHazard onCancel={() => setAdding(false)} onSaved={async id => { setAdding(false); setJustAdded(id); await refresh(); }} />}

      {shown.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">{hazards.length === 0 ? 'No hazards recorded yet.' : 'No hazards match.'}</Card>
      ) : shown.map(h => <HazardCard key={h.id} hazard={h} canManage={canManage} onChanged={refresh} />)}
    </div>
  );
}

function NewHazard({ onSaved, onCancel }: { onSaved: (id: string) => void; onCancel: () => void }) {
  const [v, setV] = useState<HazardInput>({ title: '', type: 'terrain', riskLevel: 3, controls: '', reviewDue: null, location: '' });
  const [saving, setSaving] = useState(false);
  return (
    <Card className="p-4">
      <form className="space-y-3 max-w-xl" onSubmit={async e => {
        e.preventDefault();
        if (!v.title.trim()) return toast.error('Say what the hazard is');
        setSaving(true);
        try {
          const { id } = await safety.createHazard({ ...v, title: v.title.trim() });
          onSaved(id);
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setSaving(false);
        }
      }}>
        <h2 className="font-semibold">Report a hazard</h2>
        <HazardFields v={v} set={p => setV(x => ({ ...x, ...p }))} />
        <p className="text-xs text-muted-foreground">You can draw it on the farm map afterwards, or straight away with <strong>Hazard</strong> on the map's toolbar.</p>
        <div className="flex gap-2">
          <Button type="submit" className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving…' : 'Add to register'}</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

function HazardCard({ hazard: h, canManage, onChanged }: { hazard: Hazard; canManage: boolean; onChanged: () => Promise<unknown> }) {
  const overdue = h.status !== 'resolved' && h.reviewDue && h.reviewDue < today();
  const act = async (work: () => Promise<unknown>, done: string) => {
    try { await work(); await onChanged(); toast.success(done); } catch (err: any) { toast.error(err.message); }
  };
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[220px] space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: riskColour(h.riskLevel) }} />
            <h3 className="font-semibold">{h.title}</h3>
            <Badge variant="outline">{riskText(h.riskLevel)}</Badge>
            {h.status === 'monitoring' && <Badge variant="secondary">Controlled, monitoring</Badge>}
            {h.status === 'resolved' && <Badge variant="outline">Resolved</Badge>}
            {overdue && <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Review overdue</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{hazardCategoryLabel(h.type)}{h.location ? ` · ${h.location}` : ''}</p>
          {h.controls && <p className="text-sm"><span className="font-medium">Controls:</span> {h.controls}</p>}
          {h.description && <p className="text-sm text-muted-foreground">{h.description}</p>}
          <p className="text-xs text-muted-foreground">
            Reported {new Date(h.createdAt).toLocaleDateString()}{h.reportedByName ? ` by ${h.reportedByName}` : ''}
            {h.reviewDue ? ` · review by ${new Date(h.reviewDue).toLocaleDateString()}` : ''}
            {h.photos?.length ? ` · ${h.photos.length} photo${h.photos.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {h.status !== 'resolved' && (h.geometry
            ? <Button asChild size="sm" variant="outline"><Link href={`/app/farm-map?hazard=${h.id}`}><MapPin className="h-4 w-4 mr-1" />Show on map</Link></Button>
            : canManage && <Button asChild size="sm" variant="outline"><Link href={`/app/farm-map?hazard=${h.id}&place=1`}><MapPin className="h-4 w-4 mr-1" />Place on map</Link></Button>)}
          {canManage && h.status === 'active' && <Button size="sm" variant="outline" onClick={() => act(() => safety.updateHazard(h.id, { status: 'monitoring' }), 'Marked controlled')}>Controlled</Button>}
          {canManage && h.status !== 'resolved' && <Button size="sm" variant="outline" onClick={() => window.confirm(`Mark "${h.title}" resolved?`) && act(() => safety.resolveHazard(h.id), 'Hazard resolved')}>Resolved</Button>}
          {canManage && h.status === 'resolved' && <Button size="sm" variant="ghost" onClick={() => act(() => safety.updateHazard(h.id, { status: 'active' }), 'Hazard reopened')}>Reopen</Button>}
        </div>
      </div>
    </Card>
  );
}

// ===== Incidents =====

function Incidents({ incidents, canManage, canReport }: { incidents: Incident[]; canManage: boolean; canReport: boolean }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['/api/compliance/incidents'] });
  const setStatus = async (id: string, status: string) => {
    try { await send('PATCH', `/api/compliance/incidents/${id}/status`, { status }); await refresh(); } catch (err: any) { toast.error(err.message); }
  };
  return (
    <div className="space-y-4">
      <Card className="p-3 text-sm bg-amber-50 dark:bg-amber-950/30">
        A death, a notifiable injury or illness, or a notifiable incident must be reported to WorkSafe as soon as possible
        (0800 030 040 or worksafe.govt.nz), and the scene left undisturbed unless that's needed to keep people safe.
      </Card>
      {canReport && !adding && <Button className="bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Report an incident</Button>}
      {adding && <NewIncident onCancel={() => setAdding(false)} onSaved={async () => { setAdding(false); await refresh(); }} />}
      {incidents.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No incidents recorded.</Card>
      ) : incidents.map(i => (
        <Card key={i.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-[220px] space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{INCIDENT_TYPES.find(t => t.key === i.type)?.label ?? i.type.replace(/_/g, ' ')}</h3>
                <Badge variant={i.severity === 'critical' || i.severity === 'major' ? 'destructive' : 'outline'}>{i.severity}</Badge>
                <Badge variant={i.status === 'open' ? 'default' : 'outline'}>{INCIDENT_STATUS_LABEL[i.status] ?? i.status}</Badge>
              </div>
              <p className="text-sm">{i.description}</p>
              <p className="text-xs text-muted-foreground">{new Date(i.occurredAt).toLocaleString()}{i.location ? ` · ${i.location}` : ''}</p>
            </div>
            {canManage && (i.status === 'open' || i.status === 'investigating') && (
              <div className="flex gap-2">
                {i.status === 'open' && <Button size="sm" variant="outline" onClick={() => setStatus(i.id, 'investigating')}>Investigating</Button>}
                <Button size="sm" variant="outline" onClick={() => setStatus(i.id, 'resolved')}>Resolved</Button>
                <Button size="sm" variant="ghost" onClick={() => setStatus(i.id, 'closed')}>Close</Button>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

function NewIncident({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [type, setType] = useState('near_miss');
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>('minor');
  const [when, setWhen] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
  const [saving, setSaving] = useState(false);
  return (
    <Card className="p-4">
      <form className="space-y-3 max-w-xl" onSubmit={async e => {
        e.preventDefault();
        if (!description.trim()) return toast.error('Say what happened');
        setSaving(true);
        try {
          await send('POST', '/api/compliance/incidents', { type, severity, occurredAt: new Date(when).toISOString(), location: location || undefined, description: description.trim(), ...(here ?? {}) });
          toast.success('Incident recorded');
          onSaved();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setSaving(false);
        }
      }}>
        <h2 className="font-semibold">Report an incident</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1"><Label htmlFor="in-type">What kind</Label>
            <select id="in-type" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={type} onChange={e => setType(e.target.value)}>
              {INCIDENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select></div>
          <div className="space-y-1"><Label htmlFor="in-sev">How serious</Label>
            <select id="in-sev" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={severity} onChange={e => setSeverity(e.target.value as any)}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
            </select></div>
          <div className="space-y-1"><Label htmlFor="in-when">When</Label><Input id="in-when" type="datetime-local" value={when} max={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setWhen(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="in-where">Where</Label><Input id="in-where" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Cowshed yard" /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="in-what">What happened</Label><Textarea id="in-what" rows={4} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="flex items-center gap-2 text-sm">
          <Button type="button" size="sm" variant="outline" onClick={() => navigator.geolocation?.getCurrentPosition(
            p => { setHere({ latitude: p.coords.latitude, longitude: p.coords.longitude }); toast.success('Location added'); },
            () => toast.error("Couldn't get this device's location"))}><MapPin className="h-4 w-4 mr-1" />Use where I am</Button>
          {here && <span className="text-muted-foreground">{here.latitude.toFixed(5)}, {here.longitude.toFixed(5)}</span>}
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving…' : 'Record incident'}</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}

// ===== Documents =====

function Documents({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const { data: docs = [] } = useQuery({ queryKey: [...DOCUMENTS_KEY, showArchived], queryFn: () => safety.documents(showArchived) });
  const [adding, setAdding] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY });
  const grouped = useMemo(() => SAFETY_DOCUMENT_TYPES.map(t => ({ type: t, docs: docs.filter(d => d.docType === t.key) })).filter(g => g.docs.length), [docs]);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const act = async (work: () => Promise<unknown>, done: string) => {
    try { await work(); await refresh(); toast.success(done); } catch (err: any) { toast.error(err.message); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />Show archived</label>
        {canManage && !adding && <Button className="ml-auto bg-pulse-forest hover:bg-pulse-forest-dark" onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Add a document</Button>}
      </div>
      {adding && <NewDocument onCancel={() => setAdding(false)} onSaved={async () => { setAdding(false); await refresh(); }} />}
      {docs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          No safety documents yet. Add the farm's health and safety plan, emergency procedures, chemical register and the like, with a review date for each.
        </Card>
      ) : grouped.map(g => (
        <section key={g.type.key} className="space-y-2">
          <h2 className="text-sm font-semibold">{g.type.label}</h2>
          {g.docs.map(d => {
            const overdue = !d.archivedAt && d.reviewDue && d.reviewDue < today();
            return (
              <Card key={d.id} className="p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex-1 min-w-[200px] space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d.title}</span>
                      {overdue && <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Review overdue</Badge>}
                      {d.archivedAt && <Badge variant="outline">Archived</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {d.reviewDue ? `Review by ${new Date(d.reviewDue).toLocaleDateString()}` : 'No review date'} · added {new Date(d.createdAt).toLocaleDateString()}{d.createdByName ? ` by ${d.createdByName}` : ''}
                    </p>
                    {d.notes && <p className="text-sm text-muted-foreground">{d.notes}</p>}
                    {d.files.length > 0 ? (
                      <ul className="text-sm">
                        {d.files.map(f => <li key={f.id}><a className="underline inline-flex items-center gap-1" href={f.url} target="_blank" rel="noreferrer"><Paperclip className="h-3.5 w-3.5" />{f.fileName ?? 'File'}</a></li>)}
                      </ul>
                    ) : <p className="text-xs text-amber-800">No file attached</p>}
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => fileRefs.current[d.id]?.click()}><Paperclip className="h-4 w-4 mr-1" />Add file</Button>
                      <input ref={el => { fileRefs.current[d.id] = el; }} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        if (files.length) act(() => safety.addDocumentFiles(d.id, files), 'File added');
                      }} />
                      {!d.archivedAt
                        ? <Button size="sm" variant="ghost" onClick={() => window.confirm(`Archive "${d.title}"?`) && act(() => safety.updateDocument(d.id, { archived: true }), 'Archived')}><Archive className="h-4 w-4 mr-1" />Archive</Button>
                        : <Button size="sm" variant="ghost" onClick={() => act(() => safety.updateDocument(d.id, { archived: false }), 'Restored')}>Restore</Button>}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function NewDocument({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<string>(SAFETY_DOCUMENT_TYPES[0].key);
  const [reviewDue, setReviewDue] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  return (
    <Card className="p-4">
      <form className="space-y-3 max-w-xl" onSubmit={async e => {
        e.preventDefault();
        if (!title.trim()) return toast.error('Give the document a name');
        setSaving(true);
        try {
          await safety.createDocument({ title: title.trim(), docType, reviewDue: reviewDue || null, notes: notes || null }, files);
          toast.success('Document added');
          onSaved();
        } catch (err: any) {
          toast.error(err.message);
        } finally {
          setSaving(false);
        }
      }}>
        <h2 className="font-semibold">Add a safety document</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2"><Label htmlFor="doc-title">Name</Label><Input id="doc-title" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Farm health and safety plan 2026" /></div>
          <div className="space-y-1"><Label htmlFor="doc-type">Kind</Label>
            <select id="doc-type" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={docType} onChange={e => setDocType(e.target.value)}>
              {SAFETY_DOCUMENT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select></div>
          <div className="space-y-1"><Label htmlFor="doc-review">Review by</Label><Input id="doc-review" type="date" value={reviewDue} onChange={e => setReviewDue(e.target.value)} /></div>
        </div>
        <div className="space-y-1"><Label htmlFor="doc-notes">Notes</Label><Textarea id="doc-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        <div className="space-y-1">
          <Label htmlFor="doc-files">File (PDF or photo)</Label>
          <Input id="doc-files" type="file" accept="application/pdf,image/*" multiple onChange={e => setFiles(Array.from(e.target.files ?? []))} />
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="bg-pulse-forest hover:bg-pulse-forest-dark" disabled={saving}><Save className="h-4 w-4 mr-1" />{saving ? 'Saving…' : 'Add document'}</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </div>
      </form>
    </Card>
  );
}
