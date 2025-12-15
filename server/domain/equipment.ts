import { db } from '../db';
import { equipment, equipmentServiceHistory, type Equipment, type InsertEquipment } from '@shared/schema';
import { eq, and, desc, lt, gte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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
