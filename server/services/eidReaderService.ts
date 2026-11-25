import { EidEvent, FarmGateway } from "../types/hardware";
import { subscribeEidEvents } from "../hardware/eidReaderBridge";
import { gatewayUrl } from "../hardware/coreGatewayBridge";
import { simGetRecentEids } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";

const MAX_BUFFER = 200;
// Recent reads kept per gateway, so a farm only ever sees its own gateway's tags. A gateway is
// listened to from the first time its farm asks.
const buffers = new Map<string, EidEvent[]>();

function bufferFor(baseUrl: string | null): EidEvent[] {
  const key = gatewayUrl(baseUrl);
  let buffer = buffers.get(key);
  if (!buffer) {
    const events: EidEvent[] = [];
    buffers.set(key, events);
    subscribeEidEvents((evt) => {
      events.unshift(evt);
      if (events.length > MAX_BUFFER) events.pop();
    }, baseUrl);
    buffer = events;
  }
  return buffer;
}

export function getRecentEids(gw: FarmGateway): EidEvent[] {
  if (gw.simulated || isDemoMode()) return simGetRecentEids();
  return bufferFor(gw.baseUrl);
}
