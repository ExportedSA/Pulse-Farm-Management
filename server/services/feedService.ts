import { gatewayGet, gatewayPost } from "../hardware/coreGatewayBridge";
import { simGetStatus, simGetHealth, simStartFeed, simStopFeed } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";
import { shedLink } from "../shed-link";
import { FarmGateway, HardwareStatus } from "../types/hardware";

// A Stride gateway is reached through the shed link Stride keeps open (Stride has its own demo mode).
// Otherwise the simulator stands in for a gateway marked simulated, or for every gateway Pulse calls
// while demo mode is on; else Pulse calls the gateway.
const stride = (gw: FarmGateway) => gw.kind === "stride" && !gw.simulated;
const simulated = (gw: FarmGateway) => !stride(gw) && (gw.simulated || isDemoMode());

async function strideCommand(gw: FarmGateway, command: Parameters<typeof shedLink.sendCommand>[1]) {
  const result = await shedLink.sendCommand(gw.id, command);
  if (!result.ok) throw new Error(result.error || "Stride refused the command");
  return result;
}

export async function getHardwareHealth(gw: FarmGateway): Promise<{ ok: boolean; link?: unknown }> {
  if (simulated(gw)) return simGetHealth();
  if (stride(gw)) {
    const link = shedLink.info(gw.id);
    return { ok: link.connected, link };
  }
  return gatewayGet<{ ok: boolean }>("/health", gw.baseUrl);
}

export async function fetchStatus(gw: FarmGateway): Promise<HardwareStatus> {
  if (simulated(gw)) return simGetStatus();
  if (stride(gw)) {
    // Stride reports its bails as they change; shown in the same shape as the gateway's status
    const status: HardwareStatus = {};
    for (const b of shedLink.info(gw.id).status?.bails ?? []) {
      const row = { actual: b.actualGrams, target: b.targetGrams, state: b.feeding ? 1 : 0 };
      if (b.bail === 1) status.b1 = row;
      if (b.bail === 2) status.b2 = row;
    }
    return status;
  }
  return gatewayGet<HardwareStatus>("/status", gw.baseUrl);
}

export async function startBailFeed(gw: FarmGateway, bail: number, grams: number) {
  if (grams <= 0) throw new Error("grams must be > 0");
  if (simulated(gw)) return simStartFeed(bail, grams);
  if (stride(gw)) return strideCommand(gw, { action: "feed_start", bail, grams });
  return gatewayPost("/feed/start", { bail, grams }, gw.baseUrl);
}

export async function stopBailFeed(gw: FarmGateway, bail: number) {
  if (simulated(gw)) return simStopFeed(bail);
  if (stride(gw)) return strideCommand(gw, { action: "feed_stop", bail });
  return gatewayPost("/feed/stop", { bail }, gw.baseUrl);
}
