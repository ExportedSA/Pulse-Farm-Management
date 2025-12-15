import { withDB, tx } from "./idb";
export type Op = { table:string, action:'insert'|'update'|'delete', data?:any, where?:any };
export async function enqueue(op:Op){
  return withDB(db => tx(db, 'queue', 'readwrite', s => new Promise((resolve, reject)=>{
    const req = s.add({ ...op, ts: Date.now() }); req.onsuccess = ()=> resolve(req.result); req.onerror = ()=> reject(req.error);
  })));
}
export async function drain(){
  const ops:any[] = await withDB(db => tx(db, 'queue', 'readonly', s => new Promise((resolve)=>{
    const out:any[] = []; const cur = s.openCursor();
    cur.onsuccess = ()=>{ const c = cur.result; if (c){ out.push({ key:c.key, ...c.value }); c.continue(); } else resolve(out); };
  })));
  if (!ops.length) return { pushed:0, errors:0 };
  const res = await fetch('/api/sync/push', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ops: ops.map(o=> ({ table:o.table, action:o.action, data:o.data, where:o.where })) }) }).then(r=> r.json()).catch(()=> null);
  if (!res || !res.ok) return { pushed:0, errors:ops.length };
  await withDB(db => tx(db, 'queue', 'readwrite', s => Promise.all(ops.map(op => new Promise<void>((resolve)=>{ const d = s.delete(op.key); d.onsuccess=()=> resolve(); })))));
  return { pushed: ops.length, errors: res.results.filter((r:any)=> !r.ok).length };
}
export function setupBackgroundSync(){
  if ('serviceWorker' in navigator && 'SyncManager' in window){
    navigator.serviceWorker.ready.then(reg=> reg.sync.register('pulse-sync')).catch(()=>{});
  }
}
export function listenConnection(cb:(online:boolean)=>void){
  const fn = ()=> cb(navigator.onLine);
  window.addEventListener('online', fn); window.addEventListener('offline', fn); cb(navigator.onLine);
  return ()=>{ window.removeEventListener('online', fn); window.removeEventListener('offline', fn); };
}
export async function pull(){
  const metaKey = 'cursor';
  const since = await withDB(db => tx(db, 'meta', 'readonly', s => new Promise<string|null>((resolve)=>{ const g = s.get(metaKey); g.onsuccess = ()=> resolve(g.result||null); })));
  const r = await fetch('/api/sync/pull', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ since }) }).then(r=> r.json());
  await withDB(db => tx(db, 'meta', 'readwrite', s => new Promise<void>((resolve)=>{ const p = s.put(r.at, metaKey); p.onsuccess = ()=> resolve(); })));
  return r;
}
