/**
 * IoT Integration API Routes
 */

import { Router, Request, Response } from 'express';
import { iotService } from '../services/iot-service';

const router = Router();

// ============ Device Management ============

// Get all devices
router.get('/api/iot/devices', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;
    const devices = iotService.getDevices(type as any);
    res.json({ success: true, data: devices });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch devices' });
  }
});

// Get device by ID
router.get('/api/iot/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const device = iotService.getDevice(req.params.deviceId);
    if (!device) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true, data: device });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch device' });
  }
});

// Register new device
router.post('/api/iot/devices', async (req: Request, res: Response) => {
  try {
    const device = iotService.registerDevice(req.body);
    res.json({ success: true, data: device });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to register device' });
  }
});

// Update device status
router.patch('/api/iot/devices/:deviceId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const success = iotService.updateDeviceStatus(req.params.deviceId, status);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update device status' });
  }
});

// Delete device
router.delete('/api/iot/devices/:deviceId', async (req: Request, res: Response) => {
  try {
    const success = iotService.removeDevice(req.params.deviceId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Device not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete device' });
  }
});

// Get device statistics
router.get('/api/iot/stats', async (req: Request, res: Response) => {
  try {
    const stats = iotService.getDeviceStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch device stats' });
  }
});

// ============ Sensor Readings ============

// Get milk meter readings
router.get('/api/iot/readings/milk', async (req: Request, res: Response) => {
  try {
    const { deviceId, limit } = req.query;
    const readings = await iotService.getMilkMeterReadings(
      deviceId as string,
      limit ? parseInt(limit as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch milk readings' });
  }
});

// Get EID readings
router.get('/api/iot/readings/eid', async (req: Request, res: Response) => {
  try {
    const { deviceId, limit } = req.query;
    const readings = await iotService.getEIDReadings(
      deviceId as string,
      limit ? parseInt(limit as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch EID readings' });
  }
});

// Get weather readings
router.get('/api/iot/readings/weather', async (req: Request, res: Response) => {
  try {
    const { deviceId, hours } = req.query;
    const readings = await iotService.getWeatherReadings(
      deviceId as string,
      hours ? parseInt(hours as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch weather readings' });
  }
});

// Get soil sensor readings
router.get('/api/iot/readings/soil', async (req: Request, res: Response) => {
  try {
    const { deviceId, days } = req.query;
    const readings = await iotService.getSoilReadings(
      deviceId as string,
      days ? parseInt(days as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch soil readings' });
  }
});

// Get water meter readings
router.get('/api/iot/readings/water', async (req: Request, res: Response) => {
  try {
    const { deviceId, days } = req.query;
    const readings = await iotService.getWaterReadings(
      deviceId as string,
      days ? parseInt(days as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch water readings' });
  }
});

// Get fence monitor readings
router.get('/api/iot/readings/fence', async (req: Request, res: Response) => {
  try {
    const { deviceId, hours } = req.query;
    const readings = await iotService.getFenceReadings(
      deviceId as string,
      hours ? parseInt(hours as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch fence readings' });
  }
});

// Get GPS collar readings
router.get('/api/iot/readings/gps', async (req: Request, res: Response) => {
  try {
    const { deviceId, hours } = req.query;
    const readings = await iotService.getGPSCollarReadings(
      deviceId as string,
      hours ? parseInt(hours as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch GPS readings' });
  }
});

// Get vat sensor readings
router.get('/api/iot/readings/vat', async (req: Request, res: Response) => {
  try {
    const { deviceId, hours } = req.query;
    const readings = await iotService.getVatReadings(
      deviceId as string,
      hours ? parseInt(hours as string) : undefined
    );
    res.json({ success: true, data: readings });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch vat readings' });
  }
});

// ============ Alerts ============

// Get alerts
router.get('/api/iot/alerts', async (req: Request, res: Response) => {
  try {
    const { acknowledged } = req.query;
    const alerts = iotService.getAlerts(
      acknowledged !== undefined ? acknowledged === 'true' : undefined
    );
    res.json({ success: true, data: alerts });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch alerts' });
  }
});

// Create alert
router.post('/api/iot/alerts', async (req: Request, res: Response) => {
  try {
    const alert = iotService.createAlert(req.body);
    res.json({ success: true, data: alert });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

// Acknowledge alert
router.post('/api/iot/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const success = iotService.acknowledgeAlert(req.params.alertId, userId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
  }
});

// Resolve alert
router.post('/api/iot/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const success = iotService.resolveAlert(req.params.alertId);
    if (!success) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resolve alert' });
  }
});

// ============ Dashboard ============

// Get IoT dashboard data
router.get('/api/iot/dashboard', async (req: Request, res: Response) => {
  try {
    const data = await iotService.getDashboardData();
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard data' });
  }
});

export default router;
