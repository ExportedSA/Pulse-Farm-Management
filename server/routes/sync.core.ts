import { Router } from "express";
import { db } from "../db/drizzle";
import { requireAtLeast } from "../auth/jwt";
const router = Router();
function sinceClause(col:string){ return `(${col} > $1 or $1 is null)`; }
function rows(r:any){ return (r && r.rows) || []; }
async function getChanges(since:string|null){
  const tables = [
    { name:'animals', sql:`select id, vid, eid, name, breed, status, herd, updated_at from animals where ${sinceClause('updated_at')}` },
    { name:'animal_events', sql:`select id, animal_id, kind, ts, data, updated_at from animal_events where ${sinceClause('updated_at')}` },
    { name:'repro_heats', sql:`select id, animal_id, ts, source, notes, updated_at from repro_heats where ${sinceClause('updated_at')}` },
    { name:'repro_matings', sql:`select id, animal_id, ts, method, bull_id, technician, straw_batch, notes, updated_at from repro_matings where ${sinceClause('updated_at')}` },
    { name:'repro_preg_tests', sql:`select id, animal_id, ts, result, due_date, foetal_age_days, notes, updated_at from repro_preg_tests where ${sinceClause('updated_at')}` },
    { name:'planned_jobs', sql:`select id, kind, title, animal_id, due_date, status, meta, updated_at from planned_jobs where ${sinceClause('updated_at')}` },
  ];
  const out:any = { at: new Date().toISOString(), tables:{} };
  for (const t of tables){
    const r = await db.execute(t.sql, [since]) as any;
    out.tables[t.name] = rows(r);
  }
  return out;
}
router.post("/pull", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{ const since = req.body?.since || null; res.json(await getChanges(since)); }catch(e){ next(e); }
});
async function applyOp(op:any){
  const t = op.table, a = op.action; const nowISO = new Date().toISOString();
  if (a === 'insert'){
    const keys = Object.keys(op.data||{});
    const cols = keys.concat('updated_at');
    const vals = keys.map((_,i)=> `$${i+1}`).concat(`$${keys.length+1}`);
    const sql = `insert into ${t} (${cols.join(',')}) values (${vals.join(',')}) on conflict do nothing`;
    const args = keys.map((k:any)=> op.data[k]).concat(nowISO);
    return db.execute(sql, args);
  }else if (a === 'update'){
    const keys = Object.keys(op.data||{});
    const sets = keys.map((k,i)=> `${k}=$${i+1}`);
    const whereKeys = Object.keys(op.where||{id: op.data?.id || 0});
    const where = whereKeys.map((k,i)=> `${k}=$${i+1+keys.length}`);
    const sql = `update ${t} set ${sets.concat(['updated_at=$'+(keys.length+whereKeys.length+1)]).join(', ')} where ${where.join(' and ')}`;
    const args = keys.map((k:any)=> op.data[k]).concat(whereKeys.map((k:any)=> op.where[k]?? (k==='id'? op.data?.id: null))).concat(nowISO);
    return db.execute(sql, args);
  }else if (a === 'delete'){
    const whereKeys = Object.keys(op.where||{id: op.data?.id || 0});
    const where = whereKeys.map((k,i)=> `${k}=$${i+1}`);
    const sql = `delete from ${t} where ${where.join(' and ')}`;
    const args = whereKeys.map((k:any)=> op.where[k]?? (k==='id'? op.data?.id: null));
    return db.execute(sql, args);
  }
  return null;
}
router.post("/push", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const ops = Array.isArray(req.body?.ops) ? req.body.ops : [];
    const results:any[] = [];
    for (const op of ops){
      try{ await applyOp(op); results.push({ ok:true }); }
      catch(err:any){ results.push({ ok:false, error:String(err?.message||err) }); }
    }
    res.json({ ok:true, results, at: new Date().toISOString() });
  }catch(e){ next(e); }
});
export default router;
