import { enqueue, drain } from "@/lib/sync";
type JSONLike = Record<string, any>;
function isOnline(){ return typeof navigator !== 'undefined' ? navigator.onLine : true; }
export async function postOrQueue(url:string, body: JSONLike, composeOps: (body: JSONLike) => any){
  if (isOnline()){
    const r = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json().catch(()=> ({}));
  }else{
    const ops = composeOps(body); if (Array.isArray(ops)){ for (const op of ops) await enqueue(op); } else { await enqueue(ops); }
    try{ await drain(); }catch{} return { ok:true, queued:true };
  }
}
