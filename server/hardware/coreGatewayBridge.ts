import WebSocket from "ws";

const GATEWAY_URL = process.env.PULSE_GATEWAY_URL || "http://localhost:8000";
const WS_URL = GATEWAY_URL.replace("http", "ws") + "/ws";

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
  const ws = new WebSocket(WS_URL);

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
