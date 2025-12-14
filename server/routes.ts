import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { pool } from "./db";
import passport from "passport";
import { sanitizeUser, sanitizeUsers } from "./auth-utils";
import groupsRouter from "./routes/groups";
import { hardwareRouter } from "./routes/hardware";
import chatRouter from "./routes/chat";
import complianceRouter from "./routes/compliance";
import jobsRouter from "./routes/jobs";
import visitorRouter from "./visitor-routes";
import vehicleRouter from "./vehicle-routes";
import stockRouter from "./stock-routes";
import mapRouter from "./map-routes";
import financialRouter from "./financial-routes";
import milkRouter from "./milk-routes";
import budgetingRouter from "./budgeting-routes";
import nzfapRouter from "./nzfap-routes";
import weatherRouter from "./weather-routes";
import gallagherRouter from "./gallagher-routes";
import staffRouter from "./routes/staff";
import contractorsRouter from "./routes/contractors";
import recurringTasksRouter from "./routes/recurring-tasks";
import taskTemplatesRouter from "./routes/task-templates";
import notificationsRouter from "./routes/notifications";
import timeTrackingRouter from "./routes/time-tracking";
import equipmentRouter from "./routes/equipment";
import taskDependenciesRouter from "./routes/task-dependencies";
import complianceTagsRouter from "./routes/compliance-tags";
import weightRouter from "./routes/weight";
import vaccinationRouter from "./routes/vaccination";
import healthMonitoringRouter from "./routes/health-monitoring";
import reproductionRouter from "./routes/reproduction";
import veterinaryRouter from "./routes/veterinary";
import healthAnalyticsRouter from "./routes/health-analytics";
import mobileFeaturesRouter from "./routes/mobile-features";
import smartAlertsRouter from "./routes/smart-alerts";
import photosRouter from "./routes/photos";
import voiceNotesRouter from "./routes/voice-notes";
import naitRouter from "./routes/nait";
import stockTransactionsRouter from "./routes/stock-transactions";
import bulkOperationsRouter from "./routes/bulk-operations";
import animalTimelineRouter from "./routes/animal-timeline";
import lineageRouter from "./routes/lineage";
import herdReportsRouter from "./routes/herd-reports";
import pastureWalksRouter from "./routes/pasture-walks";
import rosterRouter from "./routes/roster";
import healthSafetyRouter from "./routes/health-safety";
import financialAnalyticsRouter from "./routes/financial-analytics";
import benchmarkingRouter from "./routes/benchmarking";
import reportsRouter from "./routes/reports";
import externalApisRouter from "./routes/external-apis";
import iotRouter from "./routes/iot";
import multiFarmRouter from "./routes/multi-farm";
import animalTagsRouter from "./routes/animal-tags";
// Phase overlay routes
import medCoreRouter from "./routes/med.core";
import medWithholdRouter from "./routes/med.withhold";
import medWithholdIdsRouter from "./routes/med.withhold.ids";
import reproExtrasRouter from "./routes/repro.extras";
import reproPlanRouter from "./routes/repro.plan";
import syncCoreRouter from "./routes/sync.core";
import naitCoreRouter from "./routes/nait.core";
import { z } from "zod";
import {
  insertUserSchema,
  insertProductSchema,
  insertProductBatchSchema,
  insertConditionSchema,
  insertAnimalSchema,
  insertPastureSchema,
  insertAnimalTreatmentSchema,
  insertReproductionEventSchema,
  insertNaitRecordSchema,
  insertMilkWithholdingSchema,
  insertPastureMovementSchema,
  insertPastureHealthRecordSchema,
  insertBatchLifecycleEventSchema,
  insertAlertSchema,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // ===== CORE HEALTH CHECKS =====
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      version: process.env.npm_package_version ?? "unknown",
      env: process.env.NODE_ENV ?? "development",
      time: new Date().toISOString(),
    });
  });

  app.get("/api/health/db", async (_req, res) => {
    try {
      const result = await pool.query("select 1");
      res.json({ ok: true, result: result.rows?.[0] ?? null });
    } catch (error: any) {
      console.error("DB health check failed:", error);
      res.status(500).json({ ok: false, error: String(error?.message ?? error) });
    }
  });

  // ===== PHASE 4: ANIMAL GROUPS =====
  app.use("/api/groups", groupsRouter);

  // ===== HEALTH TRACKING: WEIGHT MANAGEMENT =====
  app.use("/api/weight", weightRouter);

  // ===== VACCINATION & PREVENTIVE HEALTH =====
  app.use("/api/vaccination", vaccinationRouter);

  // ===== HEALTH MONITORING =====
  app.use("/api/health", healthMonitoringRouter);

  // ===== REPRODUCTION MANAGEMENT =====
  app.use("/api/reproduction", reproductionRouter);

  // ===== VETERINARY INTEGRATION =====
  app.use("/api/veterinary", veterinaryRouter);

  // ===== HEALTH ANALYTICS =====
  app.use("/api/analytics/health", healthAnalyticsRouter);

  // ===== FINANCIAL ANALYTICS =====
  app.use(financialAnalyticsRouter);

  // ===== BENCHMARKING =====
  app.use(benchmarkingRouter);

  // ===== REPORTS & PDF GENERATION =====
  app.use(reportsRouter);

  // ===== EXTERNAL API INTEGRATIONS (NAIT, Weather, LIC, Fonterra) =====
  app.use(externalApisRouter);

  // ===== IOT INTEGRATIONS =====
  app.use(iotRouter);

  // ===== MULTI-FARM MANAGEMENT =====
  app.use(multiFarmRouter);

  // ===== ANIMAL TAG MANAGEMENT =====
  app.use(animalTagsRouter);

  // ===== PHASE OVERLAY: MEDICINE & WITHHOLD =====
  app.use("/api/med", medCoreRouter);
  app.use("/api/med/withhold", medWithholdRouter);
  app.use("/api/med/withhold-ids", medWithholdIdsRouter);

  // ===== PHASE OVERLAY: REPRODUCTION EXTRAS =====
  app.use("/api/repro", reproExtrasRouter);
  app.use("/api/repro/plan", reproPlanRouter);

  // ===== PHASE OVERLAY: OFFLINE SYNC =====
  app.use("/api/sync", syncCoreRouter);

  // ===== PHASE OVERLAY: NAIT CORE =====
  app.use("/api/nait/core", naitCoreRouter);

  // ===== MOBILE & FIELD FEATURES =====
  app.use("/api/mobile", mobileFeaturesRouter);

  // ===== SMART ALERTS =====
  app.use("/api/alerts", smartAlertsRouter);

  // ===== PHOTO ATTACHMENTS =====
  app.use("/api/photos", photosRouter);

  // ===== VOICE NOTES =====
  app.use("/api/voice-notes", voiceNotesRouter);

  // ===== NAIT INTEGRATION =====
  app.use("/api/nait", naitRouter);

  // ===== STOCK TRANSACTIONS =====
  app.use("/api/stock", stockTransactionsRouter);

  // ===== BULK OPERATIONS =====
  app.use("/api/bulk", bulkOperationsRouter);

  // ===== ANIMAL TIMELINE =====
  app.use("/api/animals", animalTimelineRouter);

  // ===== LINEAGE/OFFSPRING =====
  app.use("/api/lineage", lineageRouter);

  // ===== HERD REPORTS =====
  app.use("/api/reports", herdReportsRouter);

  // ===== PASTURE WALKS =====
  app.use("/api/pasture-walks", pastureWalksRouter);

  // ===== HARDWARE MODULE =====
  app.use("/api/hardware", hardwareRouter);

  // ===== CHAT & COMPLIANCE =====
  app.use("/api/chat", chatRouter);
  app.use("/api/compliance", complianceRouter);
  
  // ===== JOBS =====
  app.use("/api/jobs", jobsRouter);

  // ===== VISITOR MANAGEMENT (PHASE 1) =====
  // Public visitor routes (no authentication required)
  app.use("/api/visitor", visitorRouter);
  
  // Vehicle Registry routes
  app.use("/api/vehicles", vehicleRouter);
  
  // Stock Reconciliation routes
  app.use("/api/stock", stockRouter);
  
  // Map & Task Pin routes
  app.use("/api/map", mapRouter);
  
  // Financial routes
  app.use("/api/financial", financialRouter);
  
  // Milk Production routes
  app.use("/api/milk", milkRouter);
  
  // Budgeting & Forecasting routes
  app.use("/api/budgeting", budgetingRouter);
  
  // NZFAP Compliance routes
  app.use("/api/nzfap", nzfapRouter);
  
  // Weather Integration routes
  app.use("/api/weather", weatherRouter);
  
  // Gallagher Weigh Scale Integration routes
  app.use("/api/gallagher", gallagherRouter);
  
  // Staff & Contractor Management routes
  app.use("/api/staff", staffRouter);
  app.use("/api/contractors", contractorsRouter);
  app.use("/api/roster", rosterRouter);
  
  // Health & Safety routes
  app.use("/api/health-safety", healthSafetyRouter);
  
  // Recurring Tasks routes
  app.use("/api/recurring-tasks", recurringTasksRouter);
  
  // Task Templates routes
  app.use("/api/task-templates", taskTemplatesRouter);
  
  // Notifications routes
  app.use("/api/notifications", notificationsRouter);
  
  // Time Tracking routes
  app.use("/api/time-tracking", timeTrackingRouter);
  
  // Equipment routes
  app.use("/api/equipment", equipmentRouter);
  
  // Task Dependencies routes
  app.use("/api/task-dependencies", taskDependenciesRouter);
  
  // Compliance Tags routes
  app.use("/api/compliance-tags", complianceTagsRouter);
  
  // Admin visitor routes (authentication required)
  app.use("/api/visitor/admin", passport.authenticate("session", { session: false }), visitorRouter);

  // ===== AUTH =====
  
  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.json({ user: sanitizeUser(req.user as any) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json({ user: sanitizeUser(req.user as any) });
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  // ===== USERS =====
  
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(sanitizeUsers(users));
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(sanitizeUser(user));
    } catch (error) {
      console.error("Failed to fetch user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      storage.createActivityLog({
        userId: (req.user as any)?.id ?? null,
        userName: (req.user as any)?.name || (req.user as any)?.email || "System",
        action: "create",
        resourceType: "user",
        resourceId: user.id,
        details: { name: user.name, email: user.email, role: (user as any).role },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
      }).catch((err: any) => {
        console.error("Failed to create activity log:", err);
      });
      res.status(201).json(sanitizeUser(user));
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const data = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, data);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      storage.createActivityLog({
        userId: (req.user as any)?.id ?? null,
        userName: (req.user as any)?.name || (req.user as any)?.email || "System",
        action: "update",
        resourceType: "user",
        resourceId: user.id,
        details: { name: user.name, email: user.email, role: (user as any).role },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
      }).catch((err: any) => {
        console.error("Failed to create activity log:", err);
      });
      res.json(sanitizeUser(user));
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const existing = await storage.getUser(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "User not found" });
      }
      await storage.deleteUser(req.params.id);
      storage.createActivityLog({
        userId: (req.user as any)?.id ?? null,
        userName: (req.user as any)?.name || (req.user as any)?.email || "System",
        action: "delete",
        resourceType: "user",
        resourceId: existing.id,
        details: { name: existing.name, email: existing.email, role: (existing as any).role },
        ipAddress: req.ip,
        userAgent: req.get("user-agent") || null,
      }).catch((err: any) => {
        console.error("Failed to create activity log:", err);
      });
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // ===== PRODUCTS (MEDICINES) =====

  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getProducts();
      res.json(products);
    } catch (error) {
      console.error("Failed to fetch products:", error);
      res.status(500).json({ error: "Failed to fetch products" });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Failed to fetch product:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.get("/api/products/barcode/:barcode", async (req, res) => {
    try {
      const product = await storage.getProductByBarcode(req.params.barcode);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error) {
      console.error("Failed to fetch product by barcode:", error);
      res.status(500).json({ error: "Failed to fetch product" });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const data = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(data);
      res.status(201).json(product);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create product:", error);
      res.status(500).json({ error: "Failed to create product" });
    }
  });

  app.put("/api/products/:id", async (req, res) => {
    try {
      const data = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, data);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update product:", error);
      res.status(500).json({ error: "Failed to update product" });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Product not found" });
      }
      await storage.deleteProduct(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete product:", error);
      res.status(500).json({ error: "Failed to delete product" });
    }
  });

  app.post("/api/products/:id/adjust-stock", async (req, res) => {
    try {
      const adjustStockSchema = z.object({
        quantity: z.number().int().refine((val) => val !== 0, {
          message: "Quantity must be non-zero"
        })
      });
      
      const parsed = adjustStockSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
      }
      
      const product = await storage.adjustProductStock(req.params.id, parsed.data.quantity);
      res.json(product);
    } catch (error: any) {
      console.error("Failed to adjust product stock:", error);
      res.status(500).json({ error: error.message || "Failed to adjust stock" });
    }
  });

  app.post("/api/products/:id/dispose-stock", async (req, res) => {
    try {
      const existingProduct = await storage.getProduct(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Validate stock has actually expired
      if (existingProduct.stockExpiryDate) {
        const expiryDate = new Date(existingProduct.stockExpiryDate);
        if (isNaN(expiryDate.getTime()) || expiryDate >= new Date()) {
          return res.status(400).json({ error: "Stock has not expired" });
        }
      } else {
        return res.status(400).json({ error: "No expiry date set for this stock" });
      }
      
      const product = await storage.disposeExpiredStock(req.params.id);
      res.json(product);
    } catch (error: any) {
      console.error("Failed to dispose expired stock:", error);
      res.status(500).json({ error: error.message || "Failed to dispose stock" });
    }
  });

  // ===== PRODUCT BATCHES (STOCK/INVENTORY) =====

  app.get("/api/product-batches", async (req, res) => {
    try {
      const openOnly = req.query.openOnly === 'true';
      const batches = await storage.getProductBatches(openOnly);
      res.json(batches);
    } catch (error) {
      console.error("Failed to fetch product batches:", error);
      res.status(500).json({ error: "Failed to fetch product batches" });
    }
  });

  app.get("/api/product-batches/:id", async (req, res) => {
    try {
      const batch = await storage.getProductBatch(req.params.id);
      if (!batch) {
        return res.status(404).json({ error: "Product batch not found" });
      }
      res.json(batch);
    } catch (error) {
      console.error("Failed to fetch product batch:", error);
      res.status(500).json({ error: "Failed to fetch product batch" });
    }
  });

  app.post("/api/product-batches", async (req, res) => {
    try {
      const data = insertProductBatchSchema.parse(req.body);
      const batch = await storage.createProductBatch(data);
      res.status(201).json(batch);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create product batch:", error);
      res.status(500).json({ error: "Failed to create product batch" });
    }
  });

  app.put("/api/product-batches/:id", async (req, res) => {
    try {
      const data = insertProductBatchSchema.partial().parse(req.body);
      
      // Check if batch is being opened (status changing to 'open')
      const previousBatch = await storage.getProductBatch(req.params.id);
      const isOpening = data.status === 'open' && previousBatch?.status !== 'open';
      
      const batch = await storage.updateProductBatch(req.params.id, data);
      if (!batch) {
        return res.status(404).json({ error: "Product batch not found" });
      }
      
      // Auto-create "opened" lifecycle event when batch is opened (fire-and-forget)
      if (isOpening && req.user) {
        const user = req.user as any;
        storage.createBatchLifecycleEvent({
          batchId: batch.id,
          eventType: 'opened',
          userName: user.username || user.name || 'Unknown',
          userId: user.id || null,
          quantity: null,
          relatedTreatmentId: null,
          payload: { 
            productName: batch.productName,
            batchNo: batch.batchNo,
            expiryDate: batch.expiryDate 
          },
        }).catch(err => {
          // Log but don't fail batch update
          console.error("Failed to create batch lifecycle event:", err);
        });
      }
      
      res.json(batch);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update product batch:", error);
      res.status(500).json({ error: "Failed to update product batch" });
    }
  });

  app.delete("/api/product-batches/:id", async (req, res) => {
    try {
      const existing = await storage.getProductBatch(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Product batch not found" });
      }
      await storage.deleteProductBatch(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete product batch:", error);
      res.status(500).json({ error: "Failed to delete product batch" });
    }
  });

  app.get("/api/product-batches/:id/traceability", async (req, res) => {
    try {
      const traceability = await storage.getBatchTraceability(req.params.id);
      if (!traceability) {
        return res.status(404).json({ error: "Product batch not found" });
      }
      res.json(traceability);
    } catch (error) {
      console.error("Failed to fetch batch traceability:", error);
      res.status(500).json({ error: "Failed to fetch batch traceability" });
    }
  });

  app.get("/api/medicine-compliance/alerts", async (req, res) => {
    try {
      const alerts = await storage.getMedicineComplianceAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Failed to fetch medicine compliance alerts:", error);
      res.status(500).json({ error: "Failed to fetch medicine compliance alerts" });
    }
  });

  // ===== BATCH LIFECYCLE EVENTS (Phase 6) =====

  app.post("/api/batch-lifecycle-events", async (req, res) => {
    try {
      const data = insertBatchLifecycleEventSchema.parse(req.body);
      const event = await storage.createBatchLifecycleEvent(data);
      res.status(201).json(event);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create batch lifecycle event:", error);
      res.status(500).json({ error: "Failed to create batch lifecycle event" });
    }
  });

  app.get("/api/batch-lifecycle-events/:batchId", async (req, res) => {
    try {
      const events = await storage.getBatchLifecycleEvents(req.params.batchId);
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch batch lifecycle events:", error);
      res.status(500).json({ error: "Failed to fetch batch lifecycle events" });
    }
  });

  app.get("/api/product-batches/:id/usage-history", async (req, res) => {
    try {
      const history = await storage.getBatchUsageHistory(req.params.id);
      if (!history) {
        return res.status(404).json({ error: "Product batch not found" });
      }
      res.json(history);
    } catch (error) {
      console.error("Failed to fetch batch usage history:", error);
      res.status(500).json({ error: "Failed to fetch batch usage history" });
    }
  });

  // ===== CONDITIONS =====

  app.get("/api/conditions", async (req, res) => {
    try {
      const conditions = await storage.getConditions();
      res.json(conditions);
    } catch (error) {
      console.error("Failed to fetch conditions:", error);
      res.status(500).json({ error: "Failed to fetch conditions" });
    }
  });

  app.get("/api/conditions/:id", async (req, res) => {
    try {
      const condition = await storage.getCondition(req.params.id);
      if (!condition) {
        return res.status(404).json({ error: "Condition not found" });
      }
      res.json(condition);
    } catch (error) {
      console.error("Failed to fetch condition:", error);
      res.status(500).json({ error: "Failed to fetch condition" });
    }
  });

  app.post("/api/conditions", async (req, res) => {
    try {
      const data = insertConditionSchema.parse(req.body);
      const condition = await storage.createCondition(data);
      res.status(201).json(condition);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create condition:", error);
      res.status(500).json({ error: "Failed to create condition" });
    }
  });

  app.put("/api/conditions/:id", async (req, res) => {
    try {
      const data = insertConditionSchema.partial().parse(req.body);
      const condition = await storage.updateCondition(req.params.id, data);
      if (!condition) {
        return res.status(404).json({ error: "Condition not found" });
      }
      res.json(condition);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update condition:", error);
      res.status(500).json({ error: "Failed to update condition" });
    }
  });

  app.delete("/api/conditions/:id", async (req, res) => {
    try {
      const existing = await storage.getCondition(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Condition not found" });
      }
      await storage.deleteCondition(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete condition:", error);
      res.status(500).json({ error: "Failed to delete condition" });
    }
  });

  // ===== ANIMALS =====

  app.get("/api/animals", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const animals = await storage.getAnimals(status);
      res.json(animals);
    } catch (error) {
      console.error("Failed to fetch animals:", error);
      res.status(500).json({ error: "Failed to fetch animals" });
    }
  });

  app.get("/api/animals/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const animals = await storage.searchAnimals(query);
      res.json(animals);
    } catch (error) {
      console.error("Failed to search animals:", error);
      res.status(500).json({ error: "Failed to search animals" });
    }
  });

  app.get("/api/animals/:id", async (req, res) => {
    try {
      const animal = await storage.getAnimal(req.params.id);
      if (!animal) {
        return res.status(404).json({ error: "Animal not found" });
      }
      res.json(animal);
    } catch (error) {
      console.error("Failed to fetch animal:", error);
      res.status(500).json({ error: "Failed to fetch animal" });
    }
  });

  app.post("/api/animals", async (req, res) => {
    try {
      const data = insertAnimalSchema.parse(req.body);
      const animal = await storage.createAnimal(data);
      res.status(201).json(animal);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create animal:", error.message || error);
      console.error("Error details:", error.code, error.detail, error.constraint);
      res.status(500).json({ error: "Failed to create animal", detail: error.message });
    }
  });

  app.put("/api/animals/:id", async (req, res) => {
    try {
      const data = insertAnimalSchema.partial().parse(req.body);
      const animal = await storage.updateAnimal(req.params.id, data);
      if (!animal) {
        return res.status(404).json({ error: "Animal not found" });
      }
      res.json(animal);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update animal:", error);
      res.status(500).json({ error: "Failed to update animal" });
    }
  });

  app.delete("/api/animals/:id", async (req, res) => {
    try {
      const existing = await storage.getAnimal(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Animal not found" });
      }
      await storage.deleteAnimal(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete animal:", error);
      res.status(500).json({ error: "Failed to delete animal" });
    }
  });

  // ===== PASTURES =====

  app.get("/api/pastures", async (req, res) => {
    try {
      const pastures = await storage.getPastures();
      res.json(pastures);
    } catch (error) {
      console.error("Failed to fetch pastures:", error);
      res.status(500).json({ error: "Failed to fetch pastures" });
    }
  });

  app.get("/api/pastures/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({ error: "Search query required" });
      }
      const pastures = await storage.searchPastures(query);
      res.json(pastures);
    } catch (error) {
      console.error("Failed to search pastures:", error);
      res.status(500).json({ error: "Failed to search pastures" });
    }
  });

  app.get("/api/pastures/:id", async (req, res) => {
    try {
      const pasture = await storage.getPasture(req.params.id);
      if (!pasture) {
        return res.status(404).json({ error: "Pasture not found" });
      }
      res.json(pasture);
    } catch (error) {
      console.error("Failed to fetch pasture:", error);
      res.status(500).json({ error: "Failed to fetch pasture" });
    }
  });

  app.post("/api/pastures", async (req, res) => {
    try {
      const data = insertPastureSchema.parse(req.body);
      const pasture = await storage.createPasture(data);
      res.status(201).json(pasture);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create pasture:", error);
      res.status(500).json({ error: "Failed to create pasture" });
    }
  });

  app.put("/api/pastures/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    try {
      const data = insertPastureSchema.partial().parse(req.body);
      const userId = (req.user as any).id; // Extract user ID for auto-snapshot
      const pasture = await storage.updatePasture(req.params.id, data, userId);
      if (!pasture) {
        return res.status(404).json({ error: "Pasture not found" });
      }
      res.json(pasture);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update pasture:", error);
      res.status(500).json({ error: "Failed to update pasture" });
    }
  });

  app.delete("/api/pastures/:id", async (req, res) => {
    try {
      const existing = await storage.getPasture(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Pasture not found" });
      }
      await storage.deletePasture(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete pasture:", error);
      res.status(500).json({ error: "Failed to delete pasture" });
    }
  });

  // ===== PASTURE HEALTH RECORDS (Phase 5.3) =====

  app.get("/api/pastures/:id/health-records", async (req, res) => {
    try {
      const records = await storage.getPastureHealthRecords(req.params.id);
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch pasture health records:", error);
      res.status(500).json({ error: "Failed to fetch health records" });
    }
  });

  app.post("/api/pastures/:id/health-records", async (req, res) => {
    try {
      const data = insertPastureHealthRecordSchema.parse({
        ...req.body,
        pastureId: req.params.id,
      });
      const record = await storage.createPastureHealthRecord(data);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create pasture health record:", error);
      res.status(500).json({ error: "Failed to create health record" });
    }
  });

  // ===== PASTURE MOVEMENTS (Phase 5: Pasture Performance) =====

  app.get("/api/pasture-movements", async (req, res) => {
    try {
      const animalId = req.query.animalId as string | undefined;
      const pastureId = req.query.pastureId as string | undefined;
      const movements = await storage.getPastureMovements(animalId, pastureId);
      res.json(movements);
    } catch (error) {
      console.error("Failed to fetch pasture movements:", error);
      res.status(500).json({ error: "Failed to fetch pasture movements" });
    }
  });

  app.get("/api/pasture-movements/:id", async (req, res) => {
    try {
      const movement = await storage.getPastureMovement(req.params.id);
      if (!movement) {
        return res.status(404).json({ error: "Movement not found" });
      }
      res.json(movement);
    } catch (error) {
      console.error("Failed to fetch pasture movement:", error);
      res.status(500).json({ error: "Failed to fetch pasture movement" });
    }
  });

  app.post("/api/pasture-movements", async (req, res) => {
    try {
      const data = insertPastureMovementSchema.parse(req.body);
      const movement = await storage.createPastureMovement(data);
      res.status(201).json(movement);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create pasture movement:", error);
      res.status(500).json({ error: "Failed to create pasture movement" });
    }
  });

  app.post("/api/pasture-movements/bulk", async (req, res) => {
    try {
      const { animalIds, toPastureId, movedBy, reason } = req.body;
      
      if (!Array.isArray(animalIds) || animalIds.length === 0) {
        return res.status(400).json({ error: "animalIds array is required" });
      }
      
      if (!toPastureId || !movedBy) {
        return res.status(400).json({ error: "toPastureId and movedBy are required" });
      }

      const movements = await storage.moveanimalsToPasture(animalIds, toPastureId, movedBy, reason);
      res.status(201).json(movements);
    } catch (error: any) {
      console.error("Failed to move animals:", error);
      res.status(500).json({ error: "Failed to move animals" });
    }
  });

  // ===== ALERTS =====
  
  app.get("/api/alerts", async (req, res) => {
    try {
      // Ensure alerts reflect current treatment states
      await storage.recomputeTreatmentAlerts();
      const alerts = await storage.getActiveAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Failed to fetch alerts:", error);
      res.status(500).json({ error: "Failed to fetch alerts" });
    }
  });

  app.get("/api/alerts/animal/:animalId", async (req, res) => {
    try {
      const alerts = await storage.getAlertsByAnimal(req.params.animalId);
      res.json(alerts);
    } catch (error) {
      console.error("Failed to fetch animal alerts:", error);
      res.status(500).json({ error: "Failed to fetch animal alerts" });
    }
  });

  app.post("/api/alerts", async (req, res) => {
    try {
      const data = insertAlertSchema.parse(req.body);
      const alert = await storage.createAlert(data);
      res.status(201).json(alert);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create alert:", error);
      res.status(500).json({ error: "Failed to create alert" });
    }
  });

  app.put("/api/alerts/:id/dismiss", async (req, res) => {
    try {
      const userId = (req.user as any)?.id || '';
      const alert = await storage.dismissAlert(req.params.id, userId);
      res.json(alert);
    } catch (error) {
      console.error("Failed to dismiss alert:", error);
      res.status(500).json({ error: "Failed to dismiss alert" });
    }
  });

  // ===== USER PREFERENCES (Phase 6A) =====

  app.get("/api/user-preferences/:userId", async (req, res) => {
    try {
      const preferences = await storage.getUserPreferences(req.params.userId);
      if (!preferences) {
        return res.status(404).json({ error: "Preferences not found" });
      }
      res.json(preferences);
    } catch (error: any) {
      console.error("Failed to fetch user preferences:", error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.post("/api/user-preferences", async (req, res) => {
    try {
      const preferences = await storage.upsertUserPreferences(req.body);
      res.json(preferences);
    } catch (error: any) {
      console.error("Failed to save user preferences:", error);
      res.status(400).json({ error: error.message });
    }
  });

  // ===== ANALYTICS (Phase 5.4) =====

  app.get("/api/analytics/treatment-activity", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await storage.getAnalyticsTreatmentActivity(days);
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch treatment activity analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/pasture-health-trends", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await storage.getAnalyticsPastureHealthTrends(days);
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch pasture health trends:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/medicine-usage", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await storage.getAnalyticsMedicineUsage(days);
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch medicine usage analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/animal-movements", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await storage.getAnalyticsAnimalMovements(days);
      res.json(data);
    } catch (error) {
      console.error("Failed to fetch animal movement analytics:", error);
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  app.get("/api/analytics/reproduction-metrics", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const data = await storage.getAnalyticsReproductionMetrics(days);
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/pasture-round-length", async (req, res) => {
    try {
      const data = await storage.getAnalyticsPastureRoundLength();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/analytics/pasture-growth-estimate", async (req, res) => {
    try {
      const data = await storage.getAnalyticsPastureGrowthEstimate();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===== ANIMAL TREATMENTS =====

  app.get("/api/treatments", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const treatments = await storage.getAnimalTreatments(status);
      res.json(treatments);
    } catch (error) {
      console.error("Failed to fetch treatments:", error);
      res.status(500).json({ error: "Failed to fetch treatments" });
    }
  });

  app.get("/api/treatments/:id", async (req, res) => {
    try {
      const treatment = await storage.getAnimalTreatment(req.params.id);
      if (!treatment) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.json(treatment);
    } catch (error) {
      console.error("Failed to fetch treatment:", error);
      res.status(500).json({ error: "Failed to fetch treatment" });
    }
  });

  app.get("/api/animals/:animalId/treatments", async (req, res) => {
    try {
      const treatments = await storage.getAnimalTreatmentsByAnimal(req.params.animalId);
      res.json(treatments);
    } catch (error) {
      console.error("Failed to fetch animal treatments:", error);
      res.status(500).json({ error: "Failed to fetch animal treatments" });
    }
  });

  app.post("/api/treatments", async (req, res) => {
    try {
      const data = insertAnimalTreatmentSchema.parse(req.body);
      const treatment = await storage.createAnimalTreatment(data);
      
      // Auto-create lifecycle event for batch traceability (fire-and-forget)
      if (treatment.batchId && req.user) {
        const user = req.user as any;
        // Parse dose amount safely - coerce NaN to null for valid audit data
        const parsedDose = treatment.doseAmount ? parseFloat(treatment.doseAmount) : NaN;
        const quantity = !isNaN(parsedDose) ? parsedDose : null;
        
        storage.createBatchLifecycleEvent({
          batchId: treatment.batchId,
          eventType: 'administered',
          userName: user.username || user.name || 'Unknown',
          userId: user.id || null,
          quantity,
          relatedTreatmentId: treatment.id,
          payload: { 
            animalId: treatment.animalId, 
            cowId: treatment.cowId,
            doseUnit: treatment.doseUnit 
          },
        }).catch(err => {
          // Log but don't fail treatment creation
          console.error("Failed to create batch lifecycle event:", err);
        });
      }
      
      res.status(201).json(treatment);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create treatment:", error);
      res.status(500).json({ error: "Failed to create treatment" });
    }
  });

  app.put("/api/treatments/:id", async (req, res) => {
    try {
      const data = insertAnimalTreatmentSchema.partial().parse(req.body);
      const treatment = await storage.updateAnimalTreatment(req.params.id, data);
      if (!treatment) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.json(treatment);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update treatment:", error);
      res.status(500).json({ error: "Failed to update treatment" });
    }
  });

  app.delete("/api/treatments/:id", async (req, res) => {
    try {
      const existing = await storage.getAnimalTreatment(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      await storage.deleteAnimalTreatment(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete treatment:", error);
      res.status(500).json({ error: "Failed to delete treatment" });
    }
  });

  // Get treatment events (audit trail)
  app.get("/api/treatments/:id/events", async (req, res) => {
    try {
      const events = await storage.getTreatmentEvents(req.params.id);
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch treatment events:", error);
      res.status(500).json({ error: "Failed to fetch treatment events" });
    }
  });

  // ===== REPRODUCTION EVENTS =====

  app.get("/api/reproduction-events", async (req, res) => {
    try {
      const animalId = req.query.animalId as string | undefined;
      const events = await storage.getReproductionEvents(animalId);
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch reproduction events:", error);
      res.status(500).json({ error: "Failed to fetch reproduction events" });
    }
  });

  app.get("/api/reproduction-events/:id", async (req, res) => {
    try {
      const event = await storage.getReproductionEvent(req.params.id);
      if (!event) {
        return res.status(404).json({ error: "Reproduction event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Failed to fetch reproduction event:", error);
      res.status(500).json({ error: "Failed to fetch reproduction event" });
    }
  });

  app.post("/api/reproduction-events", async (req, res) => {
    try {
      const data = insertReproductionEventSchema.parse(req.body);
      const event = await storage.createReproductionEvent(data);
      res.status(201).json(event);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create reproduction event:", error);
      res.status(500).json({ error: "Failed to create reproduction event" });
    }
  });

  app.put("/api/reproduction-events/:id", async (req, res) => {
    try {
      const data = insertReproductionEventSchema.partial().parse(req.body);
      const event = await storage.updateReproductionEvent(req.params.id, data);
      if (!event) {
        return res.status(404).json({ error: "Reproduction event not found" });
      }
      res.json(event);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update reproduction event:", error);
      res.status(500).json({ error: "Failed to update reproduction event" });
    }
  });

  app.delete("/api/reproduction-events/:id", async (req, res) => {
    try {
      const existing = await storage.getReproductionEvent(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Reproduction event not found" });
      }
      await storage.deleteReproductionEvent(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete reproduction event:", error);
      res.status(500).json({ error: "Failed to delete reproduction event" });
    }
  });

  // ===== MILK WITHHOLDINGS =====

  app.get("/api/milk-withholdings/active", async (req, res) => {
    try {
      const withholdings = await storage.getActiveMilkWithholdings();
      res.json(withholdings);
    } catch (error) {
      console.error("Failed to fetch active milk withholdings:", error);
      res.status(500).json({ error: "Failed to fetch active milk withholdings" });
    }
  });

  app.get("/api/animals/:animalId/milk-withholdings", async (req, res) => {
    try {
      const withholdings = await storage.getMilkWithholdingsByAnimal(req.params.animalId);
      res.json(withholdings);
    } catch (error) {
      console.error("Failed to fetch milk withholdings:", error);
      res.status(500).json({ error: "Failed to fetch milk withholdings" });
    }
  });

  app.post("/api/milk-withholdings", async (req, res) => {
    try {
      const data = insertMilkWithholdingSchema.parse(req.body);
      const withholding = await storage.createMilkWithholding(data);
      res.status(201).json(withholding);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create milk withholding:", error);
      res.status(500).json({ error: "Failed to create milk withholding" });
    }
  });

  app.post("/api/milk-withholdings/:id/close", async (req, res) => {
    try {
      const withholding = await storage.closeMilkWithholding(req.params.id);
      if (!withholding) {
        return res.status(404).json({ error: "Milk withholding not found" });
      }
      res.json(withholding);
    } catch (error) {
      console.error("Failed to close milk withholding:", error);
      res.status(500).json({ error: "Failed to close milk withholding" });
    }
  });

  // ===== NAIT RECORDS =====

  app.get("/api/nait-records", async (req, res) => {
    try {
      const records = await storage.getNaitRecords();
      res.json(records);
    } catch (error) {
      console.error("Failed to fetch NAIT records:", error);
      res.status(500).json({ error: "Failed to fetch NAIT records" });
    }
  });

  app.get("/api/animals/:animalId/nait-record", async (req, res) => {
    try {
      const record = await storage.getNaitRecordByAnimal(req.params.animalId);
      if (!record) {
        return res.status(404).json({ error: "NAIT record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Failed to fetch NAIT record:", error);
      res.status(500).json({ error: "Failed to fetch NAIT record" });
    }
  });

  app.post("/api/nait-records", async (req, res) => {
    try {
      const data = insertNaitRecordSchema.parse(req.body);
      const record = await storage.createNaitRecord(data);
      res.status(201).json(record);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to create NAIT record:", error);
      res.status(500).json({ error: "Failed to create NAIT record" });
    }
  });

  app.put("/api/nait-records/:id", async (req, res) => {
    try {
      const data = insertNaitRecordSchema.partial().parse(req.body);
      const record = await storage.updateNaitRecord(req.params.id, data);
      if (!record) {
        return res.status(404).json({ error: "NAIT record not found" });
      }
      res.json(record);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ error: error.message });
      }
      console.error("Failed to update NAIT record:", error);
      res.status(500).json({ error: "Failed to update NAIT record" });
    }
  });

  // ===== SETTINGS =====

  app.get("/api/settings/:key", async (req, res) => {
    try {
      const value = await storage.getSetting(req.params.key);
      if (value === undefined) {
        return res.status(404).json({ error: "Setting not found" });
      }
      res.json({ key: req.params.key, value });
    } catch (error) {
      console.error("Failed to fetch setting:", error);
      res.status(500).json({ error: "Failed to fetch setting" });
    }
  });

  app.put("/api/settings/:key", async (req, res) => {
    try {
      const { value } = req.body;
      if (value === undefined) {
        return res.status(400).json({ error: "Value is required" });
      }
      await storage.setSetting(req.params.key, value);
      res.json({ key: req.params.key, value });
    } catch (error) {
      console.error("Failed to update setting:", error);
      res.status(500).json({ error: "Failed to update setting" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
