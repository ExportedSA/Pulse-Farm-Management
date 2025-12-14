import WebSocket from "ws";
import { log } from "../logger";

const GATEWAY_URL = process.env.PULSE_GATEWAY_URL || "http://localhost:8000";
const WS_URL = GATEWAY_URL.replace("http", "ws") + "/ws";

const isBackendOnly = process.env.BACKEND_ONLY === "1" || process.env.BACKEND_ONLY === "true";
const isSimMode = process.env.PULSE_SIM_MODE === "1" || process.env.PULSE_SIM_MODE === "true";

export async function gatewayGet<T = any>(path: string): Promise<T> {
  const res = await fetch(GATEWAY_URL + path);
  if (!res.ok) {
    throw new Error(`GET ${path} failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function gatewayPost<T = any>(
  path: string,
  body?: any
): Promise<T> {
  const res = await fetch(GATEWAY_URL + path, {
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
  onMessage: (data: any) => void
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

  const ws = new WebSocket(WS_URL);

  ws.on("open", () => {
    log(`[gateway-ws] connected ${WS_URL} (type=${expectedType})`);
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
