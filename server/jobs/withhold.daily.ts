import { Router } from "express";
import { db } from "../db/drizzle";
const router = Router();
function dstr(d:Date){ return d.toISOString().slice(0,10); }
router.get("/withhold/daily", async (_req:any,res:any,next)=>{
  try{
    const date = new Date(); const dISO = dstr(date);
    const r = await db.execute(`
      select a.id as animal_id, max(t.withhold_until_milk) as milk_until, max(t.withhold_until_meat) as meat_until
      from treatments t join animals a on a.id=t.animal_id
      group by a.id
      having max(t.withhold_until_milk) >= $1::date or max(t.withhold_until_meat) >= $1::date
      order by a.id asc
    `, [dISO]) as any;
    const rows = r.rows||[]; const header = ['AnimalID','MilkUntil','MeatUntil'];
    const csv = [header.join(',')].concat(rows.map((x:any)=> [x.animal_id, x.milk_until||'', x.meat_until||''].join(','))).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="withholds_${dISO}.csv"`);
    res.send(csv);
  }catch(e){ next(e); }
});
export default router;
