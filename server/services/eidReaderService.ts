import { EidEvent } from "../types/hardware";
import { subscribeEidEvents } from "../hardware/eidReaderBridge";
import { simGetRecentEids } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";

const DEMO = () => isDemoMode();
const MAX_BUFFER = 200;
const buffer: EidEvent[] = [];

if (!DEMO()) {
  subscribeEidEvents((evt) => {
    buffer.unshift(evt);
    if (buffer.length > MAX_BUFFER) buffer.pop();
  });
}

export function getRecentEids(): EidEvent[] {
  if (DEMO()) return simGetRecentEids();
  return buffer;
}
