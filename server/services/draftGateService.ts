import { sendDraftCommand, subscribeDraftEvents } from "../hardware/draftGateBridge";
import { DraftDirection } from "../types/hardware";
import { simExecuteDraft } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";

const DEMO = () => isDemoMode();

export async function executeDraft(direction: DraftDirection) {
  if (DEMO()) return simExecuteDraft(direction);
  return sendDraftCommand(direction);
}

export function onDraftEvent(cb: (evt: any) => void) {
  return subscribeDraftEvents(cb);
}
