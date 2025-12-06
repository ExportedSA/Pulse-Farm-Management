import { DraftDirection } from "../types/hardware";

export type DraftRulePreview = {
  eid: string;
  direction: DraftDirection;
  reasons: string[];
  score: number;
};

export function previewDraftForEid(eid: string): DraftRulePreview {
  const reasons: string[] = [];
  let direction: DraftDirection = "straight";
  let score = 0;

  // Stub logic – you'll later plug in real rule engine
  if (eid.endsWith("2") || eid.endsWith("4")) {
    direction = "left";
    reasons.push("Matched 'Lame / Treatment' list");
    score += 50;
  }
  if (eid.endsWith("5")) {
    direction = "right";
    reasons.push("Matched 'Once-a-day' group");
    score += 40;
  }
  if (reasons.length === 0) {
    reasons.push("No matching rules — default lane");
  }

  return {
    eid,
    direction,
    reasons,
    score,
  };
}
