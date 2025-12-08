/**
 * Multi-Farm Management API Routes
 */

import { Router, Request, Response } from 'express';
import { multiFarmService } from '../services/multi-farm-service';

const router = Router();

// ============ Farm Management ============

// Get all farms for user
router.get('/api/farms', async (req: Request, res: Response) => {
  try {
    // In production, get userId from auth context
    const userId = (req as any).user?.id || 'user-001';
    const farms = multiFarmService.getFarmsForUser(userId);
    res.json({ success: true, data: farms });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch farms' });
  }
});

// Get all farms (admin)
router.get('/api/farms/all', async (req: Request, res: Response) => {
  try {
    const farms = multiFarmService.getAllFarms();
    res.json({ success: true, data: farms });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch farms' });
  }
});

// Get farm by ID
router.get('/api/farms/:farmId', async (req: Request, res: Response) => {
  try {
    const farm = multiFarmService.getFarm(req.params.farmId);
    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }
    res.json({ success: true, data: farm });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch farm' });
  }
});

// Create new farm
router.post('/api/farms', async (req: Request, res: Response) => {
  try {
    const farm = multiFarmService.createFarm(req.body);
    res.json({ success: true, data: farm });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create farm' });
  }
});

// Update farm
router.put('/api/farms/:farmId', async (req: Request, res: Response) => {
  try {
    const farm = multiFarmService.updateFarm(req.params.farmId, req.body);
    if (!farm) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }
    res.json({ success: true, data: farm });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update farm' });
  }
});

// Archive farm
router.post('/api/farms/:farmId/archive', async (req: Request, res: Response) => {
  try {
    const success = multiFarmService.archiveFarm(req.params.farmId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Farm not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to archive farm' });
  }
});

// ============ Farm Groups ============

// Get farm groups
router.get('/api/farm-groups', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'user-001';
    const groups = multiFarmService.getFarmGroups(userId);
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch farm groups' });
  }
});

// Create farm group
router.post('/api/farm-groups', async (req: Request, res: Response) => {
  try {
    const group = multiFarmService.createFarmGroup(req.body);
    res.json({ success: true, data: group });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create farm group' });
  }
});

// Get farms in group
router.get('/api/farm-groups/:groupId/farms', async (req: Request, res: Response) => {
  try {
    const farms = multiFarmService.getFarmsInGroup(req.params.groupId);
    res.json({ success: true, data: farms });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch farms in group' });
  }
});

// ============ Cross-Farm Analytics ============

// Get farm metrics
router.post('/api/farms/metrics', async (req: Request, res: Response) => {
  try {
    const { farmIds, period } = req.body;
    const metrics = await multiFarmService.getFarmMetrics(farmIds, period);
    res.json({ success: true, data: metrics });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch farm metrics' });
  }
});

// Compare farms
router.post('/api/farms/compare', async (req: Request, res: Response) => {
  try {
    const { farmIds, metrics } = req.body;
    const comparisons = await multiFarmService.compareFarms(farmIds, metrics);
    res.json({ success: true, data: comparisons });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to compare farms' });
  }
});

// Generate consolidated report
router.post('/api/farms/consolidated-report', async (req: Request, res: Response) => {
  try {
    const { farmIds, period } = req.body;
    const report = await multiFarmService.generateConsolidatedReport(farmIds, period);
    res.json({ success: true, data: report });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate consolidated report' });
  }
});

// ============ User Access Management ============

// Get farm users
router.get('/api/farms/:farmId/users', async (req: Request, res: Response) => {
  try {
    const users = multiFarmService.getFarmUsers(req.params.farmId);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch farm users' });
  }
});

// Add user to farm
router.post('/api/farms/:farmId/users', async (req: Request, res: Response) => {
  try {
    const user = multiFarmService.addUserToFarm({
      ...req.body,
      farmId: req.params.farmId,
    });
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add user to farm' });
  }
});

// Update user role
router.patch('/api/farms/:farmId/users/:userId/role', async (req: Request, res: Response) => {
  try {
    const { role } = req.body;
    const success = multiFarmService.updateUserRole(req.params.farmId, req.params.userId, role);
    if (!success) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update user role' });
  }
});

// Remove user from farm
router.delete('/api/farms/:farmId/users/:userId', async (req: Request, res: Response) => {
  try {
    const success = multiFarmService.removeUserFromFarm(req.params.farmId, req.params.userId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to remove user from farm' });
  }
});

// ============ Dashboard ============

// Get portfolio dashboard
router.get('/api/farms/dashboard', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'user-001';
    const data = await multiFarmService.getPortfolioDashboard(userId);
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch portfolio dashboard' });
  }
});

export default router;
