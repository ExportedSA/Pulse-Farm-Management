import { useCallback } from "react";
import { getHardwareStatus, HardwareStatus } from "../api/hardwareClient";
import { usePolling } from "./usePolling";

export function useHardwareStatus(pollMs: number = 1000) {
  const fetcher = useCallback(() => getHardwareStatus(), []);
  return usePolling<HardwareStatus>(fetcher, pollMs);
}
