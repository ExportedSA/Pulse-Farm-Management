import { useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
type Farm = { name:string, region:string, herds:number, rotation:string };
type ImportPreview = { headers:string[], rows:string[][] };
export default function OnboardingWizard(){
  const [step,setStep] = useState(1);
  const [farm,setFarm] = useState<Farm>({ name:'', region:'', herds:1, rotation:'Spring' });
  const [file,setFile] = useState<File|null>(null);
  const [preview,setPreview] = useState<ImportPreview|null>(null);
  async function next(){ setStep(s=> Math.min(4, s+1)); }
  async function back(){ setStep(s=> Math.max(1, s-1)); }
  async function readCSV(f:File){ const text = await f.text(); const lines = text.split(/\r?\n/).filter(x=> x.trim().length>0); const headers = (lines.shift()||'').split(',').map(s=> s.trim()); const rows = lines.slice(0,20).map(l=> l.split(',').map(s=> s.trim())); setPreview({ headers, rows }); }
  async function saveFarm(){ await fetch('/api/farm/setup', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(farm) }).catch(()=>{}); next(); }
  async function importHerd(){ if (!file) return; const fd = new FormData(); fd.append('file', file); await fetch('/api/animals/import.csv', { method:'POST', body: fd }).catch(()=>{}); next(); }
  return (<PageShell title="Welcome · Setup Wizard">
    <div className="rounded-2xl border border-border p-4 max-w-3xl"><div className="text-sm text-fg/60 mb-2">Step {step} / 4</div>
      {step===1 && (<div className="grid gap-3"><div className="text-lg font-medium">Farm Basics</div>
        <div className="grid md:grid-cols-2 gap-2">
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Farm name" value={farm.name} onChange={e=> setFarm({...farm, name:e.target.value})} />
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Region" value={farm.region} onChange={e=> setFarm({...farm, region:e.target.value})} />
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <input className="h-9 rounded-xl border border-border bg-card px-3" placeholder="Herds count" value={farm.herds} onChange={e=> setFarm({...farm, herds: Number(e.target.value||1)})} />
          <select className="h-9 rounded-xl border border-border bg-card px-3" value={farm.rotation} onChange={e=> setFarm({...farm, rotation:e.target.value})}><option>Spring</option><option>All-grass</option><option>TMR</option></select>
        </div>
        <div className="flex gap-2"><button className="h-9 px-3 rounded-xl border border-border" onClick={saveFarm}>Continue</button></div>
      </div>)}
      {step===2 && (<div className="grid gap-3"><div className="text-lg font-medium">Import Herd (CSV)</div>
        <input type="file" accept=".csv" onChange={e=> { const f = e.target.files?.[0]||null; setFile(f); if (f) readCSV(f);} } />
        {preview && (<div className="rounded-xl border border-border overflow-auto"><table className="min-w-full text-sm"><thead><tr>{preview.headers.map((h,i)=> <th key={i} className="py-2 px-3 text-left">{h}</th>)}</tr></thead><tbody>{preview.rows.map((r,i)=> <tr key={i}>{r.map((c,j)=> <td key={j} className="py-1 px-3 border-t border-border/50">{c}</td>)}</tr>)}</tbody></table></div>)}
        <div className="flex gap-2"><button className="h-9 px-3 rounded-xl border border-border" onClick={back}>Back</button><button className="h-9 px-3 rounded-xl border border-border" onClick={importHerd}>Import</button></div>
      </div>)}
      {step===3 && (<div className="grid gap-3"><div className="text-lg font-medium">Feed Baselines</div><div className="text-sm text-fg/60">Set monthly growth targets and default covers (you can adjust later).</div>
        <div className="grid md:grid-cols-3 gap-2">{['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'].map((m)=>(<label key={m} className="text-xs">{m}
          <input className="mt-1 h-9 w-full rounded-xl border border-border bg-card px-3" placeholder="kgDM/ha" />
        </label>))}</div>
        <div className="flex gap-2"><button className="h-9 px-3 rounded-xl border border-border" onClick={back}>Back</button><button className="h-9 px-3 rounded-xl border border-border" onClick={next}>Continue</button></div>
      </div>)}
      {step===4 && (<div className="grid gap-3"><div className="text-lg font-medium">All set 🎉</div><div className="text-sm text-fg/60">You can now manage your herd, plan grazing, record treatments and more.</div><a className="h-9 px-3 inline-flex items-center rounded-xl border border-border w-fit" href="/">Start Managing</a></div>)}
    </div>
  </PageShell>);
}
