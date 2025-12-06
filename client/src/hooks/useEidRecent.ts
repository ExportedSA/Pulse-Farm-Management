import { useCallback } from "react";
import { getRecentEids, EidEvent } from "../api/hardwareClient";
import { usePolling } from "./usePolling";

export function useEidRecent(pollMs: number = 1000) {
  const fetcher = useCallback(() => getRecentEids(), []);
  return usePolling<EidEvent[]>(fetcher, pollMs);
}
