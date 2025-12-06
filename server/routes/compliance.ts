import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.get("/hazards", async (req, res) => {
  try {
    const hazards = await prisma.pulseHazard.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(hazards);
  } catch (error) {
    console.error("Failed to fetch hazards:", error);
    res.status(500).json({ error: "Failed to fetch hazards" });
  }
});

router.post("/hazards", async (req, res) => {
  try {
    const userId = (req.user as any)?.id || "demo-user";
    const { title, description, type, riskLevel } = req.body;
    
    const hazard = await prisma.pulseHazard.create({
      data: { title, description, type, riskLevel, createdById: userId },
    });
    
    res.json(hazard);
  } catch (error) {
    console.error("Failed to create hazard:", error);
    res.status(500).json({ error: "Failed to create hazard" });
  }
});

router.post("/hazards/:id/resolve", async (req, res) => {
  try {
    const hazard = await prisma.pulseHazard.update({
      where: { id: req.params.id },
      data: { active: false, resolvedAt: new Date() },
    });
    res.json(hazard);
  } catch (error) {
    res.status(500).json({ error: "Failed to resolve hazard" });
  }
});

router.get("/incidents", async (req, res) => {
  try {
    const incidents = await prisma.pulseIncident.findMany({
      orderBy: { occurredAt: "desc" },
    });
    res.json(incidents);
  } catch (error) {
    console.error("Failed to fetch incidents:", error);
    res.status(500).json({ error: "Failed to fetch incidents" });
  }
});

router.post("/incidents", async (req, res) => {
  try {
    const { type, description, severity, occurredAt } = req.body;
    
    const incident = await prisma.pulseIncident.create({
      data: { type, description, severity, occurredAt: new Date(occurredAt) },
    });
    
    res.json(incident);
  } catch (error) {
    console.error("Failed to create incident:", error);
    res.status(500).json({ error: "Failed to create incident" });
  }
});

router.patch("/incidents/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const incident = await prisma.pulseIncident.update({
      where: { id: req.params.id },
      data: { status },
    });
    res.json(incident);
  } catch (error) {
    res.status(500).json({ error: "Failed to update incident" });
  }
});

export default router;
