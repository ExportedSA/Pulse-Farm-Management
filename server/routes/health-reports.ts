import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { animals, animalTreatments, farms, products } from '@shared/schema';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { requireFarm, getFarmId } from '../middleware/auth';
import logger from '../config/logger';

// /api/health-reports - the Health Reports page: treatment log, withholds, medicine use and
// animal history, built from the farm's animal treatments
const router = Router();
router.use(requireFarm);

const DAY_MS = 24 * 60 * 60 * 1000;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

// A moment's date on the farm (treatments are timestamps; report ranges are farm days)
function farmDay(when: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(when);
}

interface TreatmentRow {
  id: string;
  ts: string;
  day: string;
  animal_id: string;
  tag_number: string | null;
  medicine: string;
  medicine_id: string | null;
  dose: string | null;
  route: string | null;
  site: string | null;
  condition: string | null;
  approver: string | null;
  approval_ref: string | null;
  notes: string | null;
  withhold_until_milk: string | null;
  withhold_until_meat: string | null;
}

/**
 * Every treatment on the farm, oldest first, shaped for the report tables
 */
async function farmTreatments(farmId: string) {
  const [farm] = await db.select({ timezone: farms.timezone }).from(farms).where(eq(farms.id, farmId));
  const timezone = farm?.timezone || 'Pacific/Auckland';
  const rows = await db
    .select({
      id: animalTreatments.id,
      dateTime: animalTreatments.dateTime,
      visualId: animals.visualId,
      cowId: animalTreatments.cowId,
      naitTag: animals.naitTag,
      eid: animals.eid,
      productId: animalTreatments.productId,
      product: products.name,
      treatmentType: animalTreatments.treatmentType,
      doseAmount: animalTreatments.doseAmount,
      doseUnit: animalTreatments.doseUnit,
      bodyPart: animalTreatments.bodyPart,
      condition: animalTreatments.condition,
      staffMember: animalTreatments.staffMember,
      notes: animalTreatments.clinicalNotes,
      milkDays: animalTreatments.milkWithdrawalDays,
      milkEnd: animalTreatments.milkWithdrawalEndDate,
      productMilkDays: products.milkWithdrawalDays,
      productMeatDays: products.meatWithdrawalDays,
    })
    .from(animalTreatments)
    .innerJoin(animals, eq(animals.id, animalTreatments.animalId))
    .leftJoin(products, eq(products.id, animalTreatments.productId))
    .where(and(eq(animals.farmId, farmId), isNull(animalTreatments.deletedAt)))
    .orderBy(asc(animalTreatments.dateTime));

  const treatments: TreatmentRow[] = rows.map(r => {
    const given = new Date(r.dateTime);
    const milkDays = r.milkDays ?? r.productMilkDays;
    const milkUntil = r.milkEnd ? new Date(r.milkEnd) : milkDays != null ? new Date(given.getTime() + milkDays * DAY_MS) : null;
    const meatUntil = r.productMeatDays != null ? new Date(given.getTime() + r.productMeatDays * DAY_MS) : null;
    return {
      id: r.id,
      ts: given.toISOString(),
      day: farmDay(given, timezone),
      animal_id: r.visualId ?? r.cowId ?? r.naitTag ?? r.eid ?? '?',
      tag_number: r.naitTag ?? r.eid ?? null,
      medicine: r.product ?? r.treatmentType ?? 'Not recorded',
      medicine_id: r.productId,
      dose: r.doseAmount != null ? `${Number(r.doseAmount)} ${r.doseUnit ?? ''}`.trim() : null,
      route: r.treatmentType,
      site: r.bodyPart,
      condition: r.condition,
      approver: r.staffMember,
      approval_ref: null,
      notes: r.notes,
      withhold_until_milk: milkUntil?.toISOString() ?? null,
      withhold_until_meat: meatUntil ? farmDay(meatUntil, timezone) : null,
    };
  });
  return { treatments, timezone };
}

function range(query: any) {
  const today = new Date().toISOString().slice(0, 10);
  const { from, to } = z.object({ from: day.optional(), to: day.optional() }).parse(query);
  return { from: from ?? new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10), to: to ?? today };
}

function handle(res: any, error: unknown, message: string) {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0]?.message ?? 'Invalid request' });
  logger.error({ err: error }, message);
  res.status(500).json({ error: message });
}

// GET /api/health-reports/medicines - medicines to filter by
router.get('/medicines', async (_req, res) => {
  try {
    const list = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(isNull(products.deletedAt))
      .orderBy(asc(products.name));
    res.json({ rows: list });
  } catch (error) {
    handle(res, error, 'Failed to load medicines');
  }
});

// GET /api/health-reports/rvm?from&to - every treatment in the range (the RVM treatment log)
router.get('/rvm', async (req, res) => {
  try {
    const { from, to } = range(req.query);
    const { treatments } = await farmTreatments(getFarmId(req)!);
    res.json({ rows: treatments.filter(t => t.day >= from && t.day <= to) });
  } catch (error) {
    handle(res, error, 'Failed to build the treatment log');
  }
});

// GET /api/health-reports/withholds?date - animals still withheld on that date (milk or meat)
router.get('/withholds', async (req, res) => {
  try {
    const { date } = z.object({ date: day.optional() }).parse(req.query);
    const { treatments, timezone } = await farmTreatments(getFarmId(req)!);
    const on = date ?? farmDay(new Date(), timezone);
    // Latest withhold per animal
    const byAnimal = new Map<string, { animal_id: string; milk_until: string | null; meat_until: string | null; medicine: string }>();
    for (const t of treatments) {
      const milkActive = t.withhold_until_milk && farmDay(new Date(t.withhold_until_milk), timezone) >= on && t.day <= on;
      const meatActive = t.withhold_until_meat && t.withhold_until_meat >= on && t.day <= on;
      if (!milkActive && !meatActive) continue;
      const current = byAnimal.get(t.animal_id) ?? { animal_id: t.animal_id, milk_until: null, meat_until: null, medicine: t.medicine };
      if (milkActive && (!current.milk_until || t.withhold_until_milk! > current.milk_until)) current.milk_until = t.withhold_until_milk;
      if (meatActive && (!current.meat_until || t.withhold_until_meat! > current.meat_until)) current.meat_until = t.withhold_until_meat;
      current.medicine = t.medicine;
      byAnimal.set(t.animal_id, current);
    }
    res.json({ rows: Array.from(byAnimal.values()).sort((a, b) => a.animal_id.localeCompare(b.animal_id)) });
  } catch (error) {
    handle(res, error, 'Failed to build the withholds report');
  }
});

// GET /api/health-reports/treatment-summary?from&to - treatments and animals per medicine
router.get('/treatment-summary', async (req, res) => {
  try {
    const { from, to } = range(req.query);
    const { treatments } = await farmTreatments(getFarmId(req)!);
    const byMedicine = new Map<string, { medicine: string; treatment_count: number; with_dose: number; animals: Set<string> }>();
    for (const t of treatments.filter(t => t.day >= from && t.day <= to)) {
      const row = byMedicine.get(t.medicine) ?? { medicine: t.medicine, treatment_count: 0, with_dose: 0, animals: new Set<string>() };
      row.treatment_count++;
      if (t.dose) row.with_dose++;
      row.animals.add(t.animal_id);
      byMedicine.set(t.medicine, row);
    }
    res.json({
      rows: Array.from(byMedicine.values())
        .map(({ animals: a, ...r }) => ({ ...r, unique_animals: a.size }))
        .sort((a, b) => b.treatment_count - a.treatment_count),
    });
  } catch (error) {
    handle(res, error, 'Failed to build the treatment summary');
  }
});

// GET /api/health-reports/medicine-usage?from&to - treatments per medicine per month
router.get('/medicine-usage', async (req, res) => {
  try {
    const { from, to } = range(req.query);
    const { treatments } = await farmTreatments(getFarmId(req)!);
    const counts = new Map<string, { month: string; medicine: string; usage_count: number }>();
    for (const t of treatments.filter(t => t.day >= from && t.day <= to)) {
      const month = `${t.day.slice(0, 7)}-01`;
      const key = `${month}|${t.medicine}`;
      const row = counts.get(key) ?? { month, medicine: t.medicine, usage_count: 0 };
      row.usage_count++;
      counts.set(key, row);
    }
    res.json({ rows: Array.from(counts.values()).sort((a, b) => b.month.localeCompare(a.month) || b.usage_count - a.usage_count) });
  } catch (error) {
    handle(res, error, 'Failed to build medicine usage');
  }
});

// GET /api/health-reports/animal-health-history?animalId - one animal's treatments, by tag
router.get('/animal-health-history', async (req, res) => {
  try {
    const { animalId } = z.object({ animalId: z.string().trim().min(1, 'Enter the animal\'s tag') }).parse(req.query);
    const { treatments } = await farmTreatments(getFarmId(req)!);
    const wanted = animalId.toLowerCase();
    const rows = treatments
      .filter(t => t.animal_id.toLowerCase() === wanted || t.tag_number?.toLowerCase() === wanted)
      .reverse();
    res.json({ rows });
  } catch (error) {
    handle(res, error, 'Failed to load the animal\'s history');
  }
});

// POST /api/health-reports/custom - filter by dates, medicines, animals (tags) and treatment types
router.post('/custom', async (req, res) => {
  try {
    const input = z.object({
      from: day.optional(),
      to: day.optional(),
      medicines: z.array(z.string()).max(100).optional(),
      animals: z.array(z.union([z.string(), z.number()]).transform(String)).max(500).optional(),
      routes: z.array(z.string()).max(50).optional(),
    }).parse(req.body ?? {});
    const { treatments } = await farmTreatments(getFarmId(req)!);
    const tags = input.animals?.map(a => a.trim().toLowerCase()).filter(Boolean);
    const types = input.routes?.map(r => r.trim().toLowerCase()).filter(Boolean);
    const rows = treatments.filter(t =>
      (!input.from || t.day >= input.from) &&
      (!input.to || t.day <= input.to) &&
      (!input.medicines?.length || (t.medicine_id != null && input.medicines.includes(t.medicine_id))) &&
      (!tags?.length || tags.includes(t.animal_id.toLowerCase()) || (t.tag_number != null && tags.includes(t.tag_number.toLowerCase()))) &&
      (!types?.length || (t.route != null && types.includes(t.route.toLowerCase()))),
    ).reverse();
    res.json({ rows });
  } catch (error) {
    handle(res, error, 'Failed to run the report');
  }
});

export default router;
