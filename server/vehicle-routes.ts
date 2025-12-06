import { Router } from 'express';
import { z } from 'zod';
import { storage } from './storage';
import { VehicleAlertService } from './vehicle-alerts';
import { insertVehicleTypeSchema, insertVehicleSchema, insertVehicleInspectionTemplateSchema, 
         insertVehicleInspectionSchema, insertVehicleInspectionResultSchema, 
         insertVehicleMaintenanceRecordSchema } from '@shared/schema';

const router = Router();

// ===== VEHICLE TYPES =====

// Get all vehicle types
router.get('/types', async (req, res) => {
  try {
    const vehicleTypes = await storage.getVehicleTypes();
    res.json(vehicleTypes);
  } catch (error) {
    console.error('Error fetching vehicle types:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle types' });
  }
});

// Create vehicle type
router.post('/types', async (req, res) => {
  try {
    const validatedData = insertVehicleTypeSchema.parse(req.body);
    const vehicleType = await storage.createVehicleType(validatedData);
    res.status(201).json(vehicleType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid vehicle type data', details: error.errors });
    } else {
      console.error('Error creating vehicle type:', error);
      res.status(500).json({ error: 'Failed to create vehicle type' });
    }
  }
});

// Update vehicle type
router.put('/types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertVehicleTypeSchema.partial().parse(req.body);
    const vehicleType = await storage.updateVehicleType(id, validatedData);
    
    if (!vehicleType) {
      return res.status(404).json({ error: 'Vehicle type not found' });
    }
    
    res.json(vehicleType);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid vehicle type data', details: error.errors });
    } else {
      console.error('Error updating vehicle type:', error);
      res.status(500).json({ error: 'Failed to update vehicle type' });
    }
  }
});

// Delete vehicle type
router.delete('/types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteVehicleType(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Vehicle type not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting vehicle type:', error);
    res.status(500).json({ error: 'Failed to delete vehicle type' });
  }
});

// ===== VEHICLES =====

// Get all vehicles with optional filters
router.get('/', async (req, res) => {
  try {
    const { type, status, search } = req.query;
    const filters = {
      type: type as string,
      status: status as string,
      search: search as string,
    };
    
    const vehicles = await storage.getVehicles(filters);
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// ===== VEHICLE ALERTS (must be before /:id route) =====

// Get vehicle alerts
router.get('/alerts', async (req, res) => {
  try {
    const { vehicleId, type, severity } = req.query;
    
    const filters: any = {};
    if (vehicleId) filters.vehicleId = vehicleId;
    if (type) filters.type = type;
    if (severity) filters.severity = severity;
    
    // Filter for vehicle-related alert types
    const vehicleAlertTypes = [
      'vehicle_service_overdue', 'vehicle_service_due',
      'vehicle_wof_expired', 'vehicle_wof_expiring',
      'vehicle_cof_expired', 'vehicle_cof_expiring',
      'vehicle_registration_expired', 'vehicle_registration_expiring',
      'vehicle_ruc_expired', 'vehicle_ruc_expiring',
      'vehicle_inspection_overdue', 'vehicle_inspection_due',
      'vehicle_insurance_expired', 'vehicle_insurance_expiring',
    ];
    
    const alerts = await storage.getAlerts(filters);
    const vehicleAlerts = alerts.filter(alert => vehicleAlertTypes.includes(alert.type));
    
    res.json(vehicleAlerts);
  } catch (error) {
    console.error('Error fetching vehicle alerts:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle alerts' });
  }
});

// Generate vehicle compliance alerts (admin function)
router.post('/alerts/generate', async (req, res) => {
  try {
    await VehicleAlertService.generateVehicleAlerts();
    res.json({ message: 'Vehicle alerts generated successfully' });
  } catch (error) {
    console.error('Error generating vehicle alerts:', error);
    res.status(500).json({ error: 'Failed to generate vehicle alerts' });
  }
});

// Get upcoming compliance items for all vehicles
router.get('/compliance/upcoming', async (req, res) => {
  try {
    const { days } = req.query;
    const upcomingDays = days ? parseInt(days as string) : 30;
    
    const items = await VehicleAlertService.getUpcomingComplianceItems(upcomingDays);
    res.json(items);
  } catch (error) {
    console.error('Error fetching upcoming compliance items:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming compliance items' });
  }
});

// Get vehicle by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vehicle = await storage.getVehicleById(id);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(vehicle);
  } catch (error) {
    console.error('Error fetching vehicle:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle' });
  }
});

// Create vehicle
router.post('/', async (req, res) => {
  try {
    const validatedData = insertVehicleSchema.parse(req.body);
    const vehicle = await storage.createVehicle(validatedData);
    res.status(201).json(vehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid vehicle data', details: error.errors });
    } else {
      console.error('Error creating vehicle:', error);
      res.status(500).json({ error: 'Failed to create vehicle' });
    }
  }
});

// Update vehicle
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const validatedData = insertVehicleSchema.partial().parse(req.body);
    const vehicle = await storage.updateVehicle(id, validatedData);
    
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.json(vehicle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid vehicle data', details: error.errors });
    } else {
      console.error('Error updating vehicle:', error);
      res.status(500).json({ error: 'Failed to update vehicle' });
    }
  }
});

// Delete vehicle
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await storage.deleteVehicle(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
});

// ===== VEHICLE INSPECTIONS =====

// Get inspections for a vehicle
router.get('/:id/inspections', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit } = req.query;
    
    const inspections = await storage.getVehicleInspections(id, {
      status: status as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json(inspections);
  } catch (error) {
    console.error('Error fetching vehicle inspections:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle inspections' });
  }
});

// Create vehicle inspection
router.post('/:id/inspections', async (req, res) => {
  try {
    const { id } = req.params;
    const inspectionData = {
      ...insertVehicleInspectionSchema.parse(req.body),
      vehicleId: id,
    };
    
    const inspection = await storage.createVehicleInspection(inspectionData);
    res.status(201).json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid inspection data', details: error.errors });
    } else {
      console.error('Error creating vehicle inspection:', error);
      res.status(500).json({ error: 'Failed to create vehicle inspection' });
    }
  }
});

// Get inspection details
router.get('/inspections/:inspectionId', async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const inspection = await storage.getVehicleInspectionById(inspectionId);
    
    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    
    // Get inspection results
    const results = await storage.getVehicleInspectionResults(inspectionId);
    res.json({ ...inspection, results });
  } catch (error) {
    console.error('Error fetching inspection:', error);
    res.status(500).json({ error: 'Failed to fetch inspection' });
  }
});

// Complete inspection with results
router.post('/inspections/:inspectionId/complete', async (req, res) => {
  try {
    const { inspectionId } = req.params;
    const { results, overallStatus, notes } = req.body;
    
    // Validate results array
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'Results must be an array' });
    }
    
    // Update inspection
    const updatedInspection = await storage.updateVehicleInspection(inspectionId, {
      overallStatus,
      notes,
      completedAt: new Date(),
    });
    
    if (!updatedInspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    
    // Save inspection results
    for (const result of results) {
      const resultData = {
        ...insertVehicleInspectionResultSchema.parse(result),
        inspectionId,
      };
      await storage.createVehicleInspectionResult(resultData);
    }
    
    res.json(updatedInspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid inspection data', details: error.errors });
    } else {
      console.error('Error completing inspection:', error);
      res.status(500).json({ error: 'Failed to complete inspection' });
    }
  }
});

// ===== VEHICLE MAINTENANCE =====

// Get maintenance records for a vehicle
router.get('/:id/maintenance', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, limit } = req.query;
    
    const records = await storage.getVehicleMaintenanceRecords(id, {
      type: type as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json(records);
  } catch (error) {
    console.error('Error fetching maintenance records:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance records' });
  }
});

// Create maintenance record
router.post('/:id/maintenance', async (req, res) => {
  try {
    const { id } = req.params;
    const maintenanceData = {
      ...insertVehicleMaintenanceRecordSchema.parse(req.body),
      vehicleId: id,
    };
    
    const record = await storage.createVehicleMaintenanceRecord(maintenanceData);
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid maintenance data', details: error.errors });
    } else {
      console.error('Error creating maintenance record:', error);
      res.status(500).json({ error: 'Failed to create maintenance record' });
    }
  }
});

// ===== VEHICLE STATISTICS =====

// Get vehicle fleet statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await storage.getVehicleStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching vehicle stats:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle stats' });
  }
});

// Get upcoming inspections
router.get('/inspections/upcoming', async (req, res) => {
  try {
    const { days } = req.query;
    const upcomingDays = days ? parseInt(days as string) : 7;
    
    const inspections = await storage.getUpcomingInspections(upcomingDays);
    res.json(inspections);
  } catch (error) {
    console.error('Error fetching upcoming inspections:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming inspections' });
  }
});

// Get compliance status for a specific vehicle (must be after other routes)
router.get('/:id/compliance', async (req, res) => {
  try {
    const { id } = req.params;
    const compliance = await VehicleAlertService.getVehicleComplianceStatus(id);
    res.json(compliance);
  } catch (error) {
    console.error('Error fetching vehicle compliance:', error);
    res.status(500).json({ error: 'Failed to fetch vehicle compliance' });
  }
});

export default router;
