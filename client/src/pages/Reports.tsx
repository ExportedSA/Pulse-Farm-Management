import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
export default function HealthReports(){
  const [from,setFrom] = useState(()=> new Date(Date.now()-30*86400000).toISOString().slice(0,10));
  const [to,setTo] = useState(()=> new Date().toISOString().slice(0,10));
  const [rvm,setRvm] = useState<any[]>([]);
  const [whDate,setWhDate] = useState(()=> new Date().toISOString().slice(0,10));
  const [wh,setWh] = useState<any[]>([]);
  async function loadRVM(){ const r = await fetch(`/api/med/reports/rvm?from=${from}&to=${to}`).then(r=> r.json()); setRvm(r.rows||[]); }
  async function loadWH(){ const r = await fetch(`/api/med/reports/withholds?date=${whDate}`).then(r=> r.json()); setWh(r.rows||[]); }
  useEffect(()=>{ loadRVM(); }, [from,to]); useEffect(()=>{ loadWH(); }, [whDate]);
  return (<PageShell title="Health · Reports">
    <div className="grid gap-3">
      <div className="rounded-2xl border border-border p-3">
        <div className="text-sm font-medium mb-2">RVM Log</div>
        <div className="grid md:grid-cols-3 gap-2 mb-2">
          <input type="date" className="h-9 rounded-xl border border-border bg-card px-3" value={from} onChange={e=> setFrom(e.target.value)} />
          <input type="date" className="h-9 rounded-xl border border-border bg-card px-3" value={to} onChange={e=> setTo(e.target.value)} />
          <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={loadRVM}>Refresh</button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm"><thead className="text-left text-fg/70 border-b border-border">
            <tr><th className="py-2 px-3">When</th><th className="py-2 px-3">Animal</th><th className="py-2 px-3">Medicine</th><th className="py-2 px-3">Dose</th><th className="py-2 px-3">Route</th><th className="py-2 px-3">Site</th><th className="py-2 px-3">Vet/Ref</th></tr>
          </thead><tbody>
            {rvm.map((r:any,i:number)=> (<tr key={i} className="border-b border-border/60">
              <td className="py-2 px-3">{new Date(r.ts).toLocaleString()}</td>
              <td className="py-2 px-3">#{r.animal_id}</td>
              <td className="py-2 px-3">{r.medicine}</td>
              <td className="py-2 px-3">{r.dose||'—'}</td>
              <td className="py-2 px-3">{r.route||'—'}</td>
              <td className="py-2 px-3">{r.site||'—'}</td>
              <td className="py-2 px-3">{r.approver||'—'} {r.approval_ref? `(${r.approval_ref})`: ''}</td>
            </tr>))}
            {!rvm.length && <tr><td className="py-3 text-fg/60" colSpan={7}>No entries.</td></tr>}
          </tbody></table>
        </div>
      </div>
      <div className="rounded-2xl border border-border p-3">
        <div className="text-sm font-medium mb-2">Active Withholds</div>
        <div className="grid md:grid-cols-3 gap-2 mb-2">
          <input type="date" className="h-9 rounded-xl border border-border bg-card px-3" value={whDate} onChange={e=> setWhDate(e.target.value)} />
          <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={loadWH}>Refresh</button>
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm"><thead className="text-left text-fg/70 border-b border-border">
            <tr><th className="py-2 px-3">Animal</th><th className="py-2 px-3">Milk until</th><th className="py-2 px-3">Meat until</th></tr>
          </thead><tbody>
            {wh.map((r:any,i:number)=> (<tr key={i} className="border-b border-border/60">
              <td className="py-2 px-3">#{r.animal_id}</td>
              <td className="py-2 px-3">{r.milk_until? new Date(r.milk_until).toLocaleString(): '—'}</td>
              <td className="py-2 px-3">{r.meat_until|| '—'}</td>
            </tr>))}
            {!wh.length && <tr><td className="py-3 text-fg/60" colSpan={3}>None</td></tr>}
          </tbody></table>
        </div>
      </div>
    </div>
  </PageShell>);
}
