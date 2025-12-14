import { Router } from "express";
import { db } from "../db/drizzle";
import { requireAtLeast } from "../auth/jwt";
const router = Router();
function dayStr(d:Date){ return d.toISOString().slice(0,10); }

router.get("/runsheet", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const date = req.query.date ? new Date(String(req.query.date)) : new Date(Date.now() + 86400000);
    const source = String(req.query.source||'heats');
    const dISO = dayStr(date);
    let rows:any[] = [];
    if (source === 'planned'){
      const r = await db.execute(`
        select animal_id, title, meta from planned_jobs
        where kind='mating' and due_date=$1::date
        order by animal_id asc
      `, [dISO]) as any;
      rows = (r.rows||[]).map((x:any)=> ({ animal_id: x.animal_id, bull_code: x.meta?.bull_code||null, technician: x.meta?.technician||null, batch: x.meta?.straw_batch||null, notes: x.meta?.notes||null }));
    }else{
      const prev = new Date(date.getTime() - 86400000);
      const r = await db.execute(`
        select h.animal_id, a.vid, a.eid
        from repro_heats h left join animals a on a.id=h.animal_id
        where h.ts::date = $1::date
        order by h.animal_id asc
      `, [dayStr(prev)]) as any;
      rows = (r.rows||[]).map((x:any)=> ({ animal_id:x.animal_id, vid:x.vid, eid:x.eid, bull_code:null, technician:null, batch:null, notes:null }));
    }
    res.json({ ok:true, date:dISO, source, rows });
  }catch(e){ next(e); }
});

export async function createRTHForMating(animal_id:number, mating_ts:string, meta:any){
  const dueDates = [18,21,24].map(d=> {
    const t = new Date(mating_ts).getTime() + d*86400000;
    return new Date(t).toISOString().slice(0,10);
  });
  for (const due of dueDates){
    await db.execute(`
      insert into planned_jobs (farm_id, kind, title, animal_id, due_date, meta)
      values ($1,'rth',$2,$3,$4,$5)
      on conflict (farm_id, kind, animal_id, due_date) do nothing
    `, [1, 'RTH #'+animal_id, animal_id, due, { from_mating_ts:mating_ts, ...meta } as any]);
  }
}

router.post("/rth/backfill", requireAtLeast("manager"), async (req:any,res:any,next)=>{
  try{
    const since = Math.max(1, Number(req.query.since_days||60));
    const r = await db.execute(`
      select animal_id, ts, (data->>'method') as method, (data->>'bull_code') as bull_code
      from animal_events where kind='mating' and ts >= (now() - ($1::int||' days')::interval)
      order by ts desc
    `, [since]) as any;
    let created=0;
    for (const m of (r.rows||[])){
      for (const d of [18,21,24]){
        const due = new Date(new Date(m.ts).getTime() + d*86400000).toISOString().slice(0,10);
        const rr = await db.execute(`
          insert into planned_jobs (farm_id, kind, title, animal_id, due_date, meta)
          values ($1,'rth',$2,$3,$4,$5)
          on conflict (farm_id, kind, animal_id, due_date) do nothing
        `, [1, 'RTH #'+m.animal_id, m.animal_id, due, { from_mating_ts: m.ts, method: m.method, bull_code: m.bull_code }]) as any;
        created += rr.rowCount||0;
      }
    }
    res.json({ ok:true, created, since_days: since });
  }catch(e){ next(e); }
});

export default router;
