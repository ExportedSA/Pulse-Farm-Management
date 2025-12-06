import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { insertTaskPinSchema } from '@shared/schema';

const router = Router();

// ===== TASK PINS =====

// Get all task pins with optional filters
router.get('/pins', async (req, res) => {
  try {
    const { status, priority, category, pastureId, assignedTo } = req.query;
    
    const filters: any = {};
    if (status) filters.status = status as string;
    if (priority) filters.priority = priority as string;
    if (category) filters.category = category as string;
    if (pastureId) filters.pastureId = pastureId as string;
    if (assignedTo) filters.assignedTo = assignedTo as string;
    
    const pins = await storage.getTaskPins(filters);
    res.json(pins);
  } catch (error) {
    console.error('Error fetching task pins:', error);
    res.status(500).json({ error: 'Failed to fetch task pins' });
  }
});

// Get task pin by ID
router.get('/pins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pin = await storage.getTaskPinById(id);
    
    if (!pin) {
      return res.status(404).json({ error: 'Task pin not found' });
    }
    
    res.json(pin);
  } catch (error) {
    console.error('Error fetching task pin:', error);
    res.status(500).json({ error: 'Failed to fetch task pin' });
  }
});

// Create new task pin
router.post('/pins', async (req, res) => {
  try {
    const validatedData = insertTaskPinSchema.parse(req.body);
    const pin = await storage.createTaskPin(validatedData);
    res.status(201).json(pin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid task pin data', details: error.errors });
    } else {
      console.error('Error creating task pin:', error);
      res.status(500).json({ error: 'Failed to create task pin' });
    }
  }
});

// Update task pin
router.put('/pins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const pin = await storage.updateTaskPin(id, updates);
    
    if (!pin) {
      return res.status(404).json({ error: 'Task pin not found' });
    }
    
    res.json(pin);
  } catch (error) {
    console.error('Error updating task pin:', error);
    res.status(500).json({ error: 'Failed to update task pin' });
  }
});

// Complete task pin
router.post('/pins/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { completedBy, notes } = req.body;
    
    const pin = await storage.completeTaskPin(id, completedBy, notes);
    
    if (!pin) {
      return res.status(404).json({ error: 'Task pin not found' });
    }
    
    res.json(pin);
  } catch (error) {
    console.error('Error completing task pin:', error);
    res.status(500).json({ error: 'Failed to complete task pin' });
  }
});

// Delete task pin
router.delete('/pins/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteTaskPin(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Task pin not found' });
    }
    
    res.json({ message: 'Task pin deleted successfully' });
  } catch (error) {
    console.error('Error deleting task pin:', error);
    res.status(500).json({ error: 'Failed to delete task pin' });
  }
});

// ===== DISTANCE CALCULATION =====

// Calculate distance between two points (Haversine formula)
router.post('/distance', async (req, res) => {
  try {
    const { lat1, lng1, lat2, lng2 } = req.body;
    
    if (!lat1 || !lng1 || !lat2 || !lng2) {
      return res.status(400).json({ error: 'Missing coordinates' });
    }
    
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    res.json({
      distanceKm: Math.round(distance * 1000) / 1000,
      distanceM: Math.round(distance * 1000),
      distanceMiles: Math.round(distance * 0.621371 * 1000) / 1000,
    });
  } catch (error) {
    console.error('Error calculating distance:', error);
    res.status(500).json({ error: 'Failed to calculate distance' });
  }
});

// Calculate area of polygon (in hectares)
router.post('/area', async (req, res) => {
  try {
    const { coordinates } = req.body; // Array of [lat, lng] pairs
    
    if (!coordinates || coordinates.length < 3) {
      return res.status(400).json({ error: 'Need at least 3 coordinates to calculate area' });
    }
    
    // Shoelace formula for polygon area
    let area = 0;
    const n = coordinates.length;
    
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += coordinates[i][1] * coordinates[j][0];
      area -= coordinates[j][1] * coordinates[i][0];
    }
    
    area = Math.abs(area) / 2;
    
    // Convert to hectares (approximate conversion at mid-latitudes)
    const avgLat = coordinates.reduce((sum: number, c: number[]) => sum + c[0], 0) / n;
    const metersPerDegreeLat = 111320;
    const metersPerDegreeLng = 111320 * Math.cos(avgLat * Math.PI / 180);
    
    const areaM2 = area * metersPerDegreeLat * metersPerDegreeLng;
    const areaHa = areaM2 / 10000;
    
    res.json({
      areaHectares: Math.round(areaHa * 100) / 100,
      areaAcres: Math.round(areaHa * 2.47105 * 100) / 100,
      areaSquareMeters: Math.round(areaM2),
    });
  } catch (error) {
    console.error('Error calculating area:', error);
    res.status(500).json({ error: 'Failed to calculate area' });
  }
});

// ===== MAP DATA AGGREGATION =====

// Get all map data (pastures, hazards, task pins) for rendering
router.get('/data', async (req, res) => {
  try {
    const [pastures, hazards, taskPins] = await Promise.all([
      storage.getPasturesWithBoundaries(),
      storage.getFarmHazards(),
      storage.getTaskPins({ status: 'pending' }),
    ]);
    
    res.json({
      pastures,
      hazards,
      taskPins,
    });
  } catch (error) {
    console.error('Error fetching map data:', error);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

// Get pins near a location
router.get('/pins/nearby', async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing coordinates' });
    }
    
    const pins = await storage.getTaskPinsNearby(
      parseFloat(lat as string),
      parseFloat(lng as string),
      parseFloat(radius as string) || 1 // Default 1km radius
    );
    
    res.json(pins);
  } catch (error) {
    console.error('Error fetching nearby pins:', error);
    res.status(500).json({ error: 'Failed to fetch nearby pins' });
  }
});

export default router;
