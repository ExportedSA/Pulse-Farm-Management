import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
function todayPlus(n:number){ const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
export default function RunSheet(){
  const [date,setDate] = useState(todayPlus(1)); const [source,setSource] = useState<'heats'|'planned'>('heats'); const [rows,setRows] = useState<any[]>([]);
  async function load(){ const r = await fetch(`/api/repro/runsheet?date=${date}&source=${source}`).then(r=> r.json()); setRows(r.rows||[]); }
  useEffect(()=>{ load(); }, [date, source]);
  return (<PageShell title="Reproduction · AB Run‑Sheet">
    <div className="rounded-2xl border border-border p-3 no-print">
      <div className="grid md:grid-cols-4 gap-2">
        <input type="date" className="h-9 rounded-xl border border-border bg-card px-3" value={date} onChange={e=> setDate(e.target.value)} />
        <select className="h-9 rounded-xl border border-border bg-card px-3" value={source} onChange={e=> setSource(e.target.value as any)}>
          <option value="heats">From heats (yesterday)</option><option value="planned">From planned jobs</option>
        </select>
        <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={load}>Refresh</button>
        <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={()=> window.print()}>Print</button>
      </div>
    </div>
    <div className="rounded-2xl border border-border p-0 overflow-auto mt-3">
      <table className="min-w-full text-sm print:w-full">
        <thead className="text-left border-b border-border print:border-black"><tr>
          <th className="py-2 px-3">Animal</th><th className="py-2 px-3">VID / EID</th>
          <th className="py-2 px-3">Planned Bull</th><th className="py-2 px-3">Technician</th><th className="py-2 px-3">Batch</th><th className="py-2 px-3">Notes</th><th className="py-2 px-3">✓</th>
        </tr></thead>
        <tbody>
          {rows.map((r:any, i:number)=> (<tr key={i} className="border-b border-border print:border-black">
            <td className="py-2 px-3 font-medium">#{r.animal_id}</td>
            <td className="py-2 px-3">{r.vid || r.eid || '—'}</td>
            <td className="py-2 px-3">{r.bull_code || ''}</td>
            <td className="py-2 px-3">{r.technician || ''}</td>
            <td className="py-2 px-3">{r.batch || ''}</td>
            <td className="py-2 px-3">{r.notes || ''}</td>
            <td className="py-2 px-3"></td>
          </tr>))}
          {!rows.length && <tr><td className="py-6 px-3 text-fg/60" colSpan={7}>No rows.</td></tr>}
        </tbody>
      </table>
    </div>
    <style>{`@media print { .no-print { display:none } table { font-size:12px } }`}</style>
  </PageShell>);
}
