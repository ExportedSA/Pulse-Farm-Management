import { db } from '../db';
import { 
  equipment, 
  equipmentServiceHistory, 
  devices,
  deviceDataLogs,
  type Equipment, 
  type InsertEquipment,
  type Device,
  type InsertDevice,
  type DeviceDataLog,
} from '@shared/schema';
import { eq, and, desc, lt, gte, isNull, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ===== ERROR CLASSES =====

export class EquipmentNotFoundError extends Error {
  constructor(equipmentId: string) {
    super(`Equipment not found: ${equipmentId}`);
    this.name = 'EquipmentNotFoundError';
  }
}

export class DeviceNotFoundError extends Error {
  constructor(deviceId: string) {
    super(`Device not found: ${deviceId}`);
    this.name = 'DeviceNotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(message: string = 'Permission denied') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

export async function createEquipment(params: {
  farmId: string;
  name: string;
  type: string;
  model?: string;
  serialNumber?: string;
  manufacturer?: string;
  yearManufactured?: number;
  purchaseDate?: string;
  purchasePrice?: string;
  location?: string;
  status?: 'operational' | 'maintenance_due' | 'in_maintenance' | 'out_of_service';
  lastServiceDate?: string;
  nextServiceDue?: string;
  serviceIntervalDays?: number;
  warrantyExpiry?: string;
  notes?: string;
}): Promise<Equipment> {
  const [equipmentRecord] = await db.insert(equipment).values({
    id: nanoid(),
    ...params,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return equipmentRecord;
}

export async function listEquipment(
  farmId: string,
  options?: {
    status?: 'operational' | 'maintenance_due' | 'in_maintenance' | 'out_of_service';
    type?: string;
    includeInactive?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<Equipment[]> {
  const conditions = [eq(equipment.farmId, farmId)];
  
  if (!options?.includeInactive) {
    conditions.push(eq(equipment.isActive, true));
  }
  
  if (options?.status) {
    conditions.push(eq(equipment.status, options.status));
  }
  
  if (options?.type) {
    conditions.push(eq(equipment.type, options.type));
  }

  let query = db
    .select()
    .from(equipment)
    .where(and(...conditions))
    .orderBy(desc(equipment.createdAt));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

export async function getEquipment(id: string): Promise<Equipment | null> {
  const [equipmentRecord] = await db
    .select()
    .from(equipment)
    .where(eq(equipment.id, id))
    .limit(1);

  return equipmentRecord || null;
}

export async function updateEquipment(
  id: string,
  params: Partial<{
    name: string;
    type: string;
    model: string;
    serialNumber: string;
    manufacturer: string;
    yearManufactured: number;
    purchaseDate: string;
    purchasePrice: string;
    location: string;
    status: 'operational' | 'maintenance_due' | 'in_maintenance' | 'out_of_service';
    lastServiceDate: string;
    nextServiceDue: string;
    serviceIntervalDays: number;
    warrantyExpiry: string;
    notes: string;
    isActive: boolean;
  }>
): Promise<Equipment | null> {
  const [equipmentRecord] = await db
    .update(equipment)
    .set({
      ...params,
      updatedAt: new Date(),
    })
    .where(eq(equipment.id, id))
    .returning();

  return equipmentRecord || null;
}

export async function deleteEquipment(id: string): Promise<boolean> {
  // Soft delete by setting isActive to false
  const result = await db
    .update(equipment)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(equipment.id, id));

  return result.rowCount > 0;
}

export async function getEquipmentDueForService(
  farmId: string,
  daysAhead: number = 30
): Promise<Equipment[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + daysAhead);

  return await db
    .select()
    .from(equipment)
    .where(
      and(
        eq(equipment.farmId, farmId),
        eq(equipment.isActive, true),
        gte(equipment.nextServiceDue, today.toISOString().split('T')[0]),
        lt(equipment.nextServiceDue, futureDate.toISOString().split('T')[0])
      )
    )
    .orderBy(equipment.nextServiceDue);
}

export async function getEquipmentOverdueForService(farmId: string): Promise<Equipment[]> {
  const today = new Date().toISOString().split('T')[0];

  return await db
    .select()
    .from(equipment)
    .where(
      and(
        eq(equipment.farmId, farmId),
        eq(equipment.isActive, true),
        lt(equipment.nextServiceDue, today)
      )
    )
    .orderBy(equipment.nextServiceDue);
}

export async function searchEquipment(
  farmId: string,
  searchTerm: string,
  limit: number = 50
): Promise<Equipment[]> {
  return await db
    .select()
    .from(equipment)
    .where(
      and(
        eq(equipment.farmId, farmId),
        eq(equipment.isActive, true),
        // Search in multiple fields
        `(
          ${equipment.name} ILIKE ${'%' + searchTerm + '%'} OR
          ${equipment.type} ILIKE ${'%' + searchTerm + '%'} OR
          ${equipment.model} ILIKE ${'%' + searchTerm + '%'} OR
          ${equipment.serialNumber} ILIKE ${'%' + searchTerm + '%'} OR
          ${equipment.manufacturer} ILIKE ${'%' + searchTerm + '%'}
        )`
      )
    )
    .limit(limit);
}

export async function logServiceHistory(params: {
  equipmentId: string;
  serviceDate: string;
  serviceType: string;
  description?: string;
  cost?: string;
  performedBy?: string;
  nextServiceDue?: string;
  notes?: string;
}): Promise<any> {
  const [serviceRecord] = await db.insert(equipmentServiceHistory).values({
    id: nanoid(),
    ...params,
    createdAt: new Date(),
  }).returning();

  // Update the equipment's last service date and next service due
  if (params.nextServiceDue) {
    await updateEquipment(params.equipmentId, {
      lastServiceDate: params.serviceDate,
      nextServiceDue: params.nextServiceDue,
      status: 'operational', // Reset to operational after service
    });
  } else {
    await updateEquipment(params.equipmentId, {
      lastServiceDate: params.serviceDate,
    });
  }

  return serviceRecord;
}

export async function getEquipmentServiceHistory(equipmentId: string): Promise<any[]> {
  return await db
    .select()
    .from(equipmentServiceHistory)
    .where(eq(equipmentServiceHistory.equipmentId, equipmentId))
    .orderBy(desc(equipmentServiceHistory.serviceDate));
}

// ===== DEVICE MANAGEMENT =====

/**
 * Register a new IoT device
 */
export async function registerDevice(params: {
  farmId: string;
  equipmentId?: string;
  name: string;
  type: 'temperature_sensor' | 'humidity_sensor' | 'gps_tracker' | 'water_level_sensor' | 
        'milk_meter' | 'weight_scale' | 'camera' | 'weather_station' | 'soil_sensor' | 
        'fence_monitor' | 'tank_level_sensor' | 'other';
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  location?: string;
  latitude?: string;
  longitude?: string;
  config?: Record<string, any>;
  alertThresholds?: { min?: number; max?: number; unit?: string; alertOnOffline?: boolean };
  notes?: string;
}): Promise<Device> {
  // Validate equipment exists if provided
  if (params.equipmentId) {
    const equip = await getEquipment(params.equipmentId);
    if (!equip) {
      throw new EquipmentNotFoundError(params.equipmentId);
    }
    if (equip.farmId !== params.farmId) {
      throw new ValidationError('Equipment does not belong to this farm');
    }
  }

  const [device] = await db.insert(devices).values({
    id: nanoid(),
    ...params,
    status: 'offline', // New devices start offline until they ping
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).returning();

  return device;
}

/**
 * List all devices for a farm
 */
export async function listDevices(
  farmId: string,
  options?: {
    equipmentId?: string;
    type?: string;
    status?: 'online' | 'offline' | 'error' | 'maintenance';
    includeInactive?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<Device[]> {
  const conditions = [eq(devices.farmId, farmId)];

  if (!options?.includeInactive) {
    conditions.push(eq(devices.isActive, true));
  }

  if (options?.equipmentId) {
    conditions.push(eq(devices.equipmentId, options.equipmentId));
  }

  if (options?.type) {
    conditions.push(eq(devices.type, options.type as any));
  }

  if (options?.status) {
    conditions.push(eq(devices.status, options.status));
  }

  let query = db
    .select()
    .from(devices)
    .where(and(...conditions))
    .orderBy(desc(devices.lastSeenAt));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

/**
 * Get a single device by ID
 */
export async function getDevice(deviceId: string, farmId?: string): Promise<Device | null> {
  const conditions = [eq(devices.id, deviceId)];
  if (farmId) {
    conditions.push(eq(devices.farmId, farmId));
  }

  const [device] = await db
    .select()
    .from(devices)
    .where(and(...conditions))
    .limit(1);

  return device || null;
}

/**
 * Update device information
 */
export async function updateDevice(
  deviceId: string,
  farmId: string,
  params: Partial<{
    name: string;
    equipmentId: string | null;
    type: string;
    serialNumber: string;
    manufacturer: string;
    model: string;
    firmwareVersion: string;
    status: 'online' | 'offline' | 'error' | 'maintenance';
    location: string;
    latitude: string;
    longitude: string;
    config: Record<string, any>;
    alertThresholds: { min?: number; max?: number; unit?: string; alertOnOffline?: boolean };
    notes: string;
    isActive: boolean;
  }>
): Promise<Device> {
  const existing = await getDevice(deviceId, farmId);
  if (!existing) {
    throw new DeviceNotFoundError(deviceId);
  }

  // Validate equipment if being linked
  if (params.equipmentId) {
    const equip = await getEquipment(params.equipmentId);
    if (!equip || equip.farmId !== farmId) {
      throw new ValidationError('Equipment does not belong to this farm');
    }
  }

  const [device] = await db
    .update(devices)
    .set({
      ...params,
      updatedAt: new Date(),
    })
    .where(and(eq(devices.id, deviceId), eq(devices.farmId, farmId)))
    .returning();

  return device;
}

/**
 * Update device status (typically called when device pings or goes offline)
 */
export async function updateDeviceStatus(
  deviceId: string,
  status: 'online' | 'offline' | 'error' | 'maintenance',
  lastData?: Record<string, any>
): Promise<Device> {
  const updateData: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'online') {
    updateData.lastSeenAt = new Date();
  }

  if (lastData) {
    updateData.lastData = lastData;
  }

  const [device] = await db
    .update(devices)
    .set(updateData)
    .where(eq(devices.id, deviceId))
    .returning();

  if (!device) {
    throw new DeviceNotFoundError(deviceId);
  }

  return device;
}

/**
 * Delete (deactivate) a device
 */
export async function deleteDevice(deviceId: string, farmId: string): Promise<boolean> {
  const result = await db
    .update(devices)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(devices.id, deviceId), eq(devices.farmId, farmId)));

  return result.rowCount > 0;
}

/**
 * Log device data reading
 */
export async function logDeviceData(params: {
  deviceId: string;
  timestamp: Date;
  data: Record<string, any>;
  temperature?: string;
  humidity?: string;
  batteryLevel?: number;
  signalStrength?: number;
}): Promise<DeviceDataLog> {
  // Update device status to online and store last data
  await updateDeviceStatus(params.deviceId, 'online', params.data);

  const [log] = await db.insert(deviceDataLogs).values({
    id: nanoid(),
    ...params,
    createdAt: new Date(),
  }).returning();

  return log;
}

/**
 * Get device data logs
 */
export async function getDeviceDataLogs(
  deviceId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<DeviceDataLog[]> {
  const conditions = [eq(deviceDataLogs.deviceId, deviceId)];

  if (options?.startDate) {
    conditions.push(gte(deviceDataLogs.timestamp, options.startDate));
  }

  if (options?.endDate) {
    conditions.push(lt(deviceDataLogs.timestamp, options.endDate));
  }

  let query = db
    .select()
    .from(deviceDataLogs)
    .where(and(...conditions))
    .orderBy(desc(deviceDataLogs.timestamp));

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  if (options?.offset) {
    query = query.offset(options.offset);
  }

  return await query;
}

/**
 * Get devices that are offline (haven't pinged recently)
 */
export async function getOfflineDevices(
  farmId: string,
  offlineThresholdMinutes: number = 30
): Promise<Device[]> {
  const threshold = new Date();
  threshold.setMinutes(threshold.getMinutes() - offlineThresholdMinutes);

  return await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.farmId, farmId),
        eq(devices.isActive, true),
        eq(devices.status, 'online'), // Currently marked online but hasn't pinged
        lt(devices.lastSeenAt, threshold)
      )
    );
}

/**
 * Get devices with alerts (readings outside thresholds)
 */
export async function getDevicesWithAlerts(farmId: string): Promise<Device[]> {
  // Get all active devices with alert thresholds configured
  const allDevices = await db
    .select()
    .from(devices)
    .where(
      and(
        eq(devices.farmId, farmId),
        eq(devices.isActive, true),
        isNotNull(devices.alertThresholds),
        isNotNull(devices.lastData)
      )
    );

  // Filter devices where last data exceeds thresholds
  return allDevices.filter(device => {
    if (!device.alertThresholds || !device.lastData) return false;
    
    const thresholds = device.alertThresholds as { min?: number; max?: number };
    const data = device.lastData as Record<string, any>;
    
    // Check common sensor values
    const value = data.value ?? data.temperature ?? data.humidity ?? data.level;
    if (typeof value !== 'number') return false;
    
    if (thresholds.min !== undefined && value < thresholds.min) return true;
    if (thresholds.max !== undefined && value > thresholds.max) return true;
    
    return false;
  });
}

/**
 * Get equipment with its associated devices
 */
export async function getEquipmentWithDevices(equipmentId: string): Promise<{
  equipment: Equipment;
  devices: Device[];
} | null> {
  const equip = await getEquipment(equipmentId);
  if (!equip) return null;

  const equipDevices = await listDevices(equip.farmId, { equipmentId });

  return {
    equipment: equip,
    devices: equipDevices,
  };
}

// ===== PERMISSION HELPERS =====

const EQUIPMENT_MANAGER_ROLES = ['owner', 'manager', 'admin', 'maintenance'];

/**
 * Check if user can manage equipment (create, update, delete)
 */
export function canManageEquipment(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return EQUIPMENT_MANAGER_ROLES.includes(userRole.toLowerCase());
}

/**
 * Check if user can log maintenance
 */
export function canLogMaintenance(userRole: string | undefined): boolean {
  if (!userRole) return false;
  return EQUIPMENT_MANAGER_ROLES.includes(userRole.toLowerCase());
}
