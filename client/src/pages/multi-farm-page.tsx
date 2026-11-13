import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Check, Plus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFarm } from '@/lib/farm-context';
import { InviteStaff } from '@/components/invite-staff';

// The farms this person belongs to: switch between them, add a farm, and (for owners and
// managers) see and add the people on each. Every farm's data is kept to that farm.

interface Member { userId: string; name: string; email: string | null; role: string; isActive: boolean }

const ROLE_LABEL: Record<string, string> = { owner: 'Owner', manager: 'Manager', worker: 'Worker', viewer: 'Viewer', contractor: 'Contractor' };

export default function MultiFarmPage() {
  const { farms, currentFarm, switchFarm, addFarm } = useFarm();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [openMembers, setOpenMembers] = useState<string | null>(null);

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg"><Building2 className="h-6 w-6 text-indigo-600" /></div>
          <div>
            <h1 className="text-2xl font-bold">Your farms</h1>
            <p className="text-sm text-muted-foreground">Each farm's animals, paddocks, records and people are kept to that farm</p>
          </div>
        </div>
        {!adding && <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4 mr-1" />Add a farm</Button>}
      </div>

      {adding && (
        <Card>
          <CardContent className="pt-6">
            <form className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 items-end" onSubmit={e => {
              e.preventDefault();
              if (!name.trim()) return toast.error('Give the farm a name');
              addFarm({ name: name.trim(), location: location.trim() || undefined });
              toast.success(`${name.trim()} added. Switch to it to set it up.`);
              setAdding(false); setName(''); setLocation('');
            }}>
              <div className="space-y-1"><Label htmlFor="nf-name">Farm name</Label><Input id="nf-name" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
              <div className="space-y-1"><Label htmlFor="nf-loc">District or area</Label><Input id="nf-loc" value={location} onChange={e => setLocation(e.target.value)} /></div>
              <div className="flex gap-2"><Button type="submit">Add</Button><Button type="button" variant="outline" onClick={() => setAdding(false)}>Cancel</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      {farms.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">You're not on any farm yet. Add one, or ask a farm's owner to add you.</Card>
      ) : farms.map(f => {
        const isCurrent = f.id === currentFarm?.id;
        const manages = f.role === 'owner' || f.role === 'manager';
        return (
          <Card key={f.id} className={isCurrent ? 'border-pulse-forest' : undefined}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">{f.name}{isCurrent && <Badge className="bg-pulse-forest">Working in</Badge>}</CardTitle>
                <CardDescription>{[f.location, ROLE_LABEL[f.role ?? ''] ?? f.role].filter(Boolean).join(' · ')}</CardDescription>
              </div>
              <div className="flex gap-2">
                {manages && <Button size="sm" variant="outline" onClick={() => setOpenMembers(openMembers === f.id ? null : f.id)}><Users className="h-4 w-4 mr-1" />People</Button>}
                {!isCurrent && (
                  <Button size="sm" onClick={async () => {
                    try { await switchFarm(f.id); toast.success(`Now working in ${f.name}`); } catch (err: any) { toast.error(err.message ?? "Couldn't switch farm"); }
                  }}><Check className="h-4 w-4 mr-1" />Switch to this farm</Button>
                )}
              </div>
            </CardHeader>
            {openMembers === f.id && <CardContent><FarmMembers farmId={f.id} isOwner={f.role === 'owner'} /></CardContent>}
          </Card>
        );
      })}
    </div>
  );
}

function FarmMembers({ farmId, isOwner }: { farmId: string; isOwner: boolean }) {
  const queryClient = useQueryClient();
  const key = ['/api/farms', farmId, 'members'];
  const { data: members = [], isLoading } = useQuery<Member[]>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetch(`/api/farms/${farmId}/members`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't load people");
      return body.data;
    },
  });
  const call = async (method: string, url: string, body?: unknown) => {
    const res = await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error ?? 'Request failed');
    await queryClient.invalidateQueries({ queryKey: key });
  };
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="space-y-3">
      <ul className="divide-y rounded-md border text-sm">
        {members.filter(m => m.isActive).map(m => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <span>{m.name}{m.email ? <span className="text-muted-foreground"> · {m.email}</span> : null}</span>
            <span className="flex items-center gap-2">
              <Badge variant="outline">{ROLE_LABEL[m.role] ?? m.role}</Badge>
              {(m.role !== 'owner' || isOwner) && (
                <Button size="sm" variant="ghost" className="text-red-700" onClick={() => window.confirm(`Take ${m.name} off this farm?`) && call('DELETE', `/api/farms/${farmId}/members/${m.userId}`).then(() => toast.success('Removed'), e => toast.error(e.message))}>Remove</Button>
              )}
            </span>
          </li>
        ))}
      </ul>
      <InviteStaff farmId={farmId} isOwner={isOwner} />
    </div>
  );
}
