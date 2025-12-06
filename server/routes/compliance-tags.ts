import { Router } from 'express';

const router = Router();

// Compliance Framework Types
type ComplianceFramework = 
  | 'nait'           // National Animal Identification & Tracing
  | 'nzfap'          // NZ Farm Assurance Programme
  | 'health_safety'  // Health & Safety at Work Act
  | 'rma'            // Resource Management Act
  | 'animal_welfare' // Animal Welfare Act
  | 'dairy_nz'       // DairyNZ Best Practice
  | 'fonterra'       // Fonterra Supplier Requirements
  | 'organic'        // Organic Certification
  | 'synlait'        // Synlait Lead With Pride
  | 'custom';        // Custom compliance requirement

interface ComplianceTag {
  id: string;
  framework: ComplianceFramework;
  name: string;
  code: string;
  description: string;
  color: string;
  icon: string;
  requiresEvidence: boolean;
  evidenceTypes?: string[];
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  dueDate?: string;
  isActive: boolean;
  createdAt: string;
}

interface TaskComplianceLink {
  id: string;
  taskId: string;
  taskTitle: string;
  complianceTagId: string;
  complianceTagName: string;
  framework: ComplianceFramework;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'not_applicable';
  evidenceProvided: boolean;
  evidenceUrls?: string[];
  notes?: string;
  completedAt?: string;
  completedBy?: string;
  dueDate?: string;
  createdAt: string;
}

interface ComplianceAuditLog {
  id: string;
  action: 'tag_added' | 'tag_removed' | 'status_changed' | 'evidence_uploaded' | 'verified';
  taskId: string;
  taskTitle: string;
  complianceTagId: string;
  complianceTagName: string;
  previousStatus?: string;
  newStatus?: string;
  performedBy: string;
  performedAt: string;
  notes?: string;
}

// In-memory storage
let complianceTags: ComplianceTag[] = [];
let taskComplianceLinks: TaskComplianceLink[] = [];
let auditLogs: ComplianceAuditLog[] = [];
let idCounter = 1;

// Framework metadata
const FRAMEWORKS: Record<ComplianceFramework, { name: string; icon: string; color: string; description: string }> = {
  nait: {
    name: 'NAIT',
    icon: '🏷️',
    color: '#2563eb',
    description: 'National Animal Identification & Tracing',
  },
  nzfap: {
    name: 'NZFAP',
    icon: '✅',
    color: '#16a34a',
    description: 'NZ Farm Assurance Programme',
  },
  health_safety: {
    name: 'H&S',
    icon: '⚠️',
    color: '#dc2626',
    description: 'Health & Safety at Work Act',
  },
  rma: {
    name: 'RMA',
    icon: '🌿',
    color: '#65a30d',
    description: 'Resource Management Act',
  },
  animal_welfare: {
    name: 'Animal Welfare',
    icon: '🐄',
    color: '#7c3aed',
    description: 'Animal Welfare Act 1999',
  },
  dairy_nz: {
    name: 'DairyNZ',
    icon: '🥛',
    color: '#0891b2',
    description: 'DairyNZ Best Practice Standards',
  },
  fonterra: {
    name: 'Fonterra',
    icon: '🏭',
    color: '#0369a1',
    description: 'Fonterra Supplier Requirements',
  },
  organic: {
    name: 'Organic',
    icon: '🌱',
    color: '#15803d',
    description: 'Organic Certification Standards',
  },
  synlait: {
    name: 'Synlait',
    icon: '⭐',
    color: '#7c2d12',
    description: 'Synlait Lead With Pride',
  },
  custom: {
    name: 'Custom',
    icon: '📋',
    color: '#6b7280',
    description: 'Custom compliance requirement',
  },
};

// Generate demo data
function generateDemoData() {
  complianceTags = [
    {
      id: 'tag-1',
      framework: 'nait',
      name: 'Animal Movement Recording',
      code: 'NAIT-001',
      description: 'Record all animal movements within 48 hours',
      color: FRAMEWORKS.nait.color,
      icon: FRAMEWORKS.nait.icon,
      requiresEvidence: true,
      evidenceTypes: ['movement_declaration', 'rfid_scan'],
      frequency: 'daily',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-2',
      framework: 'nait',
      name: 'Tag Replacement',
      code: 'NAIT-002',
      description: 'Replace lost or damaged NAIT tags within 30 days',
      color: FRAMEWORKS.nait.color,
      icon: FRAMEWORKS.nait.icon,
      requiresEvidence: true,
      evidenceTypes: ['photo', 'receipt'],
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-3',
      framework: 'nzfap',
      name: 'Chemical Storage Audit',
      code: 'NZFAP-101',
      description: 'Monthly audit of chemical storage facilities',
      color: FRAMEWORKS.nzfap.color,
      icon: FRAMEWORKS.nzfap.icon,
      requiresEvidence: true,
      evidenceTypes: ['checklist', 'photo'],
      frequency: 'monthly',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-4',
      framework: 'nzfap',
      name: 'Staff Training Records',
      code: 'NZFAP-201',
      description: 'Maintain up-to-date training records for all staff',
      color: FRAMEWORKS.nzfap.color,
      icon: FRAMEWORKS.nzfap.icon,
      requiresEvidence: true,
      evidenceTypes: ['certificate', 'training_log'],
      frequency: 'annually',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-5',
      framework: 'health_safety',
      name: 'Hazard Register Update',
      code: 'HS-001',
      description: 'Review and update hazard register',
      color: FRAMEWORKS.health_safety.color,
      icon: FRAMEWORKS.health_safety.icon,
      requiresEvidence: true,
      evidenceTypes: ['document', 'checklist'],
      frequency: 'quarterly',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-6',
      framework: 'health_safety',
      name: 'PPE Inspection',
      code: 'HS-002',
      description: 'Inspect and maintain personal protective equipment',
      color: FRAMEWORKS.health_safety.color,
      icon: FRAMEWORKS.health_safety.icon,
      requiresEvidence: true,
      evidenceTypes: ['checklist', 'photo'],
      frequency: 'monthly',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-7',
      framework: 'animal_welfare',
      name: 'Body Condition Scoring',
      code: 'AW-001',
      description: 'Regular body condition scoring of herd',
      color: FRAMEWORKS.animal_welfare.color,
      icon: FRAMEWORKS.animal_welfare.icon,
      requiresEvidence: true,
      evidenceTypes: ['record', 'photo'],
      frequency: 'monthly',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-8',
      framework: 'dairy_nz',
      name: 'Milk Quality Testing',
      code: 'DNZ-001',
      description: 'Regular milk quality and SCC testing',
      color: FRAMEWORKS.dairy_nz.color,
      icon: FRAMEWORKS.dairy_nz.icon,
      requiresEvidence: true,
      evidenceTypes: ['lab_report', 'record'],
      frequency: 'weekly',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-9',
      framework: 'rma',
      name: 'Effluent Management',
      code: 'RMA-001',
      description: 'Effluent spreading and storage compliance',
      color: FRAMEWORKS.rma.color,
      icon: FRAMEWORKS.rma.icon,
      requiresEvidence: true,
      evidenceTypes: ['record', 'photo', 'map'],
      frequency: 'daily',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'tag-10',
      framework: 'fonterra',
      name: 'Supplier Handbook Compliance',
      code: 'FON-001',
      description: 'Meet Fonterra supplier handbook requirements',
      color: FRAMEWORKS.fonterra.color,
      icon: FRAMEWORKS.fonterra.icon,
      requiresEvidence: true,
      evidenceTypes: ['audit_report', 'checklist'],
      frequency: 'annually',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];

  // Demo task-compliance links
  taskComplianceLinks = [
    {
      id: 'link-1',
      taskId: '1',
      taskTitle: 'Morning Feed - Paddock A',
      complianceTagId: 'tag-7',
      complianceTagName: 'Body Condition Scoring',
      framework: 'animal_welfare',
      status: 'completed',
      evidenceProvided: true,
      evidenceUrls: ['/evidence/bcs-report-dec.pdf'],
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      completedBy: 'John Smith',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: 'link-2',
      taskId: '2',
      taskTitle: 'Fence Repair - North Boundary',
      complianceTagId: 'tag-5',
      complianceTagName: 'Hazard Register Update',
      framework: 'health_safety',
      status: 'pending',
      evidenceProvided: false,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'link-3',
      taskId: '3',
      taskTitle: 'Health Check - Dairy Herd',
      complianceTagId: 'tag-1',
      complianceTagName: 'Animal Movement Recording',
      framework: 'nait',
      status: 'in_progress',
      evidenceProvided: false,
      dueDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    },
    {
      id: 'link-4',
      taskId: '4',
      taskTitle: 'Water Trough Inspection',
      complianceTagId: 'tag-7',
      complianceTagName: 'Body Condition Scoring',
      framework: 'animal_welfare',
      status: 'pending',
      evidenceProvided: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'link-5',
      taskId: '5',
      taskTitle: 'Afternoon Milking',
      complianceTagId: 'tag-8',
      complianceTagName: 'Milk Quality Testing',
      framework: 'dairy_nz',
      status: 'completed',
      evidenceProvided: true,
      completedAt: new Date().toISOString(),
      completedBy: 'Sarah Johnson',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'link-6',
      taskId: '5',
      taskTitle: 'Afternoon Milking',
      complianceTagId: 'tag-10',
      complianceTagName: 'Supplier Handbook Compliance',
      framework: 'fonterra',
      status: 'completed',
      evidenceProvided: true,
      completedAt: new Date().toISOString(),
      completedBy: 'Sarah Johnson',
      createdAt: new Date().toISOString(),
    },
  ];

  // Demo audit logs
  auditLogs = [
    {
      id: 'audit-1',
      action: 'status_changed',
      taskId: '1',
      taskTitle: 'Morning Feed - Paddock A',
      complianceTagId: 'tag-7',
      complianceTagName: 'Body Condition Scoring',
      previousStatus: 'in_progress',
      newStatus: 'completed',
      performedBy: 'John Smith',
      performedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'audit-2',
      action: 'evidence_uploaded',
      taskId: '1',
      taskTitle: 'Morning Feed - Paddock A',
      complianceTagId: 'tag-7',
      complianceTagName: 'Body Condition Scoring',
      performedBy: 'John Smith',
      performedAt: new Date(Date.now() - 86400000).toISOString(),
      notes: 'Uploaded BCS report for December',
    },
    {
      id: 'audit-3',
      action: 'tag_added',
      taskId: '2',
      taskTitle: 'Fence Repair - North Boundary',
      complianceTagId: 'tag-5',
      complianceTagName: 'Hazard Register Update',
      performedBy: 'Mike Wilson',
      performedAt: new Date().toISOString(),
    },
  ];
}

generateDemoData();

// ============================================
// COMPLIANCE TAG ENDPOINTS
// ============================================

// Get all compliance tags
router.get('/tags', (req, res) => {
  const { framework, active } = req.query;
  
  let filtered = [...complianceTags];
  
  if (framework && framework !== 'all') {
    filtered = filtered.filter(t => t.framework === framework);
  }
  
  if (active === 'true') {
    filtered = filtered.filter(t => t.isActive);
  }
  
  // Add framework metadata
  const enriched = filtered.map(tag => ({
    ...tag,
    frameworkInfo: FRAMEWORKS[tag.framework],
  }));
  
  res.json(enriched);
});

// Get frameworks
router.get('/frameworks', (req, res) => {
  const frameworks = Object.entries(FRAMEWORKS).map(([key, value]) => ({
    id: key,
    ...value,
  }));
  res.json(frameworks);
});

// Get single tag
router.get('/tags/:id', (req, res) => {
  const { id } = req.params;
  const tag = complianceTags.find(t => t.id === id);
  
  if (!tag) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  
  // Get linked tasks
  const linkedTasks = taskComplianceLinks.filter(l => l.complianceTagId === id);
  
  res.json({
    ...tag,
    frameworkInfo: FRAMEWORKS[tag.framework],
    linkedTasks,
    stats: {
      total: linkedTasks.length,
      completed: linkedTasks.filter(l => l.status === 'completed').length,
      pending: linkedTasks.filter(l => l.status === 'pending').length,
      overdue: linkedTasks.filter(l => l.status === 'overdue').length,
    },
  });
});

// Create compliance tag
router.post('/tags', (req, res) => {
  const {
    framework,
    name,
    code,
    description,
    requiresEvidence,
    evidenceTypes,
    frequency,
  } = req.body;
  
  if (!framework || !name || !code) {
    return res.status(400).json({ error: 'Framework, name, and code are required' });
  }
  
  const frameworkInfo = FRAMEWORKS[framework as ComplianceFramework];
  if (!frameworkInfo) {
    return res.status(400).json({ error: 'Invalid framework' });
  }
  
  const tag: ComplianceTag = {
    id: `tag-${idCounter++}`,
    framework,
    name,
    code,
    description: description || '',
    color: frameworkInfo.color,
    icon: frameworkInfo.icon,
    requiresEvidence: requiresEvidence || false,
    evidenceTypes,
    frequency,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  
  complianceTags.push(tag);
  
  res.status(201).json(tag);
});

// Update tag
router.patch('/tags/:id', (req, res) => {
  const { id } = req.params;
  const tag = complianceTags.find(t => t.id === id);
  
  if (!tag) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  
  Object.assign(tag, req.body);
  
  res.json(tag);
});

// Delete tag
router.delete('/tags/:id', (req, res) => {
  const { id } = req.params;
  const index = complianceTags.findIndex(t => t.id === id);
  
  if (index === -1) {
    return res.status(404).json({ error: 'Tag not found' });
  }
  
  complianceTags.splice(index, 1);
  // Also remove links
  taskComplianceLinks = taskComplianceLinks.filter(l => l.complianceTagId !== id);
  
  res.json({ success: true });
});

// ============================================
// TASK-COMPLIANCE LINK ENDPOINTS
// ============================================

// Get all task compliance links
router.get('/links', (req, res) => {
  const { taskId, tagId, framework, status } = req.query;
  
  let filtered = [...taskComplianceLinks];
  
  if (taskId) {
    filtered = filtered.filter(l => l.taskId === taskId);
  }
  
  if (tagId) {
    filtered = filtered.filter(l => l.complianceTagId === tagId);
  }
  
  if (framework && framework !== 'all') {
    filtered = filtered.filter(l => l.framework === framework);
  }
  
  if (status && status !== 'all') {
    filtered = filtered.filter(l => l.status === status);
  }
  
  // Enrich with framework info
  const enriched = filtered.map(link => ({
    ...link,
    frameworkInfo: FRAMEWORKS[link.framework],
    tag: complianceTags.find(t => t.id === link.complianceTagId),
  }));
  
  res.json(enriched);
});

// Add compliance tag to task
router.post('/links', (req, res) => {
  const { taskId, taskTitle, complianceTagId, dueDate, notes } = req.body;
  const userName = (req.user as any)?.name || 'Demo User';
  
  if (!taskId || !complianceTagId) {
    return res.status(400).json({ error: 'Task ID and compliance tag ID are required' });
  }
  
  const tag = complianceTags.find(t => t.id === complianceTagId);
  if (!tag) {
    return res.status(404).json({ error: 'Compliance tag not found' });
  }
  
  // Check if already linked
  const existing = taskComplianceLinks.find(
    l => l.taskId === taskId && l.complianceTagId === complianceTagId
  );
  if (existing) {
    return res.status(400).json({ error: 'Task already has this compliance tag' });
  }
  
  const link: TaskComplianceLink = {
    id: `link-${idCounter++}`,
    taskId,
    taskTitle: taskTitle || `Task ${taskId}`,
    complianceTagId,
    complianceTagName: tag.name,
    framework: tag.framework,
    status: 'pending',
    evidenceProvided: false,
    dueDate,
    notes,
    createdAt: new Date().toISOString(),
  };
  
  taskComplianceLinks.push(link);
  
  // Audit log
  auditLogs.push({
    id: `audit-${idCounter++}`,
    action: 'tag_added',
    taskId,
    taskTitle: link.taskTitle,
    complianceTagId,
    complianceTagName: tag.name,
    performedBy: userName,
    performedAt: new Date().toISOString(),
  });
  
  res.status(201).json(link);
});

// Update link status
router.patch('/links/:id', (req, res) => {
  const { id } = req.params;
  const { status, evidenceUrls, notes } = req.body;
  const userName = (req.user as any)?.name || 'Demo User';
  
  const link = taskComplianceLinks.find(l => l.id === id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }
  
  const previousStatus = link.status;
  
  if (status) {
    link.status = status;
    if (status === 'completed') {
      link.completedAt = new Date().toISOString();
      link.completedBy = userName;
    }
  }
  
  if (evidenceUrls) {
    link.evidenceUrls = evidenceUrls;
    link.evidenceProvided = evidenceUrls.length > 0;
  }
  
  if (notes !== undefined) {
    link.notes = notes;
  }
  
  // Audit log
  if (status && status !== previousStatus) {
    auditLogs.push({
      id: `audit-${idCounter++}`,
      action: 'status_changed',
      taskId: link.taskId,
      taskTitle: link.taskTitle,
      complianceTagId: link.complianceTagId,
      complianceTagName: link.complianceTagName,
      previousStatus,
      newStatus: status,
      performedBy: userName,
      performedAt: new Date().toISOString(),
    });
  }
  
  res.json(link);
});

// Remove compliance tag from task
router.delete('/links/:id', (req, res) => {
  const { id } = req.params;
  const userName = (req.user as any)?.name || 'Demo User';
  
  const link = taskComplianceLinks.find(l => l.id === id);
  if (!link) {
    return res.status(404).json({ error: 'Link not found' });
  }
  
  const index = taskComplianceLinks.findIndex(l => l.id === id);
  taskComplianceLinks.splice(index, 1);
  
  // Audit log
  auditLogs.push({
    id: `audit-${idCounter++}`,
    action: 'tag_removed',
    taskId: link.taskId,
    taskTitle: link.taskTitle,
    complianceTagId: link.complianceTagId,
    complianceTagName: link.complianceTagName,
    performedBy: userName,
    performedAt: new Date().toISOString(),
  });
  
  res.json({ success: true });
});

// ============================================
// DASHBOARD & REPORTS
// ============================================

// Get compliance dashboard
router.get('/dashboard', (req, res) => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  
  // Overall stats
  const stats = {
    totalTags: complianceTags.filter(t => t.isActive).length,
    totalLinks: taskComplianceLinks.length,
    completed: taskComplianceLinks.filter(l => l.status === 'completed').length,
    pending: taskComplianceLinks.filter(l => l.status === 'pending').length,
    inProgress: taskComplianceLinks.filter(l => l.status === 'in_progress').length,
    overdue: taskComplianceLinks.filter(l => 
      l.status !== 'completed' && l.dueDate && l.dueDate < today
    ).length,
  };
  
  // Compliance rate
  stats.completionRate = stats.totalLinks > 0 
    ? Math.round((stats.completed / stats.totalLinks) * 100) 
    : 100;
  
  // By framework
  const byFramework = Object.keys(FRAMEWORKS).map(framework => {
    const links = taskComplianceLinks.filter(l => l.framework === framework);
    return {
      framework,
      ...FRAMEWORKS[framework as ComplianceFramework],
      total: links.length,
      completed: links.filter(l => l.status === 'completed').length,
      pending: links.filter(l => l.status === 'pending' || l.status === 'in_progress').length,
      overdue: links.filter(l => l.status !== 'completed' && l.dueDate && l.dueDate < today).length,
    };
  }).filter(f => f.total > 0);
  
  // Upcoming due
  const upcomingDue = taskComplianceLinks
    .filter(l => l.status !== 'completed' && l.dueDate)
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    .slice(0, 5)
    .map(l => ({
      ...l,
      frameworkInfo: FRAMEWORKS[l.framework],
      isOverdue: l.dueDate! < today,
    }));
  
  // Recent activity
  const recentActivity = auditLogs
    .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime())
    .slice(0, 10);
  
  res.json({
    stats,
    byFramework,
    upcomingDue,
    recentActivity,
  });
});

// Get audit log
router.get('/audit-log', (req, res) => {
  const { taskId, tagId, action, limit = 50 } = req.query;
  
  let filtered = [...auditLogs];
  
  if (taskId) {
    filtered = filtered.filter(l => l.taskId === taskId);
  }
  
  if (tagId) {
    filtered = filtered.filter(l => l.complianceTagId === tagId);
  }
  
  if (action) {
    filtered = filtered.filter(l => l.action === action);
  }
  
  filtered.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  filtered = filtered.slice(0, Number(limit));
  
  res.json(filtered);
});

// Generate compliance report
router.get('/report', (req, res) => {
  const { framework, startDate, endDate } = req.query;
  
  let links = [...taskComplianceLinks];
  
  if (framework && framework !== 'all') {
    links = links.filter(l => l.framework === framework);
  }
  
  if (startDate) {
    links = links.filter(l => l.createdAt >= startDate);
  }
  
  if (endDate) {
    links = links.filter(l => l.createdAt <= endDate);
  }
  
  const report = {
    generatedAt: new Date().toISOString(),
    period: { startDate, endDate },
    framework: framework || 'all',
    summary: {
      totalItems: links.length,
      completed: links.filter(l => l.status === 'completed').length,
      pending: links.filter(l => l.status === 'pending').length,
      inProgress: links.filter(l => l.status === 'in_progress').length,
      overdue: links.filter(l => l.status === 'overdue').length,
      evidenceProvided: links.filter(l => l.evidenceProvided).length,
    },
    items: links.map(l => ({
      ...l,
      tag: complianceTags.find(t => t.id === l.complianceTagId),
      frameworkInfo: FRAMEWORKS[l.framework],
    })),
  };
  
  report.summary.completionRate = report.summary.totalItems > 0
    ? Math.round((report.summary.completed / report.summary.totalItems) * 100)
    : 100;
  
  res.json(report);
});

export default router;
