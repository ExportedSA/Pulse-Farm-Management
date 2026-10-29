import { randomUUID } from 'crypto';
import { db } from '../db';
import { animals, stockCounts, stockTransactions, type StockCount } from '@shared/schema';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { STOCK_IN_TYPES, STOCK_OUT_TYPES, STOCK_MOVEMENT_LABELS, type StockMovementType } from '@shared/stock';
import { attachmentsFor, saveAttachments, toApiAttachment } from './attachments';
import { createRecord, deleteRecord } from './records';

// Stock reconciliation: tallies per stock class from the last stocktake plus movements since.
// Each movement's ASD photo is kept as a Document record in Records, which the movement points at.

export interface MovementInput {
  type: StockMovementType;
  date: string; // yyyy-mm-dd
  asdNumber?: string | null;
  otherParty?: string | null;
  otherPartyNait?: string | null;
  notes?: string | null;
  lines: { stockClass: string; quantity: number }[];
}

// +1 for stock arriving, -1 for stock leaving; adjustments carry their own sign
const direction = (type: string) => (STOCK_IN_TYPES.includes(type as any) ? 1 : STOCK_OUT_TYPES.includes(type as any) ? -1 : 1);

export async function createMovement(farmId: string, userId: string, input: MovementInput, files: Express.Multer.File[]) {
  const movementId = randomUUID();
  const incoming = direction(input.type) > 0;
  const party = input.otherParty || null;

  let recordId: string | null = null;
  if (files.length > 0) {
    const head = input.lines.map(l => `${l.quantity} ${l.stockClass}`).join(', ');
    const { record } = await createRecord(farmId, userId, {
      type: 'document',
      title: [`ASD${input.asdNumber ? ` ${input.asdNumber}` : ''}`, `${STOCK_MOVEMENT_LABELS[input.type]} ${head}`].join(' – ').slice(0, 255),
      occurredAt: new Date(input.date),
      notes: input.notes || null,
      details: { documentType: 'ASD', reference: input.asdNumber || undefined, issuer: party || undefined, movementId },
      tags: ['Compliance'],
    });
    await saveAttachments(farmId, 'record', record.id, files, userId, { takenAt: new Date(input.date) });
    recordId = record.id;
  }

  await db.insert(stockTransactions).values(input.lines.map(line => ({
    farmId,
    movementId,
    recordId,
    type: input.type,
    date: input.date,
    quantity: line.quantity,
    stockClass: line.stockClass,
    asdNumber: input.asdNumber || null,
    otherPartyNait: input.otherPartyNait || null,
    fromLocation: incoming ? party : null,
    toLocation: incoming ? null : party,
    seller: input.type === 'purchase' ? party : null,
    buyer: input.type === 'sale' ? party : null,
    description: input.notes || null,
    notes: input.notes || null,
    createdBy: userId,
  })));
  return movementId;
}

export async function deleteMovement(farmId: string, movementId: string): Promise<boolean> {
  const rows = await db
    .update(stockTransactions)
    .set({ deletedAt: new Date() })
    .where(and(eq(stockTransactions.farmId, farmId), eq(stockTransactions.movementId, movementId), isNull(stockTransactions.deletedAt)))
    .returning({ id: stockTransactions.id, recordId: stockTransactions.recordId });
  // The ASD record goes too; both stay in the audit history
  const recordId = rows.find(r => r.recordId)?.recordId;
  if (recordId) await deleteRecord(farmId, recordId);
  return rows.length > 0;
}

export async function recordCount(farmId: string, userId: string, input: { stockClass: string; count: number; countedAt: string; notes?: string | null }) {
  const [row] = await db.insert(stockCounts).values({ farmId, createdBy: userId, ...input, notes: input.notes || null }).returning();
  return row;
}

export async function stockReconciliation(farmId: string) {
  const lines = await db
    .select()
    .from(stockTransactions)
    .where(and(eq(stockTransactions.farmId, farmId), isNull(stockTransactions.deletedAt)))
    .orderBy(desc(stockTransactions.date), desc(stockTransactions.createdAt));
  const counts = await db.select().from(stockCounts).where(eq(stockCounts.farmId, farmId)).orderBy(desc(stockCounts.countedAt), desc(stockCounts.createdAt));

  // Latest stocktake per class
  const lastCount = new Map<string, StockCount>();
  for (const c of counts) if (!lastCount.has(c.stockClass)) lastCount.set(c.stockClass, c);

  const classes = new Map<string, { stockClass: string; counted: { count: number; countedAt: string } | null; in: number; out: number; tally: number }>();
  const row = (stockClass: string) => {
    if (!classes.has(stockClass)) {
      const c = lastCount.get(stockClass);
      classes.set(stockClass, { stockClass, counted: c ? { count: c.count, countedAt: c.countedAt } : null, in: 0, out: 0, tally: c?.count ?? 0 });
    }
    return classes.get(stockClass)!;
  };
  Array.from(lastCount.keys()).forEach(row);
  for (const line of lines) {
    const r = row(line.stockClass ?? 'Unclassified');
    // A stocktake already includes movements up to and including its day
    if (r.counted && line.date <= r.counted.countedAt) continue;
    const change = line.type === 'adjustment' ? line.quantity : direction(line.type) * line.quantity;
    if (change >= 0) r.in += change; else r.out -= change;
    r.tally += change;
  }

  // Group lines into movements (one per ASD)
  const movements = new Map<string, any>();
  for (const line of lines) {
    const key = line.movementId ?? line.id;
    if (!movements.has(key)) {
      movements.set(key, {
        id: key,
        recordId: line.recordId,
        type: line.type,
        date: line.date,
        asdNumber: line.asdNumber,
        otherParty: line.fromLocation ?? line.toLocation ?? line.seller ?? line.buyer ?? null,
        otherPartyNait: line.otherPartyNait,
        notes: line.notes,
        lines: [] as { stockClass: string | null; quantity: number }[],
        attachments: [] as ReturnType<typeof toApiAttachment>[],
      });
    }
    movements.get(key).lines.push({ stockClass: line.stockClass, quantity: line.quantity });
  }
  const recent = Array.from(movements.values()).slice(0, 100);
  const files = await attachmentsFor('record', recent.map(m => m.recordId).filter(Boolean));
  for (const m of recent) m.attachments = (m.recordId ? files.get(m.recordId) ?? [] : []).map(toApiAttachment);

  // Animals tagged in the register, to compare with the tally
  const [{ register }] = await db
    .select({ register: count() })
    .from(animals)
    .where(and(eq(animals.farmId, farmId), eq(animals.status, 'active')));

  const list = Array.from(classes.values()).sort((a, b) => a.stockClass.localeCompare(b.stockClass));
  return {
    classes: list,
    totalTally: list.reduce((sum, c) => sum + c.tally, 0),
    registerActive: register,
    movements: recent,
  };
}
