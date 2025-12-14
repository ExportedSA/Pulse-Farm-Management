import { Router } from "express";
import { db } from "../db/drizzle";
import { requireAtLeast } from "../auth/jwt";
const router = Router();
router.post("/mating/plan", requireAtLeast("manager"), async (req:any,res:any,next)=>{
  try{
    const farmId = req.user?.farmId ?? 1;
    const { due_date, animal_ids, bull_code, technician, straw_batch, notes } = req.body||{};
    if (!due_date) return res.status(400).json({ ok:false, code:"missing_due_date" });
    if (!Array.isArray(animal_ids) || !animal_ids.length) return res.status(400).json({ ok:false, code:"missing_animals" });
    let created=0, skipped=0;
    for (const id of animal_ids){
      const r = await db.execute(`
        insert into planned_jobs (farm_id, kind, title, animal_id, due_date, meta)
        values ($1,'mating',$2,$3,$4,$5)
        on conflict (farm_id, kind, animal_id, due_date) do nothing
      `, [farmId, 'Mating #'+id, Number(id), due_date, { bull_code, technician, straw_batch, notes }]) as any;
      if (r.rowCount) created+=1; else skipped+=1;
    }
    res.json({ ok:true, created, skipped, due_date });
  }catch(e){ next(e); }
});
export default router;
