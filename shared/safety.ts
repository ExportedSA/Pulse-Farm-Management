// Health & safety lists shared by the server and the screens (NZ farms, HSWA 2015).

// What kind of hazard it is. Keys are stored on the hazard (farm_hazards.type).
export const HAZARD_CATEGORIES = [
  { key: 'vehicles', label: 'Vehicles (quad bikes, tractors, side-by-sides)' },
  { key: 'machinery', label: 'Machinery and equipment' },
  { key: 'livestock', label: 'Livestock' },
  { key: 'water', label: 'Water (dams, ponds, rivers, troughs)' },
  { key: 'effluent', label: 'Effluent ponds and sumps' },
  { key: 'electrical', label: 'Electrical (overhead lines, electric fences)' },
  { key: 'chemical', label: 'Chemicals and fuel' },
  { key: 'terrain', label: 'Terrain (steep slopes, tomos, holes, banks)' },
  { key: 'confined_space', label: 'Confined spaces (silos, tanks, pits)' },
  { key: 'height', label: 'Working at height' },
  { key: 'infrastructure', label: 'Buildings, fences and structures' },
  { key: 'environmental', label: 'Environmental (flooding, fire, weather)' },
  { key: 'biosecurity', label: 'Biosecurity' },
  { key: 'other', label: 'Other' },
] as const;

export type HazardCategory = (typeof HAZARD_CATEGORIES)[number]['key'];

export const hazardCategoryLabel = (key: string | null | undefined) =>
  HAZARD_CATEGORIES.find(c => c.key === key)?.label ?? (key ? key.replace(/_/g, ' ') : 'Other');

export const HAZARD_STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'monitoring', label: 'Controlled, monitoring' },
  { key: 'resolved', label: 'Resolved' },
] as const;

export type HazardStatus = (typeof HAZARD_STATUSES)[number]['key'];

// Risk is scored 1 (low) to 5 (highest) by the person assessing it
export const riskColour = (risk: number | null | undefined) =>
  risk == null ? '#868e96' : risk >= 5 ? '#c92a2a' : risk >= 4 ? '#e8590c' : risk >= 3 ? '#f59f00' : '#2f9e44';

// Points of interest on the farm map. `mark` is the short text shown in the map marker.
export const POI_TYPES = [
  { key: 'first_aid', label: 'First aid kit', mark: '+', colour: '#2f9e44' },
  { key: 'aed', label: 'Defibrillator (AED)', mark: 'AED', colour: '#2f9e44' },
  { key: 'fire_extinguisher', label: 'Fire extinguisher', mark: 'FE', colour: '#c92a2a' },
  { key: 'assembly_point', label: 'Emergency assembly point', mark: 'AP', colour: '#2f9e44' },
  { key: 'chemical_store', label: 'Chemical store', mark: 'CH', colour: '#9c36b5' },
  { key: 'fuel_store', label: 'Fuel store', mark: 'FU', colour: '#e8590c' },
  { key: 'power_isolation', label: 'Power isolation switch', mark: 'PW', colour: '#f59f00' },
  { key: 'water_supply', label: 'Water supply or bore', mark: 'W', colour: '#1971c2' },
  { key: 'gate', label: 'Gate', mark: 'G', colour: '#495057' },
  { key: 'bridge', label: 'Bridge or culvert', mark: 'BR', colour: '#495057' },
  { key: 'helicopter', label: 'Helicopter landing site', mark: 'H', colour: '#1971c2' },
  { key: 'shed', label: 'Shed or office', mark: 'SH', colour: '#495057' },
  { key: 'other', label: 'Other', mark: '•', colour: '#495057' },
] as const;

export type PoiType = (typeof POI_TYPES)[number]['key'];

export const poiType = (key: string | null | undefined) => POI_TYPES.find(p => p.key === key) ?? POI_TYPES[POI_TYPES.length - 1];

// The farm's safety documents
export const SAFETY_DOCUMENT_TYPES = [
  { key: 'safety_plan', label: 'Health and safety plan' },
  { key: 'emergency_plan', label: 'Emergency procedures' },
  { key: 'hazard_register', label: 'Hazard register' },
  { key: 'chemical_register', label: 'Chemical register' },
  { key: 'induction', label: 'Induction material' },
  { key: 'risk_assessment', label: 'Risk assessment' },
  { key: 'training', label: 'Training records' },
  { key: 'equipment', label: 'Equipment checks and manuals' },
  { key: 'contractor', label: 'Contractor documents' },
  { key: 'other', label: 'Other' },
] as const;

export const safetyDocumentLabel = (key: string | null | undefined) =>
  SAFETY_DOCUMENT_TYPES.find(t => t.key === key)?.label ?? 'Other';
