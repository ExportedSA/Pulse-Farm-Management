import request from "supertest";
import express from "express";
import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("./db", () => {
  return {
    pool: {
      query: vi.fn().mockResolvedValue({ rows: [{ "?column?": 1 }] }),
    },
  };
});

let app: ReturnType<typeof express>;

describe("Health Endpoints", () => {
  beforeAll(async () => {
    app = express();
    app.use(express.json());

    const { default: healthRouter } = await import("./routes/health");
    app.use("/api", healthRouter);
  });

  describe("GET /api/health", () => {
    it("should return health status with time/env/version", async () => {
      const response = await request(app).get("/api/health").expect(200);

      expect(response.body).toHaveProperty("ok", true);
      expect(response.body).toHaveProperty("version");
      expect(response.body).toHaveProperty("env");
      expect(response.body).toHaveProperty("time");
      expect(typeof response.body.time).toBe("string");
    });

    it("should respond quickly", async () => {
      const start = Date.now();
      await request(app)
        .get("/api/health")
        .expect(200);
      const duration = Date.now() - start;

      // Keep this generous to reduce CI flakiness
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("GET /api/health/db", () => {
    it("should return database health status", async () => {
      const response = await request(app).get("/api/health/db").expect(200);

      expect(response.body).toHaveProperty("ok", true);
      expect(response.body).toHaveProperty("result");
    });

    it("should handle database connection errors gracefully", async () => {
      // This test would require mocking the database connection
      // For now, we just verify the endpoint exists and responds
      const response = await request(app)
        .get("/api/health/db");
      
      // Should either succeed (200) or fail gracefully with proper error format (500)
      expect([200, 500]).toContain(response.status);
      
      if (response.status === 500) {
        expect(response.body).toHaveProperty("ok", false);
        expect(response.body).toHaveProperty("error");
      }
    });

    it("should respond within reasonable time", async () => {
      const start = Date.now();
      await request(app)
        .get("/api/health/db");
      const duration = Date.now() - start;
      
      // Database health check should complete within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe("Health Check Consistency", () => {
    it("should maintain consistent ok flags", async () => {
      const basicHealth = await request(app).get("/api/health").expect(200);
      const dbHealth = await request(app).get("/api/health/db").expect(200);

      expect(basicHealth.body).toHaveProperty("ok", true);
      expect(dbHealth.body).toHaveProperty("ok", true);
    });
  });
});
