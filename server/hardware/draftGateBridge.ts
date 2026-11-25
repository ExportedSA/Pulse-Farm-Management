import { gatewayPost, gatewaySubscribe } from "./coreGatewayBridge";
import { DraftDirection } from "../types/hardware";

export async function sendDraftCommand(direction: DraftDirection, baseUrl?: string | null) {
  return gatewayPost("/draft", { direction }, baseUrl);
}

export function subscribeDraftEvents(cb: (event: any) => void, baseUrl?: string | null) {
  return gatewaySubscribe("draft-events", cb, baseUrl);
}
