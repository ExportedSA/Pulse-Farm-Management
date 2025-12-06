import type { DraftDirection } from "./hardwareClient";

export type DraftRulePreview = {
  eid: string;
  direction: DraftDirection;
  reasons: string[];
  score: number;
};

export async function previewDraftRules(eid: string): Promise<DraftRulePreview> {
  const res = await fetch(
    `/api/hardware/draft/rules/preview?eid=${encodeURIComponent(eid)}`
  );
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}
