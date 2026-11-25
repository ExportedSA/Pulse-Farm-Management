import { gatewaySubscribe } from "./coreGatewayBridge";
import { EidEvent } from "../types/hardware";

export function subscribeEidEvents(cb: (event: EidEvent) => void, baseUrl?: string | null) {
  return gatewaySubscribe("eid", (data) => cb(data as EidEvent), baseUrl);
}
