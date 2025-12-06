import { gatewayGet, gatewayPost } from "../hardware/coreGatewayBridge";
import { simGetStatus, simGetHealth, simStartFeed, simStopFeed } from "../sim/hardwareSimulator";
import { isDemoMode } from "../config/demoMode";
import { HardwareStatus } from "../types/hardware";

const DEMO = () => isDemoMode();

export async function getHardwareHealth(): Promise<{ ok: boolean }> {
  if (DEMO()) return simGetHealth();
  return gatewayGet<{ ok: boolean }>("/health");
}

export async function fetchStatus(): Promise<HardwareStatus> {
  if (DEMO()) {
    return simGetStatus();
  }
  return gatewayGet<HardwareStatus>("/status");
}

export async function startBailFeed(bail: number, grams: number) {
  if (grams <= 0) throw new Error("grams must be > 0");
  if (DEMO()) return simStartFeed(bail, grams);
  return gatewayPost("/feed/start", { bail, grams });
}

export async function stopBailFeed(bail: number) {
  if (DEMO()) return simStopFeed(bail);
  return gatewayPost("/feed/stop", { bail });
}
