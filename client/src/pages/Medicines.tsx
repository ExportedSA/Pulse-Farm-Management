import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
export default function Medicines(){
  const [rows,setRows] = useState<any[]>([]); const [file,setFile] = useState<File|null>(null);
  const [edit,setEdit] = useState<any>({ name:'', actives:'', route:'', milk_withhold_hours:'', meat_withhold_days:'' });
  async function load(){ const r = await fetch('/api/med/medicine').then(r=> r.json()); setRows(r.rows||[]); } useEffect(()=>{ load(); }, []);
  async function save(){ await fetch('/api/med/medicine', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(edit) }); setEdit({ name:'', actives:'', route:'', milk_withhold_hours:'', meat_withhold_days:'' }); load(); }
  async function importCSV(){ if (!file) return; const fd = new FormData(); fd.append('file', file); await fetch('/api/med/medicine.csv', { method:'POST', body: fd }); setFile(null); load(); }
  return (<PageShell title="Health · Medicines">
    <div className="grid md:grid-cols-2 gap-3">
      <div className="rounded-2xl border border-border p-3 grid gap-2 text-sm">
        <div className="font-medium">Add / Update</div>
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Name" value={edit.name} onChange={e=> setEdit({...edit, name:e.target.value})} />
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Actives" value={edit.actives} onChange={e=> setEdit({...edit, actives:e.target.value})} />
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Route" value={edit.route} onChange={e=> setEdit({...edit, route:e.target.value})} />
        <div className="grid grid-cols-2 gap-2">
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Milk withhold hours" value={edit.milk_withhold_hours} onChange={e=> setEdit({...edit, milk_withhold_hours:e.target.value})} />
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Meat withhold days" value={edit.meat_withhold_days} onChange={e=> setEdit({...edit, meat_withhold_days:e.target.value})} />
        </div>
        <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={save}>Save</button>
      </div>
      <div className="rounded-2xl border border-border p-3">
        <div className="text-sm font-medium mb-2">Import CSV</div>
        <input type="file" accept=".csv" onChange={e=> setFile(e.target.files?.[0]||null)} />
        <button className="h-9 rounded-xl border border-border bg-card px-3 ml-2" onClick={importCSV}>Upload</button>
        <div className="text-xs text-fg/60 mt-2">Header: <code>Name,Actives,Route,MilkWithholdHours,MeatWithholdDays</code></div>
      </div>
      <div className="rounded-2xl border border-border p-3 md:col-span-2 overflow-auto">
        <table className="min-w-full text-sm"><thead className="text-left text-fg/70 border-b border-border">
          <tr><th className="py-2 px-3">Name</th><th className="py-2 px-3">Actives</th><th className="py-2 px-3">Route</th><th className="py-2 px-3">Milk h</th><th className="py-2 px-3">Meat d</th></tr></thead>
          <tbody>{rows.map((r:any)=> (<tr key={r.id} className="border-b border-border/60">
            <td className="py-2 px-3">{r.name}</td><td className="py-2 px-3">{r.actives||'—'}</td><td className="py-2 px-3">{r.route||'—'}</td><td className="py-2 px-3">{r.milk_withhold_hours??'—'}</td><td className="py-2 px-3">{r.meat_withhold_days??'—'}</td>
          </tr>))}
          {!rows.length && <tr><td className="py-3 text-fg/60" colSpan={5}>No medicines yet.</td></tr>}
          </tbody></table>
      </div>
    </div>
  </PageShell>);
}
