import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertMilkRecordSchema, insertMilkQualityAlertSchema } from '@shared/schema';

const router = Router();

// ===== MILK RECORDS =====

// Get all milk records with optional filters
router.get('/records', async (req, res) => {
  try {
    const { startDate, endDate, herdId, limit } = req.query;
    
    const filters: any = {};
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (herdId) filters.herdId = herdId as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const records = await storage.getMilkRecords(filters);
    res.json(records);
  } catch (error) {
    console.error('Error fetching milk records:', error);
    res.status(500).json({ error: 'Failed to fetch milk records' });
  }
});

// Get milk production summary
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate, period } = req.query;
    const summary = await storage.getMilkSummary(
      startDate as string | undefined,
      endDate as string | undefined,
      period as string | undefined
    );
    res.json(summary);
  } catch (error) {
    console.error('Error fetching milk summary:', error);
    res.status(500).json({ error: 'Failed to fetch milk summary' });
  }
});

// Get milk production trends
router.get('/trends', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const trends = await storage.getMilkTrends(parseInt(days as string));
    res.json(trends);
  } catch (error) {
    console.error('Error fetching milk trends:', error);
    res.status(500).json({ error: 'Failed to fetch milk trends' });
  }
});

// Get milk record by ID
router.get('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const record = await storage.getMilkRecordById(id);
    
    if (!record) {
      return res.status(404).json({ error: 'Milk record not found' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('Error fetching milk record:', error);
    res.status(500).json({ error: 'Failed to fetch milk record' });
  }
});

// Create new milk record
router.post('/records', async (req, res) => {
  try {
    const validatedData = insertMilkRecordSchema.parse(req.body);
    
    // Calculate total value if not provided
    if (!validatedData.totalValue && validatedData.totalVolume && validatedData.milkPrice) {
      const volume = parseFloat(validatedData.totalVolume);
      const price = parseFloat(validatedData.milkPrice);
      // Assuming milk price is per litre for simplicity
      validatedData.totalValue = String(volume * price);
    }
    
    const record = await storage.createMilkRecord(validatedData);
    
    // Check for quality alerts
    await storage.checkMilkQuality(record);
    
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid milk record data', details: error.errors });
    } else {
      console.error('Error creating milk record:', error);
      res.status(500).json({ error: 'Failed to create milk record' });
    }
  }
});

// Update milk record
router.put('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const record = await storage.updateMilkRecord(id, updates);
    
    if (!record) {
      return res.status(404).json({ error: 'Milk record not found' });
    }
    
    res.json(record);
  } catch (error) {
    console.error('Error updating milk record:', error);
    res.status(500).json({ error: 'Failed to update milk record' });
  }
});

// Delete milk record
router.delete('/records/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteMilkRecord(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Milk record not found' });
    }
    
    res.json({ message: 'Milk record deleted successfully' });
  } catch (error) {
    console.error('Error deleting milk record:', error);
    res.status(500).json({ error: 'Failed to delete milk record' });
  }
});

// ===== MILK QUALITY ALERTS =====

// Get milk quality alerts
router.get('/alerts', async (req, res) => {
  try {
    const { acknowledged, severity, limit } = req.query;
    
    const filters: any = {};
    if (acknowledged !== undefined) filters.acknowledged = acknowledged === 'true';
    if (severity) filters.severity = severity as string;
    if (limit) filters.limit = parseInt(limit as string);
    
    const alerts = await storage.getMilkQualityAlerts(filters);
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching milk quality alerts:', error);
    res.status(500).json({ error: 'Failed to fetch milk quality alerts' });
  }
});

// Acknowledge milk quality alert
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    const alert = await storage.acknowledgeMilkQualityAlert(id, userId);
    
    if (!alert) {
      return res.status(404).json({ error: 'Milk quality alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    console.error('Error acknowledging milk quality alert:', error);
    res.status(500).json({ error: 'Failed to acknowledge milk quality alert' });
  }
});

// ===== MILK ANALYTICS =====

// Get milk quality metrics
router.get('/analytics/quality', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await storage.getMilkQualityAnalytics(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching milk quality analytics:', error);
    res.status(500).json({ error: 'Failed to fetch milk quality analytics' });
  }
});

// Get milk production efficiency metrics
router.get('/analytics/efficiency', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const analytics = await storage.getMilkEfficiencyAnalytics(
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching milk efficiency analytics:', error);
    res.status(500).json({ error: 'Failed to fetch milk efficiency analytics' });
  }
});

export default router;
