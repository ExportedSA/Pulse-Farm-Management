import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
export default function Treat(){
  const [ids,setIds] = useState(''); const [medId,setMedId] = useState(''); const [dose,setDose] = useState(''); const [route,setRoute] = useState(''); const [site,setSite] = useState(''); const [milkH,setMilkH] = useState<number|''>(''); const [meatD,setMeatD] = useState<number|''>(''); const [notes,setNotes] = useState('');
  async function submit(){
    const list = ids.split(/[^0-9]+/).map(s=> Number(s)).filter(Boolean);
    for (const id of list){
      const body:any = { animal_id:id, medicine_id: Number(medId), dose, route, site, notes };
      if (milkH !== '') body.withhold_milk_hours = Number(milkH); if (meatD !== '') body.withhold_meat_days = Number(meatD);
      const r = await fetch('/api/med/treatment', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!r.ok){ alert('Error'); return; }
    }
    setIds(''); setDose(''); setNotes(''); setMilkH(''); setMeatD(''); alert('Saved');
  }
  return (<PageShell title="Health · Record Treatment">
    <div className="grid gap-3 max-w-2xl">
      <div className="rounded-2xl border border-border p-3 grid gap-2 text-sm">
        <textarea className="rounded-xl border border-border bg-card p-2" placeholder="Animal IDs (comma/space/newline)" value={ids} onChange={e=> setIds(e.target.value)} />
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Medicine ID" value={medId} onChange={e=> setMedId(e.target.value)} />
        <div className="grid md:grid-cols-2 gap-2">
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Dose" value={dose} onChange={e=> setDose(e.target.value)} />
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Route (e.g., inj, pour-on)" value={route} onChange={e=> setRoute(e.target.value)} />
        </div>
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Site (e.g., LF/neck)" value={site} onChange={e=> setSite(e.target.value)} />
        <div className="grid md:grid-cols-2 gap-2">
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Milk withhold hours (optional)" value={milkH} onChange={e=> setMilkH(e.target.value as any)} />
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Meat withhold days (optional)" value={meatD} onChange={e=> setMeatD(e.target.value as any)} />
        </div>
        <textarea className="rounded-xl border border-border bg-card p-2" placeholder="Notes" value={notes} onChange={e=> setNotes(e.target.value)} />
        <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={submit}>Save</button>
      </div>
    </div>
  </PageShell>);
}
