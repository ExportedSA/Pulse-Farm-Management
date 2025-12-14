import { Router } from "express";
import { db } from "../db/drizzle";
import { requireAtLeast } from "../auth/jwt";
const router = Router();
function dstr(d:Date){ return d.toISOString().slice(0,10); }
function rows(r:any){ return (r && r.rows) || []; }
router.get("/withhold/ids", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    const r = await db.execute(`
      select a.id as animal_id, max(t.withhold_until_milk) as milk_until, max(t.withhold_until_meat) as meat_until
      from treatments t join animals a on a.id=t.animal_id
      group by a.id
    `) as any;
    const milk:number[] = [], meat:number[] = [], both:number[] = [];
    for (const x of rows(r)){
      const activeMilk = x.milk_until ? (new Date(x.milk_until) >= date) : false;
      const activeMeat = x.meat_until ? (new Date(x.meat_until + 'T00:00:00Z') >= date) : false;
      if (activeMilk && activeMeat){ both.push(x.animal_id); }
      else if (activeMilk){ milk.push(x.animal_id); }
      else if (activeMeat){ meat.push(x.animal_id); }
    }
    res.json({ ok:true, date: dstr(date), milk, meat, both });
  }catch(e){ next(e); }
});
export default router;
