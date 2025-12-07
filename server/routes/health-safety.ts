import { Router } from 'express';
import { z } from 'zod';

const router = Router();

// Types
interface Incident {
  id: string;
  type: 'injury' | 'near_miss' | 'property_damage' | 'environmental' | 'vehicle' | 'other';
  severity: 'minor' | 'moderate' | 'serious' | 'critical';
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  dateOccurred: string;
  timeOccurred: string;
  reportedBy: string;
  reportedAt: string;
  involvedPersons: string[];
  witnesses: string[];
  immediateActions: string;
  rootCause?: string;
  correctiveActions?: string;
  status: 'reported' | 'investigating' | 'action_required' | 'resolved' | 'closed';
  attachments?: string[];
  followUpDate?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

interface Hazard {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  identifiedBy: string;
  identifiedAt: string;
  controls: string[];
  status: 'identified' | 'assessed' | 'controlled' | 'monitoring' | 'eliminated';
  reviewDate: string;
  lastReviewedAt?: string;
  lastReviewedBy?: string;
  riskRating?: number;
  residualRisk?: number;
}

interface SafetyMeeting {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  attendees: string[];
  agenda: string[];
  minutes: string;
  actionItems: { task: string; assignee: string; dueDate: string; completed: boolean }[];
  nextMeetingDate?: string;
  createdBy: string;
  createdAt: string;
}

interface SafetyTraining {
  id: string;
  staffId: string;
  staffName: string;
  trainingType: string;
  provider: string;
  completedDate: string;
  expiryDate?: string;
  certificateNumber?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'scheduled';
  documentUrl?: string;
}

// In-memory storage
let incidents: Incident[] = [];
let hazards: Hazard[] = [];
let meetings: SafetyMeeting[] = [];
let trainings: SafetyTraining[] = [];
let incidentIdCounter = 1;
let hazardIdCounter = 1;
let meetingIdCounter = 1;
let trainingIdCounter = 1;

// Validation schemas
const createIncidentSchema = z.object({
  type: z.enum(['injury', 'near_miss', 'property_damage', 'environmental', 'vehicle', 'other']),
  severity: z.enum(['minor', 'moderate', 'serious', 'critical']),
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  dateOccurred: z.string(),
  timeOccurred: z.string(),
  involvedPersons: z.array(z.string()),
  witnesses: z.array(z.string()).optional(),
  immediateActions: z.string().optional(),
});

const createHazardSchema = z.object({
  type: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  controls: z.array(z.string()).optional(),
});

// ============================================
// INCIDENT ENDPOINTS
// ============================================

// GET /api/health-safety/incidents
router.get('/incidents', (req, res) => {
  try {
    const { status, type, severity } = req.query;
    let filtered = [...incidents];
    
    if (status) filtered = filtered.filter(i => i.status === status);
    if (type) filtered = filtered.filter(i => i.type === type);
    if (severity) filtered = filtered.filter(i => i.severity === severity);
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching incidents:', error);
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// GET /api/health-safety/incidents/:id
router.get('/incidents/:id', (req, res) => {
  const incident = incidents.find(i => i.id === req.params.id);
  if (!incident) return res.status(404).json({ error: 'Incident not found' });
  res.json(incident);
});

// POST /api/health-safety/incidents
router.post('/incidents', (req, res) => {
  try {
    const data = createIncidentSchema.parse(req.body);
    const userId = (req.user as any)?.id || 'demo-user';
    const userName = (req.user as any)?.name || 'Current User';
    
    const incident: Incident = {
      id: `inc-${incidentIdCounter++}`,
      ...data,
      witnesses: data.witnesses || [],
      immediateActions: data.immediateActions || '',
      reportedBy: userName,
      reportedAt: new Date().toISOString(),
      status: 'reported',
    };
    
    incidents.push(incident);
    res.status(201).json(incident);
  } catch (error) {
    console.error('Error creating incident:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid incident data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// PUT /api/health-safety/incidents/:id
router.put('/incidents/:id', (req, res) => {
  try {
    const index = incidents.findIndex(i => i.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Incident not found' });
    
    const userId = (req.user as any)?.id || 'demo-user';
    const userName = (req.user as any)?.name || 'Current User';
    
    incidents[index] = {
      ...incidents[index],
      ...req.body,
      ...(req.body.status === 'resolved' || req.body.status === 'closed' ? {
        resolvedAt: new Date().toISOString(),
        resolvedBy: userName,
      } : {}),
    };
    
    res.json(incidents[index]);
  } catch (error) {
    console.error('Error updating incident:', error);
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

// DELETE /api/health-safety/incidents/:id
router.delete('/incidents/:id', (req, res) => {
  const index = incidents.findIndex(i => i.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Incident not found' });
  incidents.splice(index, 1);
  res.json({ message: 'Incident deleted' });
});

// ============================================
// HAZARD ENDPOINTS
// ============================================

// GET /api/health-safety/hazards
router.get('/hazards', (req, res) => {
  try {
    const { status, severity, type } = req.query;
    let filtered = [...hazards];
    
    if (status) filtered = filtered.filter(h => h.status === status);
    if (severity) filtered = filtered.filter(h => h.severity === severity);
    if (type) filtered = filtered.filter(h => h.type === type);
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching hazards:', error);
    res.status(500).json({ error: 'Failed to fetch hazards' });
  }
});

// GET /api/health-safety/hazards/:id
router.get('/hazards/:id', (req, res) => {
  const hazard = hazards.find(h => h.id === req.params.id);
  if (!hazard) return res.status(404).json({ error: 'Hazard not found' });
  res.json(hazard);
});

// POST /api/health-safety/hazards
router.post('/hazards', (req, res) => {
  try {
    const data = createHazardSchema.parse(req.body);
    const userName = (req.user as any)?.name || 'Current User';
    
    const hazard: Hazard = {
      id: `haz-${hazardIdCounter++}`,
      ...data,
      controls: data.controls || [],
      identifiedBy: userName,
      identifiedAt: new Date().toISOString(),
      status: 'identified',
      reviewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    };
    
    hazards.push(hazard);
    res.status(201).json(hazard);
  } catch (error) {
    console.error('Error creating hazard:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid hazard data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create hazard' });
  }
});

// PUT /api/health-safety/hazards/:id
router.put('/hazards/:id', (req, res) => {
  try {
    const index = hazards.findIndex(h => h.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Hazard not found' });
    
    const userName = (req.user as any)?.name || 'Current User';
    
    hazards[index] = {
      ...hazards[index],
      ...req.body,
      lastReviewedAt: new Date().toISOString(),
      lastReviewedBy: userName,
    };
    
    res.json(hazards[index]);
  } catch (error) {
    console.error('Error updating hazard:', error);
    res.status(500).json({ error: 'Failed to update hazard' });
  }
});

// DELETE /api/health-safety/hazards/:id
router.delete('/hazards/:id', (req, res) => {
  const index = hazards.findIndex(h => h.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Hazard not found' });
  hazards.splice(index, 1);
  res.json({ message: 'Hazard deleted' });
});

// ============================================
// MEETING ENDPOINTS
// ============================================

// GET /api/health-safety/meetings
router.get('/meetings', (req, res) => {
  res.json(meetings);
});

// POST /api/health-safety/meetings
router.post('/meetings', (req, res) => {
  try {
    const userName = (req.user as any)?.name || 'Current User';
    
    const meeting: SafetyMeeting = {
      id: `meet-${meetingIdCounter++}`,
      ...req.body,
      createdBy: userName,
      createdAt: new Date().toISOString(),
    };
    
    meetings.push(meeting);
    res.status(201).json(meeting);
  } catch (error) {
    console.error('Error creating meeting:', error);
    res.status(500).json({ error: 'Failed to create meeting' });
  }
});

// PUT /api/health-safety/meetings/:id
router.put('/meetings/:id', (req, res) => {
  const index = meetings.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Meeting not found' });
  
  meetings[index] = { ...meetings[index], ...req.body };
  res.json(meetings[index]);
});

// PUT /api/health-safety/meetings/:id/action/:actionIndex
router.put('/meetings/:id/action/:actionIndex', (req, res) => {
  const meeting = meetings.find(m => m.id === req.params.id);
  if (!meeting) return res.status(404).json({ error: 'Meeting not found' });
  
  const actionIndex = parseInt(req.params.actionIndex);
  if (actionIndex < 0 || actionIndex >= meeting.actionItems.length) {
    return res.status(404).json({ error: 'Action item not found' });
  }
  
  meeting.actionItems[actionIndex] = { ...meeting.actionItems[actionIndex], ...req.body };
  res.json(meeting);
});

// ============================================
// TRAINING ENDPOINTS
// ============================================

// GET /api/health-safety/training
router.get('/training', (req, res) => {
  try {
    const { staffId, status } = req.query;
    let filtered = [...trainings];
    
    if (staffId) filtered = filtered.filter(t => t.staffId === staffId);
    if (status) filtered = filtered.filter(t => t.status === status);
    
    // Update status based on expiry dates
    filtered = filtered.map(t => {
      if (t.expiryDate) {
        const expiry = new Date(t.expiryDate);
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        
        if (expiry < now) {
          return { ...t, status: 'expired' as const };
        } else if (expiry < thirtyDaysFromNow) {
          return { ...t, status: 'expiring_soon' as const };
        }
      }
      return t;
    });
    
    res.json(filtered);
  } catch (error) {
    console.error('Error fetching training:', error);
    res.status(500).json({ error: 'Failed to fetch training records' });
  }
});

// POST /api/health-safety/training
router.post('/training', (req, res) => {
  try {
    const training: SafetyTraining = {
      id: `tr-${trainingIdCounter++}`,
      ...req.body,
      status: 'valid',
    };
    
    trainings.push(training);
    res.status(201).json(training);
  } catch (error) {
    console.error('Error creating training record:', error);
    res.status(500).json({ error: 'Failed to create training record' });
  }
});

// PUT /api/health-safety/training/:id
router.put('/training/:id', (req, res) => {
  const index = trainings.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Training record not found' });
  
  trainings[index] = { ...trainings[index], ...req.body };
  res.json(trainings[index]);
});

// DELETE /api/health-safety/training/:id
router.delete('/training/:id', (req, res) => {
  const index = trainings.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Training record not found' });
  trainings.splice(index, 1);
  res.json({ message: 'Training record deleted' });
});

// ============================================
// STATISTICS ENDPOINT
// ============================================

// GET /api/health-safety/stats
router.get('/stats', (req, res) => {
  try {
    const openIncidents = incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length;
    const totalIncidents = incidents.length;
    const nearMisses = incidents.filter(i => i.type === 'near_miss').length;
    const injuries = incidents.filter(i => i.type === 'injury').length;
    
    const totalHazards = hazards.length;
    const criticalHazards = hazards.filter(h => h.severity === 'critical').length;
    const uncontrolledHazards = hazards.filter(h => !['controlled', 'eliminated'].includes(h.status)).length;
    
    const validTraining = trainings.filter(t => t.status === 'valid').length;
    const trainingCompliance = trainings.length > 0 ? Math.round((validTraining / trainings.length) * 100) : 100;
    const expiredTraining = trainings.filter(t => t.status === 'expired').length;
    const expiringTraining = trainings.filter(t => t.status === 'expiring_soon').length;
    
    const overdueActions = meetings.flatMap(m => m.actionItems)
      .filter(a => !a.completed && new Date(a.dueDate) < new Date()).length;
    
    res.json({
      openIncidents,
      totalIncidents,
      nearMisses,
      injuries,
      totalHazards,
      criticalHazards,
      uncontrolledHazards,
      trainingCompliance,
      validTraining,
      expiredTraining,
      expiringTraining,
      overdueActions,
      totalMeetings: meetings.length,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
