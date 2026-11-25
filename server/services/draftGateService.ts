import { sendDraftCommand, subscribeDraftEvents } from "../hardware/draftGateBridge";
import { DraftDirection, FarmGateway } from "../types/hardware";
import { simExecuteDraft } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";

export async function executeDraft(gw: FarmGateway, direction: DraftDirection) {
  if (gw.simulated || isDemoMode()) return simExecuteDraft(direction);
  return sendDraftCommand(direction, gw.baseUrl);
}

export function onDraftEvent(gw: FarmGateway, cb: (evt: any) => void) {
  return subscribeDraftEvents(cb, gw.baseUrl);
}
