import { Router } from "express";
import { db } from "../db/drizzle";
import { requireAtLeast } from "../auth/jwt";
const router = Router();
function rows(r:any){ return (r && r.rows) || []; }
function dstr(d:Date){ return d.toISOString().slice(0,10); }
router.get("/withhold/animal/:id", requireAtLeast("staff"), async (req:any,res:any,next)=>{
  try{
    const id = Number(req.params.id);
    const now = new Date();
    const r = await db.execute(`
      select max(withhold_until_milk) as milk_until, max(withhold_until_meat) as meat_until
      from treatments where animal_id=$1
    `, [id]) as any;
    const milk_until = r.rows?.[0]?.milk_until || null;
    const meat_until = r.rows?.[0]?.meat_until || null;
    const activeMilk = milk_until ? (new Date(milk_until) >= now) : false;
    const activeMeat = meat_until ? (new Date(meat_until + 'T00:00:00Z') >= now) : false;
    res.json({ ok:true, animal_id:id, milk_until, meat_until, activeMilk, activeMeat, now: now.toISOString() });
  }catch(e){ next(e); }
});
export default router;
