// Shed hardware: bail feed, drafting gate and EID reads, through the farm's own gateway.
//
// A farm reaches hardware only through its active hardware_gateways row (migration 0038), which the
// service's operator adds; a farm without one gets 404. Farm staff (owner, manager, worker) can see
// status and reads; only owners and managers can send feed or gate commands, and every command is
// logged in hardware_commands. Contractors and viewers get nothing.
//
// Draft rules and feed levels (set here, sent to a farm's Stride over the shed link) don't need a
// gateway: a farm can set them up before Stride is connected. Staff can read them; owners and
// managers change them.
import { Router, type Request, type Response, type NextFunction } from "express";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { getFarmId, getUserId } from "../middleware/auth";
import { getFarmRole } from "../domain/farms";
import { hardwareCommands, hardwareGateways, shedDraftRules, shedEvents, shedFeedLevels } from "@shared/platform-schema";
import { compileSnapshotHere, draftRuleInput, draftRuleValues, feedLevelInput } from "../domain/shed";
import { shedLink } from "../shed-link";
import logger from "../config/logger";
import { fetchStatus, getHardwareHealth, startBailFeed, stopBailFeed } from "../services/feedService";
import { executeDraft } from "../services/draftGateService";
import { getRecentEids } from "../services/eidReaderService";
import { previewDraftForEid } from "../services/draftRuleInspector";
import { isDemoMode, setDemoMode } from "../config/demoMode";
import { DraftDirection, FarmGateway } from "../types/hardware";

export const hardwareRouter = Router();

const SHED_ROLES = ["owner", "manager", "worker"];
const COMMAND_ROLES = ["owner", "manager"];

type ShedRequest = Request & { gateway?: FarmGateway; farmRole?: string };

// Demo mode switches every gateway on the server to the simulator, so only the service's operator
// may change it: PULSE_DEMO_ADMIN_TOKEN must be set and sent. Unset means nobody can.
function isDemoAdmin(req: Request): boolean {
  const required = process.env.PULSE_DEMO_ADMIN_TOKEN;
  if (!required) return false;
  const provided = req.header("x-demo-admin-token");
  return Boolean(provided && provided === required);
}

// Demo mode – GET
hardwareRouter.get("/demo-mode", (req, res) => {
  res.json({ demo: isDemoMode(), canToggle: isDemoAdmin(req) });
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
  res.json({ demo: isDemoMode(), canToggle: true });
});

// ── Draft rules and feed levels ──

async function farmRole(req: Request): Promise<string | undefined> {
  const farmId = getFarmId(req);
  const userId = getUserId(req);
  return farmId && userId ? getFarmRole(userId, farmId) : undefined;
}

const staffOnly = async (req: Request, res: Response, next: NextFunction) => {
  const role = await farmRole(req).catch(() => undefined);
  if (!role || !SHED_ROLES.includes(role)) return res.status(403).json({ error: "Only farm staff can see the shed set-up" });
  next();
};
const managersOnly = async (req: Request, res: Response, next: NextFunction) => {
  const role = await farmRole(req).catch(() => undefined);
  if (!role || !COMMAND_ROLES.includes(role)) {
    return res.status(403).json({ error: "Only owners and managers can change draft rules and feed levels" });
  }
  next();
};

const route = (fn: (req: Request, res: Response) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      await fn(req, res);
    } catch (e: any) {
      if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors[0]?.message ?? "Invalid request" });
      if (e?.code === "P0403" || e?.code === "42501") return res.status(403).json({ error: "That belongs to another farm" });
      if (e?.code === "23503") return res.status(400).json({ error: "That animal or group doesn't exist" });
      logger.error({ err: e }, "Shed set-up request failed");
      res.status(500).json({ error: "Something went wrong" });
    }
  };

// After a change, the farm's Stride gets the new lists straight away (when it's connected)
const refresh = (req: Request) => {
  void shedLink.refreshFarm(getFarmId(req)!).catch(err => logger.warn({ err }, "Shed link refresh failed"));
};

hardwareRouter.get("/draft-rules", staffOnly, route(async (_req, res) => {
  res.json(await db.select().from(shedDraftRules).orderBy(desc(shedDraftRules.priority), asc(shedDraftRules.createdAt)));
}));

hardwareRouter.post("/draft-rules", managersOnly, route(async (req, res) => {
  const values = draftRuleValues(draftRuleInput.parse(req.body));
  const [row] = await db.insert(shedDraftRules).values({ ...values, farmId: getFarmId(req)! }).returning();
  refresh(req);
  res.status(201).json(row);
}));

hardwareRouter.put("/draft-rules/:id", managersOnly, route(async (req, res) => {
  const values = draftRuleValues(draftRuleInput.parse(req.body));
  const [row] = await db.update(shedDraftRules).set({ ...values, updatedAt: new Date() })
    .where(eq(shedDraftRules.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: "Draft rule not found" });
  refresh(req);
  res.json(row);
}));

hardwareRouter.delete("/draft-rules/:id", managersOnly, route(async (req, res) => {
  const [row] = await db.delete(shedDraftRules).where(eq(shedDraftRules.id, req.params.id)).returning({ id: shedDraftRules.id });
  if (!row) return res.status(404).json({ error: "Draft rule not found" });
  refresh(req);
  res.status(204).send();
}));

hardwareRouter.get("/feed-levels", staffOnly, route(async (_req, res) => {
  res.json(await db.select().from(shedFeedLevels).orderBy(desc(shedFeedLevels.priority), desc(shedFeedLevels.createdAt)));
}));

const levelValues = (input: z.infer<typeof feedLevelInput>) => ({
  animalId: input.animalId ?? null,
  groupId: input.groupId ?? null,
  gramsPerVisit: input.gramsPerVisit,
  priority: input.priority,
  enabled: input.enabled,
  validFrom: input.validFrom ?? null,
  validTo: input.validTo ?? null,
  note: input.note ?? null,
});

hardwareRouter.post("/feed-levels", managersOnly, route(async (req, res) => {
  const values = levelValues(feedLevelInput.parse(req.body));
  const [row] = await db.insert(shedFeedLevels).values({ ...values, farmId: getFarmId(req)! }).returning();
  refresh(req);
  res.status(201).json(row);
}));

hardwareRouter.put("/feed-levels/:id", managersOnly, route(async (req, res) => {
  const values = levelValues(feedLevelInput.parse(req.body));
  const [row] = await db.update(shedFeedLevels).set({ ...values, updatedAt: new Date() })
    .where(eq(shedFeedLevels.id, req.params.id)).returning();
  if (!row) return res.status(404).json({ error: "Feed level not found" });
  refresh(req);
  res.json(row);
}));

hardwareRouter.delete("/feed-levels/:id", managersOnly, route(async (req, res) => {
  const [row] = await db.delete(shedFeedLevels).where(eq(shedFeedLevels.id, req.params.id)).returning({ id: shedFeedLevels.id });
  if (!row) return res.status(404).json({ error: "Feed level not found" });
  refresh(req);
  res.status(204).send();
}));

// What the farm's Stride is (or would be) sent right now: who drafts where, and grams per visit
hardwareRouter.get("/snapshot", managersOnly, route(async (_req, res) => {
  res.json(await compileSnapshotHere());
}));

// Everything below works with the signed-in person's farm and that farm's gateway only
async function farmGateway(req: ShedRequest, res: Response, next: NextFunction) {
  const farmId = getFarmId(req);
  const userId = getUserId(req);
  if (!farmId || !userId) return res.status(403).json({ error: "No farm selected" });
  try {
    const role = await getFarmRole(userId, farmId);
    if (!role || !SHED_ROLES.includes(role)) {
      return res.status(403).json({ error: "Only farm staff can use the shed hardware" });
    }
    const [gateway] = await db
      .select({ id: hardwareGateways.id, baseUrl: hardwareGateways.baseUrl, simulated: hardwareGateways.simulated, kind: hardwareGateways.kind })
      .from(hardwareGateways)
      .where(and(eq(hardwareGateways.farmId, farmId), eq(hardwareGateways.isActive, true)))
      .limit(1);
    if (!gateway) {
      return res.status(404).json({ error: "No shed hardware is set up for this farm", code: "no_gateway" });
    }
    req.gateway = gateway;
    req.farmRole = role;
    next();
  } catch (e) {
    next(e);
  }
}

function commandRole(req: ShedRequest, res: Response, next: NextFunction) {
  if (!COMMAND_ROLES.includes(req.farmRole ?? "")) {
    return res.status(403).json({ error: "Only owners and managers can send commands to the shed hardware" });
  }
  next();
}

// Every command that reaches the gateway is logged, whether or not it worked
async function logCommand(req: ShedRequest, command: string, params: Record<string, unknown>, ok: boolean, error?: string) {
  try {
    await db.insert(hardwareCommands).values({
      farmId: getFarmId(req)!,
      gatewayId: req.gateway!.id,
      userId: getUserId(req) ?? null,
      command,
      params,
      ok,
      error: error ?? null,
    });
  } catch (e) {
    logger.error({ err: e, command }, "Could not log a shed hardware command");
  }
}

hardwareRouter.use(farmGateway);

// Health
hardwareRouter.get("/health", async (req: ShedRequest, res) => {
  try {
    res.json(await getHardwareHealth(req.gateway!));
  } catch (e: any) {
    res.status(503).json({ ok: false, error: e?.message ?? "unreachable" });
  }
});

// Status
hardwareRouter.get("/status", async (req: ShedRequest, res) => {
  try {
    res.json(await fetchStatus(req.gateway!));
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? "status failed" });
  }
});

// Feed start
hardwareRouter.post("/feed/start", commandRole, async (req: ShedRequest, res) => {
  const bail = Number(req.query.bail ?? req.body?.bail);
  const grams = Number(req.query.grams ?? req.body?.grams);

  if (!Number.isFinite(bail) || !Number.isFinite(grams)) {
    return res.status(400).json({ error: "bail and grams are required" });
  }

  try {
    const result = await startBailFeed(req.gateway!, bail, grams);
    await logCommand(req, "feed_start", { bail, grams }, true);
    res.json({ ok: true, result });
  } catch (e: any) {
    const error = e?.message ?? "feed failed";
    await logCommand(req, "feed_start", { bail, grams }, false, error);
    res.status(400).json({ ok: false, error });
  }
});

// Feed stop
hardwareRouter.post("/feed/stop", commandRole, async (req: ShedRequest, res) => {
  const bail = Number(req.query.bail ?? req.body?.bail);

  if (!Number.isFinite(bail)) {
    return res.status(400).json({ error: "bail is required" });
  }

  try {
    const result = await stopBailFeed(req.gateway!, bail);
    await logCommand(req, "feed_stop", { bail }, true);
    res.json({ ok: true, result });
  } catch (e: any) {
    const error = e?.message ?? "stop failed";
    await logCommand(req, "feed_stop", { bail }, false, error);
    res.status(400).json({ ok: false, error });
  }
});

// Draft command
hardwareRouter.post("/draft", commandRole, async (req: ShedRequest, res) => {
  const direction = req.body?.direction as DraftDirection;
  if (!["left", "right", "straight"].includes(direction)) {
    return res.status(400).json({ error: "invalid direction" });
  }

  try {
    const result = await executeDraft(req.gateway!, direction);
    await logCommand(req, "draft", { direction }, true);
    res.json({ ok: true, result });
  } catch (e: any) {
    const error = e?.message ?? "draft failed";
    await logCommand(req, "draft", { direction }, false, error);
    res.status(400).json({ ok: false, error });
  }
});

// The command log, newest first
hardwareRouter.get("/commands", commandRole, async (req: ShedRequest, res, next) => {
  try {
    const rows = await db
      .select()
      .from(hardwareCommands)
      .where(eq(hardwareCommands.farmId, getFarmId(req)!))
      .orderBy(desc(hardwareCommands.createdAt))
      .limit(100);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Recent EIDs: a Stride gateway's are the reads it reported; others come from the gateway
hardwareRouter.get("/eid/recent", async (req: ShedRequest, res, next) => {
  try {
    if (req.gateway!.kind === "stride" && !req.gateway!.simulated) {
      const rows = await db.select({ eid: shedEvents.eid, at: shedEvents.occurredAt }).from(shedEvents)
        .where(and(eq(shedEvents.kind, "eid"), eq(shedEvents.gatewayId, req.gateway!.id)))
        .orderBy(desc(shedEvents.occurredAt)).limit(50);
      return res.json(rows.filter(r => r.eid).map(r => ({ eid: r.eid, timestamp: new Date(r.at).toISOString() })));
    }
    res.json(getRecentEids(req.gateway!));
  } catch (e) {
    next(e);
  }
});

// What happened in the shed: drafts, feeds and reads Stride reported (default: the last 24 hours)
hardwareRouter.get("/events", async (req: ShedRequest, res, next) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 24, 1), 24 * 31);
    const rows = await db.select().from(shedEvents)
      .where(gte(shedEvents.occurredAt, new Date(Date.now() - hours * 3600_000)))
      .orderBy(desc(shedEvents.occurredAt)).limit(500);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Draft rule preview
hardwareRouter.get("/draft/rules/preview", (req, res) => {
  const eid = String(req.query.eid || "").trim();
  if (!eid) {
    return res.status(400).json({ error: "eid is required" });
  }
  res.json(previewDraftForEid(eid));
});
