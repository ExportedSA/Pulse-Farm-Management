import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { format, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Droplets, Leaf, TreePine, Factory, Gauge, AlertTriangle, CheckCircle2,
  Plus, Download, Calendar, MapPin, TrendingUp, TrendingDown, Target,
  Thermometer, Wind, CloudRain, Sun, BarChart3, PieChart, Activity,
  FileText, Eye, Edit, RefreshCw, Info, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

// Interfaces
interface WaterTest {
  id: string;
  site: string;
  date: string;
  ph: number;
  nitrate: number;
  phosphorus: number;
  ecoli: number;
  turbidity: number;
  dissolvedOxygen: number;
  temperature: number;
  status: 'compliant' | 'warning' | 'non-compliant';
  testedBy: string;
}

interface NutrientBudget {
  id: string;
  year: string;
  nitrogen: { applied: number; removed: number; balance: number; limit: number };
  phosphorus: { applied: number; removed: number; balance: number; limit: number };
  potassium: { applied: number; removed: number; balance: number; limit: number };
  status: 'within-limits' | 'approaching' | 'exceeded';
}

interface EffluentPond {
  id: string;
  name: string;
  capacity: number;
  currentLevel: number;
  lastEmptied: string;
  nextScheduled: string;
  status: 'normal' | 'warning' | 'critical';
  alerts: string[];
}

interface RiparianPlanting {
  id: string;
  zone: string;
  location: string;
  totalLength: number;
  plantedLength: number;
  plantedDate?: string;
  species: string[];
  survivalRate?: number;
  status: 'planned' | 'in-progress' | 'completed' | 'maintenance';
  nextAction?: string;
}

interface CarbonData {
  category: string;
  emissions: number;
  unit: string;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  reduction?: number;
}

// Mock Data
const mockWaterTests: WaterTest[] = [
  { id: 'w1', site: 'Stream - North Boundary', date: '2024-01-15', ph: 7.2, nitrate: 3.2, phosphorus: 0.025, ecoli: 180, turbidity: 4.5, dissolvedOxygen: 9.2, temperature: 14.5, status: 'compliant', testedBy: 'EnviroLab NZ' },
  { id: 'w2', site: 'Stream - South Crossing', date: '2024-01-15', ph: 7.0, nitrate: 5.8, phosphorus: 0.042, ecoli: 420, turbidity: 8.2, dissolvedOxygen: 8.1, temperature: 15.2, status: 'warning', testedBy: 'EnviroLab NZ' },
  { id: 'w3', site: 'Pond Outlet', date: '2024-01-10', ph: 6.8, nitrate: 2.1, phosphorus: 0.018, ecoli: 95, turbidity: 3.2, dissolvedOxygen: 10.1, temperature: 13.8, status: 'compliant', testedBy: 'Farm Manager' },
  { id: 'w4', site: 'Groundwater Bore #1', date: '2024-01-08', ph: 7.4, nitrate: 8.5, phosphorus: 0.008, ecoli: 0, turbidity: 0.5, dissolvedOxygen: 6.5, temperature: 12.0, status: 'warning', testedBy: 'EnviroLab NZ' },
  { id: 'w5', site: 'Stream - East Paddock', date: '2024-01-05', ph: 6.5, nitrate: 12.2, phosphorus: 0.065, ecoli: 850, turbidity: 15.5, dissolvedOxygen: 6.8, temperature: 16.5, status: 'non-compliant', testedBy: 'Regional Council' },
];

const mockNutrientBudget: NutrientBudget = {
  id: 'nb1', year: '2023-24',
  nitrogen: { applied: 185, removed: 142, balance: 43, limit: 50 },
  phosphorus: { applied: 28, removed: 22, balance: 6, limit: 8 },
  potassium: { applied: 45, removed: 38, balance: 7, limit: 15 },
  status: 'approaching'
};

const mockEffluentPonds: EffluentPond[] = [
  { id: 'p1', name: 'Main Dairy Pond', capacity: 2500, currentLevel: 1850, lastEmptied: '2024-01-05', nextScheduled: '2024-01-25', status: 'warning', alerts: ['74% capacity - schedule irrigation'] },
  { id: 'p2', name: 'Secondary Storage', capacity: 1500, currentLevel: 680, lastEmptied: '2024-01-12', nextScheduled: '2024-02-15', status: 'normal', alerts: [] },
  { id: 'p3', name: 'Calf Shed Sump', capacity: 200, currentLevel: 45, lastEmptied: '2024-01-14', nextScheduled: '2024-01-28', status: 'normal', alerts: [] },
];

const mockRiparianPlanting: RiparianPlanting[] = [
  { id: 'r1', zone: 'Zone A - North Stream', location: 'Paddocks 1-5 boundary', totalLength: 850, plantedLength: 850, plantedDate: '2022-06-15', species: ['Flax', 'Cabbage Tree', 'Manuka', 'Karamu'], survivalRate: 92, status: 'maintenance', nextAction: 'Weed control - Feb 2024' },
  { id: 'r2', zone: 'Zone B - South Stream', location: 'Paddocks 12-15 boundary', totalLength: 620, plantedLength: 420, plantedDate: '2023-05-20', species: ['Flax', 'Toetoe', 'Kahikatea'], survivalRate: 85, status: 'in-progress', nextAction: 'Complete planting - May 2024' },
  { id: 'r3', zone: 'Zone C - Wetland Edge', location: 'Home paddock wetland', totalLength: 380, plantedLength: 380, plantedDate: '2021-08-10', species: ['Raupo', 'Flax', 'Carex'], survivalRate: 95, status: 'completed', nextAction: 'Annual inspection - Aug 2024' },
  { id: 'r4', zone: 'Zone D - East Gully', location: 'East block erosion area', totalLength: 450, plantedLength: 0, species: ['Native mix TBD'], status: 'planned', nextAction: 'Site preparation - Apr 2024' },
];

const mockCarbonData: CarbonData[] = [
  { category: 'Enteric Fermentation', emissions: 1850, unit: 't CO2e', percentage: 48, trend: 'down', reduction: 5 },
  { category: 'Fertiliser (N2O)', emissions: 680, unit: 't CO2e', percentage: 18, trend: 'down', reduction: 12 },
  { category: 'Fuel & Energy', emissions: 420, unit: 't CO2e', percentage: 11, trend: 'down', reduction: 8 },
  { category: 'Effluent Management', emissions: 380, unit: 't CO2e', percentage: 10, trend: 'stable' },
  { category: 'Imported Feed', emissions: 290, unit: 't CO2e', percentage: 8, trend: 'up', reduction: -15 },
  { category: 'Other', emissions: 220, unit: 't CO2e', percentage: 5, trend: 'stable' },
];

const waterLimits = { ph: { min: 6.5, max: 8.5 }, nitrate: 11.3, phosphorus: 0.05, ecoli: 540, turbidity: 10, dissolvedOxygen: 8 };

export default function EnvironmentalCompliancePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isAddTestOpen, setIsAddTestOpen] = useState(false);
  const [selectedSite, setSelectedSite] = useState('all');

  // Calculate stats
  const totalTests = mockWaterTests.length;
  const compliantTests = mockWaterTests.filter(t => t.status === 'compliant').length;
  const complianceRate = Math.round((compliantTests / totalTests) * 100);
  const totalRiparian = mockRiparianPlanting.reduce((s, r) => s + r.totalLength, 0);
  const plantedRiparian = mockRiparianPlanting.reduce((s, r) => s + r.plantedLength, 0);
  const riparianProgress = Math.round((plantedRiparian / totalRiparian) * 100);
  const totalEmissions = mockCarbonData.reduce((s, c) => s + c.emissions, 0);
  const avgPondLevel = Math.round(mockEffluentPonds.reduce((s, p) => s + (p.currentLevel / p.capacity) * 100, 0) / mockEffluentPonds.length);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': case 'normal': case 'completed': case 'within-limits': return 'bg-green-100 text-green-800';
      case 'warning': case 'in-progress': case 'approaching': case 'maintenance': return 'bg-yellow-100 text-yellow-800';
      case 'non-compliant': case 'critical': case 'exceeded': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getValueStatus = (value: number, limit: number, isMax: boolean = true) => {
    const ratio = value / limit;
    if (isMax) {
      if (ratio >= 1) return 'text-red-600';
      if (ratio >= 0.8) return 'text-yellow-600';
      return 'text-green-600';
    }
    if (ratio <= 1) return 'text-red-600';
    return 'text-green-600';
  };

  const getPondColor = (level: number, capacity: number) => {
    const pct = (level / capacity) * 100;
    if (pct >= 85) return 'bg-red-500';
    if (pct >= 70) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><Leaf className="h-6 w-6" /></div>
              <div>
                <h1 className="text-2xl font-bold">Environmental Compliance</h1>
                <p className="text-sm text-green-100">Water quality, nutrients, effluent & carbon tracking</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0"><Download className="h-4 w-4 mr-2" />Export Report</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="water">Water Quality</TabsTrigger>
            <TabsTrigger value="nutrients">Nutrient Budget</TabsTrigger>
            <TabsTrigger value="effluent">Effluent Management</TabsTrigger>
            <TabsTrigger value="riparian">Riparian Planting</TabsTrigger>
            <TabsTrigger value="carbon">Carbon Footprint</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Water Compliance</p><p className="text-2xl font-bold text-green-600">{complianceRate}%</p></div><Droplets className="h-8 w-8 text-blue-200" /></div><p className="text-xs text-gray-500 mt-1">{compliantTests}/{totalTests} tests compliant</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">N Balance</p><p className={`text-2xl font-bold ${mockNutrientBudget.nitrogen.balance > mockNutrientBudget.nitrogen.limit * 0.9 ? 'text-yellow-600' : 'text-green-600'}`}>{mockNutrientBudget.nitrogen.balance} kg/ha</p></div><Leaf className="h-8 w-8 text-green-200" /></div><p className="text-xs text-gray-500 mt-1">Limit: {mockNutrientBudget.nitrogen.limit} kg/ha</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Effluent Storage</p><p className={`text-2xl font-bold ${avgPondLevel > 70 ? 'text-yellow-600' : 'text-green-600'}`}>{avgPondLevel}%</p></div><Factory className="h-8 w-8 text-gray-200" /></div><p className="text-xs text-gray-500 mt-1">Average pond level</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Carbon Footprint</p><p className="text-2xl font-bold">{(totalEmissions / 1000).toFixed(1)}k</p></div><Wind className="h-8 w-8 text-gray-200" /></div><p className="text-xs text-green-600 mt-1">↓ 6% vs last year</p></CardContent></Card>
            </div>

            {/* Alerts */}
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-orange-800"><AlertTriangle className="h-5 w-5" />Active Alerts</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {mockWaterTests.filter(t => t.status !== 'compliant').map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                      <div className="flex items-center gap-3"><Droplets className="h-4 w-4 text-orange-600" /><div><p className="font-medium text-sm">{t.site}</p><p className="text-xs text-gray-500">Tested: {format(new Date(t.date), 'MMM d, yyyy')}</p></div></div>
                      <Badge className={getStatusColor(t.status)}>{t.status}</Badge>
                    </div>
                  ))}
                  {mockEffluentPonds.filter(p => p.status !== 'normal').map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                      <div className="flex items-center gap-3"><Factory className="h-4 w-4 text-orange-600" /><div><p className="font-medium text-sm">{p.name}</p><p className="text-xs text-gray-500">{p.alerts[0]}</p></div></div>
                      <Badge className={getStatusColor(p.status)}>{Math.round((p.currentLevel / p.capacity) * 100)}% full</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Riparian Progress</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div><p className="text-3xl font-bold text-green-600">{plantedRiparian}m</p><p className="text-sm text-gray-500">of {totalRiparian}m planted</p></div>
                    <div className="text-right"><p className="text-2xl font-bold">{riparianProgress}%</p><p className="text-sm text-gray-500">complete</p></div>
                  </div>
                  <Progress value={riparianProgress} className="h-3 mb-4" />
                  <div className="space-y-2">
                    {mockRiparianPlanting.slice(0, 3).map(r => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span>{r.zone}</span>
                        <Badge className={getStatusColor(r.status)}>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Carbon Breakdown</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockCarbonData.slice(0, 4).map(c => (
                      <div key={c.category}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>{c.category}</span>
                          <span className="font-medium">{c.emissions} {c.unit}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={c.percentage} className="h-2 flex-1" />
                          <span className="text-xs text-gray-500 w-10">{c.percentage}%</span>
                          {c.trend === 'down' && <ArrowDownRight className="h-4 w-4 text-green-600" />}
                          {c.trend === 'up' && <ArrowUpRight className="h-4 w-4 text-red-600" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Water Quality Tab */}
          <TabsContent value="water" className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex gap-3">
                <Select value={selectedSite} onValueChange={setSelectedSite}>
                  <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by site" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sites</SelectItem>
                    {Array.from(new Set(mockWaterTests.map(t => t.site))).map(site => (<SelectItem key={site} value={site}>{site}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <Dialog open={isAddTestOpen} onOpenChange={setIsAddTestOpen}>
                <DialogTrigger asChild><Button className="bg-blue-600 hover:bg-blue-700"><Plus className="h-4 w-4 mr-2" />Record Test</Button></DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Record Water Quality Test</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <div><Label>Site</Label><Select><SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger><SelectContent><SelectItem value="stream-north">Stream - North Boundary</SelectItem><SelectItem value="stream-south">Stream - South Crossing</SelectItem><SelectItem value="pond">Pond Outlet</SelectItem><SelectItem value="bore">Groundwater Bore #1</SelectItem></SelectContent></Select></div>
                    <div><Label>Date</Label><Input type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} /></div>
                    <div><Label>pH</Label><Input type="number" step="0.1" placeholder="6.5 - 8.5" /></div>
                    <div><Label>Nitrate (mg/L)</Label><Input type="number" step="0.1" placeholder="< 11.3" /></div>
                    <div><Label>Phosphorus (mg/L)</Label><Input type="number" step="0.001" placeholder="< 0.05" /></div>
                    <div><Label>E. coli (MPN/100ml)</Label><Input type="number" placeholder="< 540" /></div>
                    <div><Label>Turbidity (NTU)</Label><Input type="number" step="0.1" placeholder="< 10" /></div>
                    <div><Label>Dissolved Oxygen (mg/L)</Label><Input type="number" step="0.1" placeholder="> 8" /></div>
                    <div><Label>Temperature (°C)</Label><Input type="number" step="0.1" /></div>
                    <div><Label>Tested By</Label><Input placeholder="Lab or person name" /></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsAddTestOpen(false)}>Cancel</Button><Button onClick={() => { setIsAddTestOpen(false); toast.success('Test recorded'); }}>Save</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {/* Limits Reference */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2"><Info className="h-4 w-4 text-blue-600" /><span className="font-medium text-blue-800">Compliance Limits</span></div>
                <div className="grid grid-cols-6 gap-4 text-sm">
                  <div><span className="text-gray-500">pH:</span> <span className="font-medium">{waterLimits.ph.min}-{waterLimits.ph.max}</span></div>
                  <div><span className="text-gray-500">Nitrate:</span> <span className="font-medium">&lt;{waterLimits.nitrate} mg/L</span></div>
                  <div><span className="text-gray-500">Phosphorus:</span> <span className="font-medium">&lt;{waterLimits.phosphorus} mg/L</span></div>
                  <div><span className="text-gray-500">E. coli:</span> <span className="font-medium">&lt;{waterLimits.ecoli} MPN</span></div>
                  <div><span className="text-gray-500">Turbidity:</span> <span className="font-medium">&lt;{waterLimits.turbidity} NTU</span></div>
                  <div><span className="text-gray-500">DO:</span> <span className="font-medium">&gt;{waterLimits.dissolvedOxygen} mg/L</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Site</th>
                      <th className="text-left p-4 text-sm font-medium">Date</th>
                      <th className="text-center p-4 text-sm font-medium">pH</th>
                      <th className="text-center p-4 text-sm font-medium">Nitrate</th>
                      <th className="text-center p-4 text-sm font-medium">Phosphorus</th>
                      <th className="text-center p-4 text-sm font-medium">E. coli</th>
                      <th className="text-center p-4 text-sm font-medium">Turbidity</th>
                      <th className="text-center p-4 text-sm font-medium">DO</th>
                      <th className="text-center p-4 text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockWaterTests.filter(t => selectedSite === 'all' || t.site === selectedSite).map(test => (
                      <tr key={test.id} className="hover:bg-gray-50">
                        <td className="p-4"><p className="font-medium text-sm">{test.site}</p><p className="text-xs text-gray-500">{test.testedBy}</p></td>
                        <td className="p-4 text-sm">{format(new Date(test.date), 'MMM d, yyyy')}</td>
                        <td className={`p-4 text-center font-medium ${test.ph < waterLimits.ph.min || test.ph > waterLimits.ph.max ? 'text-red-600' : 'text-green-600'}`}>{test.ph}</td>
                        <td className={`p-4 text-center font-medium ${getValueStatus(test.nitrate, waterLimits.nitrate)}`}>{test.nitrate}</td>
                        <td className={`p-4 text-center font-medium ${getValueStatus(test.phosphorus, waterLimits.phosphorus)}`}>{test.phosphorus}</td>
                        <td className={`p-4 text-center font-medium ${getValueStatus(test.ecoli, waterLimits.ecoli)}`}>{test.ecoli}</td>
                        <td className={`p-4 text-center font-medium ${getValueStatus(test.turbidity, waterLimits.turbidity)}`}>{test.turbidity}</td>
                        <td className={`p-4 text-center font-medium ${getValueStatus(test.dissolvedOxygen, waterLimits.dissolvedOxygen, false)}`}>{test.dissolvedOxygen}</td>
                        <td className="p-4 text-center"><Badge className={getStatusColor(test.status)}>{test.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Nutrient Budget Tab */}
          <TabsContent value="nutrients" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {/* Nitrogen */}
              <Card className={mockNutrientBudget.nitrogen.balance > mockNutrientBudget.nitrogen.limit ? 'border-red-300' : mockNutrientBudget.nitrogen.balance > mockNutrientBudget.nitrogen.limit * 0.9 ? 'border-yellow-300' : 'border-green-300'}>
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-blue-500" />Nitrogen (N)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between"><span className="text-gray-500">Applied</span><span className="font-bold text-red-600">+{mockNutrientBudget.nitrogen.applied} kg/ha</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Removed (product)</span><span className="font-bold text-green-600">-{mockNutrientBudget.nitrogen.removed} kg/ha</span></div>
                    <div className="border-t pt-3 flex justify-between"><span className="font-medium">Balance</span><span className={`font-bold text-xl ${mockNutrientBudget.nitrogen.balance > mockNutrientBudget.nitrogen.limit ? 'text-red-600' : 'text-green-600'}`}>{mockNutrientBudget.nitrogen.balance} kg/ha</span></div>
                    <div><div className="flex justify-between text-sm mb-1"><span>Limit: {mockNutrientBudget.nitrogen.limit} kg/ha</span><span>{Math.round((mockNutrientBudget.nitrogen.balance / mockNutrientBudget.nitrogen.limit) * 100)}%</span></div><Progress value={(mockNutrientBudget.nitrogen.balance / mockNutrientBudget.nitrogen.limit) * 100} className={`h-3 ${mockNutrientBudget.nitrogen.balance > mockNutrientBudget.nitrogen.limit * 0.9 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`} /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Phosphorus */}
              <Card className="border-green-300">
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-orange-500" />Phosphorus (P)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between"><span className="text-gray-500">Applied</span><span className="font-bold text-red-600">+{mockNutrientBudget.phosphorus.applied} kg/ha</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Removed (product)</span><span className="font-bold text-green-600">-{mockNutrientBudget.phosphorus.removed} kg/ha</span></div>
                    <div className="border-t pt-3 flex justify-between"><span className="font-medium">Balance</span><span className="font-bold text-xl text-green-600">{mockNutrientBudget.phosphorus.balance} kg/ha</span></div>
                    <div><div className="flex justify-between text-sm mb-1"><span>Limit: {mockNutrientBudget.phosphorus.limit} kg/ha</span><span>{Math.round((mockNutrientBudget.phosphorus.balance / mockNutrientBudget.phosphorus.limit) * 100)}%</span></div><Progress value={(mockNutrientBudget.phosphorus.balance / mockNutrientBudget.phosphorus.limit) * 100} className="h-3 [&>div]:bg-green-500" /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Potassium */}
              <Card className="border-green-300">
                <CardHeader className="pb-2"><CardTitle className="text-lg flex items-center gap-2"><div className="w-4 h-4 rounded-full bg-purple-500" />Potassium (K)</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between"><span className="text-gray-500">Applied</span><span className="font-bold text-red-600">+{mockNutrientBudget.potassium.applied} kg/ha</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Removed (product)</span><span className="font-bold text-green-600">-{mockNutrientBudget.potassium.removed} kg/ha</span></div>
                    <div className="border-t pt-3 flex justify-between"><span className="font-medium">Balance</span><span className="font-bold text-xl text-green-600">{mockNutrientBudget.potassium.balance} kg/ha</span></div>
                    <div><div className="flex justify-between text-sm mb-1"><span>Limit: {mockNutrientBudget.potassium.limit} kg/ha</span><span>{Math.round((mockNutrientBudget.potassium.balance / mockNutrientBudget.potassium.limit) * 100)}%</span></div><Progress value={(mockNutrientBudget.potassium.balance / mockNutrientBudget.potassium.limit) * 100} className="h-3 [&>div]:bg-green-500" /></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Nutrient Application Records</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { date: '2024-01-10', type: 'Urea', n: 46, p: 0, k: 0, area: 'North Block', rate: '25 kg/ha' },
                    { date: '2024-01-05', type: 'DAP', n: 18, p: 20, k: 0, area: 'South Block', rate: '150 kg/ha' },
                    { date: '2023-12-20', type: 'Potash', n: 0, p: 0, k: 50, area: 'All Paddocks', rate: '100 kg/ha' },
                    { date: '2023-12-15', type: 'Effluent', n: 12, p: 3, k: 15, area: 'Effluent Block', rate: '25mm' },
                  ].map((app, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-500">{format(new Date(app.date), 'MMM d')}</span>
                        <span className="font-medium">{app.type}</span>
                        <span className="text-sm text-gray-500">{app.area}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">N: {app.n}%</Badge>
                        <Badge variant="outline">P: {app.p}%</Badge>
                        <Badge variant="outline">K: {app.k}%</Badge>
                        <span className="text-sm font-medium">{app.rate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Effluent Management Tab */}
          <TabsContent value="effluent" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-6">
              {mockEffluentPonds.map(pond => {
                const levelPct = Math.round((pond.currentLevel / pond.capacity) * 100);
                return (
                  <Card key={pond.id} className={pond.status === 'warning' ? 'border-yellow-300' : pond.status === 'critical' ? 'border-red-300' : ''}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{pond.name}</CardTitle>
                        <Badge className={getStatusColor(pond.status)}>{pond.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="relative h-32 bg-gray-100 rounded-lg overflow-hidden mb-4">
                        <div className={`absolute bottom-0 left-0 right-0 ${getPondColor(pond.currentLevel, pond.capacity)} transition-all`} style={{ height: `${levelPct}%` }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl font-bold text-white drop-shadow-lg">{levelPct}%</span>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Current Level</span><span className="font-medium">{pond.currentLevel.toLocaleString()} m³</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Capacity</span><span className="font-medium">{pond.capacity.toLocaleString()} m³</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Last Emptied</span><span className="font-medium">{format(new Date(pond.lastEmptied), 'MMM d')}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Next Scheduled</span><span className="font-medium">{format(new Date(pond.nextScheduled), 'MMM d')}</span></div>
                      </div>
                      {pond.alerts.length > 0 && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-xs text-yellow-800">{pond.alerts[0]}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Effluent Application Log</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { date: '2024-01-12', pond: 'Secondary Storage', area: 'Paddock 8-10', volume: '180 m³', method: 'Low-rate irrigation', conditions: 'Soil dry, no rain forecast' },
                    { date: '2024-01-05', pond: 'Main Dairy Pond', area: 'Effluent Block A', volume: '450 m³', method: 'Travelling irrigator', conditions: 'Good soil moisture deficit' },
                    { date: '2023-12-28', pond: 'Main Dairy Pond', area: 'Effluent Block B', volume: '380 m³', method: 'Travelling irrigator', conditions: 'Acceptable conditions' },
                  ].map((log, idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{format(new Date(log.date), 'MMM d, yyyy')}</span>
                          <Badge variant="outline">{log.pond}</Badge>
                        </div>
                        <span className="font-bold">{log.volume}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm text-gray-600">
                        <div><span className="text-gray-400">Area:</span> {log.area}</div>
                        <div><span className="text-gray-400">Method:</span> {log.method}</div>
                        <div><span className="text-gray-400">Conditions:</span> {log.conditions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Riparian Planting Tab */}
          <TabsContent value="riparian" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Length</p><p className="text-3xl font-bold">{totalRiparian}m</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Planted</p><p className="text-3xl font-bold text-green-600">{plantedRiparian}m</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Remaining</p><p className="text-3xl font-bold text-orange-600">{totalRiparian - plantedRiparian}m</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Progress</p><p className="text-3xl font-bold text-blue-600">{riparianProgress}%</p></CardContent></Card>
            </div>

            <div className="space-y-4">
              {mockRiparianPlanting.map(zone => {
                const progress = Math.round((zone.plantedLength / zone.totalLength) * 100);
                return (
                  <Card key={zone.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{zone.zone}</h3>
                          <p className="text-sm text-gray-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{zone.location}</p>
                        </div>
                        <Badge className={getStatusColor(zone.status)}>{zone.status}</Badge>
                      </div>
                      <div className="grid md:grid-cols-4 gap-4 mb-4">
                        <div><p className="text-sm text-gray-500">Total Length</p><p className="font-bold">{zone.totalLength}m</p></div>
                        <div><p className="text-sm text-gray-500">Planted</p><p className="font-bold text-green-600">{zone.plantedLength}m</p></div>
                        <div><p className="text-sm text-gray-500">Survival Rate</p><p className="font-bold">{zone.survivalRate || '-'}%</p></div>
                        <div><p className="text-sm text-gray-500">Planted Date</p><p className="font-bold">{zone.plantedDate ? format(new Date(zone.plantedDate), 'MMM yyyy') : 'Planned'}</p></div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1"><span>Progress</span><span>{progress}%</span></div>
                        <Progress value={progress} className="h-3" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-1">{zone.species.map(s => (<Badge key={s} variant="outline" className="text-xs">{s}</Badge>))}</div>
                        {zone.nextAction && <p className="text-sm text-blue-600"><Calendar className="h-3 w-3 inline mr-1" />{zone.nextAction}</p>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Carbon Footprint Tab */}
          <TabsContent value="carbon" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-green-600">Total Emissions</p>
                  <p className="text-3xl font-bold text-green-700">{totalEmissions.toLocaleString()}</p>
                  <p className="text-sm text-green-600">t CO2e/year</p>
                </CardContent>
              </Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Per Hectare</p><p className="text-3xl font-bold">{(totalEmissions / 200).toFixed(1)}</p><p className="text-sm text-gray-500">t CO2e/ha</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Per kg MS</p><p className="text-3xl font-bold">{(totalEmissions / 76000).toFixed(2)}</p><p className="text-sm text-gray-500">kg CO2e</p></CardContent></Card>
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">YoY Change</p><p className="text-3xl font-bold text-green-700">-6%</p><p className="text-sm text-green-600">↓ 245 t CO2e</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Emissions by Source</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockCarbonData.map(cat => (
                    <div key={cat.category} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{cat.category}</span>
                          {cat.trend === 'down' && <Badge className="bg-green-100 text-green-800"><ArrowDownRight className="h-3 w-3 mr-1 inline" />{cat.reduction}%</Badge>}
                          {cat.trend === 'up' && <Badge className="bg-red-100 text-red-800"><ArrowUpRight className="h-3 w-3 mr-1 inline" />{Math.abs(cat.reduction || 0)}%</Badge>}
                        </div>
                        <span className="font-bold">{cat.emissions.toLocaleString()} {cat.unit}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={cat.percentage} className="h-3 flex-1" />
                        <span className="text-sm text-gray-500 w-12">{cat.percentage}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Carbon Reduction Initiatives</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { initiative: 'Low-emission feed additives', status: 'active', reduction: '8%', category: 'Enteric' },
                    { initiative: 'Precision fertiliser application', status: 'active', reduction: '12%', category: 'Fertiliser' },
                    { initiative: 'Solar panel installation', status: 'planned', reduction: '15%', category: 'Energy' },
                    { initiative: 'Native tree planting (sequestration)', status: 'active', reduction: '50 t/yr', category: 'Offset' },
                  ].map((init, idx) => (
                    <div key={idx} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{init.initiative}</span>
                        <Badge className={init.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>{init.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{init.category}</span>
                        <span className="font-bold text-green-600">-{init.reduction}</span>
                      </div>
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
