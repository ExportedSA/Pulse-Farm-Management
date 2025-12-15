import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { postOrQueue } from "@/lib/net";
export default function PregQuick(){
  const [id,setId] = useState(''); const [result,setResult] = useState<'preg'|'empty'|'recheck'>('preg'); const [due,setDue] = useState(''); const [foetal,setFoetal] = useState<number|''>(''); const [notes,setNotes] = useState('');
  async function save(){
    const animal_id = Number(id); if (!animal_id) return alert('Enter animal ID');
    const body:any = { animal_id, result, notes, ts: new Date().toISOString() }; if (due) body.due_date = due; if (foetal !== '') body.foetal_age_days = Number(foetal);
    await postOrQueue('/api/repro/preg-test', body, (b)=> ({ table:'repro_preg_tests', action:'insert', data:b }));
    setId(''); setDue(''); setFoetal(''); setNotes(''); alert(navigator.onLine ? 'Saved' : 'Saved locally — will sync when online');
  }
  return (<PageShell title="Reproduction · Quick Preg-Test">
    <div className="grid gap-3 max-w-md">
      <div className="rounded-2xl border border-border p-3 grid gap-2 text-sm">
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Animal ID" value={id} onChange={e=> setId(e.target.value)} />
        <select className="h-9 rounded-xl border border-border bg-card px-3" value={result} onChange={e=> setResult(e.target.value as any)}>
          <option value="preg">Pregnant</option><option value="empty">Empty</option><option value="recheck">Recheck</option>
        </select>
        <label className="text-xs">Due date (optional)<input type="date" className="h-9 rounded-xl border border-border bg-card px-3 w-full mt-1" value={due} onChange={e=> setDue(e.target.value)} /></label>
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Foetal age (days, optional)" value={foetal} onChange={e=> setFoetal(e.target.value as any)} />
        <textarea className="rounded-xl border border-border bg-card p-2" placeholder="Notes" value={notes} onChange={e=> setNotes(e.target.value)} />
        <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={save}>Save</button>
      </div>
    </div>
  </PageShell>);
}
