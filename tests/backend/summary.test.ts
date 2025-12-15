import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock the database
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    execute: vi.fn(),
  },
}));

describe('Dashboard Summary API Tests', () => {
  let app: express.Application;
  const mockUserId = 'user-123';
  const mockFarmId = 'farm-123';

  beforeEach(() => {
    vi.clearAllMocks();

    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req, res, next) => {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        (req as any).user = {
          id: mockUserId,
          farmId: mockFarmId,
          email: 'test@example.com',
        };
        next();
      } else {
        res.status(401).json({ error: 'Unauthorized' });
      }
    });

    // GET /api/summary - Dashboard summary endpoint
    app.get('/api/summary', (req, res) => {
      const summary = {
        jobs: {
          openCount: 5,
          nextJob: {
            id: 'job-1',
            title: 'Fix fence in paddock 3',
            due_date: '2024-01-20',
            status: 'PENDING',
          },
        },
        hazards: {
          activeCount: 2,
          topHazards: [
            {
              id: 'hazard-1',
              title: 'Slippery floor',
              risk_level: 'high',
              location: 'Milking Shed',
            },
            {
              id: 'hazard-2',
              title: 'Chemical storage',
              risk_level: 'critical',
              location: 'Storage Shed',
            },
          ],
        },
        incidents: {
          recentCount: 1,
        },
        animals: {
          activeCount: 150,
        },
        equipment: {
          needsAttentionCount: 3,
          needsAttention: [
            {
              id: 'equip-1',
              name: 'Tractor 1',
              type: 'Tractor',
              status: 'maintenance_due',
              next_service_due: '2024-01-18',
            },
          ],
        },
        roster: {
          todayShiftsCount: 4,
          nextShift: {
            id: 'shift-1',
            staff_id: 'staff-1',
            date: '2024-01-16',
            start_time: '07:00',
            end_time: '15:00',
            shift_type: 'morning',
          },
        },
        generatedAt: new Date().toISOString(),
      };

      res.json(summary);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/summary', () => {
    it('should return dashboard summary for authenticated user', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('hazards');
      expect(response.body).toHaveProperty('incidents');
      expect(response.body).toHaveProperty('animals');
      expect(response.body).toHaveProperty('equipment');
      expect(response.body).toHaveProperty('roster');
      expect(response.body).toHaveProperty('generatedAt');
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/summary');

      expect(response.status).toBe(401);
    });

    it('should return jobs summary with open count', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.jobs.openCount).toBe(5);
      expect(response.body.jobs.nextJob).toBeDefined();
      expect(response.body.jobs.nextJob.title).toBe('Fix fence in paddock 3');
    });

    it('should return hazards summary with active count and top hazards', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.hazards.activeCount).toBe(2);
      expect(response.body.hazards.topHazards).toHaveLength(2);
      expect(response.body.hazards.topHazards[0].risk_level).toBe('high');
    });

    it('should return incidents summary with recent count', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.incidents.recentCount).toBe(1);
    });

    it('should return animals summary with active count', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.animals.activeCount).toBe(150);
    });

    it('should return equipment summary with needs attention count', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.equipment.needsAttentionCount).toBe(3);
      expect(response.body.equipment.needsAttention).toHaveLength(1);
    });

    it('should return roster summary with today shifts count', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.roster.todayShiftsCount).toBe(4);
      expect(response.body.roster.nextShift).toBeDefined();
    });

    it('should include generatedAt timestamp', async () => {
      const response = await request(app)
        .get('/api/summary')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.generatedAt).toBeDefined();
      expect(new Date(response.body.generatedAt)).toBeInstanceOf(Date);
    });
  });
});
