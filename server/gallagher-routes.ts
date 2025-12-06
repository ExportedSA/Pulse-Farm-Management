import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Gallagher API configuration
const GALLAGHER_API_BASE = 'https://api.gallagher.com/v1';
const GALLAGHER_API_KEY = process.env.GALLAGHER_API_KEY || 'demo-key';

interface WeighScaleData {
  deviceId: string;
  timestamp: string;
  animalId?: string;
  weight: number;
  unit: 'kg' | 'lbs';
  temperature?: number;
  humidity?: number;
  batteryLevel?: number;
  signalStrength?: number;
  location?: string;
  notes?: string;
}

interface ScaleDevice {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  lastSeen: string;
  batteryLevel: number;
  status: 'online' | 'offline' | 'maintenance';
  location: string;
}

interface WeighSession {
  id: string;
  deviceId: string;
  startTime: string;
  endTime?: string;
  animalCount: number;
  totalWeight: number;
  averageWeight: number;
  minWeight: number;
  maxWeight: number;
  status: 'active' | 'completed' | 'paused';
  notes?: string;
}

// Mock weigh scale data for demo purposes
const getMockWeighData = (deviceId: string): WeighScaleData => {
  return {
    deviceId,
    timestamp: new Date().toISOString(),
    animalId: `ANIMAL-${Math.floor(Math.random() * 1000).toString().padStart(4, '0')}`,
    weight: Math.round(Math.random() * 500 + 200), // 200-700kg typical dairy cow weight
    unit: 'kg',
    temperature: Math.round(Math.random() * 15 + 15), // 15-30°C
    humidity: Math.round(Math.random() * 40 + 40), // 40-80%
    batteryLevel: Math.round(Math.random() * 100),
    signalStrength: Math.round(Math.random() * 100),
    location: 'Main Yard',
    notes: 'Automatic weighing session',
  };
};

const getMockDevices = (): ScaleDevice[] => {
  return [
    {
      id: 'gallagher-001',
      name: 'Main Yard Scale',
      model: 'Gallagher W210',
      serialNumber: 'GW210001234',
      firmwareVersion: '2.1.3',
      lastSeen: new Date().toISOString(),
      batteryLevel: 85,
      status: 'online',
      location: 'Main Yard',
    },
    {
      id: 'gallagher-002',
      name: 'Milking Parlour Scale',
      model: 'Gallagher W210',
      serialNumber: 'GW210005678',
      firmwareVersion: '2.1.3',
      lastSeen: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      batteryLevel: 92,
      status: 'online',
      location: 'Milking Parlour',
    },
    {
      id: 'gallagher-003',
      name: 'Mobile Scale Unit',
      model: 'Gallagher W200',
      serialNumber: 'GW200009012',
      firmwareVersion: '1.9.7',
      lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      batteryLevel: 45,
      status: 'offline',
      location: 'Field 3',
    },
  ];
};

// Get all connected weigh scale devices
router.get('/devices', async (req, res) => {
  try {
    // In production, this would call Gallagher API
    // const response = await fetch(`${GALLAGHER_API_BASE}/devices?apikey=${GALLAGHER_API_KEY}`);
    // const devices = await response.json();
    
    // For demo, return mock devices
    const devices = getMockDevices();
    
    res.json({
      devices,
      totalDevices: devices.length,
      onlineDevices: devices.filter(d => d.status === 'online').length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching Gallagher devices:', error);
    res.status(500).json({ error: 'Failed to fetch Gallagher devices' });
  }
});

// Get device by ID
router.get('/devices/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const devices = getMockDevices();
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    res.json(device);
  } catch (error) {
    console.error('Error fetching Gallagher device:', error);
    res.status(500).json({ error: 'Failed to fetch Gallagher device' });
  }
});

// Get recent weigh data
router.get('/weigh-data/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50, startDate, endDate } = req.query;
    
    // Generate mock weigh data
    const weighData: WeighScaleData[] = [];
    const dataPoints = Math.min(parseInt(limit as string), 200);
    
    for (let i = 0; i < dataPoints; i++) {
      const timestamp = new Date(Date.now() - i * 30 * 60 * 1000); // Every 30 minutes
      const data = getMockWeighData(deviceId);
      data.timestamp = timestamp.toISOString();
      
      // Apply date filters
      if (startDate && new Date(data.timestamp) < new Date(startDate as string)) continue;
      if (endDate && new Date(data.timestamp) > new Date(endDate as string)) continue;
      
      weighData.push(data);
    }
    
    res.json({
      deviceId,
      weighData: weighData.reverse(), // Most recent first
      totalRecords: weighData.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching weigh data:', error);
    res.status(500).json({ error: 'Failed to fetch weigh data' });
  }
});

// Get live weighing data
router.get('/live/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Simulate real-time data
    const liveData = getMockWeighData(deviceId);
    
    res.json({
      ...liveData,
      isLive: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching live weigh data:', error);
    res.status(500).json({ error: 'Failed to fetch live weigh data' });
  }
});

// Start weighing session
router.post('/sessions/start', async (req, res) => {
  try {
    const { deviceId, notes } = req.body;
    
    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }
    
    const session: WeighSession = {
      id: `session-${Date.now()}`,
      deviceId,
      startTime: new Date().toISOString(),
      animalCount: 0,
      totalWeight: 0,
      averageWeight: 0,
      minWeight: 0,
      maxWeight: 0,
      status: 'active',
      notes,
    };
    
    res.status(201).json({
      message: 'Weighing session started',
      session,
    });
  } catch (error) {
    console.error('Error starting weighing session:', error);
    res.status(500).json({ error: 'Failed to start weighing session' });
  }
});

// End weighing session
router.post('/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { notes } = req.body;
    
    // In production, this would update the session in database
    const session: WeighSession = {
      id: sessionId,
      deviceId: 'gallagher-001',
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date().toISOString(),
      animalCount: Math.floor(Math.random() * 50 + 10),
      totalWeight: Math.floor(Math.random() * 15000 + 5000),
      averageWeight: Math.floor(Math.random() * 100 + 300),
      minWeight: Math.floor(Math.random() * 50 + 200),
      maxWeight: Math.floor(Math.random() * 100 + 500),
      status: 'completed',
      notes,
    };
    
    res.json({
      message: 'Weighing session ended',
      session,
    });
  } catch (error) {
    console.error('Error ending weighing session:', error);
    res.status(500).json({ error: 'Failed to end weighing session' });
  }
});

// Get weighing sessions
router.get('/sessions', async (req, res) => {
  try {
    const { deviceId, limit = 20 } = req.query;
    
    // Generate mock sessions
    const sessions: WeighSession[] = [];
    const sessionCount = Math.min(parseInt(limit as string), 50);
    
    for (let i = 0; i < sessionCount; i++) {
      const startTime = new Date(Date.now() - i * 24 * 60 * 60 * 1000); // Daily sessions
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000); // 2 hour sessions
      
      sessions.push({
        id: `session-${startTime.getTime()}`,
        deviceId: deviceId as string || ['gallagher-001', 'gallagher-002', 'gallagher-003'][Math.floor(Math.random() * 3)],
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        animalCount: Math.floor(Math.random() * 50 + 10),
        totalWeight: Math.floor(Math.random() * 15000 + 5000),
        averageWeight: Math.floor(Math.random() * 100 + 300),
        minWeight: Math.floor(Math.random() * 50 + 200),
        maxWeight: Math.floor(Math.random() * 100 + 500),
        status: 'completed',
        notes: i === 0 ? 'Most recent session' : undefined,
      });
    }
    
    res.json({
      sessions,
      totalSessions: sessions.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching weighing sessions:', error);
    res.status(500).json({ error: 'Failed to fetch weighing sessions' });
  }
});

// Get weight analytics
router.get('/analytics/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { period = '7d' } = req.query;
    
    // Calculate period in days
    const periodDays = parseInt(period.toString().replace('d', ''));
    
    // Generate analytics data
    const analytics = {
      deviceId,
      period,
      summary: {
        totalWeighings: Math.floor(Math.random() * 500 + 100),
        averageWeight: Math.floor(Math.random() * 50 + 350),
        weightTrend: Math.random() > 0.5 ? 'increasing' : 'stable',
        totalAnimals: Math.floor(Math.random() * 200 + 50),
        activeDays: periodDays - Math.floor(Math.random() * 3),
      },
      dailyAverages: Array.from({ length: Math.min(periodDays, 30) }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        averageWeight: Math.floor(Math.random() * 50 + 350),
        animalCount: Math.floor(Math.random() * 30 + 10),
        totalWeight: Math.floor(Math.random() * 5000 + 2000),
      })).reverse(),
      weightDistribution: {
        under300kg: Math.floor(Math.random() * 10 + 5),
        between300and400kg: Math.floor(Math.random() * 40 + 30),
        between400and500kg: Math.floor(Math.random() * 30 + 20),
        over500kg: Math.floor(Math.random() * 15 + 5),
      },
      deviceHealth: {
        batteryLevel: Math.floor(Math.random() * 30 + 70),
        signalStrength: Math.floor(Math.random() * 20 + 80),
        uptime: '99.2%',
        lastCalibration: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      },
    };
    
    res.json(analytics);
  } catch (error) {
    console.error('Error generating weight analytics:', error);
    res.status(500).json({ error: 'Failed to generate weight analytics' });
  }
});

// Sync weigh data with farm records
router.post('/sync/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { startDate, endDate, autoCreateAnimals = false } = req.body;
    
    // In production, this would:
    // 1. Fetch weigh data from Gallagher API
    // 2. Match with existing animal records
    // 3. Create new animal records if needed
    // 4. Update animal weights in the system
    
    const syncResult = {
      deviceId,
      syncDate: new Date().toISOString(),
      period: { startDate, endDate },
      recordsProcessed: Math.floor(Math.random() * 100 + 20),
      animalsUpdated: Math.floor(Math.random() * 50 + 10),
      animalsCreated: autoCreateAnimals ? Math.floor(Math.random() * 10 + 2) : 0,
      errors: 0,
      nextSync: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    
    res.json({
      message: 'Weigh data synchronized successfully',
      result: syncResult,
    });
  } catch (error) {
    console.error('Error syncing weigh data:', error);
    res.status(500).json({ error: 'Failed to sync weigh data' });
  }
});

// Device calibration
router.post('/calibrate/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { testWeight, unit = 'kg' } = req.body;
    
    if (!testWeight) {
      return res.status(400).json({ error: 'Test weight is required for calibration' });
    }
    
    // In production, this would send calibration command to device
    const calibrationResult = {
      deviceId,
      calibrationDate: new Date().toISOString(),
      testWeight,
      unit,
      measuredWeight: Math.round(testWeight * (0.99 + Math.random() * 0.02)), // Simulate slight variation
      accuracy: Math.round((100 - Math.random() * 2) * 100) / 100, // 98-100% accuracy
      status: Math.random() > 0.1 ? 'success' : 'failed',
      nextCalibrationDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    
    res.json({
      message: 'Device calibration completed',
      result: calibrationResult,
    });
  } catch (error) {
    console.error('Error calibrating device:', error);
    res.status(500).json({ error: 'Failed to calibrate device' });
  }
});

export default router;
