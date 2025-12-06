export type DraftDirection = "left" | "right" | "straight";

export type HardwareStatus = {
  b1?: { actual: number; target: number; state: number };
  b2?: { actual: number; target: number; state: number };
};

export type EidEvent = {
  eid: string;
  timestamp: string;
};

export type DemoModeInfo = {
  demo: boolean;
  canToggle: boolean;
};

async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  return res.json() as Promise<T>;
}

export async function getHardwareHealth(): Promise<{ ok: boolean }> {
  const res = await fetch("/api/hardware/health");
  return handleJson(res);
}

export async function getHardwareStatus(): Promise<HardwareStatus> {
  const res = await fetch("/api/hardware/status");
  return handleJson(res);
}

export async function startFeed(bail: number, grams: number) {
  const res = await fetch(
    `/api/hardware/feed/start?bail=${bail}&grams=${grams}`,
    { method: "POST" }
  );
  return handleJson(res);
}

export async function stopFeed(bail: number) {
  const res = await fetch(`/api/hardware/feed/stop?bail=${bail}`, {
    method: "POST",
  });
  return handleJson(res);
}

export async function sendDraft(direction: DraftDirection) {
  const res = await fetch("/api/hardware/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ direction }),
  });
  return handleJson(res);
}

export async function getRecentEids(): Promise<EidEvent[]> {
  const res = await fetch("/api/hardware/eid/recent");
  if (res.status === 404) return [];
  return handleJson(res);
}

export async function getDemoMode(): Promise<DemoModeInfo> {
  const res = await fetch("/api/hardware/demo-mode");
  return handleJson(res);
}

const DEMO_ADMIN_TOKEN = (import.meta as any).env?.VITE_DEMO_ADMIN_TOKEN;

export async function setDemoMode(demo: boolean): Promise<DemoModeInfo> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (DEMO_ADMIN_TOKEN) headers["x-demo-admin-token"] = DEMO_ADMIN_TOKEN;
  const res = await fetch("/api/hardware/demo-mode", {
    method: "POST",
    headers,
    body: JSON.stringify({ demo }),
  });
  return handleJson(res);
}
