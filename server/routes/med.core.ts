import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db/drizzle";
import { requireAtLeast } from "../auth/jwt";
const router = Router();
const upload = multer({ dest: path.join(process.cwd(), "uploads", "med") });
function rows(r:any){ return (r && r.rows) || []; }
function dstr(d:Date){ return d.toISOString().slice(0,10); }
async function addEvent(animal_id:number, kind:string, ts:string, data:any){
  await db.execute(`insert into animal_events (farm_id, animal_id, kind, ts, data) values ($1,$2,$3,$4,$5)`, [1, animal_id, kind, ts, data]);
}
function computeWithholds(tsISO:string, milkH:number|null, meatD:number|null){
  const t0 = new Date(tsISO).getTime();
  const milkUntil = milkH!=null ? new Date(t0 + milkH*3600*1000) : null;
  const meatUntil = meatD!=null ? new Date(t0 + meatD*86400*1000) : null;
  return { milkUntil, meatUntil };
}
router.get("/medicine", requireAtLeast("staff"), async (_req:any,res:any,next)=>{
  try{ const r = await db.execute("select * from medicines order by name asc") as any; res.json({ rows: rows(r) }); }catch(e){ next(e); }
});
router.post("/medicine", requireAtLeast("manager"), async (req:any,res:any,next)=>{
  try{
    const { name, actives, route, milk_withhold_hours, meat_withhold_days, notes } = req.body||{};
    if (!name) return res.status(400).json({ ok:false, code:"missing_name" });
    await db.execute(`
      insert into medicines (farm_id, name, actives, route, milk_withhold_hours, meat_withhold_days, notes)
      values ($1,$2,$3,$4,$5,$6,$7)
      on conflict (farm_id, name) do update set actives=excluded.actives, route=excluded.route, milk_withhold_hours=excluded.milk_withhold_hours, meat_withhold_days=excluded.meat_withhold_days, notes=excluded.notes
    `, [1, name, actives||null, route||null, milk_withhold_hours??null, meat_withhold_days??null, notes||null]);
    res.json({ ok:true });
  }catch(e){ next(e); }
});
router.post("/medicine.csv", requireAtLeast("manager"), upload.single("file"), async (req:any,res:any,next)=>{
  try{
    if (!req.file) return res.status(400).json({ ok:false, code:"missing_file" });
    const text = fs.readFileSync(req.file.path, "utf-8");
    const lines = text.split(/\r?\n/).filter(x=> x.trim().length>0);
    const header = (lines.shift()||'').split(',').map(s=> s.trim());
    const idx = (h:string)=> header.indexOf(h);
    if (idx('Name')<0) return res.status(400).json({ ok:false, code:"missing_Name" });
    let upserts=0;
    for (const line of lines){
      const cols = line.split(',').map(s=> s.trim());
      const name = cols[idx('Name')]; if (!name) continue;
      const actives = idx('Actives')>=0 ? cols[idx('Actives')] : null;
      const route = idx('Route')>=0 ? cols[idx('Route')] : null;
      const milkH = idx('MilkWithholdHours')>=0 ? Number(cols[idx('MilkWithholdHours')]) : null;
      const meatD = idx('MeatWithholdDays')>=0 ? Number(cols[idx('MeatWithholdDays')]) : null;
      await db.execute(`
        insert into medicines (farm_id, name, actives, route, milk_withhold_hours, meat_withhold_days)
        values ($1,$2,$3,$4,$5,$6)
        on conflict (farm_id, name) do update set actives=excluded.actives, route=excluded.route, milk_withhold_hours=excluded.milk_withhold_hours, meat_withhold_days=excluded.meat_withhold_days
      `, [1, name, actives, route, milkH, meatD]);
      upserts+=1;
    }
    res.json({ ok:true, upserts });
  }catch(e){ next(e); }
});
router.post("/inventory", requireAtLeast("manager"), async (req:any,res:any,next)=>{
  try{
    const { medicine_id, batch, expiry, quantity, notes } = req.body||{};
    if (!medicine_id) return res.status(400).json({ ok:false, code:"missing_medicine" });
    await db.execute(`insert into medicine_inventory (farm_id, medicine_id, batch, expiry, quantity, notes) values ($1,$2,$3,$4,$5,$6)`,
      [1, medicine_id, batch||null, expiry||null, quantity??0, notes||null]);
    res.json({ ok:true });
  }catch(e){ next(e); }
});
router.post("/treatment", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const { animal_id, medicine_id, ts, dose, route, site, notes, withhold_milk_hours, withhold_meat_days, approver, approval_ref } = req.body||{};
    if (!animal_id || !medicine_id) return res.status(400).json({ ok:false, code:"missing_inputs" });
    const when = ts || new Date().toISOString();
    const med = await db.execute("select milk_withhold_hours, meat_withhold_days from medicines where id=$1", [medicine_id]) as any;
    const defMilk = med.rows?.[0]?.milk_withhold_hours ?? null;
    const defMeat = med.rows?.[0]?.meat_withhold_days ?? null;
    const milkH = (withhold_milk_hours ?? defMilk);
    const meatD = (withhold_meat_days ?? defMeat);
    const t0 = computeWithholds(when, milkH, meatD);
    const r = await db.execute(`
      insert into treatments (farm_id, animal_id, medicine_id, ts, dose, route, site, notes,
                              withhold_milk_hours, withhold_meat_days, withhold_until_milk, withhold_until_meat,
                              approver, approval_ref, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      returning id, withhold_until_milk, withhold_until_meat
    `, [1, animal_id, medicine_id, when, dose||null, route||null, site||null, notes||null,
         milkH, meatD, t0.milkUntil, t0.meatUntil ? new Date(t0.meatUntil).toISOString().slice(0,10) : null, approver||null, approval_ref||null, 'system']) as any;
    await addEvent(animal_id, 'treatment', when, {
      medicine_id, dose, route, site, notes,
      withhold_milk_hours: milkH, withhold_meat_days: meatD,
      withhold_until_milk: r.rows?.[0]?.withhold_until_milk, withhold_until_meat: r.rows?.[0]?.withhold_until_meat,
      approver, approval_ref
    });
    res.json({ ok:true, id: r.rows?.[0]?.id, withhold_until_milk: r.rows?.[0]?.withhold_until_milk, withhold_until_meat: r.rows?.[0]?.withhold_until_meat });
  }catch(e){ next(e); }
});
router.put("/treatment/:id", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const id = Number(req.params.id);
    const { ts, dose, route, site, notes, withhold_milk_hours, withhold_meat_days, approver, approval_ref } = req.body||{};
    const cur = await db.execute("select * from treatments where id=$1", [id]) as any;
    if (!cur.rows?.[0]) return res.status(404).json({ ok:false, code:"not_found" });
    const t = cur.rows[0];
    const when = ts || t.ts;
    const milkH = withhold_milk_hours ?? t.withhold_milk_hours;
    const meatD = withhold_meat_days ?? t.withhold_meat_days;
    const t0 = computeWithholds(when, milkH, meatD);
    await db.execute(`
      update treatments set ts=$2, dose=$3, route=$4, site=$5, notes=$6,
        withhold_milk_hours=$7, withhold_meat_days=$8, withhold_until_milk=$9, withhold_until_meat=$10,
        approver=$11, approval_ref=$12, updated_at=now()
      where id=$1
    `, [id, when, dose||t.dose, route||t.route, site||t.site, notes||t.notes,
         milkH, meatD, t0.milkUntil, t0.meatUntil ? new Date(t0.meatUntil).toISOString().slice(0,10) : null,
         approver||t.approver, approval_ref||t.approval_ref ]);
    res.json({ ok:true });
  }catch(e){ next(e); }
});
router.get("/reports/rvm", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now()-30*86400000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    const r = await db.execute(`
      select t.id, t.ts, t.animal_id, m.name as medicine, t.dose, t.route, t.site, t.notes, t.approver, t.approval_ref
      from treatments t left join medicines m on m.id=t.medicine_id
      where t.ts::date between $1::date and $2::date
      order by t.ts asc
    `, [from.toISOString().slice(0,10), to.toISOString().slice(0,10)]) as any;
    res.json({ ok:true, rows: rows(r) });
  }catch(e){ next(e); }
});
router.get("/reports/withholds", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const dISO = date.toISOString().slice(0,10);
    const r = await db.execute(`
      select a.id as animal_id, max(t.withhold_until_milk) as milk_until,
             max(t.withhold_until_meat) as meat_until
      from treatments t join animals a on a.id=t.animal_id
      where (t.withhold_until_milk is not null and t.withhold_until_milk::date >= $1::date)
         or (t.withhold_until_meat is not null and t.withhold_until_meat >= $1::date)
      group by a.id
      order by a.id asc
    `, [dISO]) as any;
    res.json({ ok:true, rows: rows(r), date: dISO });
  }catch(e){ next(e); }
});
export default router;
