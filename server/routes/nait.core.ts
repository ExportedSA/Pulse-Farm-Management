import { Router } from "express";
import { db } from "../db/drizzle";
import { requireAtLeast } from "../auth/jwt";
const router = Router();
router.post("/submit", requireAtLeast("manager"), async (req:any,res:any,next)=>{
  try{
    const { animal_id, kind, payload } = req.body||{};
    if (!animal_id || !kind) return res.status(400).json({ ok:false, code:"missing_fields" });
    await db.execute(`insert into nait_queue (farm_id, animal_id, kind, payload) values ($1,$2,$3,$4)`, [1, animal_id, kind, payload||{}]);
    res.json({ ok:true });
  }catch(e){ next(e); }
});
router.post("/simulate-send", requireAtLeast("manager"), async (_req:any,res:any,next)=>{
  try{ const r = await db.execute("update nait_queue set status='sent', updated_at=now() where status='queued'") as any; res.json({ ok:true, sent: r.rowCount||0 }); }catch(e){ next(e); }
});
router.get("/queue", requireAtLeast("staff"), async (_req:any,res:any,next)=>{
  try{ const r = await db.execute("select * from nait_queue order by id desc") as any; res.json({ ok:true, rows: r.rows||[] }); }catch(e){ next(e); }
});
export default router;
