import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { format, addYears, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Droplets, AlertTriangle, CheckCircle2, Clock, FileText, Target,
  Calendar, Download, Shield, MapPin, Leaf, ArrowRight, Plus,
  ChevronRight, Eye, Edit, Trash2, ClipboardCheck, Award,
  TrendingUp, BarChart3, Users, Building, AlertCircle, Info,
  CheckSquare, XCircle, Timer, Printer, Upload, RefreshCw
} from 'lucide-react';

// Interfaces
interface Risk {
  id: string;
  category: string;
  subcategory: string;
  description: string;
  location: string;
  likelihood: 'low' | 'medium' | 'high' | 'very-high';
  consequence: 'minor' | 'moderate' | 'major' | 'severe';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  currentControls: string[];
  status: 'identified' | 'assessed' | 'managed' | 'monitored';
  dateIdentified: string;
  lastReviewed: string;
}

interface Action {
  id: string;
  riskId: string;
  title: string;
  description: string;
  actionType: 'mitigate' | 'monitor' | 'avoid' | 'accept';
  priority: 'low' | 'medium' | 'high' | 'critical';
  responsible: string;
  startDate: string;
  dueDate: string;
  completedDate?: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'overdue';
  progress: number;
  cost?: number;
  notes?: string;
  year: number;
}

interface AuditRecord {
  id: string;
  type: 'internal' | 'external' | 'certification';
  date: string;
  auditor: string;
  status: 'scheduled' | 'completed' | 'passed' | 'failed' | 'conditional';
  findings: number;
  criticalFindings: number;
  nextAuditDate?: string;
  notes?: string;
}

interface Certification {
  id: string;
  name: string;
  issuedBy: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expiring' | 'expired' | 'pending';
  certificateNumber?: string;
}

// Mock Data
const riskCategories = [
  { id: 'nitrogen', name: 'Nitrogen Management', icon: 'leaf' },
  { id: 'phosphorus', name: 'Phosphorus Management', icon: 'droplets' },
  { id: 'sediment', name: 'Sediment Control', icon: 'mountain' },
  { id: 'waterways', name: 'Waterway Protection', icon: 'droplets' },
  { id: 'effluent', name: 'Effluent Management', icon: 'droplets' },
  { id: 'irrigation', name: 'Irrigation Management', icon: 'droplets' },
  { id: 'wetlands', name: 'Wetland Protection', icon: 'leaf' },
  { id: 'stock', name: 'Stock Exclusion', icon: 'fence' },
];

const mockRisks: Risk[] = [
  { id: 'r1', category: 'nitrogen', subcategory: 'Fertiliser Application', description: 'Risk of nitrogen leaching from excessive fertiliser application on free-draining soils', location: 'North Block - Paddocks 1-5', likelihood: 'medium', consequence: 'moderate', riskLevel: 'medium', currentControls: ['Soil testing', 'Split applications', 'Weather monitoring'], status: 'managed', dateIdentified: '2023-06-15', lastReviewed: '2024-01-10' },
  { id: 'r2', category: 'phosphorus', subcategory: 'Runoff', description: 'Phosphorus runoff risk from steep paddocks adjacent to stream', location: 'South Block - Paddocks 12-15', likelihood: 'high', consequence: 'major', riskLevel: 'high', currentControls: ['Riparian planting', 'Buffer strips'], status: 'assessed', dateIdentified: '2023-07-20', lastReviewed: '2024-01-05' },
  { id: 'r3', category: 'effluent', subcategory: 'Storage', description: 'Effluent pond capacity may be insufficient during wet periods', location: 'Dairy Shed - Main Pond', likelihood: 'medium', consequence: 'major', riskLevel: 'high', currentControls: ['Daily monitoring', 'Irrigation schedule'], status: 'identified', dateIdentified: '2023-08-10', lastReviewed: '2023-12-15' },
  { id: 'r4', category: 'waterways', subcategory: 'Stock Access', description: 'Unfenced section of stream allows stock access', location: 'East Paddock - Stream crossing', likelihood: 'high', consequence: 'moderate', riskLevel: 'high', currentControls: ['Temporary fencing'], status: 'assessed', dateIdentified: '2023-05-01', lastReviewed: '2024-01-12' },
  { id: 'r5', category: 'sediment', subcategory: 'Erosion', description: 'Bank erosion on steep hillside paddock', location: 'West Hills - Paddock 8', likelihood: 'medium', consequence: 'moderate', riskLevel: 'medium', currentControls: ['Reduced stocking rate'], status: 'managed', dateIdentified: '2023-09-05', lastReviewed: '2024-01-08' },
  { id: 'r6', category: 'irrigation', subcategory: 'Over-application', description: 'Risk of drainage below root zone from irrigation', location: 'Centre Pivot - Block A', likelihood: 'low', consequence: 'moderate', riskLevel: 'low', currentControls: ['Soil moisture monitoring', 'Variable rate application'], status: 'monitored', dateIdentified: '2023-04-20', lastReviewed: '2024-01-15' },
];

const mockActions: Action[] = [
  { id: 'a1', riskId: 'r2', title: 'Complete riparian fencing', description: 'Install permanent 5-wire fence along stream boundary with 5m setback', actionType: 'mitigate', priority: 'high', responsible: 'John Smith', startDate: '2024-02-01', dueDate: '2024-06-30', status: 'in-progress', progress: 35, cost: 12000, year: 1 },
  { id: 'a2', riskId: 'r2', title: 'Riparian planting - Stage 1', description: 'Plant native species along 500m of stream bank', actionType: 'mitigate', priority: 'high', responsible: 'Sarah Johnson', startDate: '2024-05-01', dueDate: '2024-08-31', status: 'not-started', progress: 0, cost: 8500, year: 1 },
  { id: 'a3', riskId: 'r3', title: 'Effluent pond expansion', description: 'Increase pond capacity by 50% to meet wet weather storage requirements', actionType: 'mitigate', priority: 'critical', responsible: 'Mike Wilson', startDate: '2024-03-01', dueDate: '2024-09-30', status: 'not-started', progress: 0, cost: 45000, year: 1 },
  { id: 'a4', riskId: 'r4', title: 'Permanent stream fencing', description: 'Install permanent fencing to exclude stock from 800m of stream', actionType: 'mitigate', priority: 'high', responsible: 'John Smith', startDate: '2024-01-15', dueDate: '2024-04-30', status: 'in-progress', progress: 60, cost: 15000, year: 1 },
  { id: 'a5', riskId: 'r1', title: 'Install soil moisture sensors', description: 'Deploy 10 soil moisture sensors across high-risk paddocks', actionType: 'monitor', priority: 'medium', responsible: 'Tech Team', startDate: '2024-07-01', dueDate: '2024-09-30', status: 'not-started', progress: 0, cost: 5000, year: 2 },
  { id: 'a6', riskId: 'r5', title: 'Hillside retirement and planting', description: 'Retire steep areas and establish native plantings', actionType: 'mitigate', priority: 'medium', responsible: 'Sarah Johnson', startDate: '2025-03-01', dueDate: '2025-08-31', status: 'not-started', progress: 0, cost: 18000, year: 2 },
  { id: 'a7', riskId: 'r2', title: 'Riparian planting - Stage 2', description: 'Complete remaining 300m of stream bank planting', actionType: 'mitigate', priority: 'medium', responsible: 'Sarah Johnson', startDate: '2025-05-01', dueDate: '2025-08-31', status: 'not-started', progress: 0, cost: 5500, year: 2 },
  { id: 'a8', riskId: 'r6', title: 'Upgrade irrigation system', description: 'Install variable rate irrigation technology', actionType: 'mitigate', priority: 'low', responsible: 'Mike Wilson', startDate: '2026-01-01', dueDate: '2026-06-30', status: 'not-started', progress: 0, cost: 35000, year: 3 },
];

const mockAudits: AuditRecord[] = [
  { id: 'au1', type: 'internal', date: '2024-01-15', auditor: 'Farm Manager', status: 'completed', findings: 3, criticalFindings: 0, nextAuditDate: '2024-07-15', notes: 'Good progress on action plan' },
  { id: 'au2', type: 'external', date: '2024-06-01', auditor: 'Regional Council', status: 'scheduled', findings: 0, criticalFindings: 0, notes: 'Annual compliance check' },
  { id: 'au3', type: 'certification', date: '2023-11-20', auditor: 'Certified Planner', status: 'passed', findings: 2, criticalFindings: 0, nextAuditDate: '2024-11-20', notes: 'Plan certified for 12 months' },
];

const mockCertifications: Certification[] = [
  { id: 'c1', name: 'Freshwater Farm Plan Certification', issuedBy: 'Regional Council', issueDate: '2023-11-20', expiryDate: '2024-11-20', status: 'active', certificateNumber: 'FFP-2023-1234' },
  { id: 'c2', name: 'Certified Freshwater Farm Plan', issuedBy: 'NZ Farm Assurance', issueDate: '2023-12-01', expiryDate: '2024-12-01', status: 'active', certificateNumber: 'CFFP-5678' },
];

export default function FreshwaterFarmPlanPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedYear, setSelectedYear] = useState('1');
  const [isAddRiskOpen, setIsAddRiskOpen] = useState(false);
  const [isAddActionOpen, setIsAddActionOpen] = useState(false);
  const [riskWizardStep, setRiskWizardStep] = useState(1);
  const [selectedRiskCategory, setSelectedRiskCategory] = useState('');

  // Calculate stats
  const totalRisks = mockRisks.length;
  const highRisks = mockRisks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
  const managedRisks = mockRisks.filter(r => r.status === 'managed' || r.status === 'monitored').length;
  const totalActions = mockActions.length;
  const completedActions = mockActions.filter(a => a.status === 'completed').length;
  const overdueActions = mockActions.filter(a => a.status === 'overdue' || (a.status !== 'completed' && new Date(a.dueDate) < new Date())).length;
  const totalCost = mockActions.reduce((s, a) => s + (a.cost || 0), 0);
  const overallProgress = Math.round((completedActions / totalActions) * 100);

  // Actions by year
  const actionsByYear = (year: number) => mockActions.filter(a => a.year === year);
  const yearProgress = (year: number) => {
    const yearActions = actionsByYear(year);
    if (yearActions.length === 0) return 0;
    return Math.round(yearActions.reduce((s, a) => s + a.progress, 0) / yearActions.length);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'passed': case 'active': case 'managed': case 'monitored': return 'bg-green-100 text-green-800';
      case 'in-progress': case 'assessed': return 'bg-blue-100 text-blue-800';
      case 'overdue': case 'failed': case 'expired': case 'critical': return 'bg-red-100 text-red-800';
      case 'expiring': case 'conditional': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-green-100 text-green-800';
    }
  };

  const daysUntilDue = (date: string) => differenceInDays(new Date(date), new Date());

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg">
                <Droplets className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Freshwater Farm Plan</h1>
                <p className="text-sm text-blue-100">NZ Regulatory Compliance & Environmental Management</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                <Printer className="h-4 w-4 mr-2" />Print Report
              </Button>
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0">
                <Download className="h-4 w-4 mr-2" />Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="risks">Risk Assessment</TabsTrigger>
            <TabsTrigger value="actions">Action Plan</TabsTrigger>
            <TabsTrigger value="5year">5-Year Plan</TabsTrigger>
            <TabsTrigger value="certification">Certification</TabsTrigger>
            <TabsTrigger value="audit">Audit Prep</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Risks</p><p className="text-2xl font-bold">{totalRisks}</p></div><AlertTriangle className="h-8 w-8 text-gray-200" /></div><p className="text-xs text-orange-600 mt-1">{highRisks} high/critical</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Risks Managed</p><p className="text-2xl font-bold text-green-600">{managedRisks}/{totalRisks}</p></div><Shield className="h-8 w-8 text-green-200" /></div><Progress value={(managedRisks/totalRisks)*100} className="h-2 mt-2" /></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Actions Progress</p><p className="text-2xl font-bold text-blue-600">{overallProgress}%</p></div><Target className="h-8 w-8 text-blue-200" /></div><p className="text-xs text-gray-500 mt-1">{completedActions}/{totalActions} completed</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">5-Year Investment</p><p className="text-2xl font-bold">${(totalCost/1000).toFixed(0)}k</p></div><TrendingUp className="h-8 w-8 text-purple-200" /></div><p className="text-xs text-red-600 mt-1">{overdueActions} overdue actions</p></CardContent></Card>
            </div>

            {/* Certification Status */}
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full">
                      <Award className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-green-800">Plan Certified</h3>
                      <p className="text-sm text-green-600">Your Freshwater Farm Plan is certified and compliant</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Certificate: FFP-2023-1234</p>
                    <p className="text-sm text-gray-600">Valid until: {format(new Date('2024-11-20'), 'MMM d, yyyy')}</p>
                    <Badge className="mt-2 bg-green-100 text-green-800">{daysUntilDue('2024-11-20')} days remaining</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Summary & Upcoming Actions */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-600" />High Priority Risks</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockRisks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').map(risk => (
                      <div key={risk.id} className={`p-3 rounded-lg border ${getRiskColor(risk.riskLevel)}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{risk.subcategory}</span>
                          <Badge className={getRiskColor(risk.riskLevel)}>{risk.riskLevel}</Badge>
                        </div>
                        <p className="text-xs text-gray-600">{risk.location}</p>
                        <p className="text-xs mt-1">{risk.description.substring(0, 80)}...</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-blue-600" />Upcoming Actions</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockActions.filter(a => a.status !== 'completed').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()).slice(0, 4).map(action => (
                      <div key={action.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{action.title}</span>
                          <Badge className={getPriorityColor(action.priority)}>{action.priority}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{action.responsible}</span>
                          <span className={daysUntilDue(action.dueDate) < 30 ? 'text-orange-600 font-medium' : ''}>
                            Due: {format(new Date(action.dueDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                        <Progress value={action.progress} className="h-1.5 mt-2" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Stats by Category */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Risk Categories</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {riskCategories.slice(0, 8).map(cat => {
                    const catRisks = mockRisks.filter(r => r.category === cat.id);
                    const highCount = catRisks.filter(r => r.riskLevel === 'high' || r.riskLevel === 'critical').length;
                    return (
                      <div key={cat.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                        <div className="flex items-center gap-2 mb-2">
                          <Droplets className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm">{cat.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">{catRisks.length}</span>
                          {highCount > 0 && <Badge className="bg-orange-100 text-orange-800">{highCount} high</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Assessment Tab */}
          <TabsContent value="risks" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Risk Register</h2>
              <Dialog open={isAddRiskOpen} onOpenChange={setIsAddRiskOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />Add Risk</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Risk Assessment Wizard - Step {riskWizardStep}/4</DialogTitle></DialogHeader>
                  <div className="py-4">
                    {riskWizardStep === 1 && (
                      <div className="space-y-4">
                        <h3 className="font-medium">Step 1: Select Risk Category</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {riskCategories.map(cat => (
                            <div key={cat.id} onClick={() => setSelectedRiskCategory(cat.id)} className={`p-4 border rounded-lg cursor-pointer hover:border-blue-500 ${selectedRiskCategory === cat.id ? 'border-blue-500 bg-blue-50' : ''}`}>
                              <div className="flex items-center gap-2"><Droplets className="h-5 w-5 text-blue-600" /><span className="font-medium">{cat.name}</span></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {riskWizardStep === 2 && (
                      <div className="space-y-4">
                        <h3 className="font-medium">Step 2: Describe the Risk</h3>
                        <div><Label>Risk Description</Label><Textarea placeholder="Describe the environmental risk..." rows={3} /></div>
                        <div><Label>Location</Label><Input placeholder="e.g., North Block - Paddocks 1-5" /></div>
                        <div><Label>Current Controls (if any)</Label><Textarea placeholder="List any existing controls or mitigations..." rows={2} /></div>
                      </div>
                    )}
                    {riskWizardStep === 3 && (
                      <div className="space-y-4">
                        <h3 className="font-medium">Step 3: Assess Risk Level</h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div><Label>Likelihood</Label><Select><SelectTrigger><SelectValue placeholder="Select likelihood" /></SelectTrigger><SelectContent><SelectItem value="low">Low - Unlikely</SelectItem><SelectItem value="medium">Medium - Possible</SelectItem><SelectItem value="high">High - Likely</SelectItem><SelectItem value="very-high">Very High - Almost Certain</SelectItem></SelectContent></Select></div>
                          <div><Label>Consequence</Label><Select><SelectTrigger><SelectValue placeholder="Select consequence" /></SelectTrigger><SelectContent><SelectItem value="minor">Minor - Minimal impact</SelectItem><SelectItem value="moderate">Moderate - Some impact</SelectItem><SelectItem value="major">Major - Significant impact</SelectItem><SelectItem value="severe">Severe - Critical impact</SelectItem></SelectContent></Select></div>
                        </div>
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="font-medium text-yellow-800">Calculated Risk Level: MEDIUM</p>
                          <p className="text-sm text-yellow-600">Based on likelihood and consequence assessment</p>
                        </div>
                      </div>
                    )}
                    {riskWizardStep === 4 && (
                      <div className="space-y-4">
                        <h3 className="font-medium">Step 4: Review & Confirm</h3>
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                          <p><strong>Category:</strong> Nitrogen Management</p>
                          <p><strong>Description:</strong> Risk of nitrogen leaching...</p>
                          <p><strong>Location:</strong> North Block</p>
                          <p><strong>Risk Level:</strong> <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge></p>
                        </div>
                        <div className="flex items-center gap-2"><Checkbox id="confirm" /><Label htmlFor="confirm">I confirm this risk assessment is accurate</Label></div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    {riskWizardStep > 1 && <Button variant="outline" onClick={() => setRiskWizardStep(s => s - 1)}>Back</Button>}
                    {riskWizardStep < 4 ? (
                      <Button onClick={() => setRiskWizardStep(s => s + 1)} disabled={riskWizardStep === 1 && !selectedRiskCategory}>Next</Button>
                    ) : (
                      <Button onClick={() => { setIsAddRiskOpen(false); setRiskWizardStep(1); toast.success('Risk added to register'); }}>Save Risk</Button>
                    )}
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Category</th>
                      <th className="text-left p-4 text-sm font-medium">Description</th>
                      <th className="text-left p-4 text-sm font-medium">Location</th>
                      <th className="text-center p-4 text-sm font-medium">Risk Level</th>
                      <th className="text-center p-4 text-sm font-medium">Status</th>
                      <th className="text-center p-4 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockRisks.map(risk => (
                      <tr key={risk.id} className="hover:bg-accent">
                        <td className="p-4"><div><p className="font-medium text-sm">{risk.subcategory}</p><p className="text-xs text-gray-500">{riskCategories.find(c => c.id === risk.category)?.name}</p></div></td>
                        <td className="p-4 text-sm max-w-xs"><p className="truncate">{risk.description}</p></td>
                        <td className="p-4 text-sm text-gray-600">{risk.location}</td>
                        <td className="p-4 text-center"><Badge className={getRiskColor(risk.riskLevel)}>{risk.riskLevel}</Badge></td>
                        <td className="p-4 text-center"><Badge className={getStatusColor(risk.status)}>{risk.status}</Badge></td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm"><Edit className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Action Plan Tab */}
          <TabsContent value="actions" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Risk Management Actions</h2>
              <Button className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />Add Action</Button>
            </div>

            <div className="grid md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Actions</p><p className="text-3xl font-bold">{totalActions}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Completed</p><p className="text-3xl font-bold text-green-600">{completedActions}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">In Progress</p><p className="text-3xl font-bold text-blue-600">{mockActions.filter(a => a.status === 'in-progress').length}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Overdue</p><p className="text-3xl font-bold text-red-600">{overdueActions}</p></CardContent></Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Action</th>
                      <th className="text-left p-4 text-sm font-medium">Type</th>
                      <th className="text-left p-4 text-sm font-medium">Responsible</th>
                      <th className="text-center p-4 text-sm font-medium">Priority</th>
                      <th className="text-center p-4 text-sm font-medium">Due Date</th>
                      <th className="text-center p-4 text-sm font-medium">Progress</th>
                      <th className="text-right p-4 text-sm font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockActions.map(action => (
                      <tr key={action.id} className="hover:bg-accent">
                        <td className="p-4"><p className="font-medium text-sm">{action.title}</p><p className="text-xs text-gray-500">{action.description.substring(0, 50)}...</p></td>
                        <td className="p-4"><Badge variant="outline">{action.actionType}</Badge></td>
                        <td className="p-4 text-sm">{action.responsible}</td>
                        <td className="p-4 text-center"><Badge className={getPriorityColor(action.priority)}>{action.priority}</Badge></td>
                        <td className="p-4 text-center text-sm">{format(new Date(action.dueDate), 'MMM d, yyyy')}</td>
                        <td className="p-4"><div className="flex items-center gap-2"><Progress value={action.progress} className="h-2 w-20" /><span className="text-xs">{action.progress}%</span></div></td>
                        <td className="p-4 text-right font-medium">${action.cost?.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 5-Year Plan Tab */}
          <TabsContent value="5year" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">5-Year Action Plan</h2>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  <SelectItem value="1">Year 1 (2024)</SelectItem>
                  <SelectItem value="2">Year 2 (2025)</SelectItem>
                  <SelectItem value="3">Year 3 (2026)</SelectItem>
                  <SelectItem value="4">Year 4 (2027)</SelectItem>
                  <SelectItem value="5">Year 5 (2028)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year Progress Cards */}
            <div className="grid grid-cols-5 gap-4">
              {[1, 2, 3, 4, 5].map(year => {
                const yearActs = actionsByYear(year);
                const progress = yearProgress(year);
                const cost = yearActs.reduce((s, a) => s + (a.cost || 0), 0);
                return (
                  <Card key={year} className={selectedYear === String(year) ? 'border-2 border-blue-500' : ''} onClick={() => setSelectedYear(String(year))}>
                    <CardContent className="p-4 cursor-pointer">
                      <p className="text-sm text-gray-500">Year {year}</p>
                      <p className="text-xl font-bold">{2023 + year}</p>
                      <Progress value={progress} className="h-2 my-2" />
                      <div className="flex justify-between text-xs">
                        <span>{yearActs.length} actions</span>
                        <span>${(cost/1000).toFixed(0)}k</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Year Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Year {selectedYear} Actions ({2023 + parseInt(selectedYear)})</CardTitle>
                <CardDescription>
                  {actionsByYear(parseInt(selectedYear)).length} actions • ${(actionsByYear(parseInt(selectedYear)).reduce((s, a) => s + (a.cost || 0), 0) / 1000).toFixed(0)}k budget • {yearProgress(parseInt(selectedYear))}% complete
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(selectedYear === 'all' ? mockActions : actionsByYear(parseInt(selectedYear))).map(action => (
                    <div key={action.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium">{action.title}</h4>
                          <p className="text-sm text-gray-500">{action.description}</p>
                        </div>
                        <Badge className={getPriorityColor(action.priority)}>{action.priority}</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm mt-3">
                        <div><span className="text-gray-500">Responsible:</span><p className="font-medium">{action.responsible}</p></div>
                        <div><span className="text-gray-500">Timeline:</span><p className="font-medium">{format(new Date(action.startDate), 'MMM yyyy')} - {format(new Date(action.dueDate), 'MMM yyyy')}</p></div>
                        <div><span className="text-gray-500">Budget:</span><p className="font-medium">${action.cost?.toLocaleString()}</p></div>
                        <div><span className="text-gray-500">Progress:</span><div className="flex items-center gap-2"><Progress value={action.progress} className="h-2 flex-1" /><span>{action.progress}%</span></div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Certification Tab */}
          <TabsContent value="certification" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {mockCertifications.map(cert => (
                <Card key={cert.id} className={`border-2 ${cert.status === 'active' ? 'border-green-200 bg-green-50' : cert.status === 'expiring' ? 'border-orange-200 bg-orange-50' : 'border-red-200 bg-red-50'}`}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-full ${cert.status === 'active' ? 'bg-green-100' : 'bg-orange-100'}`}>
                          <Award className={`h-6 w-6 ${cert.status === 'active' ? 'text-green-600' : 'text-orange-600'}`} />
                        </div>
                        <div>
                          <h3 className="font-bold">{cert.name}</h3>
                          <p className="text-sm text-gray-600">{cert.issuedBy}</p>
                        </div>
                      </div>
                      <Badge className={getStatusColor(cert.status)}>{cert.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500">Certificate #:</span><p className="font-medium">{cert.certificateNumber}</p></div>
                      <div><span className="text-gray-500">Issue Date:</span><p className="font-medium">{format(new Date(cert.issueDate), 'MMM d, yyyy')}</p></div>
                      <div><span className="text-gray-500">Expiry Date:</span><p className="font-medium">{format(new Date(cert.expiryDate), 'MMM d, yyyy')}</p></div>
                      <div><span className="text-gray-500">Days Remaining:</span><p className={`font-medium ${daysUntilDue(cert.expiryDate) < 90 ? 'text-orange-600' : 'text-green-600'}`}>{daysUntilDue(cert.expiryDate)} days</p></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button variant="outline" size="sm" className="flex-1"><Eye className="h-4 w-4 mr-2" />View Certificate</Button>
                      <Button variant="outline" size="sm" className="flex-1"><Download className="h-4 w-4 mr-2" />Download</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Certification Requirements Checklist</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { item: 'Risk assessment completed for all categories', done: true },
                    { item: 'Action plan developed with timelines', done: true },
                    { item: 'Responsible persons assigned to all actions', done: true },
                    { item: 'Budget allocated for 5-year plan', done: true },
                    { item: 'Monitoring procedures documented', done: true },
                    { item: 'Annual review schedule established', done: false },
                    { item: 'Staff training completed', done: false },
                  ].map((req, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      {req.done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-gray-300" />}
                      <span className={req.done ? 'text-gray-900' : 'text-gray-500'}>{req.item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Prep Tab */}
          <TabsContent value="audit" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Next Audit</p><p className="text-xl font-bold text-blue-700">{format(new Date('2024-06-01'), 'MMM d, yyyy')}</p><p className="text-xs text-blue-600">{daysUntilDue('2024-06-01')} days away</p></CardContent></Card>
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Last Audit Result</p><p className="text-xl font-bold text-green-700">PASSED</p><p className="text-xs text-green-600">2 minor findings</p></CardContent></Card>
              <Card className="bg-purple-50"><CardContent className="p-4 text-center"><p className="text-sm text-purple-600">Audit Readiness</p><p className="text-xl font-bold text-purple-700">85%</p><Progress value={85} className="h-2 mt-2" /></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Audit History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Date</th>
                      <th className="text-left p-4 text-sm font-medium">Type</th>
                      <th className="text-left p-4 text-sm font-medium">Auditor</th>
                      <th className="text-center p-4 text-sm font-medium">Findings</th>
                      <th className="text-center p-4 text-sm font-medium">Status</th>
                      <th className="text-center p-4 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockAudits.map(audit => (
                      <tr key={audit.id} className="hover:bg-accent">
                        <td className="p-4 font-medium">{format(new Date(audit.date), 'MMM d, yyyy')}</td>
                        <td className="p-4"><Badge variant="outline">{audit.type}</Badge></td>
                        <td className="p-4">{audit.auditor}</td>
                        <td className="p-4 text-center">{audit.findings} ({audit.criticalFindings} critical)</td>
                        <td className="p-4 text-center"><Badge className={getStatusColor(audit.status)}>{audit.status}</Badge></td>
                        <td className="p-4 text-center"><Button variant="ghost" size="sm"><FileText className="h-4 w-4" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Audit-Ready Reports</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { name: 'Risk Register Summary', icon: AlertTriangle, ready: true },
                    { name: 'Action Plan Progress', icon: Target, ready: true },
                    { name: '5-Year Investment Plan', icon: Calendar, ready: true },
                    { name: 'Monitoring Records', icon: ClipboardCheck, ready: true },
                    { name: 'Compliance Evidence', icon: Shield, ready: false },
                    { name: 'Training Records', icon: Users, ready: false },
                  ].map((report, idx) => (
                    <div key={idx} className="p-4 border rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <report.icon className="h-5 w-5 text-gray-400" />
                        <span className="font-medium text-sm">{report.name}</span>
                      </div>
                      {report.ready ? (
                        <Button variant="outline" size="sm"><Download className="h-4 w-4" /></Button>
                      ) : (
                        <Badge className="bg-orange-100 text-orange-800">Pending</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
