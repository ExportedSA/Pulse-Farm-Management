import { useEffect, useState } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Filter, BarChart3, Calendar, Syringe, AlertTriangle, TrendingUp, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

type PrebuiltReport = {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: string;
};

const PREBUILT_REPORTS: PrebuiltReport[] = [
  { id: 'rvm', name: 'RVM Treatment Log', description: 'Regulatory veterinary medicine treatment records', icon: FileText, category: 'compliance' },
  { id: 'withholds', name: 'Active Withholds', description: 'Animals currently under milk/meat withhold periods', icon: AlertTriangle, category: 'compliance' },
  { id: 'treatment-summary', name: 'Treatment Summary', description: 'Medicine usage statistics and animal counts', icon: BarChart3, category: 'analytics' },
  { id: 'medicine-usage', name: 'Medicine Usage Trends', description: 'Monthly medicine usage patterns', icon: TrendingUp, category: 'analytics' },
  { id: 'animal-history', name: 'Animal Health History', description: 'Complete treatment history for specific animal', icon: Syringe, category: 'individual' },
];

// A date as the phone sees it (UTC is still yesterday in NZ mornings)
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function HealthReports(){
  const [activeTab, setActiveTab] = useState('prebuilt');
  const [selectedReport, setSelectedReport] = useState<string>('rvm');
  
  const [from, setFrom] = useState(()=> localDay(new Date(Date.now()-30*86400000)));
  const [to, setTo] = useState(()=> localDay());
  const [whDate, setWhDate] = useState(()=> localDay());
  const [animalId, setAnimalId] = useState('');
  
  const [rvm, setRvm] = useState<any[]>([]);
  const [wh, setWh] = useState<any[]>([]);
  const [treatmentSummary, setTreatmentSummary] = useState<any[]>([]);
  const [medicineUsage, setMedicineUsage] = useState<any[]>([]);
  const [animalHistory, setAnimalHistory] = useState<any[]>([]);
  
  const [customFrom, setCustomFrom] = useState(()=> localDay(new Date(Date.now()-30*86400000)));
  const [customTo, setCustomTo] = useState(()=> localDay());
  const [customMedicines, setCustomMedicines] = useState<string[]>([]);
  // Typed as text (commas and all); split into lists when the report runs
  const [customAnimalsText, setCustomAnimalsText] = useState('');
  const [customRoutesText, setCustomRoutesText] = useState('');
  const [customResults, setCustomResults] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  
  useEffect(()=> {
    fetch('/api/health-reports/medicines').then(r=> r.json()).then(d=> setMedicines(d.rows||[]));
  }, []);
  
  async function loadRVM(){ 
    const r = await fetch(`/api/health-reports/rvm?from=${from}&to=${to}`).then(r=> r.json()); 
    setRvm(r.rows||[]); 
  }
  
  async function loadWH(){ 
    const r = await fetch(`/api/health-reports/withholds?date=${whDate}`).then(r=> r.json()); 
    setWh(r.rows||[]); 
  }
  
  async function loadTreatmentSummary(){
    const r = await fetch(`/api/health-reports/treatment-summary?from=${from}&to=${to}`).then(r=> r.json());
    setTreatmentSummary(r.rows||[]);
  }
  
  async function loadMedicineUsage(){
    const r = await fetch(`/api/health-reports/medicine-usage?from=${from}&to=${to}`).then(r=> r.json());
    setMedicineUsage(r.rows||[]);
  }
  
  async function loadAnimalHistory(){
    if (!animalId) {
      toast.error("Enter the animal's tag");
      return;
    }
    const r = await fetch(`/api/health-reports/animal-health-history?animalId=${animalId}`).then(r=> r.json());
    setAnimalHistory(r.rows||[]);
  }
  
  const splitList = (text: string) => text.split(',').map(v => v.trim()).filter(Boolean);

  async function runCustomReport(){
    const customAnimals = splitList(customAnimalsText);
    const customRoutes = splitList(customRoutesText);
    const body = {
      from: customFrom,
      to: customTo,
      medicines: customMedicines.length > 0 ? customMedicines : undefined,
      animals: customAnimals.length > 0 ? customAnimals : undefined,
      routes: customRoutes.length > 0 ? customRoutes : undefined,
    };
    const r = await fetch('/api/health-reports/custom', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    }).then(r=> r.json());
    setCustomResults(r.rows||[]);
    toast.success(`Found ${r.rows?.length || 0} records`);
  }
  
  function exportToCSV(data: any[], filename: string) {
    if (!data.length) {
      toast.error('No data to export');
      return;
    }
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${localDay()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported successfully');
  }
  
  useEffect(()=>{ if (selectedReport === 'rvm') loadRVM(); }, [from, to, selectedReport]);
  useEffect(()=>{ if (selectedReport === 'withholds') loadWH(); }, [whDate, selectedReport]);
  useEffect(()=>{ if (selectedReport === 'treatment-summary') loadTreatmentSummary(); }, [from, to, selectedReport]);
  useEffect(()=>{ if (selectedReport === 'medicine-usage') loadMedicineUsage(); }, [from, to, selectedReport]);
  
  return (<PageShell title="Health · Reports">
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-4">
        <TabsTrigger value="prebuilt">Prebuilt Reports</TabsTrigger>
        <TabsTrigger value="custom">Custom Report Builder</TabsTrigger>
      </TabsList>
      
      <TabsContent value="prebuilt" className="space-y-4">
        <div className="grid md:grid-cols-3 gap-3">
          {PREBUILT_REPORTS.map(report => {
            const Icon = report.icon;
            return (
              <Card 
                key={report.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${selectedReport === report.id ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setSelectedReport(report.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Icon className="h-5 w-5 text-primary" />
                    <Badge variant="outline" className="text-xs">{report.category}</Badge>
                  </div>
                  <CardTitle className="text-base mt-2">{report.name}</CardTitle>
                  <CardDescription className="text-xs">{report.description}</CardDescription>
                </CardHeader>
              </Card>
            );
          })}
        </div>
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{PREBUILT_REPORTS.find(r => r.id === selectedReport)?.name}</CardTitle>
                <CardDescription>{PREBUILT_REPORTS.find(r => r.id === selectedReport)?.description}</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  if (selectedReport === 'rvm') exportToCSV(rvm, 'rvm_log');
                  else if (selectedReport === 'withholds') exportToCSV(wh, 'active_withholds');
                  else if (selectedReport === 'treatment-summary') exportToCSV(treatmentSummary, 'treatment_summary');
                  else if (selectedReport === 'medicine-usage') exportToCSV(medicineUsage, 'medicine_usage');
                  else if (selectedReport === 'animal-history') exportToCSV(animalHistory, 'animal_history');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {selectedReport === 'rvm' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label>From Date</Label>
                    <Input type="date" value={from} onChange={e=> setFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <Input type="date" value={to} onChange={e=> setTo(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadRVM} className="w-full">Generate Report</Button>
                  </div>
                </div>
                <div className="overflow-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">When</th>
                        <th className="py-2 px-3 text-left font-medium">Animal</th>
                        <th className="py-2 px-3 text-left font-medium">Medicine</th>
                        <th className="py-2 px-3 text-left font-medium">Dose</th>
                        <th className="py-2 px-3 text-left font-medium">Type</th>
                        <th className="py-2 px-3 text-left font-medium">Site</th>
                        <th className="py-2 px-3 text-left font-medium">Given by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rvm.map((r:any,i:number)=> (
                        <tr key={i} className="border-t hover:bg-muted/50">
                          <td className="py-2 px-3">{new Date(r.ts).toLocaleString()}</td>
                          <td className="py-2 px-3">{r.animal_id}</td>
                          <td className="py-2 px-3">{r.medicine}</td>
                          <td className="py-2 px-3">{r.dose||'—'}</td>
                          <td className="py-2 px-3">{r.route||'—'}</td>
                          <td className="py-2 px-3">{r.site||'—'}</td>
                          <td className="py-2 px-3">{r.approver||'—'} {r.approval_ref? `(${r.approval_ref})`: ''}</td>
                        </tr>
                      ))}
                      {!rvm.length && <tr><td className="py-3 text-center text-muted-foreground" colSpan={7}>No entries found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {selectedReport === 'withholds' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label>As of Date</Label>
                    <Input type="date" value={whDate} onChange={e=> setWhDate(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadWH} className="w-full">Generate Report</Button>
                  </div>
                </div>
                <div className="overflow-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">Animal</th>
                        <th className="py-2 px-3 text-left font-medium">Milk Withhold Until</th>
                        <th className="py-2 px-3 text-left font-medium">Meat Withhold Until</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wh.map((r:any,i:number)=> (
                        <tr key={i} className="border-t hover:bg-muted/50">
                          <td className="py-2 px-3">{r.animal_id}</td>
                          <td className="py-2 px-3">{r.milk_until? new Date(r.milk_until).toLocaleString(): '—'}</td>
                          <td className="py-2 px-3">{r.meat_until|| '—'}</td>
                        </tr>
                      ))}
                      {!wh.length && <tr><td className="py-3 text-center text-muted-foreground" colSpan={3}>No active withholds</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {selectedReport === 'treatment-summary' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label>From Date</Label>
                    <Input type="date" value={from} onChange={e=> setFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <Input type="date" value={to} onChange={e=> setTo(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadTreatmentSummary} className="w-full">Generate Report</Button>
                  </div>
                </div>
                <div className="overflow-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">Medicine</th>
                        <th className="py-2 px-3 text-left font-medium">Total Treatments</th>
                        <th className="py-2 px-3 text-left font-medium">With Dose</th>
                        <th className="py-2 px-3 text-left font-medium">Unique Animals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {treatmentSummary.map((r:any,i:number)=> (
                        <tr key={i} className="border-t hover:bg-muted/50">
                          <td className="py-2 px-3 font-medium">{r.medicine}</td>
                          <td className="py-2 px-3">{r.treatment_count}</td>
                          <td className="py-2 px-3">{r.with_dose}</td>
                          <td className="py-2 px-3">{r.unique_animals}</td>
                        </tr>
                      ))}
                      {!treatmentSummary.length && <tr><td className="py-3 text-center text-muted-foreground" colSpan={4}>No data found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {selectedReport === 'medicine-usage' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label>From Date</Label>
                    <Input type="date" value={from} onChange={e=> setFrom(e.target.value)} />
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <Input type="date" value={to} onChange={e=> setTo(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadMedicineUsage} className="w-full">Generate Report</Button>
                  </div>
                </div>
                <div className="overflow-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">Month</th>
                        <th className="py-2 px-3 text-left font-medium">Medicine</th>
                        <th className="py-2 px-3 text-left font-medium">Usage Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {medicineUsage.map((r:any,i:number)=> (
                        <tr key={i} className="border-t hover:bg-muted/50">
                          <td className="py-2 px-3">{new Date(r.month).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long' })}</td>
                          <td className="py-2 px-3">{r.medicine}</td>
                          <td className="py-2 px-3">{r.usage_count}</td>
                        </tr>
                      ))}
                      {!medicineUsage.length && <tr><td className="py-3 text-center text-muted-foreground" colSpan={3}>No data found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {selectedReport === 'animal-history' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-3 gap-2">
                  <div>
                    <Label>Animal tag</Label>
                    <Input placeholder="Animal tag, e.g. VID1001" value={animalId} onChange={e=> setAnimalId(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={loadAnimalHistory} className="w-full">Generate Report</Button>
                  </div>
                </div>
                <div className="overflow-auto border rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="py-2 px-3 text-left font-medium">Date</th>
                        <th className="py-2 px-3 text-left font-medium">Medicine</th>
                        <th className="py-2 px-3 text-left font-medium">Dose</th>
                        <th className="py-2 px-3 text-left font-medium">Type</th>
                        <th className="py-2 px-3 text-left font-medium">Site</th>
                        <th className="py-2 px-3 text-left font-medium">Milk Withhold</th>
                        <th className="py-2 px-3 text-left font-medium">Meat Withhold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {animalHistory.map((r:any,i:number)=> (
                        <tr key={i} className="border-t hover:bg-muted/50">
                          <td className="py-2 px-3">{new Date(r.ts).toLocaleDateString()}</td>
                          <td className="py-2 px-3">{r.medicine}</td>
                          <td className="py-2 px-3">{r.dose||'—'}</td>
                          <td className="py-2 px-3">{r.route||'—'}</td>
                          <td className="py-2 px-3">{r.site||'—'}</td>
                          <td className="py-2 px-3">{r.withhold_until_milk ? new Date(r.withhold_until_milk).toLocaleDateString() : '—'}</td>
                          <td className="py-2 px-3">{r.withhold_until_meat||'—'}</td>
                        </tr>
                      ))}
                      {!animalHistory.length && <tr><td className="py-3 text-center text-muted-foreground" colSpan={7}>No treatment history found</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="custom" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Custom Report Builder
            </CardTitle>
            <CardDescription>Build your own custom report with specific filters and criteria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>From Date</Label>
                <Input type="date" value={customFrom} onChange={e=> setCustomFrom(e.target.value)} />
              </div>
              <div>
                <Label>To Date</Label>
                <Input type="date" value={customTo} onChange={e=> setCustomTo(e.target.value)} />
              </div>
            </div>
            
            <div>
              <Label>Filter by Medicine (Optional)</Label>
              <Select onValueChange={(val) => {
                if (val && !customMedicines.includes(val)) {
                  setCustomMedicines([...customMedicines, val]);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select medicines to filter" />
                </SelectTrigger>
                <SelectContent>
                  {medicines.map(m => (
                    <SelectItem key={m.id} value={m.id.toString()}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customMedicines.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {customMedicines.map(id => {
                    const med = medicines.find(m => m.id.toString() === id);
                    return (
                      <Badge key={id} variant="secondary" className="cursor-pointer" onClick={() => setCustomMedicines(customMedicines.filter(m => m !== id))}>
                        {med?.name} ×
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div>
              <Label>Filter by animal tags (optional)</Label>
              <Input 
                placeholder="Tags separated by commas, e.g. VID1001, VID1002" 
                value={customAnimalsText}
                onChange={e=> setCustomAnimalsText(e.target.value)}
              />
            </div>
            
            <div>
              <Label>Filter by treatment type (optional)</Label>
              <Input 
                placeholder="Treatment types separated by commas" 
                value={customRoutesText}
                onChange={e=> setCustomRoutesText(e.target.value)}
              />
            </div>
            
            <div className="flex gap-2">
              <Button onClick={runCustomReport} className="flex-1">
                <BarChart3 className="h-4 w-4 mr-2" />
                Generate Custom Report
              </Button>
              <Button variant="outline" onClick={() => exportToCSV(customResults, 'custom_report')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {customResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Results ({customResults.length} records)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="py-2 px-3 text-left font-medium">Date</th>
                      <th className="py-2 px-3 text-left font-medium">Animal</th>
                      <th className="py-2 px-3 text-left font-medium">NAIT tag</th>
                      <th className="py-2 px-3 text-left font-medium">Medicine</th>
                      <th className="py-2 px-3 text-left font-medium">Dose</th>
                      <th className="py-2 px-3 text-left font-medium">Type</th>
                      <th className="py-2 px-3 text-left font-medium">Site</th>
                      <th className="py-2 px-3 text-left font-medium">Milk Withhold</th>
                      <th className="py-2 px-3 text-left font-medium">Meat Withhold</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customResults.map((r:any,i:number)=> (
                      <tr key={i} className="border-t hover:bg-muted/50">
                        <td className="py-2 px-3">{new Date(r.ts).toLocaleDateString()}</td>
                        <td className="py-2 px-3">{r.animal_id}</td>
                        <td className="py-2 px-3">{r.tag_number||'—'}</td>
                        <td className="py-2 px-3">{r.medicine}</td>
                        <td className="py-2 px-3">{r.dose||'—'}</td>
                        <td className="py-2 px-3">{r.route||'—'}</td>
                        <td className="py-2 px-3">{r.site||'—'}</td>
                        <td className="py-2 px-3">{r.withhold_until_milk ? new Date(r.withhold_until_milk).toLocaleDateString() : '—'}</td>
                        <td className="py-2 px-3">{r.withhold_until_meat||'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  </PageShell>);
}
