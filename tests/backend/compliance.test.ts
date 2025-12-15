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

describe('Compliance Tests', () => {
  let app: express.Application;
  const mockUserId = 'user-123';
  const mockFarmId = 'farm-123';

  // Mock data
  let mockHazards = [
    {
      id: 'hazard-1',
      title: 'Slippery floor in milking shed',
      description: 'Water pooling near entrance',
      riskLevel: 'high',
      location: 'Milking Shed',
      status: 'open',
      reportedBy: mockUserId,
      farmId: mockFarmId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'hazard-2',
      title: 'Broken fence in paddock 3',
      description: 'Wire fence damaged by fallen tree',
      riskLevel: 'medium',
      location: 'Paddock 3',
      status: 'resolved',
      reportedBy: mockUserId,
      farmId: mockFarmId,
      resolvedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  let mockIncidents = [
    {
      id: 'incident-1',
      title: 'Minor slip in milking shed',
      description: 'Staff member slipped but no injury',
      type: 'near_miss',
      severity: 'minor',
      location: 'Milking Shed',
      status: 'open',
      reportedBy: mockUserId,
      farmId: mockFarmId,
      dateOccurred: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock data
    mockHazards = [
      {
        id: 'hazard-1',
        title: 'Slippery floor in milking shed',
        description: 'Water pooling near entrance',
        riskLevel: 'high',
        location: 'Milking Shed',
        status: 'open',
        reportedBy: mockUserId,
        farmId: mockFarmId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'hazard-2',
        title: 'Broken fence in paddock 3',
        description: 'Wire fence damaged by fallen tree',
        riskLevel: 'medium',
        location: 'Paddock 3',
        status: 'resolved',
        reportedBy: mockUserId,
        farmId: mockFarmId,
        resolvedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

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

    // GET /api/compliance/hazards - List hazards
    app.get('/api/compliance/hazards', (req, res) => {
      const { status, activeOnly } = req.query;
      let filteredHazards = mockHazards.filter(h => h.farmId === mockFarmId);
      
      if (status) {
        filteredHazards = filteredHazards.filter(h => h.status === status);
      }
      
      if (activeOnly === 'true') {
        filteredHazards = filteredHazards.filter(h => h.status !== 'resolved');
      }
      
      res.json(filteredHazards);
    });

    // POST /api/compliance/hazards - Create hazard
    app.post('/api/compliance/hazards', (req, res) => {
      const { title, description, riskLevel, location } = req.body;

      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
      }

      const newHazard = {
        id: `hazard-${Date.now()}`,
        title,
        description,
        riskLevel: riskLevel || 'medium',
        location,
        status: 'open',
        reportedBy: (req as any).user.id,
        farmId: (req as any).user.farmId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockHazards.push(newHazard);
      res.status(201).json(newHazard);
    });

    // GET /api/compliance/hazards/:id - Get single hazard
    app.get('/api/compliance/hazards/:id', (req, res) => {
      const { id } = req.params;
      const hazard = mockHazards.find(h => h.id === id);

      if (!hazard) {
        return res.status(404).json({ error: 'Hazard not found' });
      }

      if (hazard.farmId !== (req as any).user.farmId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(hazard);
    });

    // PATCH /api/compliance/hazards/:id/resolve - Resolve hazard
    app.patch('/api/compliance/hazards/:id/resolve', (req, res) => {
      const { id } = req.params;
      const hazardIndex = mockHazards.findIndex(h => h.id === id);

      if (hazardIndex === -1) {
        return res.status(404).json({ error: 'Hazard not found' });
      }

      const hazard = mockHazards[hazardIndex];

      if (hazard.farmId !== (req as any).user.farmId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      mockHazards[hazardIndex] = {
        ...hazard,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: (req as any).user.id,
        updatedAt: new Date().toISOString(),
      };

      res.json(mockHazards[hazardIndex]);
    });

    // GET /api/compliance/incidents - List incidents
    app.get('/api/compliance/incidents', (req, res) => {
      const { status, type } = req.query;
      let filteredIncidents = mockIncidents.filter(i => i.farmId === mockFarmId);
      
      if (status) {
        filteredIncidents = filteredIncidents.filter(i => i.status === status);
      }
      
      if (type) {
        filteredIncidents = filteredIncidents.filter(i => i.type === type);
      }
      
      res.json(filteredIncidents);
    });

    // POST /api/compliance/incidents - Create incident
    app.post('/api/compliance/incidents', (req, res) => {
      const { title, description, type, severity, location, dateOccurred } = req.body;

      if (!title || !description) {
        return res.status(400).json({ error: 'Title and description are required' });
      }

      const newIncident = {
        id: `incident-${Date.now()}`,
        title,
        description,
        type: type || 'other',
        severity: severity || 'minor',
        location,
        status: 'open',
        reportedBy: (req as any).user.id,
        farmId: (req as any).user.farmId,
        dateOccurred: dateOccurred || new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      mockIncidents.push(newIncident);
      res.status(201).json(newIncident);
    });

    // PATCH /api/compliance/incidents/:id/resolve - Resolve incident
    app.patch('/api/compliance/incidents/:id/resolve', (req, res) => {
      const { id } = req.params;
      const incidentIndex = mockIncidents.findIndex(i => i.id === id);

      if (incidentIndex === -1) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      const incident = mockIncidents[incidentIndex];

      if (incident.farmId !== (req as any).user.farmId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      mockIncidents[incidentIndex] = {
        ...incident,
        status: 'resolved',
        resolvedAt: new Date().toISOString(),
        resolvedBy: (req as any).user.id,
        updatedAt: new Date().toISOString(),
      };

      res.json(mockIncidents[incidentIndex]);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Hazard Management', () => {
    it('should list all hazards for authenticated user', async () => {
      const response = await request(app)
        .get('/api/compliance/hazards')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should filter active hazards only', async () => {
      const response = await request(app)
        .get('/api/compliance/hazards?activeOnly=true')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.every((h: any) => h.status !== 'resolved')).toBe(true);
    });

    it('should return 401 for unauthenticated request', async () => {
      const response = await request(app)
        .get('/api/compliance/hazards');

      expect(response.status).toBe(401);
    });

    it('should create a new hazard with status open', async () => {
      const response = await request(app)
        .post('/api/compliance/hazards')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'New hazard',
          description: 'Description of the hazard',
          riskLevel: 'high',
          location: 'Main Shed',
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('New hazard');
      expect(response.body.status).toBe('open');
      expect(response.body.riskLevel).toBe('high');
      expect(response.body.reportedBy).toBe(mockUserId);
    });

    it('should return 400 if hazard title is missing', async () => {
      const response = await request(app)
        .post('/api/compliance/hazards')
        .set('Authorization', 'Bearer valid-token')
        .send({
          description: 'Description only',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Title and description are required');
    });

    it('should resolve a hazard', async () => {
      const response = await request(app)
        .patch('/api/compliance/hazards/hazard-1/resolve')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
      expect(response.body.resolvedAt).toBeDefined();
      expect(response.body.resolvedBy).toBe(mockUserId);
    });

    it('should return 404 for non-existent hazard', async () => {
      const response = await request(app)
        .patch('/api/compliance/hazards/non-existent/resolve')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
    });

    it('should get a single hazard by ID', async () => {
      const response = await request(app)
        .get('/api/compliance/hazards/hazard-1')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe('hazard-1');
      expect(response.body.title).toBe('Slippery floor in milking shed');
    });
  });

  describe('Incident Reporting', () => {
    it('should list all incidents for authenticated user', async () => {
      const response = await request(app)
        .get('/api/compliance/incidents')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should create a new incident', async () => {
      const response = await request(app)
        .post('/api/compliance/incidents')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'Equipment malfunction',
          description: 'Tractor engine overheated',
          type: 'property_damage',
          severity: 'moderate',
          location: 'Field 5',
          dateOccurred: '2024-01-15T10:30:00Z',
        });

      expect(response.status).toBe(201);
      expect(response.body.title).toBe('Equipment malfunction');
      expect(response.body.type).toBe('property_damage');
      expect(response.body.severity).toBe('moderate');
      expect(response.body.status).toBe('open');
    });

    it('should return 400 if incident title is missing', async () => {
      const response = await request(app)
        .post('/api/compliance/incidents')
        .set('Authorization', 'Bearer valid-token')
        .send({
          description: 'Description only',
        });

      expect(response.status).toBe(400);
    });

    it('should filter incidents by type', async () => {
      // First create an incident with specific type
      await request(app)
        .post('/api/compliance/incidents')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'Near miss incident',
          description: 'Almost hit by falling branch',
          type: 'near_miss',
          severity: 'minor',
        });

      const response = await request(app)
        .get('/api/compliance/incidents?type=near_miss')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.every((i: any) => i.type === 'near_miss')).toBe(true);
    });

    it('should resolve an incident', async () => {
      const response = await request(app)
        .patch('/api/compliance/incidents/incident-1/resolve')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('resolved');
      expect(response.body.resolvedAt).toBeDefined();
    });
  });

  describe('Compliance Workflow', () => {
    it('should complete full hazard workflow: create -> list -> resolve -> verify', async () => {
      // Step 1: Create a hazard
      const createResponse = await request(app)
        .post('/api/compliance/hazards')
        .set('Authorization', 'Bearer valid-token')
        .send({
          title: 'Workflow test hazard',
          description: 'Testing the complete workflow',
          riskLevel: 'critical',
          location: 'Test Location',
        });

      expect(createResponse.status).toBe(201);
      const hazardId = createResponse.body.id;

      // Step 2: List hazards and verify new hazard exists
      const listResponse = await request(app)
        .get('/api/compliance/hazards')
        .set('Authorization', 'Bearer valid-token');

      expect(listResponse.status).toBe(200);
      const createdHazard = listResponse.body.find((h: any) => h.id === hazardId);
      expect(createdHazard).toBeDefined();
      expect(createdHazard.status).toBe('open');

      // Step 3: Resolve the hazard
      const resolveResponse = await request(app)
        .patch(`/api/compliance/hazards/${hazardId}/resolve`)
        .set('Authorization', 'Bearer valid-token');

      expect(resolveResponse.status).toBe(200);
      expect(resolveResponse.body.status).toBe('resolved');

      // Step 4: Verify hazard is resolved
      const verifyResponse = await request(app)
        .get('/api/compliance/hazards?activeOnly=true')
        .set('Authorization', 'Bearer valid-token');

      expect(verifyResponse.status).toBe(200);
      const resolvedHazard = verifyResponse.body.find((h: any) => h.id === hazardId);
      expect(resolvedHazard).toBeUndefined(); // Should not appear in active hazards
    });
  });
});
