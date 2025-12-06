import { useCallback } from "react";
import { getHardwareHealth } from "../api/hardwareClient";
import { usePolling } from "./usePolling";

export function useHardwareHealth(pollMs: number = 5000) {
  const fetcher = useCallback(() => getHardwareHealth(), []);
  return usePolling<{ ok: boolean }>(fetcher, pollMs);
}
