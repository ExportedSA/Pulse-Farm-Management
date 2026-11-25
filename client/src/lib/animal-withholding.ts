// An animal's withholding, from all its treatments: the latest milk and meat clear times still to come.
// "pending" when a withholding applies but its end isn't known yet (doses still to give).
import type { AnimalTreatment } from "@shared/schema";
import { formatFarmTime } from "@shared/withholding";

export type WithholdingEnd = Date | "pending" | null;

function later(a: WithholdingEnd, b: WithholdingEnd): WithholdingEnd {
  if (a === "pending" || b === "pending") return "pending";
  if (!a) return b;
  if (!b) return a;
  return a.getTime() >= b.getTime() ? a : b;
}

export function animalWithholding(treatments: AnimalTreatment[], now: Date = new Date()): { milk: WithholdingEnd; meat: WithholdingEnd } {
  let milk: WithholdingEnd = null;
  let meat: WithholdingEnd = null;
  for (const t of treatments) {
    if ((t as any).deletedAt) continue;
    const active = t.status === "active" && !t.awaitingTreatment;
    // Milk: only while the cow hasn't gone back in the vat
    if (active && !t.returnedToVatAt && (t.milkWithholdingHours ?? 0) > 0) {
      if (t.milkClearAt) {
        const at = new Date(t.milkClearAt);
        if (at.getTime() > now.getTime()) milk = later(milk, at);
      } else {
        milk = later(milk, "pending");
      }
    }
    // Meat: runs on after the treatment is finished
    if (t.meatClearAt) {
      const at = new Date(t.meatClearAt);
      if (at.getTime() > now.getTime()) meat = later(meat, at);
    } else if (active && (t.meatWithholdingHours ?? 0) > 0) {
      meat = later(meat, "pending");
    }
  }
  return { milk, meat };
}

export function withholdingLabel(kind: "milk" | "meat", end: WithholdingEnd): string | null {
  if (!end) return null;
  const what = kind === "milk" ? "Milk withheld" : "Not for slaughter";
  return end === "pending" ? `${what}: doses still to give` : `${what} until ${formatFarmTime(end)}`;
}

/** Where the quick "Medical" record opens: the treatment form, filled in for the animal */
export const medicalRecordHref = (animalId: string) => `/app/treatments/treatment?animal=${encodeURIComponent(animalId)}`;
