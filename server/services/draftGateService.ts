import { sendDraftCommand, subscribeDraftEvents } from "../hardware/draftGateBridge";
import { DraftDirection, FarmGateway } from "../types/hardware";
import { simExecuteDraft } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";
import { shedLink } from "../shed-link";

const LANE = { left: "LEFT", right: "RIGHT", straight: "STRAIGHT" } as const;

export async function executeDraft(gw: FarmGateway, direction: DraftDirection) {
  if (gw.kind === "stride" && !gw.simulated) {
    // Stride decides whether it's safe: it won't move the gate with a cow in the race
    const result = await shedLink.sendCommand(gw.id, { action: "draft", lane: LANE[direction] });
    if (!result.ok) throw new Error(result.error || "Stride refused the command");
    return result;
  }
  if (gw.simulated || isDemoMode()) return simExecuteDraft(direction);
  return sendDraftCommand(direction, gw.baseUrl);
}

export function onDraftEvent(gw: FarmGateway, cb: (evt: any) => void) {
  return subscribeDraftEvents(cb, gw.baseUrl);
}
