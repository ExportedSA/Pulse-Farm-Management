import { Router } from 'express';

const router = Router();

// Types
type EquipmentType = 
  | 'ear_tag'
  | 'collar'
  | 'sensor'
  | 'gps_tracker'
  | 'activity_monitor'
  | 'milk_meter'
  | 'bolus'
  | 'pedometer'
  | 'rfid_tag'
  | 'heat_detector'
  | 'other';

type EquipmentStatus = 'available' | 'assigned' | 'maintenance' | 'lost' | 'retired';

interface Equipment {
  id: string;
  type: EquipmentType;
  name: string;
  serialNumber?: string;
  manufacturer?: string;
  model?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  status: EquipmentStatus;
  assignedToAnimalId?: string;
  assignedToAnimalTag?: string;
  assignedToAnimalName?: string;
  assignedAt?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  notes?: string;
  batteryLevel?: number;
  lastReading?: string;
  createdAt: string;
  updatedAt: string;
}

interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  animalId: string;
  animalTag: string;
  animalName?: string;
  assignedAt: string;
  unassignedAt?: string;
  assignedBy: string;
  unassignedBy?: string;
  reason?: string;
  notes?: string;
}

interface MaintenanceRecord {
  id: string;
  equipmentId: string;
  type: 'routine' | 'repair' | 'battery_replacement' | 'calibration' | 'cleaning';
  description: string;
  performedAt: string;
  performedBy: string;
  cost?: number;
  notes?: string;
  nextScheduled?: string;
}

// In-memory storage
let equipment: Equipment[] = [];
let assignments: EquipmentAssignment[] = [];
let maintenanceRecords: MaintenanceRecord[] = [];
let idCounter = 1;

// Equipment type metadata
const EQUIPMENT_TYPES: Record<EquipmentType, { label: string; icon: string; description: string }> = {
  ear_tag: { label: 'Ear Tag', icon: '🏷️', description: 'Visual or RFID identification tag' },
  collar: { label: 'Collar', icon: '📿', description: 'Neck-mounted device for tracking or identification' },
  sensor: { label: 'Sensor', icon: '📡', description: 'General purpose sensor device' },
  gps_tracker: { label: 'GPS Tracker', icon: '📍', description: 'Location tracking device' },
  activity_monitor: { label: 'Activity Monitor', icon: '📊', description: 'Monitors movement and activity levels' },
  milk_meter: { label: 'Milk Meter', icon: '🥛', description: 'Measures milk production' },
  bolus: { label: 'Rumen Bolus', icon: '💊', description: 'Internal temperature/pH sensor' },
  pedometer: { label: 'Pedometer', icon: '👣', description: 'Step and movement counter' },
  rfid_tag: { label: 'RFID Tag', icon: '📶', description: 'Radio frequency identification' },
  heat_detector: { label: 'Heat Detector', icon: '🌡️', description: 'Detects estrus/heat cycles' },
  other: { label: 'Other', icon: '🔧', description: 'Other equipment type' },
};

// Generate demo data
function generateDemoData() {
  // Demo equipment
  equipment = [
    {
      id: 'eq-1',
      type: 'ear_tag',
      name: 'NAIT Tag #1234',
      serialNumber: 'NZ-1234-5678',
      manufacturer: 'Allflex',
      model: 'HDX EID',
      purchaseDate: '2024-01-15',
      status: 'assigned',
      assignedToAnimalId: 'animal-1',
      assignedToAnimalTag: 'NZ-1234',
      assignedToAnimalName: 'Daisy',
      assignedAt: '2024-01-20',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-20T10:00:00Z',
    },
    {
      id: 'eq-2',
      type: 'collar',
      name: 'Activity Collar A1',
      serialNumber: 'COL-2024-001',
      manufacturer: 'CowManager',
      model: 'SensOor',
      purchaseDate: '2024-02-01',
      status: 'assigned',
      assignedToAnimalId: 'animal-2',
      assignedToAnimalTag: 'NZ-1235',
      assignedToAnimalName: 'Bella',
      assignedAt: '2024-02-05',
      batteryLevel: 85,
      lastReading: new Date().toISOString(),
      createdAt: '2024-02-01T10:00:00Z',
      updatedAt: '2024-02-05T10:00:00Z',
    },
    {
      id: 'eq-3',
      type: 'gps_tracker',
      name: 'GPS Unit #5',
      serialNumber: 'GPS-2024-005',
      manufacturer: 'Moocall',
      model: 'HEAT',
      purchaseDate: '2024-03-01',
      status: 'assigned',
      assignedToAnimalId: 'animal-3',
      assignedToAnimalTag: 'NZ-1236',
      assignedToAnimalName: 'Rosie',
      assignedAt: '2024-03-10',
      batteryLevel: 72,
      lastReading: new Date(Date.now() - 3600000).toISOString(),
      createdAt: '2024-03-01T10:00:00Z',
      updatedAt: '2024-03-10T10:00:00Z',
    },
    {
      id: 'eq-4',
      type: 'heat_detector',
      name: 'Heat Patch #12',
      serialNumber: 'HP-2024-012',
      manufacturer: 'Estrotect',
      status: 'available',
      purchaseDate: '2024-04-01',
      createdAt: '2024-04-01T10:00:00Z',
      updatedAt: '2024-04-01T10:00:00Z',
    },
    {
      id: 'eq-5',
      type: 'bolus',
      name: 'Rumen Bolus #8',
      serialNumber: 'RB-2024-008',
      manufacturer: 'smaXtec',
      model: 'Classic',
      purchaseDate: '2024-01-20',
      status: 'assigned',
      assignedToAnimalId: 'animal-4',
      assignedToAnimalTag: 'NZ-1237',
      assignedToAnimalName: 'Clover',
      assignedAt: '2024-01-25',
      batteryLevel: 95,
      lastReading: new Date(Date.now() - 1800000).toISOString(),
      createdAt: '2024-01-20T10:00:00Z',
      updatedAt: '2024-01-25T10:00:00Z',
    },
    {
      id: 'eq-6',
      type: 'milk_meter',
      name: 'Milk Meter Bay 3',
      serialNumber: 'MM-2024-003',
      manufacturer: 'DeLaval',
      model: 'MM27',
      purchaseDate: '2023-06-01',
      status: 'maintenance',
      lastMaintenanceDate: '2024-10-01',
      nextMaintenanceDate: '2025-01-01',
      notes: 'Scheduled for calibration',
      createdAt: '2023-06-01T10:00:00Z',
      updatedAt: '2024-10-01T10:00:00Z',
    },
    {
      id: 'eq-7',
      type: 'ear_tag',
      name: 'NAIT Tag #1238',
      serialNumber: 'NZ-1238-9012',
      manufacturer: 'Allflex',
      model: 'HDX EID',
      purchaseDate: '2024-05-01',
      status: 'available',
      createdAt: '2024-05-01T10:00:00Z',
      updatedAt: '2024-05-01T10:00:00Z',
    },
    {
      id: 'eq-8',
      type: 'pedometer',
      name: 'Leg Pedometer #22',
      serialNumber: 'PED-2024-022',
      manufacturer: 'Afimilk',
      model: 'AfiAct II',
      purchaseDate: '2024-02-15',
      status: 'lost',
      notes: 'Lost during paddock move on 2024-09-15',
      createdAt: '2024-02-15T10:00:00Z',
      updatedAt: '2024-09-15T10:00:00Z',
    },
  ];

  // Demo assignment history
  assignments = [
    {
      id: 'assign-1',
      equipmentId: 'eq-1',
      animalId: 'animal-1',
      animalTag: 'NZ-1234',
      animalName: 'Daisy',
      assignedAt: '2024-01-20T10:00:00Z',
      assignedBy: 'John Smith',
    },
    {
      id: 'assign-2',
      equipmentId: 'eq-2',
      animalId: 'animal-2',
      animalTag: 'NZ-1235',
      animalName: 'Bella',
      assignedAt: '2024-02-05T10:00:00Z',
      assignedBy: 'Sarah Johnson',
    },
    {
      id: 'assign-3',
      equipmentId: 'eq-3',
      animalId: 'animal-old',
      animalTag: 'NZ-1200',
      animalName: 'Molly',
      assignedAt: '2024-01-01T10:00:00Z',
      unassignedAt: '2024-03-05T10:00:00Z',
      assignedBy: 'John Smith',
      unassignedBy: 'Mike Wilson',
      reason: 'Animal sold',
    },
    {
      id: 'assign-4',
      equipmentId: 'eq-3',
      animalId: 'animal-3',
      animalTag: 'NZ-1236',
      animalName: 'Rosie',
      assignedAt: '2024-03-10T10:00:00Z',
      assignedBy: 'Mike Wilson',
    },
  ];

  // Demo maintenance records
  maintenanceRecords = [
    {
      id: 'maint-1',
      equipmentId: 'eq-6',
      type: 'calibration',
      description: 'Annual calibration check',
      performedAt: '2024-10-01T10:00:00Z',
      performedBy: 'DeLaval Service',
      cost: 150,
      nextScheduled: '2025-01-01',
    },
    {
      id: 'maint-2',
      equipmentId: 'eq-2',
      type: 'battery_replacement',
      description: 'Replaced collar battery',
      performedAt: '2024-08-15T10:00:00Z',
      performedBy: 'John Smith',
      cost: 25,
    },
  ];
}

generateDemoData();

// ============================================
// EQUIPMENT ENDPOINTS
// ============================================

// Get all equipment
router.get('/', (req, res) => {
  const { type, status, assigned } = req.query;
  
  let filtered = [...equipment];
  
  if (type && type !== 'all') {
    filtered = filtered.filter(e => e.type === type);
  }
  
  if (status && status !== 'all') {
    filtered = filtered.filter(e => e.status === status);
  }
  
  if (assigned === 'true') {
    filtered = filtered.filter(e => e.assignedToAnimalId);
  } else if (assigned === 'false') {
    filtered = filtered.filter(e => !e.assignedToAnimalId);
  }
  
  // Add type metadata
  const enriched = filtered.map(e => ({
    ...e,
    typeInfo: EQUIPMENT_TYPES[e.type],
  }));
  
  // Summary stats
  const stats = {
    total: equipment.length,
    available: equipment.filter(e => e.status === 'available').length,
    assigned: equipment.filter(e => e.status === 'assigned').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    lost: equipment.filter(e => e.status === 'lost').length,
  };
  
  res.json({ equipment: enriched, stats });
});

// Get equipment types
router.get('/types', (req, res) => {
  const types = Object.entries(EQUIPMENT_TYPES).map(([key, value]) => ({
    id: key,
    ...value,
  }));
  res.json(types);
});

// Get single equipment
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const item = equipment.find(e => e.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Equipment not found' });
  }
  
  // Get assignment history
  const history = assignments.filter(a => a.equipmentId === id)
    .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  
  // Get maintenance records
  const maintenance = maintenanceRecords.filter(m => m.equipmentId === id)
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  
  res.json({
    ...item,
    typeInfo: EQUIPMENT_TYPES[item.type],
    assignmentHistory: history,
    maintenanceHistory: maintenance,
  });
});

// Create equipment
router.post('/', (req, res) => {
  const {
    type,
    name,
    serialNumber,
    manufacturer,
    model,
    purchaseDate,
    warrantyExpiry,
    notes,
  } = req.body;
  
  if (!type || !name) {
    return res.status(400).json({ error: 'Type and name are required' });
  }
  
  const newEquipment: Equipment = {
    id: `eq-${idCounter++}`,
    type,
    name,
    serialNumber,
    manufacturer,
    model,
    purchaseDate,
    warrantyExpiry,
    status: 'available',
    notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  equipment.push(newEquipment);
  
  res.status(201).json(newEquipment);
});

// Update equipment
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const item = equipment.find(e => e.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Equipment not found' });
  }
  
  const updates = req.body;
  Object.assign(item, updates, { updatedAt: new Date().toISOString() });
  
  res.json(item);
});

// Delete equipment
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  const index = equipment.findIndex(e => e.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Equipment not found' });
  }
  
  equipment.splice(index, 1);
  
  res.json({ success: true });
});

// ============================================
// ASSIGNMENT ENDPOINTS
// ============================================

// Assign equipment to animal
router.post('/:id/assign', (req, res) => {
  const { id } = req.params;
  const { animalId, animalTag, animalName, notes } = req.body;
  const userId = (req.user as any)?.id || 'demo-user';
  const userName = (req.user as any)?.name || 'Demo User';
  
  const item = equipment.find(e => e.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Equipment not found' });
  }
  
  if (item.status === 'assigned') {
    return res.status(400).json({ error: 'Equipment is already assigned' });
  }
  
  if (!animalId || !animalTag) {
    return res.status(400).json({ error: 'Animal ID and tag are required' });
  }
  
  const now = new Date().toISOString();
  
  // Update equipment
  item.status = 'assigned';
  item.assignedToAnimalId = animalId;
  item.assignedToAnimalTag = animalTag;
  item.assignedToAnimalName = animalName;
  item.assignedAt = now;
  item.updatedAt = now;
  
  // Create assignment record
  const assignment: EquipmentAssignment = {
    id: `assign-${idCounter++}`,
    equipmentId: id,
    animalId,
    animalTag,
    animalName,
    assignedAt: now,
    assignedBy: userName,
    notes,
  };
  assignments.push(assignment);
  
  res.json({ success: true, equipment: item, assignment });
});

// Unassign equipment from animal
router.post('/:id/unassign', (req, res) => {
  const { id } = req.params;
  const { reason, notes } = req.body;
  const userName = (req.user as any)?.name || 'Demo User';
  
  const item = equipment.find(e => e.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Equipment not found' });
  }
  
  if (item.status !== 'assigned') {
    return res.status(400).json({ error: 'Equipment is not assigned' });
  }
  
  const now = new Date().toISOString();
  
  // Update current assignment record
  const currentAssignment = assignments.find(
    a => a.equipmentId === id && !a.unassignedAt
  );
  if (currentAssignment) {
    currentAssignment.unassignedAt = now;
    currentAssignment.unassignedBy = userName;
    currentAssignment.reason = reason;
    if (notes) currentAssignment.notes = notes;
  }
  
  // Update equipment
  item.status = 'available';
  item.assignedToAnimalId = undefined;
  item.assignedToAnimalTag = undefined;
  item.assignedToAnimalName = undefined;
  item.assignedAt = undefined;
  item.updatedAt = now;
  
  res.json({ success: true, equipment: item });
});

// Get equipment for specific animal
router.get('/animal/:animalId', (req, res) => {
  const { animalId } = req.params;
  
  const animalEquipment = equipment.filter(e => e.assignedToAnimalId === animalId);
  const history = assignments.filter(a => a.animalId === animalId)
    .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());
  
  res.json({
    current: animalEquipment,
    history,
  });
});

// ============================================
// MAINTENANCE ENDPOINTS
// ============================================

// Log maintenance
router.post('/:id/maintenance', (req, res) => {
  const { id } = req.params;
  const { type, description, cost, notes, nextScheduled } = req.body;
  const userName = (req.user as any)?.name || 'Demo User';
  
  const item = equipment.find(e => e.id === id);
  
  if (!item) {
    return res.status(404).json({ error: 'Equipment not found' });
  }
  
  const now = new Date().toISOString();
  
  const record: MaintenanceRecord = {
    id: `maint-${idCounter++}`,
    equipmentId: id,
    type: type || 'routine',
    description,
    performedAt: now,
    performedBy: userName,
    cost,
    notes,
    nextScheduled,
  };
  maintenanceRecords.push(record);
  
  // Update equipment
  item.lastMaintenanceDate = now.split('T')[0];
  if (nextScheduled) {
    item.nextMaintenanceDate = nextScheduled;
  }
  item.updatedAt = now;
  
  // If was in maintenance status, set to available
  if (item.status === 'maintenance') {
    item.status = 'available';
  }
  
  res.json({ success: true, record, equipment: item });
});

// Get maintenance due
router.get('/maintenance/due', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  
  const due = equipment.filter(e => 
    e.nextMaintenanceDate && e.nextMaintenanceDate <= nextWeek
  ).map(e => ({
    ...e,
    typeInfo: EQUIPMENT_TYPES[e.type],
    isOverdue: e.nextMaintenanceDate! < today,
  }));
  
  res.json({
    due,
    overdue: due.filter(e => e.isOverdue).length,
    upcoming: due.filter(e => !e.isOverdue).length,
  });
});

// ============================================
// BULK OPERATIONS
// ============================================

// Bulk assign (e.g., assign tags to multiple animals)
router.post('/bulk-assign', (req, res) => {
  const { assignments: bulkAssignments } = req.body;
  const userName = (req.user as any)?.name || 'Demo User';
  const now = new Date().toISOString();
  
  const results: any[] = [];
  
  for (const { equipmentId, animalId, animalTag, animalName } of bulkAssignments) {
    const item = equipment.find(e => e.id === equipmentId);
    if (!item || item.status === 'assigned') continue;
    
    item.status = 'assigned';
    item.assignedToAnimalId = animalId;
    item.assignedToAnimalTag = animalTag;
    item.assignedToAnimalName = animalName;
    item.assignedAt = now;
    item.updatedAt = now;
    
    const assignment: EquipmentAssignment = {
      id: `assign-${idCounter++}`,
      equipmentId,
      animalId,
      animalTag,
      animalName,
      assignedAt: now,
      assignedBy: userName,
    };
    assignments.push(assignment);
    
    results.push({ equipmentId, animalId, success: true });
  }
  
  res.json({ success: true, results, count: results.length });
});

// Search equipment
router.get('/search/:query', (req, res) => {
  const { query } = req.params;
  const lowerQuery = query.toLowerCase();
  
  const results = equipment.filter(e =>
    e.name.toLowerCase().includes(lowerQuery) ||
    e.serialNumber?.toLowerCase().includes(lowerQuery) ||
    e.assignedToAnimalTag?.toLowerCase().includes(lowerQuery) ||
    e.assignedToAnimalName?.toLowerCase().includes(lowerQuery)
  ).map(e => ({
    ...e,
    typeInfo: EQUIPMENT_TYPES[e.type],
  }));
  
  res.json(results);
});

export default router;
