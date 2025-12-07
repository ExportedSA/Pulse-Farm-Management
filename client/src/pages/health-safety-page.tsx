import { useState, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  AlertTriangle, Shield, FileText, Users, MapPin, Plus, CheckCircle, Clock,
  AlertCircle, Calendar as CalendarIcon, Eye, Edit, Phone, Building,
  GraduationCap, Map, Activity, Flame, Zap, Droplets, Car, Wrench,
  Mountain, CircleDot, Target, TreePine
} from 'lucide-react';

const FarmMap = lazy(() => import('@/components/FarmMap'));

// Interfaces
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
  resolvedAt?: string;
  resolvedBy?: string;
}

interface Hazard {
  id: string;
  type: 'chemical' | 'machinery' | 'terrain' | 'water' | 'electrical' | 'biological' | 'fire' | 'vehicle' | 'manual_handling' | 'other';
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
  riskRating?: number;
  residualRisk?: number;
}

interface EmergencyPlan {
  id: string;
  title: string;
  type: 'fire' | 'medical' | 'chemical_spill' | 'natural_disaster' | 'biosecurity' | 'evacuation' | 'other';
  description: string;
  procedures: string[];
  emergencyContacts: { name: string; role: string; phone: string }[];
  assemblyPoints: string[];
  lastUpdated: string;
  status: 'current' | 'under_review' | 'outdated';
}

interface SafetyMeeting {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  minutes: string;
  actionItems: { task: string; assignee: string; dueDate: string; completed: boolean }[];
  nextMeetingDate?: string;
}

interface SafetyTraining {
  id: string;
  staffName: string;
  trainingType: string;
  provider: string;
  completedDate: string;
  expiryDate?: string;
  status: 'valid' | 'expiring_soon' | 'expired' | 'scheduled';
}

// Mock Data
const mockIncidents: Incident[] = [
  {
    id: 'inc-1', type: 'near_miss', severity: 'moderate',
    title: 'Near miss - Tractor reversing',
    description: 'Tractor reversed without checking mirrors, nearly hitting a worker.',
    location: 'Main Shed Area', latitude: -40.9006, longitude: 175.6466,
    dateOccurred: '2024-01-15', timeOccurred: '10:30',
    reportedBy: 'John Smith', reportedAt: '2024-01-15T11:00:00Z',
    involvedPersons: ['Mike Wilson'], witnesses: ['Sarah Johnson'],
    immediateActions: 'Stopped work, briefed all staff on reversing procedures',
    status: 'resolved', resolvedAt: '2024-01-20T14:00:00Z', resolvedBy: 'Farm Manager',
  },
  {
    id: 'inc-2', type: 'injury', severity: 'minor',
    title: 'Minor cut from fencing wire',
    description: 'Worker received minor cut to hand while handling fencing wire without gloves.',
    location: 'Back Paddock', latitude: -40.9020, longitude: 175.6480,
    dateOccurred: '2024-01-18', timeOccurred: '14:15',
    reportedBy: 'Sarah Johnson', reportedAt: '2024-01-18T14:30:00Z',
    involvedPersons: ['Sarah Johnson'], witnesses: [],
    immediateActions: 'First aid administered', status: 'closed',
  },
];

const mockHazards: Hazard[] = [
  {
    id: 'haz-1', type: 'chemical', severity: 'high',
    title: 'Chemical Storage Area',
    description: 'Agricultural chemicals require proper ventilation and PPE.',
    location: 'Chemical Shed', latitude: -40.9010, longitude: 175.6470,
    identifiedBy: 'John Smith', identifiedAt: '2024-01-10T09:00:00Z',
    controls: ['PPE signage', 'MSDS sheets', 'Spill kit', 'Ventilation'],
    status: 'controlled', reviewDate: '2024-04-10', riskRating: 15, residualRisk: 6,
  },
  {
    id: 'haz-2', type: 'electrical', severity: 'critical',
    title: 'Damaged Power Cable',
    description: 'Exposed wiring on power cable - electrocution risk.',
    location: 'Pump Shed', latitude: -40.9015, longitude: 175.6475,
    identifiedBy: 'John Smith', identifiedAt: '2024-01-20T08:00:00Z',
    controls: ['Area cordoned off', 'Electrician called'],
    status: 'identified', reviewDate: '2024-01-21', riskRating: 25,
  },
  {
    id: 'haz-3', type: 'machinery', severity: 'medium',
    title: 'PTO Shaft on Tractor',
    description: 'Exposed PTO shaft - entanglement risk.',
    location: 'Equipment Yard', latitude: -40.9008, longitude: 175.6468,
    identifiedBy: 'Mike Wilson', identifiedAt: '2024-01-05T10:00:00Z',
    controls: ['PTO guard fitted', 'Training provided'],
    status: 'controlled', reviewDate: '2024-07-05', riskRating: 12, residualRisk: 4,
  },
];

const mockEmergencyPlans: EmergencyPlan[] = [
  {
    id: 'ep-1', title: 'Fire Emergency Plan', type: 'fire',
    description: 'Procedures for responding to fire emergencies.',
    procedures: ['Raise alarm', 'Call 111', 'Evacuate to assembly point', 'Account for all personnel'],
    emergencyContacts: [
      { name: 'Fire Service', role: 'Emergency', phone: '111' },
      { name: 'John Smith', role: 'Fire Warden', phone: '027 123 4567' },
    ],
    assemblyPoints: ['Main gate entrance'],
    lastUpdated: '2024-01-01', status: 'current',
  },
  {
    id: 'ep-2', title: 'Medical Emergency Plan', type: 'medical',
    description: 'Procedures for medical emergencies and injuries.',
    procedures: ['Assess scene safety', 'Call 111', 'Administer first aid', 'Document incident'],
    emergencyContacts: [
      { name: 'Ambulance', role: 'Emergency', phone: '111' },
      { name: 'Sarah Johnson', role: 'First Aider', phone: '027 234 5678' },
    ],
    assemblyPoints: ['First aid room'],
    lastUpdated: '2024-01-01', status: 'current',
  },
];

const mockMeetings: SafetyMeeting[] = [
  {
    id: 'meet-1', title: 'Monthly H&S Meeting - January',
    date: '2024-01-15', attendees: ['John Smith', 'Sarah Johnson', 'Mike Wilson'],
    minutes: 'Reviewed near-miss incident. Discussed reversing training needs.',
    actionItems: [
      { task: 'Arrange reversing training', assignee: 'John Smith', dueDate: '2024-01-31', completed: true },
      { task: 'Contact electrician', assignee: 'Mike Wilson', dueDate: '2024-01-22', completed: false },
    ],
    nextMeetingDate: '2024-02-15',
  },
];

const mockTraining: SafetyTraining[] = [
  { id: 'tr-1', staffName: 'John Smith', trainingType: 'First Aid Certificate', provider: 'St John', completedDate: '2023-06-15', expiryDate: '2025-06-15', status: 'valid' },
  { id: 'tr-2', staffName: 'Sarah Johnson', trainingType: 'Chemical Handling', provider: 'Growsafe', completedDate: '2022-11-01', expiryDate: '2024-11-01', status: 'expiring_soon' },
  { id: 'tr-3', staffName: 'Mike Wilson', trainingType: 'First Aid Certificate', provider: 'St John', completedDate: '2022-01-15', expiryDate: '2024-01-15', status: 'expired' },
  { id: 'tr-4', staffName: 'Emily Brown', trainingType: 'H&S Induction', provider: 'Internal', completedDate: '2024-01-02', status: 'valid' },
];

export default function HealthSafetyPage() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [incidents, setIncidents] = useState<Incident[]>(mockIncidents);
  const [hazards, setHazards] = useState<Hazard[]>(mockHazards);
  const [emergencyPlans] = useState<EmergencyPlan[]>(mockEmergencyPlans);
  const [meetings] = useState<SafetyMeeting[]>(mockMeetings);
  const [training] = useState<SafetyTraining[]>(mockTraining);
  const [isIncidentDialogOpen, setIsIncidentDialogOpen] = useState(false);
  const [isHazardDialogOpen, setIsHazardDialogOpen] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState('all');
  const [hazardFilter, setHazardFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHazardMap, setShowHazardMap] = useState(false);

  const [newIncident, setNewIncident] = useState({
    type: 'near_miss' as Incident['type'],
    severity: 'minor' as Incident['severity'],
    title: '', description: '', location: '',
    dateOccurred: format(new Date(), 'yyyy-MM-dd'),
    timeOccurred: format(new Date(), 'HH:mm'),
    involvedPersons: '', witnesses: '', immediateActions: '',
  });

  const [newHazard, setNewHazard] = useState({
    type: 'other' as Hazard['type'],
    severity: 'low' as Hazard['severity'],
    title: '', description: '', location: '', controls: '',
  });

  // Stats
  const stats = {
    openIncidents: incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length,
    totalIncidents: incidents.length,
    criticalHazards: hazards.filter(h => h.severity === 'critical').length,
    uncontrolledHazards: hazards.filter(h => !['controlled', 'eliminated'].includes(h.status)).length,
    trainingCompliance: Math.round((training.filter(t => t.status === 'valid').length / training.length) * 100),
    expiredTraining: training.filter(t => t.status === 'expired').length,
    overdueActions: meetings.flatMap(m => m.actionItems).filter(a => !a.completed && new Date(a.dueDate) < new Date()).length,
  };

  // Handlers
  const handleCreateIncident = () => {
    const incident: Incident = {
      id: `inc-${Date.now()}`, ...newIncident,
      involvedPersons: newIncident.involvedPersons.split(',').map(p => p.trim()).filter(Boolean),
      witnesses: newIncident.witnesses.split(',').map(w => w.trim()).filter(Boolean),
      reportedBy: 'Current User', reportedAt: new Date().toISOString(), status: 'reported',
    };
    setIncidents([incident, ...incidents]);
    setIsIncidentDialogOpen(false);
    setNewIncident({ type: 'near_miss', severity: 'minor', title: '', description: '', location: '',
      dateOccurred: format(new Date(), 'yyyy-MM-dd'), timeOccurred: format(new Date(), 'HH:mm'),
      involvedPersons: '', witnesses: '', immediateActions: '' });
    toast.success('Incident reported successfully');
  };

  const handleCreateHazard = () => {
    const hazard: Hazard = {
      id: `haz-${Date.now()}`, ...newHazard,
      controls: newHazard.controls.split(',').map(c => c.trim()).filter(Boolean),
      identifiedBy: 'Current User', identifiedAt: new Date().toISOString(),
      status: 'identified', reviewDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    };
    setHazards([hazard, ...hazards]);
    setIsHazardDialogOpen(false);
    setNewHazard({ type: 'other', severity: 'low', title: '', description: '', location: '', controls: '' });
    toast.success('Hazard registered successfully');
  };

  const updateIncidentStatus = (id: string, status: Incident['status']) => {
    setIncidents(incidents.map(i => i.id === id ? { ...i, status, ...(status === 'resolved' || status === 'closed' ? { resolvedAt: new Date().toISOString() } : {}) } : i));
    toast.success(`Incident status updated`);
  };

  const updateHazardStatus = (id: string, status: Hazard['status']) => {
    setHazards(hazards.map(h => h.id === id ? { ...h, status } : h));
    toast.success(`Hazard status updated`);
  };

  // Helpers
  const getSeverityColor = (s: string) => {
    if (s === 'critical' || s === 'serious') return 'bg-red-100 text-red-800';
    if (s === 'high' || s === 'moderate') return 'bg-orange-100 text-orange-800';
    if (s === 'medium') return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
  };

  const getStatusColor = (s: string) => {
    if (s === 'reported' || s === 'identified') return 'bg-blue-100 text-blue-800';
    if (s === 'investigating' || s === 'assessed') return 'bg-yellow-100 text-yellow-800';
    if (s === 'resolved' || s === 'controlled') return 'bg-green-100 text-green-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getTrainingStatusColor = (s: string) => {
    if (s === 'valid') return 'bg-green-100 text-green-800';
    if (s === 'expiring_soon') return 'bg-yellow-100 text-yellow-800';
    if (s === 'expired') return 'bg-red-100 text-red-800';
    return 'bg-blue-100 text-blue-800';
  };

  const getIncidentIcon = (t: string) => {
    if (t === 'injury') return <AlertCircle className="h-4 w-4 text-red-600" />;
    if (t === 'near_miss') return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    if (t === 'vehicle') return <Car className="h-4 w-4 text-blue-600" />;
    return <CircleDot className="h-4 w-4 text-gray-600" />;
  };

  const getHazardIcon = (t: string) => {
    if (t === 'chemical') return <Droplets className="h-4 w-4 text-purple-600" />;
    if (t === 'machinery') return <Wrench className="h-4 w-4 text-orange-600" />;
    if (t === 'electrical') return <Zap className="h-4 w-4 text-yellow-600" />;
    if (t === 'fire') return <Flame className="h-4 w-4 text-red-600" />;
    return <AlertTriangle className="h-4 w-4 text-gray-600" />;
  };

  const filteredIncidents = incidents.filter(i => {
    const matchesFilter = incidentFilter === 'all' || i.status === incidentFilter || i.type === incidentFilter;
    const matchesSearch = i.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const filteredHazards = hazards.filter(h => {
    const matchesFilter = hazardFilter === 'all' || h.status === hazardFilter || h.severity === hazardFilter;
    const matchesSearch = h.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Health & Safety</h1>
                <p className="text-sm text-gray-500">Manage workplace safety, incidents, and compliance</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={isIncidentDialogOpen} onOpenChange={setIsIncidentDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-red-600 hover:bg-red-700">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Report Incident
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Report Incident / Near Miss</DialogTitle>
                    <DialogDescription>Record details of any workplace incident or near miss.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select value={newIncident.type} onValueChange={(v) => setNewIncident({ ...newIncident, type: v as Incident['type'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="near_miss">Near Miss</SelectItem>
                            <SelectItem value="injury">Injury</SelectItem>
                            <SelectItem value="property_damage">Property Damage</SelectItem>
                            <SelectItem value="vehicle">Vehicle</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Severity</Label>
                        <Select value={newIncident.severity} onValueChange={(v) => setNewIncident({ ...newIncident, severity: v as Incident['severity'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minor">Minor</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="serious">Serious</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Title</Label><Input value={newIncident.title} onChange={(e) => setNewIncident({ ...newIncident, title: e.target.value })} placeholder="Brief description" /></div>
                    <div><Label>Description</Label><Textarea value={newIncident.description} onChange={(e) => setNewIncident({ ...newIncident, description: e.target.value })} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Date</Label><Input type="date" value={newIncident.dateOccurred} onChange={(e) => setNewIncident({ ...newIncident, dateOccurred: e.target.value })} /></div>
                      <div><Label>Time</Label><Input type="time" value={newIncident.timeOccurred} onChange={(e) => setNewIncident({ ...newIncident, timeOccurred: e.target.value })} /></div>
                    </div>
                    <div><Label>Location</Label><Input value={newIncident.location} onChange={(e) => setNewIncident({ ...newIncident, location: e.target.value })} /></div>
                    <div><Label>Persons Involved</Label><Input value={newIncident.involvedPersons} onChange={(e) => setNewIncident({ ...newIncident, involvedPersons: e.target.value })} placeholder="Comma separated" /></div>
                    <div><Label>Immediate Actions</Label><Textarea value={newIncident.immediateActions} onChange={(e) => setNewIncident({ ...newIncident, immediateActions: e.target.value })} rows={2} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsIncidentDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateIncident} disabled={!newIncident.title}>Submit</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isHazardDialogOpen} onOpenChange={setIsHazardDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline"><Plus className="h-4 w-4 mr-2" />Register Hazard</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Register New Hazard</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Type</Label>
                        <Select value={newHazard.type} onValueChange={(v) => setNewHazard({ ...newHazard, type: v as Hazard['type'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="chemical">Chemical</SelectItem>
                            <SelectItem value="machinery">Machinery</SelectItem>
                            <SelectItem value="electrical">Electrical</SelectItem>
                            <SelectItem value="fire">Fire</SelectItem>
                            <SelectItem value="terrain">Terrain</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Severity</Label>
                        <Select value={newHazard.severity} onValueChange={(v) => setNewHazard({ ...newHazard, severity: v as Hazard['severity'] })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div><Label>Title</Label><Input value={newHazard.title} onChange={(e) => setNewHazard({ ...newHazard, title: e.target.value })} /></div>
                    <div><Label>Description</Label><Textarea value={newHazard.description} onChange={(e) => setNewHazard({ ...newHazard, description: e.target.value })} rows={3} /></div>
                    <div><Label>Location</Label><Input value={newHazard.location} onChange={(e) => setNewHazard({ ...newHazard, location: e.target.value })} /></div>
                    <div><Label>Controls</Label><Input value={newHazard.controls} onChange={(e) => setNewHazard({ ...newHazard, controls: e.target.value })} placeholder="Comma separated" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsHazardDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateHazard} disabled={!newHazard.title}>Register</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="incidents">Incidents</TabsTrigger>
            <TabsTrigger value="hazards">Hazard Register</TabsTrigger>
            <TabsTrigger value="emergency">Emergency Plans</TabsTrigger>
            <TabsTrigger value="meetings">H&S Meetings</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Open Incidents</p><p className="text-2xl font-bold text-red-600">{stats.openIncidents}</p></div><AlertTriangle className="h-8 w-8 text-red-200" /></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Critical Hazards</p><p className="text-2xl font-bold text-orange-600">{stats.criticalHazards}</p></div><AlertCircle className="h-8 w-8 text-orange-200" /></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Training Compliance</p><p className="text-2xl font-bold text-green-600">{stats.trainingCompliance}%</p></div><GraduationCap className="h-8 w-8 text-green-200" /></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Overdue Actions</p><p className="text-2xl font-bold text-yellow-600">{stats.overdueActions}</p></div><Clock className="h-8 w-8 text-yellow-200" /></div></CardContent></Card>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-red-600" />Recent Incidents</CardTitle></CardHeader><CardContent><div className="space-y-3">{incidents.slice(0, 3).map(i => (<div key={i.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">{getIncidentIcon(i.type)}<div className="flex-1"><p className="font-medium text-sm">{i.title}</p><p className="text-xs text-gray-500">{i.location} • {i.dateOccurred}</p></div><Badge className={getSeverityColor(i.severity)}>{i.severity}</Badge></div>))}</div></CardContent></Card>
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertCircle className="h-5 w-5 text-orange-600" />Critical Hazards</CardTitle></CardHeader><CardContent><div className="space-y-3">{hazards.filter(h => h.severity === 'critical' || h.severity === 'high').slice(0, 3).map(h => (<div key={h.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">{getHazardIcon(h.type)}<div className="flex-1"><p className="font-medium text-sm">{h.title}</p><p className="text-xs text-gray-500">{h.location}</p></div><Badge className={getStatusColor(h.status)}>{h.status}</Badge></div>))}</div></CardContent></Card>
            </div>
            <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><GraduationCap className="h-5 w-5" />Training Alerts</CardTitle></CardHeader><CardContent><div className="grid md:grid-cols-3 gap-4">{training.filter(t => t.status !== 'valid').map(t => (<div key={t.id} className="flex items-center gap-3 p-3 border rounded-lg"><Avatar className="h-10 w-10"><AvatarFallback>{t.staffName.charAt(0)}</AvatarFallback></Avatar><div className="flex-1"><p className="font-medium text-sm">{t.staffName}</p><p className="text-xs text-gray-500">{t.trainingType}</p></div><Badge className={getTrainingStatusColor(t.status)}>{t.status === 'expired' ? 'Expired' : 'Expiring'}</Badge></div>))}</div></CardContent></Card>
          </TabsContent>

          {/* Incidents */}
          <TabsContent value="incidents" className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 min-w-[200px]" />
              <Select value={incidentFilter} onValueChange={setIncidentFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="reported">Reported</SelectItem><SelectItem value="investigating">Investigating</SelectItem><SelectItem value="resolved">Resolved</SelectItem><SelectItem value="near_miss">Near Misses</SelectItem><SelectItem value="injury">Injuries</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-4">
              {filteredIncidents.map(i => (
                <Card key={i.id}><CardContent className="p-6"><div className="flex items-start justify-between"><div className="flex items-start gap-4"><div className={`p-3 rounded-lg ${getSeverityColor(i.severity)}`}>{getIncidentIcon(i.type)}</div><div><div className="flex items-center gap-2 mb-1"><h3 className="font-semibold">{i.title}</h3><Badge className={getSeverityColor(i.severity)}>{i.severity}</Badge><Badge className={getStatusColor(i.status)}>{i.status.replace('_', ' ')}</Badge></div><p className="text-sm text-gray-600 mb-2">{i.description}</p><div className="flex gap-4 text-xs text-gray-500"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{i.location}</span><span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{i.dateOccurred}</span><span className="flex items-center gap-1"><Users className="h-3 w-3" />{i.involvedPersons.join(', ')}</span></div></div></div><div className="flex flex-col gap-2">{i.status === 'reported' && <Button size="sm" onClick={() => updateIncidentStatus(i.id, 'investigating')}>Investigate</Button>}{i.status === 'investigating' && <Button size="sm" onClick={() => updateIncidentStatus(i.id, 'resolved')}>Resolve</Button>}<Button size="sm" variant="ghost"><Eye className="h-4 w-4 mr-1" />Details</Button></div></div></CardContent></Card>
              ))}
              {filteredIncidents.length === 0 && <Card><CardContent className="py-12 text-center"><AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">No incidents found</p></CardContent></Card>}
            </div>
          </TabsContent>

          {/* Hazards */}
          <TabsContent value="hazards" className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="flex-1 min-w-[200px]" />
              <Select value={hazardFilter} onValueChange={setHazardFilter}><SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="identified">Identified</SelectItem><SelectItem value="controlled">Controlled</SelectItem><SelectItem value="critical">Critical</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select>
              <Button variant={showHazardMap ? 'default' : 'outline'} onClick={() => setShowHazardMap(!showHazardMap)}><Map className="h-4 w-4 mr-2" />{showHazardMap ? 'Hide Map' : 'Show Map'}</Button>
            </div>
            {showHazardMap && <Card className="h-[400px]"><CardContent className="p-0 h-full"><Suspense fallback={<div className="flex items-center justify-center h-full">Loading map...</div>}><FarmMap taskPins={hazards.filter(h => h.latitude).map(h => ({ id: h.id, title: h.title, description: h.description, latitude: h.latitude?.toString() || '0', longitude: h.longitude?.toString() || '0', status: h.status === 'controlled' ? 'completed' : 'pending', priority: h.severity === 'critical' ? 'urgent' : h.severity as any, category: h.type, dueDate: h.reviewDate, assignedTo: h.identifiedBy, pastureId: null, notes: h.controls.join(', '), completedAt: null, createdAt: h.identifiedAt }))} paddocks={[]} center={[-40.9006, 175.6466]} zoom={14} /></Suspense></CardContent></Card>}
            <div className="space-y-4">
              {filteredHazards.map(h => (
                <Card key={h.id}><CardContent className="p-6"><div className="flex items-start justify-between"><div className="flex items-start gap-4"><div className={`p-3 rounded-lg ${getSeverityColor(h.severity)}`}>{getHazardIcon(h.type)}</div><div><div className="flex items-center gap-2 mb-1"><h3 className="font-semibold">{h.title}</h3><Badge className={getSeverityColor(h.severity)}>{h.severity}</Badge><Badge className={getStatusColor(h.status)}>{h.status}</Badge></div><p className="text-sm text-gray-600 mb-2">{h.description}</p><div className="flex gap-4 text-xs text-gray-500 mb-2"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{h.location}</span><span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />Review: {h.reviewDate}</span>{h.riskRating && <span className="flex items-center gap-1"><Target className="h-3 w-3" />Risk: {h.riskRating} → {h.residualRisk || '?'}</span>}</div><div className="flex flex-wrap gap-1">{h.controls.map((c, i) => <Badge key={i} variant="secondary" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />{c}</Badge>)}</div></div></div><div className="flex flex-col gap-2">{h.status === 'identified' && <Button size="sm" onClick={() => updateHazardStatus(h.id, 'assessed')}>Assess</Button>}{h.status === 'assessed' && <Button size="sm" onClick={() => updateHazardStatus(h.id, 'controlled')}>Control</Button>}<Button size="sm" variant="ghost"><Edit className="h-4 w-4 mr-1" />Edit</Button></div></div></CardContent></Card>
              ))}
            </div>
          </TabsContent>

          {/* Emergency Plans */}
          <TabsContent value="emergency" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-6">
              {emergencyPlans.map(p => (
                <Card key={p.id}><CardHeader><div className="flex items-center gap-3">{p.type === 'fire' && <Flame className="h-6 w-6 text-red-600" />}{p.type === 'medical' && <Activity className="h-6 w-6 text-blue-600" />}<div><CardTitle>{p.title}</CardTitle><p className="text-sm text-gray-500">{p.description}</p></div></div></CardHeader><CardContent><div className="space-y-4"><div><h4 className="font-medium text-sm mb-2">Procedures</h4><ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">{p.procedures.map((proc, i) => <li key={i}>{proc}</li>)}</ol></div><div><h4 className="font-medium text-sm mb-2">Emergency Contacts</h4><div className="space-y-2">{p.emergencyContacts.map((c, i) => <div key={i} className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-gray-400" /><span className="font-medium">{c.name}</span><span className="text-gray-500">({c.role})</span><span className="text-blue-600">{c.phone}</span></div>)}</div></div><div><h4 className="font-medium text-sm mb-2">Assembly Points</h4><div className="flex flex-wrap gap-2">{p.assemblyPoints.map((a, i) => <Badge key={i} variant="outline"><MapPin className="h-3 w-3 mr-1" />{a}</Badge>)}</div></div><div className="pt-4 border-t flex justify-between items-center text-xs text-gray-500"><span>Updated: {p.lastUpdated}</span><Badge className={p.status === 'current' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>{p.status}</Badge></div></div></CardContent></Card>
              ))}
            </div>
          </TabsContent>

          {/* Meetings */}
          <TabsContent value="meetings" className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">H&S Meeting Records</h2><Button><Plus className="h-4 w-4 mr-2" />New Meeting</Button></div>
            {meetings.map(m => (
              <Card key={m.id}><CardHeader><CardTitle className="text-lg">{m.title}</CardTitle><p className="text-sm text-gray-500">{m.date} • {m.attendees.length} attendees</p></CardHeader><CardContent><div className="space-y-4"><div><h4 className="font-medium text-sm mb-2">Attendees</h4><div className="flex flex-wrap gap-2">{m.attendees.map((a, i) => <Badge key={i} variant="secondary">{a}</Badge>)}</div></div><div><h4 className="font-medium text-sm mb-2">Minutes</h4><p className="text-sm text-gray-600">{m.minutes}</p></div><div><h4 className="font-medium text-sm mb-2">Action Items</h4><div className="space-y-2">{m.actionItems.map((a, i) => <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded"><input type="checkbox" checked={a.completed} readOnly className="h-4 w-4" /><div className="flex-1"><p className={`text-sm ${a.completed ? 'line-through text-gray-400' : ''}`}>{a.task}</p><p className="text-xs text-gray-500">{a.assignee} • Due: {a.dueDate}</p></div>{!a.completed && new Date(a.dueDate) < new Date() && <Badge className="bg-red-100 text-red-800">Overdue</Badge>}</div>)}</div></div>{m.nextMeetingDate && <div className="pt-4 border-t text-sm text-gray-500">Next meeting: {m.nextMeetingDate}</div>}</div></CardContent></Card>
            ))}
          </TabsContent>

          {/* Training */}
          <TabsContent value="training" className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Safety Training Records</h2><Button><Plus className="h-4 w-4 mr-2" />Add Training</Button></div>
            <Card><CardContent className="p-0"><table className="w-full"><thead className="bg-gray-50"><tr><th className="text-left p-4 text-sm font-medium">Staff Member</th><th className="text-left p-4 text-sm font-medium">Training</th><th className="text-left p-4 text-sm font-medium">Provider</th><th className="text-left p-4 text-sm font-medium">Completed</th><th className="text-left p-4 text-sm font-medium">Expiry</th><th className="text-left p-4 text-sm font-medium">Status</th></tr></thead><tbody className="divide-y">{training.map(t => (<tr key={t.id}><td className="p-4"><div className="flex items-center gap-3"><Avatar className="h-8 w-8"><AvatarFallback>{t.staffName.charAt(0)}</AvatarFallback></Avatar><span className="font-medium text-sm">{t.staffName}</span></div></td><td className="p-4 text-sm">{t.trainingType}</td><td className="p-4 text-sm text-gray-500">{t.provider}</td><td className="p-4 text-sm">{t.completedDate}</td><td className="p-4 text-sm">{t.expiryDate || '-'}</td><td className="p-4"><Badge className={getTrainingStatusColor(t.status)}>{t.status.replace('_', ' ')}</Badge></td></tr>))}</tbody></table></CardContent></Card>
            <Card><CardHeader><CardTitle className="text-lg">Training Compliance Overview</CardTitle></CardHeader><CardContent><div className="space-y-4"><div className="flex items-center justify-between"><span className="text-sm">Overall Compliance</span><span className="font-bold">{stats.trainingCompliance}%</span></div><Progress value={stats.trainingCompliance} className="h-3" /><div className="grid grid-cols-3 gap-4 pt-4"><div className="text-center p-3 bg-green-50 rounded-lg"><p className="text-2xl font-bold text-green-600">{training.filter(t => t.status === 'valid').length}</p><p className="text-xs text-gray-500">Valid</p></div><div className="text-center p-3 bg-yellow-50 rounded-lg"><p className="text-2xl font-bold text-yellow-600">{training.filter(t => t.status === 'expiring_soon').length}</p><p className="text-xs text-gray-500">Expiring Soon</p></div><div className="text-center p-3 bg-red-50 rounded-lg"><p className="text-2xl font-bold text-red-600">{stats.expiredTraining}</p><p className="text-xs text-gray-500">Expired</p></div></div></div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
