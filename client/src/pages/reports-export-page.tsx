import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { format, subDays, subMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  FileText, Download, Mail, Calendar, Clock, Filter, Settings,
  FileSpreadsheet, File, Printer, Send, Plus, Eye, Edit, Trash2,
  CheckCircle2, AlertTriangle, RefreshCw, BarChart3, PieChart,
  Shield, Leaf, Droplets, Users, Beef, Activity, Award, Building,
  ChevronRight, Play, Pause, Copy, ExternalLink, Search
} from 'lucide-react';

// Interfaces
interface ReportTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: string;
  formats: string[];
  lastGenerated?: string;
  frequency?: string;
  sections: string[];
}

interface ScheduledReport {
  id: string;
  reportId: string;
  reportName: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
  nextRun: string;
  recipients: string[];
  format: string;
  status: 'active' | 'paused';
  lastSent?: string;
}

interface GeneratedReport {
  id: string;
  name: string;
  type: string;
  generatedAt: string;
  generatedBy: string;
  format: string;
  size: string;
  status: 'ready' | 'generating' | 'failed';
  downloadUrl?: string;
}

interface CustomReport {
  id: string;
  name: string;
  description?: string;
  dateRange: { start: string; end: string };
  sections: string[];
  filters: Record<string, string>;
  createdAt: string;
  createdBy: string;
}

// Mock Data
const reportTemplates: ReportTemplate[] = [
  { id: 'nzfap', name: 'NZFAP Compliance Report', category: 'Compliance', description: 'Full New Zealand Farm Assurance Programme compliance report for auditors', icon: 'shield', formats: ['PDF', 'Excel'], sections: ['Animal Welfare', 'Biosecurity', 'Food Safety', 'Environment', 'People'], frequency: 'Annually' },
  { id: 'fwfp', name: 'Freshwater Farm Plan Report', category: 'Compliance', description: 'Comprehensive freshwater farm plan documentation for regional council', icon: 'droplets', formats: ['PDF'], sections: ['Risk Assessment', 'Action Plan', '5-Year Plan', 'Monitoring Records'], frequency: 'Annually' },
  { id: 'fep', name: 'Farm Environment Plan', category: 'Compliance', description: 'Environmental management plan and compliance evidence', icon: 'leaf', formats: ['PDF', 'Excel'], sections: ['Water Quality', 'Nutrient Budget', 'Effluent', 'Riparian', 'Carbon'], frequency: 'Annually' },
  { id: 'nait', name: 'NAIT Compliance Report', category: 'Compliance', description: 'Animal movement and identification records for NAIT', icon: 'beef', formats: ['PDF', 'Excel', 'CSV'], sections: ['Animal Register', 'Movements', 'Deaths', 'Tags'], frequency: 'Monthly' },
  { id: 'herd-performance', name: 'Herd Performance Report', category: 'Production', description: 'Comprehensive herd performance metrics and analysis', icon: 'activity', formats: ['PDF', 'Excel'], sections: ['Production', 'Reproduction', 'Health', 'Genetics'], lastGenerated: '2024-01-15' },
  { id: 'financial-summary', name: 'Financial Summary', category: 'Financial', description: 'Farm financial performance and cost analysis', icon: 'chart', formats: ['PDF', 'Excel'], sections: ['Revenue', 'Costs', 'Margins', 'Budgets'], lastGenerated: '2024-01-10' },
  { id: 'treatment-records', name: 'Treatment Records', category: 'Health', description: 'Animal treatment history and withholding periods', icon: 'health', formats: ['PDF', 'Excel', 'CSV'], sections: ['Treatments', 'Withholding', 'Medicines Used'], lastGenerated: '2024-01-14' },
  { id: 'staff-timesheets', name: 'Staff Timesheets', category: 'Operations', description: 'Staff hours, leave, and payroll summary', icon: 'users', formats: ['PDF', 'Excel'], sections: ['Hours Worked', 'Leave', 'Overtime'], frequency: 'Weekly' },
  { id: 'vehicle-maintenance', name: 'Vehicle & Equipment', category: 'Operations', description: 'Fleet maintenance records and compliance', icon: 'vehicle', formats: ['PDF', 'Excel'], sections: ['Inspections', 'Maintenance', 'Costs'] },
  { id: 'visitor-log', name: 'Visitor Log', category: 'Biosecurity', description: 'Visitor sign-in records and biosecurity compliance', icon: 'users', formats: ['PDF', 'Excel', 'CSV'], sections: ['Sign-ins', 'Declarations', 'Contractors'] },
];

const scheduledReports: ScheduledReport[] = [
  { id: 's1', reportId: 'nait', reportName: 'NAIT Compliance Report', frequency: 'monthly', nextRun: '2024-02-01', recipients: ['farm@example.com', 'manager@example.com'], format: 'PDF', status: 'active', lastSent: '2024-01-01' },
  { id: 's2', reportId: 'staff-timesheets', reportName: 'Staff Timesheets', frequency: 'weekly', nextRun: '2024-01-22', recipients: ['payroll@example.com'], format: 'Excel', status: 'active', lastSent: '2024-01-15' },
  { id: 's3', reportId: 'herd-performance', reportName: 'Herd Performance Report', frequency: 'monthly', nextRun: '2024-02-01', recipients: ['farm@example.com'], format: 'PDF', status: 'active', lastSent: '2024-01-01' },
  { id: 's4', reportId: 'treatment-records', reportName: 'Treatment Records', frequency: 'weekly', nextRun: '2024-01-22', recipients: ['vet@example.com', 'farm@example.com'], format: 'PDF', status: 'paused' },
];

const generatedReports: GeneratedReport[] = [
  { id: 'g1', name: 'NZFAP Compliance Report 2024', type: 'Compliance', generatedAt: '2024-01-15T10:30:00', generatedBy: 'John Smith', format: 'PDF', size: '2.4 MB', status: 'ready' },
  { id: 'g2', name: 'Herd Performance - January 2024', type: 'Production', generatedAt: '2024-01-15T09:15:00', generatedBy: 'System', format: 'PDF', size: '1.8 MB', status: 'ready' },
  { id: 'g3', name: 'NAIT Monthly Report - Dec 2023', type: 'Compliance', generatedAt: '2024-01-01T08:00:00', generatedBy: 'System', format: 'Excel', size: '856 KB', status: 'ready' },
  { id: 'g4', name: 'Treatment Records - Week 2', type: 'Health', generatedAt: '2024-01-14T17:00:00', generatedBy: 'Sarah Johnson', format: 'PDF', size: '420 KB', status: 'ready' },
  { id: 'g5', name: 'Financial Summary Q4 2023', type: 'Financial', generatedAt: '2024-01-10T14:20:00', generatedBy: 'Mike Wilson', format: 'Excel', size: '1.2 MB', status: 'ready' },
];

const reportSections = [
  { id: 'animals', name: 'Animal Records', items: ['Animal Register', 'Movements', 'Deaths & Culls', 'Births', 'Tag Records'] },
  { id: 'health', name: 'Health & Treatments', items: ['Treatment Records', 'Withholding Periods', 'Medicine Inventory', 'Vet Visits', 'Vaccination Records'] },
  { id: 'production', name: 'Production', items: ['Milk Production', 'Weight Records', 'Reproduction', 'Calving Records', 'BCS Records'] },
  { id: 'financial', name: 'Financial', items: ['Revenue Summary', 'Cost Analysis', 'Budget vs Actual', 'Profitability', 'Invoices'] },
  { id: 'compliance', name: 'Compliance', items: ['NZFAP Checklist', 'NAIT Records', 'Freshwater Plan', 'Environment Plan', 'H&S Records'] },
  { id: 'operations', name: 'Operations', items: ['Staff Timesheets', 'Vehicle Records', 'Visitor Log', 'Job Records', 'Maintenance Log'] },
];

export default function ReportsExportPage() {
  const [activeTab, setActiveTab] = useState('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState({ start: format(subMonths(new Date(), 1), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [exportFormat, setExportFormat] = useState('PDF');

  const categories = ['all', ...Array.from(new Set(reportTemplates.map(t => t.category)))];
  const filteredTemplates = reportTemplates.filter(t => {
    const matchCategory = selectedCategory === 'all' || t.category === selectedCategory;
    const matchSearch = !searchTerm || t.name.toLowerCase().includes(searchTerm.toLowerCase()) || t.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getIconComponent = (icon: string) => {
    switch (icon) {
      case 'shield': return <Shield className="h-6 w-6" />;
      case 'droplets': return <Droplets className="h-6 w-6" />;
      case 'leaf': return <Leaf className="h-6 w-6" />;
      case 'beef': return <Beef className="h-6 w-6" />;
      case 'activity': return <Activity className="h-6 w-6" />;
      case 'chart': return <BarChart3 className="h-6 w-6" />;
      case 'health': return <Activity className="h-6 w-6" />;
      case 'users': return <Users className="h-6 w-6" />;
      case 'vehicle': return <Building className="h-6 w-6" />;
      default: return <FileText className="h-6 w-6" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Compliance': return 'bg-purple-100 text-purple-800';
      case 'Production': return 'bg-blue-100 text-blue-800';
      case 'Financial': return 'bg-green-100 text-green-800';
      case 'Health': return 'bg-red-100 text-red-800';
      case 'Operations': return 'bg-orange-100 text-orange-800';
      case 'Biosecurity': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'PDF': return <File className="h-4 w-4 text-red-600" />;
      case 'Excel': return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case 'CSV': return <FileText className="h-4 w-4 text-blue-600" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    
    setIsGenerateOpen(false);
    toast.loading('Generating report...', { id: 'report-gen' });
    
    try {
      // Determine endpoint based on format
      const endpoint = exportFormat === 'Excel' 
        ? '/api/reports/generate-excel' 
        : '/api/reports/generate-pdf';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: selectedTemplate.id,
          dateRange,
          sections: selectedSections,
          farmName: 'Demo Farm',
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate report');
      
      const data = await response.json();
      
      // Create download link from base64 data
      const link = document.createElement('a');
      link.href = exportFormat === 'Excel' ? data.excel : data.pdf;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Report generated successfully', { id: 'report-gen', description: `${exportFormat} download started` });
    } catch (error) {
      toast.error('Failed to generate report', { id: 'report-gen' });
    }
  };

  const handleQuickExport = async (template: any, format: 'PDF' | 'Excel') => {
    toast.loading(`Generating ${format}...`, { id: 'quick-export' });
    
    try {
      const endpoint = format === 'Excel' 
        ? '/api/reports/generate-excel' 
        : '/api/reports/generate-pdf';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: template.id,
          dateRange: {
            start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            end: new Date().toISOString().slice(0, 10),
          },
          farmName: 'Demo Farm',
        }),
      });
      
      if (!response.ok) throw new Error('Failed to generate report');
      
      const data = await response.json();
      
      const link = document.createElement('a');
      link.href = format === 'Excel' ? data.excel : data.pdf;
      link.download = data.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${format} generated successfully`, { id: 'quick-export' });
    } catch (error) {
      toast.error(`Failed to generate ${format}`, { id: 'quick-export' });
    }
  };

  const handleScheduleReport = async () => {
    if (!selectedTemplate) return;
    
    try {
      const response = await fetch('/api/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedTemplate.id,
          frequency: 'monthly',
          recipients: ['farm@example.com'],
          format: exportFormat,
        }),
      });
      
      if (!response.ok) throw new Error('Failed to schedule report');
      
      setIsScheduleOpen(false);
      toast.success('Report scheduled successfully');
    } catch (error) {
      toast.error('Failed to schedule report');
    }
  };

  const toggleSection = (section: string) => {
    setSelectedSections(prev => prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg"><FileText className="h-6 w-6 text-indigo-600" /></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reports & Export</h1>
                <p className="text-sm text-gray-500">Generate compliance reports, export data & schedule deliveries</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={isCustomOpen} onOpenChange={setIsCustomOpen}>
                <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-2" />Custom Report</Button></DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Build Custom Report</DialogTitle></DialogHeader>
                  <div className="space-y-6 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Report Name</Label><Input placeholder="e.g., Q1 Performance Summary" /></div>
                      <div><Label>Export Format</Label><Select value={exportFormat} onValueChange={setExportFormat}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PDF">PDF Document</SelectItem><SelectItem value="Excel">Excel Spreadsheet</SelectItem><SelectItem value="CSV">CSV Data</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Start Date</Label><Input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} /></div>
                      <div><Label>End Date</Label><Input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} /></div>
                    </div>
                    <div>
                      <Label className="mb-3 block">Select Report Sections</Label>
                      <div className="space-y-4">
                        {reportSections.map(section => (
                          <div key={section.id} className="border rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Checkbox id={section.id} checked={selectedSections.some(s => section.items.includes(s))} onCheckedChange={() => {
                                const allSelected = section.items.every(i => selectedSections.includes(i));
                                if (allSelected) setSelectedSections(prev => prev.filter(s => !section.items.includes(s)));
                                else setSelectedSections(prev => [...prev, ...section.items.filter(i => !prev.includes(i))]);
                              }} />
                              <Label htmlFor={section.id} className="font-medium">{section.name}</Label>
                            </div>
                            <div className="grid grid-cols-3 gap-2 ml-6">
                              {section.items.map(item => (
                                <div key={item} className="flex items-center gap-2">
                                  <Checkbox id={item} checked={selectedSections.includes(item)} onCheckedChange={() => toggleSection(item)} />
                                  <Label htmlFor={item} className="text-sm font-normal">{item}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div><Label>Additional Notes</Label><Textarea placeholder="Any specific requirements or filters..." rows={2} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCustomOpen(false)}>Cancel</Button>
                    <Button onClick={() => { setIsCustomOpen(false); toast.success('Custom report generation started'); }}>
                      <Download className="h-4 w-4 mr-2" />Generate Report
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="templates">Report Templates</TabsTrigger>
            <TabsTrigger value="generated">Generated Reports</TabsTrigger>
            <TabsTrigger value="scheduled">Scheduled Reports</TabsTrigger>
            <TabsTrigger value="compliance">Compliance Exports</TabsTrigger>
          </TabsList>

          {/* Report Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search reports..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{categories.map(cat => (<SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</SelectItem>))}</SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-lg ${getCategoryColor(template.category).replace('text-', 'bg-').replace('-800', '-100')}`}>
                        {getIconComponent(template.icon)}
                      </div>
                      <Badge className={getCategoryColor(template.category)}>{template.category}</Badge>
                    </div>
                    <h3 className="font-semibold mb-1">{template.name}</h3>
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">{template.description}</p>
                    <div className="flex items-center gap-2 mb-3">
                      {template.formats.map(fmt => (
                        <div key={fmt} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                          {getFormatIcon(fmt)}<span>{fmt}</span>
                        </div>
                      ))}
                    </div>
                    {template.lastGenerated && (
                      <p className="text-xs text-gray-400 mb-3">Last generated: {format(new Date(template.lastGenerated), 'MMM d, yyyy')}</p>
                    )}
                    <div className="flex gap-2">
                      <Dialog open={isGenerateOpen && selectedTemplate?.id === template.id} onOpenChange={(open) => { setIsGenerateOpen(open); if (open) setSelectedTemplate(template); }}>
                        <DialogTrigger asChild><Button size="sm" className="flex-1"><Download className="h-4 w-4 mr-1" />Generate</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Generate {template.name}</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div><Label>Start Date</Label><Input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} /></div>
                              <div><Label>End Date</Label><Input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} /></div>
                            </div>
                            <div><Label>Export Format</Label><Select defaultValue={template.formats[0]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{template.formats.map(f => (<SelectItem key={f} value={f}>{f}</SelectItem>))}</SelectContent></Select></div>
                            <div>
                              <Label className="mb-2 block">Sections to Include</Label>
                              <div className="space-y-2">
                                {template.sections.map(section => (
                                  <div key={section} className="flex items-center gap-2">
                                    <Checkbox id={`gen-${section}`} defaultChecked />
                                    <Label htmlFor={`gen-${section}`} className="font-normal">{section}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsGenerateOpen(false)}>Cancel</Button>
                            <Button onClick={handleGenerateReport}><Download className="h-4 w-4 mr-2" />Generate</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Dialog open={isScheduleOpen && selectedTemplate?.id === template.id} onOpenChange={(open) => { setIsScheduleOpen(open); if (open) setSelectedTemplate(template); }}>
                        <DialogTrigger asChild><Button size="sm" variant="outline"><Mail className="h-4 w-4" /></Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Schedule {template.name}</DialogTitle></DialogHeader>
                          <div className="space-y-4 py-4">
                            <div><Label>Frequency</Label><Select defaultValue="monthly"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annually">Annually</SelectItem></SelectContent></Select></div>
                            <div><Label>Export Format</Label><Select defaultValue={template.formats[0]}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{template.formats.map(f => (<SelectItem key={f} value={f}>{f}</SelectItem>))}</SelectContent></Select></div>
                            <div><Label>Recipients (comma separated)</Label><Input placeholder="email1@example.com, email2@example.com" /></div>
                            <div className="flex items-center gap-2"><Switch id="include-summary" defaultChecked /><Label htmlFor="include-summary">Include summary in email body</Label></div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                            <Button onClick={handleScheduleReport}><Calendar className="h-4 w-4 mr-2" />Schedule</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Generated Reports Tab */}
          <TabsContent value="generated" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Recent Reports</CardTitle>
                  <Button variant="outline" size="sm"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Report Name</th>
                      <th className="text-left p-4 text-sm font-medium">Type</th>
                      <th className="text-left p-4 text-sm font-medium">Generated</th>
                      <th className="text-left p-4 text-sm font-medium">By</th>
                      <th className="text-center p-4 text-sm font-medium">Format</th>
                      <th className="text-center p-4 text-sm font-medium">Size</th>
                      <th className="text-center p-4 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {generatedReports.map(report => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="p-4"><p className="font-medium">{report.name}</p></td>
                        <td className="p-4"><Badge className={getCategoryColor(report.type)}>{report.type}</Badge></td>
                        <td className="p-4 text-sm text-gray-600">{format(new Date(report.generatedAt), 'MMM d, yyyy h:mm a')}</td>
                        <td className="p-4 text-sm">{report.generatedBy}</td>
                        <td className="p-4 text-center"><div className="flex items-center justify-center gap-1">{getFormatIcon(report.format)}<span className="text-sm">{report.format}</span></div></td>
                        <td className="p-4 text-center text-sm">{report.size}</td>
                        <td className="p-4">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="sm" onClick={() => toast.success('Downloading...')}><Download className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm"><Mail className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm"><Printer className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scheduled Reports Tab */}
          <TabsContent value="scheduled" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Scheduled Report Deliveries</h2>
              <Button><Plus className="h-4 w-4 mr-2" />New Schedule</Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {scheduledReports.map(schedule => (
                <Card key={schedule.id} className={schedule.status === 'paused' ? 'opacity-60' : ''}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">{schedule.reportName}</h3>
                        <p className="text-sm text-gray-500 capitalize">{schedule.frequency} • {schedule.format}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={schedule.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {schedule.status === 'active' ? <Play className="h-3 w-3 mr-1" /> : <Pause className="h-3 w-3 mr-1" />}
                          {schedule.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2 text-sm mb-4">
                      <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-gray-400" /><span>Next run: {format(new Date(schedule.nextRun), 'MMM d, yyyy')}</span></div>
                      <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" /><span>{schedule.recipients.length} recipient(s)</span></div>
                      {schedule.lastSent && <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span>Last sent: {format(new Date(schedule.lastSent), 'MMM d, yyyy')}</span></div>}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1"><Edit className="h-4 w-4 mr-1" />Edit</Button>
                      <Button variant="outline" size="sm"><Send className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm">{schedule.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Compliance Exports Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* NZFAP Export */}
              <Card className="border-purple-200">
                <CardHeader className="bg-purple-50">
                  <div className="flex items-center gap-3">
                    <Shield className="h-8 w-8 text-purple-600" />
                    <div>
                      <CardTitle>NZFAP Audit Pack</CardTitle>
                      <CardDescription>Complete audit documentation package</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3 mb-4">
                    {['Animal Welfare Records', 'Biosecurity Protocols', 'Food Safety Documentation', 'Environmental Compliance', 'Staff Training Records'].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm">{item}</span></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-purple-600 hover:bg-purple-700"><Download className="h-4 w-4 mr-2" />Download Pack</Button>
                    <Button variant="outline"><Mail className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* FWFP Export */}
              <Card className="border-blue-200">
                <CardHeader className="bg-blue-50">
                  <div className="flex items-center gap-3">
                    <Droplets className="h-8 w-8 text-blue-600" />
                    <div>
                      <CardTitle>Freshwater Farm Plan</CardTitle>
                      <CardDescription>Regional council submission package</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3 mb-4">
                    {['Risk Assessment Register', '5-Year Action Plan', 'Monitoring Records', 'Certification Documents', 'Audit History'].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm">{item}</span></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700"><Download className="h-4 w-4 mr-2" />Download Pack</Button>
                    <Button variant="outline"><Mail className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* FEP Export */}
              <Card className="border-green-200">
                <CardHeader className="bg-green-50">
                  <div className="flex items-center gap-3">
                    <Leaf className="h-8 w-8 text-green-600" />
                    <div>
                      <CardTitle>Farm Environment Plan</CardTitle>
                      <CardDescription>Environmental compliance documentation</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3 mb-4">
                    {['Water Quality Tests', 'Nutrient Budget (N/P/K)', 'Effluent Records', 'Riparian Planting Log', 'Carbon Footprint Report'].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm">{item}</span></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700"><Download className="h-4 w-4 mr-2" />Download Pack</Button>
                    <Button variant="outline"><Mail className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>

              {/* NAIT Export */}
              <Card className="border-orange-200">
                <CardHeader className="bg-orange-50">
                  <div className="flex items-center gap-3">
                    <Beef className="h-8 w-8 text-orange-600" />
                    <div>
                      <CardTitle>NAIT Data Export</CardTitle>
                      <CardDescription>Animal traceability records</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  <div className="space-y-3 mb-4">
                    {['Animal Register (CSV)', 'Movement Records', 'Death Notifications', 'Tag Replacements', 'Location History'].map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-sm">{item}</span></div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-orange-600 hover:bg-orange-700"><Download className="h-4 w-4 mr-2" />Download Pack</Button>
                    <Button variant="outline"><ExternalLink className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Data Exports */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Quick Data Exports</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { name: 'Animal Register', format: 'CSV', icon: Beef },
                    { name: 'Treatment Records', format: 'Excel', icon: Activity },
                    { name: 'Milk Production', format: 'Excel', icon: BarChart3 },
                    { name: 'Financial Summary', format: 'Excel', icon: PieChart },
                    { name: 'Staff Hours', format: 'CSV', icon: Users },
                    { name: 'Vehicle Log', format: 'PDF', icon: Building },
                    { name: 'Visitor Records', format: 'CSV', icon: Users },
                    { name: 'Pasture Data', format: 'Excel', icon: Leaf },
                  ].map((exp, idx) => (
                    <Button key={idx} variant="outline" className="h-auto py-3 flex-col" onClick={() => toast.success(`Exporting ${exp.name}...`)}>
                      <exp.icon className="h-5 w-5 mb-1" />
                      <span className="text-sm">{exp.name}</span>
                      <span className="text-xs text-gray-400">{exp.format}</span>
                    </Button>
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
