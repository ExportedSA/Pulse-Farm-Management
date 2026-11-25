import { gatewayGet, gatewayPost } from "../hardware/coreGatewayBridge";
import { simGetStatus, simGetHealth, simStartFeed, simStopFeed } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";
import { FarmGateway, HardwareStatus } from "../types/hardware";

// The simulator stands in for a farm's gateway marked simulated, or for every gateway in demo mode
const simulated = (gw: FarmGateway) => gw.simulated || isDemoMode();

export async function getHardwareHealth(gw: FarmGateway): Promise<{ ok: boolean }> {
  if (simulated(gw)) return simGetHealth();
  return gatewayGet<{ ok: boolean }>("/health", gw.baseUrl);
}

export async function fetchStatus(gw: FarmGateway): Promise<HardwareStatus> {
  if (simulated(gw)) return simGetStatus();
  return gatewayGet<HardwareStatus>("/status", gw.baseUrl);
}

export async function startBailFeed(gw: FarmGateway, bail: number, grams: number) {
  if (grams <= 0) throw new Error("grams must be > 0");
  if (simulated(gw)) return simStartFeed(bail, grams);
  return gatewayPost("/feed/start", { bail, grams }, gw.baseUrl);
}

export async function stopBailFeed(gw: FarmGateway, bail: number) {
  if (simulated(gw)) return simStopFeed(bail);
  return gatewayPost("/feed/stop", { bail }, gw.baseUrl);
}
