import { gatewayPost, gatewaySubscribe } from "./coreGatewayBridge";
import { DraftDirection } from "../types/hardware";

export async function sendDraftCommand(direction: DraftDirection) {
  return gatewayPost("/draft", { direction });
}

export function subscribeDraftEvents(cb: (event: any) => void) {
  return gatewaySubscribe("draft-events", cb);
}
