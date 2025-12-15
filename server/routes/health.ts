import { Router } from "express";
import { pool } from "../db";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: process.env.npm_package_version ?? "unknown",
    env: process.env.NODE_ENV ?? "development",
    time: new Date().toISOString(),
  });
});

router.get("/health/db", async (_req, res) => {
  try {
    const result = await pool.query("select 1");
    res.json({ ok: true, result: result.rows?.[0] ?? null });
  } catch (error: any) {
    console.error("DB health check failed:", error);
    res.status(500).json({ ok: false, error: String(error?.message ?? error) });
  }
});

export default router;
