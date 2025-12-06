import { Router } from "express";
import { fetchStatus, getHardwareHealth, startBailFeed, stopBailFeed } from "../services/feedService";
import { executeDraft } from "../services/draftGateService";
import { getRecentEids } from "../services/eidReaderService";
import { previewDraftForEid } from "../services/draftRuleInspector";
import { isDemoMode, setDemoMode } from "../config/demoMode";
import { DraftDirection } from "../types/hardware";

export const hardwareRouter = Router();

function isDemoAdmin(req: any): boolean {
  const required = process.env.PULSE_DEMO_ADMIN_TOKEN;
  if (!required) return true;
  const provided = req.header("x-demo-admin-token");
  return Boolean(provided && provided === required);
}

// Health
hardwareRouter.get("/health", async (_req, res) => {
  try {
    const health = await getHardwareHealth();
    res.json(health);
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e?.message ?? "unreachable" });
  }
});

// Status
hardwareRouter.get("/status", async (_req, res) => {
  try {
    const status = await fetchStatus();
    res.json(status);
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "status failed" });
  }
});

// Feed start
hardwareRouter.post("/feed/start", async (req, res) => {
  const bail = Number(req.query.bail ?? req.body?.bail);
  const grams = Number(req.query.grams ?? req.body?.grams);

  if (!Number.isFinite(bail) || !Number.isFinite(grams)) {
    return res.status(400).json({ error: "bail and grams are required" });
  }

  try {
    const result = await startBailFeed(bail, grams);
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? "feed failed" });
  }
});

// Feed stop
hardwareRouter.post("/feed/stop", async (req, res) => {
  const bail = Number(req.query.bail ?? req.body?.bail);

  if (!Number.isFinite(bail)) {
    return res.status(400).json({ error: "bail is required" });
  }

  try {
    const result = await stopBailFeed(bail);
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? "stop failed" });
  }
});

// Draft command
hardwareRouter.post("/draft", async (req, res) => {
  const direction = req.body?.direction as DraftDirection;
  if (!["left", "right", "straight"].includes(direction)) {
    return res.status(400).json({ error: "invalid direction" });
  }

  try {
    const result = await executeDraft(direction);
    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e?.message ?? "draft failed" });
  }
});

// Recent EIDs
hardwareRouter.get("/eid/recent", (_req, res) => {
  const events = getRecentEids();
  res.json(events);
});

// Draft rule preview
hardwareRouter.get("/draft/rules/preview", (req, res) => {
  const eid = String(req.query.eid || "").trim();
  if (!eid) {
    return res.status(400).json({ error: "eid is required" });
  }
  const preview = previewDraftForEid(eid);
  res.json(preview);
});

// Demo mode – GET
hardwareRouter.get("/demo-mode", (req, res) => {
  const demo = isDemoMode();
  const canToggle = isDemoAdmin(req);
  res.json({ demo, canToggle });
});

// Demo mode – POST
hardwareRouter.post("/demo-mode", (req, res) => {
  if (!isDemoAdmin(req)) {
    return res.status(403).json({ error: "not allowed to change demo mode" });
  }
  const bodyDemo = req.body?.demo;
  if (typeof bodyDemo !== "boolean") {
    return res.status(400).json({ error: "demo (boolean) is required" });
  }
  setDemoMode(bodyDemo);
  res.json({ demo: isDemoMode() });
});
