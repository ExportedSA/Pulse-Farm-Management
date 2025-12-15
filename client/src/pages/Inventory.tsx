import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
export default function Inventory(){
  const [medId,setMedId] = useState(''); const [batch,setBatch] = useState(''); const [expiry,setExpiry] = useState(''); const [qty,setQty] = useState(''); const [msg,setMsg] = useState('');
  async function save(){ const body = { medicine_id:Number(medId), batch, expiry, quantity:Number(qty||0) }; const r = await fetch('/api/med/inventory', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) }); setMsg(r.ok? 'Saved' : 'Error'); }
  return (<PageShell title="Health · Inventory">
    <div className="grid gap-3 max-w-md">
      <div className="rounded-2xl border border-border p-3 grid gap-2 text-sm">
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Medicine ID" value={medId} onChange={e=> setMedId(e.target.value)} />
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Batch (optional)" value={batch} onChange={e=> setBatch(e.target.value)} />
        <input type="date" className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Expiry" value={expiry} onChange={e=> setExpiry(e.target.value)} />
        <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Quantity" value={qty} onChange={e=> setQty(e.target.value)} />
        <button className="h-9 rounded-xl border border-border bg-card px-3" onClick={save}>Save</button>
        {!!msg && <div className="text-xs text-fg/60">{msg}</div>}
      </div>
    </div>
  </PageShell>);
}
