import { useEffect, useRef, useState } from "react";
type Item = { kind:'animal'|'paddock', id:number|string, label:string, href:string };
async function fetchAll(q:string): Promise<Item[]>{ if (!q || q.trim().length < 2) return []; const qs = encodeURIComponent(q.trim());
  const [animals, paddocks] = await Promise.all([
    fetch(`/api/animals/search?q=${qs}`).then(r=> r.ok? r.json(): {rows:[]}),
    fetch(`/api/pasture/paddocks/search?q=${qs}`).then(r=> r.ok? r.json(): {rows:[]}).catch(()=>({rows:[]})),
  ]); const out: Item[] = [];
  (animals.rows||[]).forEach((a:any)=> out.push({ kind:'animal', id:a.id, label:`#${a.id} ${a.name||a.vid||''}`.trim(), href:`/animals/${a.id}` }));
  (paddocks.rows||[]).forEach((p:any)=> out.push({ kind:'paddock', id:p.id, label:`Pdk ${p.code||p.name||p.id}`, href:`/pasture/paddocks/${p.id}` })); return out; }
export default function GlobalSearch(){
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const [items, setItems] = useState<Item[]>([]); const box = useRef<HTMLInputElement|null>(null);
  useEffect(()=>{ const onKey = (e:KeyboardEvent)=>{ if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){ e.preventDefault(); setOpen(true); setTimeout(()=> box.current?.focus(), 0); } if (e.key==='Escape') setOpen(false); }; window.addEventListener('keydown', onKey); return ()=> window.removeEventListener('keydown', onKey); }, []);
  useEffect(()=>{ let t = setTimeout(async ()=> setItems(await fetchAll(q)), 200); return ()=> clearTimeout(t); }, [q]);
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 bg-black/40" onClick={()=> setOpen(false)}>
    <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[min(720px,92vw)] rounded-2xl border border-border bg-card p-3 shadow-xl" onClick={e=> e.stopPropagation()}>
      <div className="flex items-center gap-2">
        <input ref={box} className="h-10 flex-1 rounded-xl border border-border bg-background px-3" placeholder="Search animals, paddocks…" value={q} onChange={e=> setQ(e.target.value)} />
        <span className="text-xs text-fg/60 px-2 py-1 rounded-md border border-border">⌘K</span>
      </div>
      <div className="mt-2 max-h-[50vh] overflow-auto">
        {items.length ? items.map((it, i)=> (<a key={i} href={it.href} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-fg/5">
          <span className="text-xs uppercase text-fg/60 w-20">{it.kind}</span><span className="font-medium">{it.label}</span>
        </a>)) : <div className="text-sm text-fg/60 px-2 py-6">Type at least 2 characters to search…</div>}
      </div>
    </div>
  </div>);
}
