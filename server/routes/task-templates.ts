import { Router } from 'express';

const router = Router();

// Pre-defined task template categories
const TEMPLATE_CATEGORIES = [
  { id: 'livestock', name: 'Livestock Care', icon: '🐄', color: '#22c55e' },
  { id: 'dairy', name: 'Dairy Operations', icon: '🥛', color: '#3b82f6' },
  { id: 'pasture', name: 'Pasture Management', icon: '🌾', color: '#84cc16' },
  { id: 'equipment', name: 'Equipment & Maintenance', icon: '🔧', color: '#f59e0b' },
  { id: 'health', name: 'Animal Health', icon: '🩺', color: '#ef4444' },
  { id: 'compliance', name: 'Compliance & Records', icon: '📋', color: '#8b5cf6' },
  { id: 'seasonal', name: 'Seasonal Tasks', icon: '🌱', color: '#06b6d4' },
  { id: 'infrastructure', name: 'Infrastructure', icon: '🏗️', color: '#6b7280' },
];

// Comprehensive library of farm task templates
const TASK_TEMPLATES = [
  // ============ LIVESTOCK CARE ============
  {
    id: 'tpl-feed-cattle',
    name: 'Feed Cattle',
    description: 'Daily feeding routine for cattle including hay, silage, and supplements',
    category: 'livestock',
    priority: 'high',
    estimatedDuration: 60,
    defaultTime: '06:00',
    checklistItems: [
      { text: 'Check feed stock levels', required: true },
      { text: 'Distribute hay to paddocks', required: true },
      { text: 'Add mineral supplements', required: false },
      { text: 'Check water troughs are full', required: true },
      { text: 'Observe animals for health issues', required: true },
      { text: 'Record any concerns', required: false },
    ],
    tags: ['daily', 'cattle', 'feeding'],
    suggestedRecurrence: 'daily',
    isPopular: true,
  },
  {
    id: 'tpl-feed-sheep',
    name: 'Feed Sheep',
    description: 'Daily feeding for sheep flock with appropriate rations',
    category: 'livestock',
    priority: 'high',
    estimatedDuration: 45,
    defaultTime: '07:00',
    checklistItems: [
      { text: 'Check feed supplies', required: true },
      { text: 'Distribute feed to paddocks', required: true },
      { text: 'Check water availability', required: true },
      { text: 'Count sheep (spot check)', required: false },
      { text: 'Look for lameness or illness', required: true },
    ],
    tags: ['daily', 'sheep', 'feeding'],
    suggestedRecurrence: 'daily',
  },
  {
    id: 'tpl-move-stock',
    name: 'Move Stock Between Paddocks',
    description: 'Safely move livestock from one paddock to another',
    category: 'livestock',
    priority: 'medium',
    estimatedDuration: 30,
    defaultTime: '08:00',
    checklistItems: [
      { text: 'Check destination paddock is ready', required: true },
      { text: 'Open gates in correct sequence', required: true },
      { text: 'Move animals calmly', required: true },
      { text: 'Count animals during move', required: true },
      { text: 'Close all gates securely', required: true },
      { text: 'Update pasture records', required: true },
    ],
    tags: ['livestock', 'pasture', 'rotation'],
    suggestedRecurrence: null,
  },
  {
    id: 'tpl-stock-count',
    name: 'Stock Count & Inspection',
    description: 'Complete count and visual inspection of all livestock',
    category: 'livestock',
    priority: 'medium',
    estimatedDuration: 90,
    defaultTime: '09:00',
    checklistItems: [
      { text: 'Count cattle in each paddock', required: true },
      { text: 'Count sheep in each paddock', required: true },
      { text: 'Check for missing animals', required: true },
      { text: 'Inspect fence lines during count', required: false },
      { text: 'Note any health concerns', required: true },
      { text: 'Update stock records', required: true },
    ],
    tags: ['weekly', 'compliance', 'counting'],
    suggestedRecurrence: 'weekly',
    isPopular: true,
  },
  {
    id: 'tpl-calf-feeding',
    name: 'Calf Feeding & Care',
    description: 'Feed and care for young calves including milk and starter feed',
    category: 'livestock',
    priority: 'urgent',
    estimatedDuration: 60,
    defaultTime: '06:30',
    checklistItems: [
      { text: 'Prepare milk/milk replacer', required: true },
      { text: 'Feed each calf individually', required: true },
      { text: 'Check calf starter feed', required: true },
      { text: 'Clean water buckets', required: true },
      { text: 'Check for scours or illness', required: true },
      { text: 'Record any health issues', required: true },
    ],
    tags: ['daily', 'calves', 'young-stock'],
    suggestedRecurrence: 'daily',
  },

  // ============ DAIRY OPERATIONS ============
  {
    id: 'tpl-morning-milking',
    name: 'Morning Milking',
    description: 'Complete morning milking session for dairy herd',
    category: 'dairy',
    priority: 'urgent',
    estimatedDuration: 120,
    defaultTime: '05:00',
    checklistItems: [
      { text: 'Bring cows to dairy shed', required: true },
      { text: 'Sanitize milking equipment', required: true },
      { text: 'Check teat condition before milking', required: true },
      { text: 'Complete milking process', required: true },
      { text: 'Apply teat spray after milking', required: true },
      { text: 'Record milk volume', required: true },
      { text: 'Clean and sanitize equipment', required: true },
      { text: 'Return cows to paddock', required: true },
    ],
    tags: ['daily', 'dairy', 'milking'],
    suggestedRecurrence: 'daily',
    isPopular: true,
  },
  {
    id: 'tpl-afternoon-milking',
    name: 'Afternoon Milking',
    description: 'Complete afternoon milking session for dairy herd',
    category: 'dairy',
    priority: 'urgent',
    estimatedDuration: 120,
    defaultTime: '15:00',
    checklistItems: [
      { text: 'Bring cows to dairy shed', required: true },
      { text: 'Sanitize milking equipment', required: true },
      { text: 'Check teat condition before milking', required: true },
      { text: 'Complete milking process', required: true },
      { text: 'Apply teat spray after milking', required: true },
      { text: 'Record milk volume', required: true },
      { text: 'Clean and sanitize equipment', required: true },
      { text: 'Return cows to paddock', required: true },
    ],
    tags: ['daily', 'dairy', 'milking'],
    suggestedRecurrence: 'daily',
    isPopular: true,
  },
  {
    id: 'tpl-dairy-shed-clean',
    name: 'Dairy Shed Deep Clean',
    description: 'Thorough cleaning and sanitization of dairy shed',
    category: 'dairy',
    priority: 'high',
    estimatedDuration: 90,
    defaultTime: '10:00',
    checklistItems: [
      { text: 'Wash down all surfaces', required: true },
      { text: 'Clean milking cups and lines', required: true },
      { text: 'Sanitize bulk tank', required: true },
      { text: 'Clean yard and races', required: true },
      { text: 'Check and clean filters', required: true },
      { text: 'Inspect rubber ware condition', required: false },
      { text: 'Record cleaning completion', required: true },
    ],
    tags: ['weekly', 'dairy', 'cleaning', 'compliance'],
    suggestedRecurrence: 'weekly',
  },
  {
    id: 'tpl-milk-quality-test',
    name: 'Milk Quality Testing',
    description: 'Collect and test milk samples for quality compliance',
    category: 'dairy',
    priority: 'high',
    estimatedDuration: 30,
    defaultTime: '06:00',
    checklistItems: [
      { text: 'Collect bulk tank sample', required: true },
      { text: 'Record tank temperature', required: true },
      { text: 'Perform somatic cell test', required: false },
      { text: 'Label sample correctly', required: true },
      { text: 'Store sample properly', required: true },
      { text: 'Update quality records', required: true },
    ],
    tags: ['weekly', 'dairy', 'quality', 'compliance'],
    suggestedRecurrence: 'weekly',
  },

  // ============ PASTURE MANAGEMENT ============
  {
    id: 'tpl-fence-check',
    name: 'Fence Line Inspection',
    description: 'Walk and inspect all fence lines for damage or issues',
    category: 'pasture',
    priority: 'medium',
    estimatedDuration: 120,
    defaultTime: '09:00',
    checklistItems: [
      { text: 'Check boundary fences', required: true },
      { text: 'Check internal paddock fences', required: true },
      { text: 'Test electric fence voltage', required: true },
      { text: 'Look for fallen posts or wires', required: true },
      { text: 'Check gate latches and hinges', required: true },
      { text: 'Note repairs needed', required: true },
      { text: 'Clear vegetation from fence lines', required: false },
    ],
    tags: ['weekly', 'fencing', 'maintenance'],
    suggestedRecurrence: 'weekly',
    isPopular: true,
  },
  {
    id: 'tpl-water-trough-check',
    name: 'Water Trough Inspection',
    description: 'Check and maintain all water troughs across paddocks',
    category: 'pasture',
    priority: 'high',
    estimatedDuration: 60,
    defaultTime: '08:00',
    checklistItems: [
      { text: 'Check water levels in all troughs', required: true },
      { text: 'Clean debris from troughs', required: true },
      { text: 'Test float valves', required: true },
      { text: 'Check for leaks', required: true },
      { text: 'Ensure adequate flow rate', required: true },
      { text: 'Report any repairs needed', required: false },
    ],
    tags: ['weekly', 'water', 'maintenance'],
    suggestedRecurrence: 'weekly',
  },
  {
    id: 'tpl-pasture-assessment',
    name: 'Pasture Cover Assessment',
    description: 'Assess pasture cover and quality across all paddocks',
    category: 'pasture',
    priority: 'medium',
    estimatedDuration: 90,
    defaultTime: '10:00',
    checklistItems: [
      { text: 'Walk each paddock', required: true },
      { text: 'Estimate pasture cover (kg DM/ha)', required: true },
      { text: 'Assess pasture quality', required: true },
      { text: 'Check for weeds', required: true },
      { text: 'Note pugging or damage', required: true },
      { text: 'Update pasture records', required: true },
      { text: 'Plan grazing rotation', required: false },
    ],
    tags: ['weekly', 'pasture', 'planning'],
    suggestedRecurrence: 'weekly',
  },
  {
    id: 'tpl-weed-spray',
    name: 'Weed Spraying',
    description: 'Spot spray or boom spray weeds in paddocks',
    category: 'pasture',
    priority: 'medium',
    estimatedDuration: 180,
    defaultTime: '07:00',
    checklistItems: [
      { text: 'Check weather conditions (no rain/wind)', required: true },
      { text: 'Prepare spray mix correctly', required: true },
      { text: 'Wear appropriate PPE', required: true },
      { text: 'Calibrate sprayer', required: true },
      { text: 'Apply spray to target areas', required: true },
      { text: 'Record spray details (product, rate, area)', required: true },
      { text: 'Clean equipment after use', required: true },
      { text: 'Note withholding period', required: true },
    ],
    tags: ['seasonal', 'spraying', 'compliance'],
    suggestedRecurrence: null,
  },

  // ============ EQUIPMENT & MAINTENANCE ============
  {
    id: 'tpl-tractor-check',
    name: 'Tractor Daily Check',
    description: 'Pre-start safety and maintenance check for tractor',
    category: 'equipment',
    priority: 'high',
    estimatedDuration: 15,
    defaultTime: '07:00',
    checklistItems: [
      { text: 'Check engine oil level', required: true },
      { text: 'Check coolant level', required: true },
      { text: 'Check hydraulic fluid', required: true },
      { text: 'Inspect tyres', required: true },
      { text: 'Test lights and indicators', required: true },
      { text: 'Check brakes', required: true },
      { text: 'Ensure ROPS is secure', required: true },
    ],
    tags: ['daily', 'equipment', 'safety'],
    suggestedRecurrence: 'daily',
  },
  {
    id: 'tpl-atv-check',
    name: 'ATV/Quad Bike Check',
    description: 'Safety inspection for ATV before use',
    category: 'equipment',
    priority: 'high',
    estimatedDuration: 10,
    defaultTime: '06:30',
    checklistItems: [
      { text: 'Check fuel level', required: true },
      { text: 'Check oil level', required: true },
      { text: 'Inspect tyres and pressure', required: true },
      { text: 'Test brakes', required: true },
      { text: 'Check throttle operation', required: true },
      { text: 'Ensure helmet available', required: true },
    ],
    tags: ['daily', 'equipment', 'safety'],
    suggestedRecurrence: 'daily',
  },
  {
    id: 'tpl-equipment-service',
    name: 'Monthly Equipment Service',
    description: 'Comprehensive service check on all farm equipment',
    category: 'equipment',
    priority: 'medium',
    estimatedDuration: 240,
    defaultTime: '08:00',
    checklistItems: [
      { text: 'Service tractor (oil, filters)', required: true },
      { text: 'Grease all machinery', required: true },
      { text: 'Check ATV/quad bikes', required: true },
      { text: 'Inspect trailers', required: true },
      { text: 'Test all power tools', required: true },
      { text: 'Check fuel supplies', required: true },
      { text: 'Update maintenance log', required: true },
      { text: 'Order replacement parts if needed', required: false },
    ],
    tags: ['monthly', 'equipment', 'maintenance'],
    suggestedRecurrence: 'monthly',
    isPopular: true,
  },
  {
    id: 'tpl-generator-test',
    name: 'Generator Test Run',
    description: 'Test backup generator to ensure operational readiness',
    category: 'equipment',
    priority: 'medium',
    estimatedDuration: 30,
    defaultTime: '10:00',
    checklistItems: [
      { text: 'Check fuel level', required: true },
      { text: 'Check oil level', required: true },
      { text: 'Start generator', required: true },
      { text: 'Run for 15 minutes under load', required: true },
      { text: 'Check output voltage', required: true },
      { text: 'Record run time', required: true },
    ],
    tags: ['monthly', 'equipment', 'emergency'],
    suggestedRecurrence: 'monthly',
  },

  // ============ ANIMAL HEALTH ============
  {
    id: 'tpl-drench-cattle',
    name: 'Cattle Drenching',
    description: 'Administer drench treatment to cattle for parasite control',
    category: 'health',
    priority: 'high',
    estimatedDuration: 120,
    defaultTime: '08:00',
    checklistItems: [
      { text: 'Weigh sample animals for dosing', required: true },
      { text: 'Calculate correct dose rates', required: true },
      { text: 'Prepare drenching equipment', required: true },
      { text: 'Yard cattle safely', required: true },
      { text: 'Administer drench correctly', required: true },
      { text: 'Record treatment details', required: true },
      { text: 'Note withholding periods', required: true },
      { text: 'Update animal health records', required: true },
    ],
    tags: ['health', 'cattle', 'treatment'],
    suggestedRecurrence: null,
    isPopular: true,
  },
  {
    id: 'tpl-vaccination',
    name: 'Vaccination Program',
    description: 'Administer scheduled vaccinations to livestock',
    category: 'health',
    priority: 'high',
    estimatedDuration: 180,
    defaultTime: '08:00',
    checklistItems: [
      { text: 'Check vaccine storage temperature', required: true },
      { text: 'Prepare vaccination equipment', required: true },
      { text: 'Yard animals safely', required: true },
      { text: 'Administer vaccines correctly', required: true },
      { text: 'Use new needle for each animal', required: true },
      { text: 'Record batch numbers', required: true },
      { text: 'Update vaccination records', required: true },
      { text: 'Dispose of sharps safely', required: true },
    ],
    tags: ['health', 'vaccination', 'compliance'],
    suggestedRecurrence: null,
  },
  {
    id: 'tpl-vet-visit-prep',
    name: 'Prepare for Vet Visit',
    description: 'Prepare animals and facilities for scheduled vet visit',
    category: 'health',
    priority: 'high',
    estimatedDuration: 60,
    defaultTime: '07:00',
    checklistItems: [
      { text: 'Yard animals to be examined', required: true },
      { text: 'Prepare crush/head bail', required: true },
      { text: 'Have animal records ready', required: true },
      { text: 'List concerns to discuss', required: true },
      { text: 'Ensure hot water available', required: false },
      { text: 'Prepare holding area', required: true },
    ],
    tags: ['health', 'vet', 'preparation'],
    suggestedRecurrence: null,
  },
  {
    id: 'tpl-lame-check',
    name: 'Lameness Inspection',
    description: 'Check herd for lameness and foot problems',
    category: 'health',
    priority: 'medium',
    estimatedDuration: 60,
    defaultTime: '09:00',
    checklistItems: [
      { text: 'Observe animals walking', required: true },
      { text: 'Identify any lame animals', required: true },
      { text: 'Separate lame animals', required: true },
      { text: 'Inspect feet if possible', required: false },
      { text: 'Record affected animals', required: true },
      { text: 'Plan treatment/vet call', required: true },
    ],
    tags: ['weekly', 'health', 'lameness'],
    suggestedRecurrence: 'weekly',
  },

  // ============ COMPLIANCE & RECORDS ============
  {
    id: 'tpl-nait-update',
    name: 'NAIT Records Update',
    description: 'Update NAIT database with animal movements and events',
    category: 'compliance',
    priority: 'high',
    estimatedDuration: 30,
    defaultTime: '16:00',
    checklistItems: [
      { text: 'Log into NAIT system', required: true },
      { text: 'Record any animal movements', required: true },
      { text: 'Register new animals', required: true },
      { text: 'Record any deaths', required: true },
      { text: 'Verify tag numbers', required: true },
      { text: 'Print confirmation', required: false },
    ],
    tags: ['compliance', 'nait', 'records'],
    suggestedRecurrence: 'weekly',
    isPopular: true,
  },
  {
    id: 'tpl-treatment-records',
    name: 'Update Treatment Records',
    description: 'Record all animal treatments and withholding periods',
    category: 'compliance',
    priority: 'high',
    estimatedDuration: 20,
    defaultTime: '17:00',
    checklistItems: [
      { text: 'Gather treatment notes from today', required: true },
      { text: 'Enter treatments in system', required: true },
      { text: 'Record product batch numbers', required: true },
      { text: 'Calculate withholding dates', required: true },
      { text: 'Flag animals in withholding', required: true },
    ],
    tags: ['daily', 'compliance', 'records'],
    suggestedRecurrence: 'daily',
  },
  {
    id: 'tpl-h-and-s-check',
    name: 'Health & Safety Inspection',
    description: 'Weekly health and safety compliance check',
    category: 'compliance',
    priority: 'high',
    estimatedDuration: 45,
    defaultTime: '14:00',
    checklistItems: [
      { text: 'Check first aid kit supplies', required: true },
      { text: 'Inspect fire extinguishers', required: true },
      { text: 'Review hazard register', required: true },
      { text: 'Check PPE availability', required: true },
      { text: 'Inspect chemical storage', required: true },
      { text: 'Test emergency contacts list', required: false },
      { text: 'Sign off H&S checklist', required: true },
    ],
    tags: ['weekly', 'compliance', 'safety'],
    suggestedRecurrence: 'weekly',
  },

  // ============ SEASONAL TASKS ============
  {
    id: 'tpl-calving-check',
    name: 'Calving Paddock Check',
    description: 'Regular checks during calving season',
    category: 'seasonal',
    priority: 'urgent',
    estimatedDuration: 45,
    defaultTime: '06:00',
    checklistItems: [
      { text: 'Check all cows in calving paddock', required: true },
      { text: 'Look for signs of calving', required: true },
      { text: 'Check new calves are feeding', required: true },
      { text: 'Tag new calves', required: true },
      { text: 'Record births', required: true },
      { text: 'Move cow-calf pairs if needed', required: false },
      { text: 'Note any difficulties', required: true },
    ],
    tags: ['seasonal', 'calving', 'urgent'],
    suggestedRecurrence: 'daily',
    isPopular: true,
  },
  {
    id: 'tpl-lambing-check',
    name: 'Lambing Paddock Check',
    description: 'Regular checks during lambing season',
    category: 'seasonal',
    priority: 'urgent',
    estimatedDuration: 60,
    defaultTime: '06:00',
    checklistItems: [
      { text: 'Check all ewes in lambing paddock', required: true },
      { text: 'Look for ewes in labour', required: true },
      { text: 'Check lambs are feeding', required: true },
      { text: 'Assist difficult births if needed', required: true },
      { text: 'Tag new lambs', required: true },
      { text: 'Record births and deaths', required: true },
      { text: 'Move mothered-up pairs', required: false },
    ],
    tags: ['seasonal', 'lambing', 'urgent'],
    suggestedRecurrence: 'daily',
  },
  {
    id: 'tpl-shearing-prep',
    name: 'Shearing Preparation',
    description: 'Prepare for shearing day',
    category: 'seasonal',
    priority: 'high',
    estimatedDuration: 120,
    defaultTime: '07:00',
    checklistItems: [
      { text: 'Yard sheep (keep dry)', required: true },
      { text: 'Prepare shearing shed', required: true },
      { text: 'Set up wool handling area', required: true },
      { text: 'Check shearing equipment', required: true },
      { text: 'Prepare smoko/lunch', required: false },
      { text: 'Have first aid kit ready', required: true },
      { text: 'Confirm shearer arrival time', required: true },
    ],
    tags: ['seasonal', 'shearing', 'preparation'],
    suggestedRecurrence: null,
  },
  {
    id: 'tpl-hay-making',
    name: 'Hay Making',
    description: 'Cut, ted, rake and bale hay',
    category: 'seasonal',
    priority: 'high',
    estimatedDuration: 480,
    defaultTime: '07:00',
    checklistItems: [
      { text: 'Check weather forecast (3+ dry days)', required: true },
      { text: 'Mow paddock', required: true },
      { text: 'Ted hay (turn for drying)', required: true },
      { text: 'Rake into rows', required: true },
      { text: 'Bale when dry', required: true },
      { text: 'Cart and stack bales', required: true },
      { text: 'Record yield', required: true },
    ],
    tags: ['seasonal', 'hay', 'feed'],
    suggestedRecurrence: null,
  },

  // ============ INFRASTRUCTURE ============
  {
    id: 'tpl-yard-maintenance',
    name: 'Yard Maintenance',
    description: 'Maintain and repair stock yards',
    category: 'infrastructure',
    priority: 'medium',
    estimatedDuration: 180,
    defaultTime: '08:00',
    checklistItems: [
      { text: 'Check all gates swing freely', required: true },
      { text: 'Inspect rails and posts', required: true },
      { text: 'Check crush/head bail operation', required: true },
      { text: 'Clear mud and debris', required: true },
      { text: 'Check loading ramp', required: true },
      { text: 'Repair any damage found', required: true },
      { text: 'Grease hinges and latches', required: false },
    ],
    tags: ['monthly', 'infrastructure', 'maintenance'],
    suggestedRecurrence: 'monthly',
  },
  {
    id: 'tpl-building-check',
    name: 'Building Inspection',
    description: 'Inspect farm buildings for maintenance needs',
    category: 'infrastructure',
    priority: 'low',
    estimatedDuration: 60,
    defaultTime: '10:00',
    checklistItems: [
      { text: 'Check roof condition', required: true },
      { text: 'Inspect gutters and downpipes', required: true },
      { text: 'Check doors and windows', required: true },
      { text: 'Inspect electrical fittings', required: true },
      { text: 'Check for pest damage', required: true },
      { text: 'Note repairs needed', required: true },
    ],
    tags: ['monthly', 'infrastructure', 'buildings'],
    suggestedRecurrence: 'monthly',
  },
];

// Custom templates created by users (in-memory for demo)
let customTemplates: any[] = [];

// ============================================
// ENDPOINTS
// ============================================

// Get all template categories
router.get('/categories', (req, res) => {
  res.json(TEMPLATE_CATEGORIES);
});

// Get all templates (system + custom)
router.get('/', (req, res) => {
  const { category, search, popular } = req.query;
  
  let templates = [...TASK_TEMPLATES, ...customTemplates];
  
  // Filter by category
  if (category && category !== 'all') {
    templates = templates.filter(t => t.category === category);
  }
  
  // Filter by search
  if (search) {
    const searchLower = (search as string).toLowerCase();
    templates = templates.filter(t => 
      t.name.toLowerCase().includes(searchLower) ||
      t.description.toLowerCase().includes(searchLower) ||
      t.tags?.some((tag: string) => tag.toLowerCase().includes(searchLower))
    );
  }
  
  // Filter popular only
  if (popular === 'true') {
    templates = templates.filter(t => t.isPopular);
  }
  
  // Add category info to each template
  const templatesWithCategory = templates.map(t => ({
    ...t,
    categoryInfo: TEMPLATE_CATEGORIES.find(c => c.id === t.category),
  }));
  
  res.json(templatesWithCategory);
});

// Get popular templates
router.get('/popular', (req, res) => {
  const popular = TASK_TEMPLATES
    .filter(t => t.isPopular)
    .map(t => ({
      ...t,
      categoryInfo: TEMPLATE_CATEGORIES.find(c => c.id === t.category),
    }));
  res.json(popular);
});

// Get single template
router.get('/:id', (req, res) => {
  const { id } = req.params;
  
  const template = [...TASK_TEMPLATES, ...customTemplates].find(t => t.id === id);
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  res.json({
    ...template,
    categoryInfo: TEMPLATE_CATEGORIES.find(c => c.id === template.category),
  });
});

// Create custom template
router.post('/', (req, res) => {
  const templateData = req.body;
  
  const newTemplate = {
    id: `custom-${Date.now()}`,
    ...templateData,
    isCustom: true,
    createdAt: new Date().toISOString(),
  };
  
  customTemplates.push(newTemplate);
  
  res.status(201).json({
    ...newTemplate,
    categoryInfo: TEMPLATE_CATEGORIES.find(c => c.id === newTemplate.category),
  });
});

// Update custom template
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  // Can only update custom templates
  const index = customTemplates.findIndex(t => t.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Custom template not found' });
  }
  
  customTemplates[index] = {
    ...customTemplates[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  res.json(customTemplates[index]);
});

// Delete custom template
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  
  const index = customTemplates.findIndex(t => t.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Custom template not found' });
  }
  
  customTemplates.splice(index, 1);
  res.json({ success: true });
});

// Create job from template
router.post('/:id/create-job', (req, res) => {
  const { id } = req.params;
  const { date, time, assignedTo, location, notes } = req.body;
  
  const template = [...TASK_TEMPLATES, ...customTemplates].find(t => t.id === id);
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  // Create job from template
  const job = {
    id: `job-${Date.now()}`,
    title: template.name,
    description: template.description,
    category: template.category,
    priority: template.priority,
    estimatedDuration: template.estimatedDuration,
    scheduledDate: date || new Date().toISOString().split('T')[0],
    scheduledTime: time || template.defaultTime,
    assignedTo: assignedTo || [],
    location: location || '',
    notes: notes || '',
    checklistItems: template.checklistItems?.map((item: any) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      completed: false,
    })),
    status: 'pending',
    fromTemplate: id,
    createdAt: new Date().toISOString(),
  };
  
  res.status(201).json(job);
});

// Create recurring task from template
router.post('/:id/create-recurring', (req, res) => {
  const { id } = req.params;
  const { recurrenceType, recurrenceInterval, recurrenceDays, startDate, assignedTo } = req.body;
  
  const template = [...TASK_TEMPLATES, ...customTemplates].find(t => t.id === id);
  
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  
  // Create recurring task from template
  const recurringTask = {
    id: `recurring-${Date.now()}`,
    title: template.name,
    description: template.description,
    category: template.category,
    priority: template.priority,
    estimatedDuration: template.estimatedDuration,
    recurrenceType: recurrenceType || template.suggestedRecurrence || 'daily',
    recurrenceInterval: recurrenceInterval || 1,
    recurrenceDays: recurrenceDays || [],
    recurrenceTime: template.defaultTime,
    startDate: startDate || new Date().toISOString().split('T')[0],
    assignedTo: assignedTo || [],
    checklistItems: template.checklistItems?.map((item: any) => ({
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    })),
    isActive: true,
    fromTemplate: id,
    createdAt: new Date().toISOString(),
  };
  
  res.status(201).json(recurringTask);
});

// Get template statistics
router.get('/stats/summary', (req, res) => {
  const stats = {
    totalTemplates: TASK_TEMPLATES.length + customTemplates.length,
    systemTemplates: TASK_TEMPLATES.length,
    customTemplates: customTemplates.length,
    categories: TEMPLATE_CATEGORIES.length,
    popularTemplates: TASK_TEMPLATES.filter(t => t.isPopular).length,
    byCategory: TEMPLATE_CATEGORIES.map(cat => ({
      ...cat,
      count: TASK_TEMPLATES.filter(t => t.category === cat.id).length,
    })),
  };
  
  res.json(stats);
});

export default router;
