import WebSocket from "ws";
import { log } from "../logger";

// The server's own gateway. A farm reaches it only through its hardware_gateways row (base_url NULL);
// a row with a base_url uses that gateway instead.
const DEFAULT_GATEWAY_URL = process.env.PULSE_GATEWAY_URL || "http://localhost:8000";

const isBackendOnly = process.env.BACKEND_ONLY === "1" || process.env.BACKEND_ONLY === "true";
const isSimMode = process.env.PULSE_SIM_MODE === "1" || process.env.PULSE_SIM_MODE === "true";

/** The gateway address for a farm's row: its own base_url, or the server's gateway */
export function gatewayUrl(baseUrl?: string | null): string {
  return (baseUrl || DEFAULT_GATEWAY_URL).replace(/\/+$/, "");
}

export async function gatewayGet<T = any>(path: string, baseUrl?: string | null): Promise<T> {
  const res = await fetch(gatewayUrl(baseUrl) + path);
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function gatewayPost<T = any>(
  path: string,
  body?: any,
  baseUrl?: string | null
): Promise<T> {
  const res = await fetch(gatewayUrl(baseUrl) + path, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`POST ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function gatewaySubscribe(
  expectedType: string,
  onMessage: (data: any) => void,
  baseUrl?: string | null
): WebSocket {
  // In backend-only or simulation mode, do not attempt to connect to the gateway.
  if (isBackendOnly || isSimMode) {
    log(`[gateway-ws] skipping connection in backend-only/sim mode (type=${expectedType})`);
    const dummy: any = {
      on: () => dummy,
      close: () => undefined,
    };
    return dummy as WebSocket;
  }

  const wsUrl = gatewayUrl(baseUrl).replace(/^http/, "ws") + "/ws";
  const ws = new WebSocket(wsUrl);

  ws.on("open", () => {
    log(`[gateway-ws] connected ${wsUrl} (type=${expectedType})`);
  });

  ws.on("error", (err) => {
    // Prevent ECONNREFUSED and similar from crashing the process
    log(`[gateway-ws] error (type=${expectedType}): ${String((err as any)?.message ?? err)}`);
  });

  ws.on("close", (code, reason) => {
    log(`[gateway-ws] closed (type=${expectedType}): code=${code} reason=${reason?.toString?.() ?? ""}`);
  });

  ws.on("message", (raw) => {
    try {
      const parsed = JSON.parse(raw.toString());
      if (parsed.type === expectedType) {
        onMessage(parsed.data);
      }
    } catch {
      // ignore malformed
    }
  });

  return ws;
}
