import { useEffect, useState } from "react";
export default function WithholdsPanel({ date }: { date?: string }){
  const [d, setD] = useState(()=> date || new Date().toISOString().slice(0,10));
  const [data, setData] = useState<{milk:number[], meat:number[], both:number[], date:string}|null>(null);
  async function load(){ const r = await fetch(`/api/med/withhold/ids?date=${d}`).then(r=> r.json()); setData(r); }
  useEffect(()=>{ load(); }, [d]);
  const milk = data?.milk?.length || 0, meat = data?.meat?.length || 0, both = data?.both?.length || 0;
  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-medium">Withholds (herd)</div>
        <input type="date" className="h-8 rounded-xl border border-border bg-card px-3 text-sm" value={d} onChange={e=> setD(e.target.value)} />
      </div>
      <div className="grid md:grid-cols-3 gap-2 mt-2">
        <div className="rounded-xl border border-border bg-card p-3"><div className="text-xs text-fg/60">Milk</div><div className="text-2xl">{milk}</div></div>
        <div className="rounded-xl border border-border bg-card p-3"><div className="text-xs text-fg/60">Meat</div><div className="text-2xl">{meat}</div></div>
        <div className="rounded-xl border border-border bg-card p-3"><div className="text-xs text-fg/60">Both</div><div className="text-2xl">{both}</div></div>
      </div>
      <div className="mt-3 text-sm"><a className="underline" href={`/health/reports?date=${encodeURIComponent(d)}`}>Open Reports</a></div>
    </div>
  );
}
