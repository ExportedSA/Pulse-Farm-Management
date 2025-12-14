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
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  TrendingUp, TrendingDown, Scale, Activity, DollarSign, Target,
  ArrowUpRight, ArrowDownRight, Minus, Calendar, Download, Filter,
  AlertTriangle, CheckCircle2, Info, ChevronRight, BarChart3,
  Skull, XCircle, Users, Clock, Heart, Baby, Beef, PieChart,
  Plus, Search, Eye, FileText
} from 'lucide-react';

// Interfaces
interface WeightRecord {
  id: string;
  animalId: string;
  date: string;
  weight: number;
  condition: number;
  recordedBy: string;
}

interface AnimalPerformance {
  id: string;
  tagNumber: string;
  name?: string;
  breed: string;
  mob: string;
  birthDate: string;
  currentWeight: number;
  birthWeight: number;
  targetWeight: number;
  adg: number;
  adgTarget: number;
  lifetimeAdg: number;
  totalRevenue: number;
  totalCosts: number;
  profitability: number;
  status: 'active' | 'sold' | 'culled' | 'died';
  weightHistory: { date: string; weight: number }[];
}

interface MortalityRecord {
  id: string;
  animalId: string;
  tagNumber: string;
  date: string;
  age: number;
  cause: string;
  category: 'disease' | 'injury' | 'calving' | 'metabolic' | 'unknown' | 'predator';
  preventable: boolean;
  notes?: string;
  cost: number;
}

interface CullingRecord {
  id: string;
  animalId: string;
  tagNumber: string;
  date: string;
  age: number;
  reason: string;
  category: 'reproductive' | 'health' | 'production' | 'temperament' | 'age' | 'economic';
  saleValue: number;
  lifetimeValue: number;
}

interface MobPerformance {
  id: string;
  name: string;
  count: number;
  avgWeight: number;
  avgAdg: number;
  targetAdg: number;
  avgAge: number;
  totalValue: number;
  performanceScore: number;
}

// Mock Data
const mockWeightRecords: WeightRecord[] = [
  { id: 'w1', animalId: 'a1', date: '2024-01-15', weight: 485, condition: 5, recordedBy: 'John Smith' },
  { id: 'w2', animalId: 'a1', date: '2024-01-01', weight: 472, condition: 5, recordedBy: 'John Smith' },
  { id: 'w3', animalId: 'a1', date: '2023-12-15', weight: 458, condition: 4.5, recordedBy: 'Sarah Johnson' },
];

const mockAnimalPerformance: AnimalPerformance[] = [
  { id: 'a1', tagNumber: 'NZ-2021-0045', name: 'Bella', breed: 'Friesian', mob: 'Milking Herd', birthDate: '2021-08-15', currentWeight: 485, birthWeight: 38, targetWeight: 520, adg: 0.92, adgTarget: 0.85, lifetimeAdg: 0.51, totalRevenue: 8500, totalCosts: 4200, profitability: 4300, status: 'active', weightHistory: [{ date: '2024-01-15', weight: 485 }, { date: '2024-01-01', weight: 472 }, { date: '2023-12-15', weight: 458 }, { date: '2023-12-01', weight: 445 }] },
  { id: 'a2', tagNumber: 'NZ-2021-0078', name: 'Daisy', breed: 'Jersey', mob: 'Milking Herd', birthDate: '2021-09-22', currentWeight: 420, birthWeight: 32, targetWeight: 450, adg: 0.78, adgTarget: 0.80, lifetimeAdg: 0.47, totalRevenue: 7800, totalCosts: 3900, profitability: 3900, status: 'active', weightHistory: [{ date: '2024-01-15', weight: 420 }, { date: '2024-01-01', weight: 408 }, { date: '2023-12-15', weight: 398 }] },
  { id: 'a3', tagNumber: 'NZ-2022-0112', name: 'Ruby', breed: 'Friesian x Jersey', mob: 'R2 Heifers', birthDate: '2022-07-10', currentWeight: 380, birthWeight: 35, targetWeight: 420, adg: 0.95, adgTarget: 0.90, lifetimeAdg: 0.62, totalRevenue: 2200, totalCosts: 1800, profitability: 400, status: 'active', weightHistory: [{ date: '2024-01-15', weight: 380 }, { date: '2024-01-01', weight: 365 }, { date: '2023-12-15', weight: 352 }] },
  { id: 'a4', tagNumber: 'NZ-2022-0156', breed: 'Friesian', mob: 'R2 Heifers', birthDate: '2022-08-05', currentWeight: 365, birthWeight: 40, targetWeight: 420, adg: 0.82, adgTarget: 0.90, lifetimeAdg: 0.58, totalRevenue: 1800, totalCosts: 1600, profitability: 200, status: 'active', weightHistory: [{ date: '2024-01-15', weight: 365 }, { date: '2024-01-01', weight: 352 }] },
  { id: 'a5', tagNumber: 'NZ-2023-0023', breed: 'Jersey', mob: 'R1 Calves', birthDate: '2023-08-12', currentWeight: 185, birthWeight: 28, targetWeight: 250, adg: 1.05, adgTarget: 1.00, lifetimeAdg: 1.01, totalRevenue: 0, totalCosts: 650, profitability: -650, status: 'active', weightHistory: [{ date: '2024-01-15', weight: 185 }, { date: '2024-01-01', weight: 168 }] },
  { id: 'a6', tagNumber: 'NZ-2023-0045', breed: 'Friesian', mob: 'R1 Calves', birthDate: '2023-09-01', currentWeight: 165, birthWeight: 42, targetWeight: 250, adg: 0.88, adgTarget: 1.00, lifetimeAdg: 0.90, totalRevenue: 0, totalCosts: 580, profitability: -580, status: 'active', weightHistory: [{ date: '2024-01-15', weight: 165 }, { date: '2024-01-01', weight: 152 }] },
];

const mockMortalityRecords: MortalityRecord[] = [
  { id: 'm1', animalId: 'x1', tagNumber: 'NZ-2023-0089', date: '2024-01-10', age: 4, cause: 'Pneumonia', category: 'disease', preventable: true, notes: 'Late detection of respiratory symptoms', cost: 850 },
  { id: 'm2', animalId: 'x2', tagNumber: 'NZ-2022-0234', date: '2023-12-28', age: 18, cause: 'Calving complications', category: 'calving', preventable: false, notes: 'Difficult birth, calf survived', cost: 2200 },
  { id: 'm3', animalId: 'x3', tagNumber: 'NZ-2023-0156', date: '2023-12-15', age: 3, cause: 'Scours', category: 'disease', preventable: true, notes: 'Outbreak in calf shed', cost: 420 },
  { id: 'm4', animalId: 'x4', tagNumber: 'NZ-2021-0312', date: '2023-11-20', age: 28, cause: 'Milk fever', category: 'metabolic', preventable: true, notes: 'Transition diet issue', cost: 3500 },
  { id: 'm5', animalId: 'x5', tagNumber: 'NZ-2023-0201', date: '2023-11-05', age: 2, cause: 'Unknown', category: 'unknown', preventable: false, cost: 380 },
];

const mockCullingRecords: CullingRecord[] = [
  { id: 'c1', animalId: 'y1', tagNumber: 'NZ-2018-0045', date: '2024-01-08', age: 68, reason: 'Empty after 2 matings', category: 'reproductive', saleValue: 1200, lifetimeValue: 28500 },
  { id: 'c2', animalId: 'y2', tagNumber: 'NZ-2017-0112', date: '2023-12-20', age: 78, reason: 'Low production', category: 'production', saleValue: 980, lifetimeValue: 32000 },
  { id: 'c3', animalId: 'y3', tagNumber: 'NZ-2019-0089', date: '2023-12-15', age: 54, reason: 'Chronic mastitis', category: 'health', saleValue: 850, lifetimeValue: 18500 },
  { id: 'c4', animalId: 'y4', tagNumber: 'NZ-2016-0234', date: '2023-11-28', age: 90, reason: 'Age - 8th lactation', category: 'age', saleValue: 1100, lifetimeValue: 45000 },
  { id: 'c5', animalId: 'y5', tagNumber: 'NZ-2020-0156', date: '2023-11-15', age: 42, reason: 'Difficult temperament', category: 'temperament', saleValue: 1050, lifetimeValue: 12000 },
];

const mockMobPerformance: MobPerformance[] = [
  { id: 'mob1', name: 'Milking Herd', count: 180, avgWeight: 465, avgAdg: 0.15, targetAdg: 0.10, avgAge: 48, totalValue: 324000, performanceScore: 82 },
  { id: 'mob2', name: 'R2 Heifers', count: 45, avgWeight: 372, avgAdg: 0.88, targetAdg: 0.90, avgAge: 18, totalValue: 67500, performanceScore: 75 },
  { id: 'mob3', name: 'R1 Calves', count: 52, avgWeight: 175, avgAdg: 0.96, targetAdg: 1.00, avgAge: 5, totalValue: 36400, performanceScore: 78 },
  { id: 'mob4', name: 'Dry Cows', count: 25, avgWeight: 510, avgAdg: 0.08, targetAdg: 0.05, avgAge: 52, totalValue: 45000, performanceScore: 85 },
  { id: 'mob5', name: 'Bulls', count: 5, avgWeight: 680, avgAdg: 0.12, targetAdg: 0.10, avgAge: 36, totalValue: 25000, performanceScore: 88 },
];

export default function AnimalPerformancePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedMob, setSelectedMob] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState('90d');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecordWeightOpen, setIsRecordWeightOpen] = useState(false);

  // Calculate stats
  const totalAnimals = mockMobPerformance.reduce((s, m) => s + m.count, 0);
  const avgAdg = mockAnimalPerformance.filter(a => a.status === 'active').reduce((s, a) => s + a.adg, 0) / mockAnimalPerformance.filter(a => a.status === 'active').length;
  const mortalityRate = (mockMortalityRecords.length / (totalAnimals + mockMortalityRecords.length + mockCullingRecords.length)) * 100;
  const cullingRate = (mockCullingRecords.length / (totalAnimals + mockMortalityRecords.length + mockCullingRecords.length)) * 100;
  const totalProfitability = mockAnimalPerformance.reduce((s, a) => s + a.profitability, 0);

  // Mortality by cause
  const mortalityByCause = mockMortalityRecords.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Culling by reason
  const cullingByReason = mockCullingRecords.reduce((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredAnimals = mockAnimalPerformance.filter(a => {
    const matchMob = selectedMob === 'all' || a.mob === selectedMob;
    const matchSearch = !searchTerm || a.tagNumber.toLowerCase().includes(searchTerm.toLowerCase()) || a.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchMob && matchSearch;
  });

  const getAdgStatus = (adg: number, target: number) => {
    const ratio = adg / target;
    if (ratio >= 1.05) return { color: 'text-green-600 bg-green-100', label: 'Excellent' };
    if (ratio >= 0.95) return { color: 'text-blue-600 bg-blue-100', label: 'On Target' };
    if (ratio >= 0.85) return { color: 'text-yellow-600 bg-yellow-100', label: 'Below Target' };
    return { color: 'text-red-600 bg-red-100', label: 'Poor' };
  };

  const getCauseColor = (category: string) => {
    const colors: Record<string, string> = {
      disease: 'bg-red-100 text-red-800',
      injury: 'bg-orange-100 text-orange-800',
      calving: 'bg-purple-100 text-purple-800',
      metabolic: 'bg-yellow-100 text-yellow-800',
      unknown: 'bg-gray-100 text-gray-800',
      predator: 'bg-red-100 text-red-800',
      reproductive: 'bg-pink-100 text-pink-800',
      health: 'bg-red-100 text-red-800',
      production: 'bg-blue-100 text-blue-800',
      temperament: 'bg-orange-100 text-orange-800',
      age: 'bg-gray-100 text-gray-800',
      economic: 'bg-green-100 text-green-800',
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Animal Performance Analytics</h1>
                <p className="text-sm text-gray-500">Weight tracking, ADG, profitability & mortality analysis</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="90d">Last 90 Days</SelectItem>
                  <SelectItem value="12m">Last 12 Months</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={isRecordWeightOpen} onOpenChange={setIsRecordWeightOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700"><Scale className="h-4 w-4 mr-2" />Record Weight</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record Animal Weight</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>Animal Tag</Label><Input placeholder="e.g., NZ-2021-0045" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Weight (kg)</Label><Input type="number" placeholder="e.g., 485" /></div>
                      <div><Label>Body Condition (1-10)</Label><Input type="number" placeholder="e.g., 5" min="1" max="10" /></div>
                    </div>
                    <div><Label>Date</Label><Input type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} /></div>
                    <div><Label>Notes</Label><Input placeholder="Optional notes" /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRecordWeightOpen(false)}>Cancel</Button>
                    <Button onClick={() => { setIsRecordWeightOpen(false); toast.success('Weight recorded'); }}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="weight-adg">Weight & ADG</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
            <TabsTrigger value="mortality">Mortality</TabsTrigger>
            <TabsTrigger value="culling">Culling Analysis</TabsTrigger>
            <TabsTrigger value="lifetime">Lifetime Performance</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Total Animals</p><p className="text-2xl font-bold">{totalAnimals}</p></div><Users className="h-8 w-8 text-gray-200" /></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Avg ADG</p><p className="text-2xl font-bold text-blue-600">{avgAdg.toFixed(2)} kg</p></div><TrendingUp className="h-8 w-8 text-blue-200" /></div><p className="text-xs text-green-600 mt-1">+8% vs target</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Mortality Rate</p><p className="text-2xl font-bold text-red-600">{mortalityRate.toFixed(1)}%</p></div><Skull className="h-8 w-8 text-red-200" /></div><p className="text-xs text-gray-500 mt-1">{mockMortalityRecords.length} deaths YTD</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Culling Rate</p><p className="text-2xl font-bold text-orange-600">{cullingRate.toFixed(1)}%</p></div><XCircle className="h-8 w-8 text-orange-200" /></div><p className="text-xs text-gray-500 mt-1">{mockCullingRecords.length} culled YTD</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Herd Profitability</p><p className="text-2xl font-bold text-green-600">${totalProfitability.toLocaleString()}</p></div><DollarSign className="h-8 w-8 text-green-200" /></div></CardContent></Card>
            </div>

            {/* Mob Performance */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Mob Performance Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockMobPerformance.map(mob => {
                    const adgStatus = getAdgStatus(mob.avgAdg, mob.targetAdg);
                    return (
                      <div key={mob.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">{mob.name}</h4>
                          <Badge className={adgStatus.color}>{adgStatus.label}</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div><p className="text-gray-500">Count</p><p className="font-bold">{mob.count}</p></div>
                          <div><p className="text-gray-500">Avg Weight</p><p className="font-bold">{mob.avgWeight} kg</p></div>
                          <div><p className="text-gray-500">Avg ADG</p><p className="font-bold">{mob.avgAdg} kg/d</p></div>
                          <div><p className="text-gray-500">Target ADG</p><p className="font-bold">{mob.targetAdg} kg/d</p></div>
                        </div>
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Performance Score</span>
                            <span className="font-bold">{mob.performanceScore}/100</span>
                          </div>
                          <Progress value={mob.performanceScore} className="h-2 mt-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Insights */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" />Top Performers</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockAnimalPerformance.filter(a => a.adg >= a.adgTarget).slice(0, 4).map(animal => (
                      <div key={animal.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div>
                          <p className="font-medium">{animal.tagNumber}</p>
                          <p className="text-xs text-gray-500">{animal.mob} • {animal.breed}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-600">{animal.adg} kg/d</p>
                          <p className="text-xs text-gray-500">Target: {animal.adgTarget}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-orange-600"><AlertTriangle className="h-5 w-5" />Needs Attention</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockAnimalPerformance.filter(a => a.adg < a.adgTarget * 0.9).slice(0, 4).map(animal => (
                      <div key={animal.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div>
                          <p className="font-medium">{animal.tagNumber}</p>
                          <p className="text-xs text-gray-500">{animal.mob} • {animal.breed}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-orange-600">{animal.adg} kg/d</p>
                          <p className="text-xs text-gray-500">Target: {animal.adgTarget}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Weight & ADG Tab */}
          <TabsContent value="weight-adg" className="space-y-6">
            <div className="flex flex-wrap gap-3 mb-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search by tag or name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
              <Select value={selectedMob} onValueChange={setSelectedMob}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Filter by mob" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Mobs</SelectItem>
                  {mockMobPerformance.map(m => (<SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Animal</th>
                      <th className="text-left p-4 text-sm font-medium">Mob</th>
                      <th className="text-right p-4 text-sm font-medium">Current Weight</th>
                      <th className="text-right p-4 text-sm font-medium">Target</th>
                      <th className="text-right p-4 text-sm font-medium">ADG (Current)</th>
                      <th className="text-right p-4 text-sm font-medium">ADG Target</th>
                      <th className="text-right p-4 text-sm font-medium">Lifetime ADG</th>
                      <th className="text-center p-4 text-sm font-medium">Status</th>
                      <th className="text-center p-4 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredAnimals.map(animal => {
                      const adgStatus = getAdgStatus(animal.adg, animal.adgTarget);
                      const weightProgress = (animal.currentWeight / animal.targetWeight) * 100;
                      return (
                        <tr key={animal.id} className="hover:bg-accent">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{animal.tagNumber}</p>
                              {animal.name && <p className="text-xs text-gray-500">{animal.name}</p>}
                              <p className="text-xs text-gray-400">{animal.breed}</p>
                            </div>
                          </td>
                          <td className="p-4 text-sm">{animal.mob}</td>
                          <td className="p-4 text-right">
                            <p className="font-bold">{animal.currentWeight} kg</p>
                            <Progress value={weightProgress} className="h-1 w-16 ml-auto mt-1" />
                          </td>
                          <td className="p-4 text-right text-gray-500">{animal.targetWeight} kg</td>
                          <td className="p-4 text-right font-bold">{animal.adg} kg/d</td>
                          <td className="p-4 text-right text-gray-500">{animal.adgTarget} kg/d</td>
                          <td className="p-4 text-right">{animal.lifetimeAdg} kg/d</td>
                          <td className="p-4 text-center"><Badge className={adgStatus.color}>{adgStatus.label}</Badge></td>
                          <td className="p-4 text-center">
                            <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Weight Gain Curves */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Weight Gain Curves</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {mockAnimalPerformance.slice(0, 3).map(animal => (
                    <div key={animal.id} className="p-4 border rounded-lg">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="font-medium">{animal.tagNumber}</p>
                          <p className="text-xs text-gray-500">{animal.mob}</p>
                        </div>
                        <Badge className={getAdgStatus(animal.adg, animal.adgTarget).color}>{animal.adg} kg/d</Badge>
                      </div>
                      <div className="space-y-2">
                        {animal.weightHistory.map((w, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 w-20">{format(new Date(w.date), 'MMM d')}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full" style={{ width: `${(w.weight / animal.targetWeight) * 100}%` }} />
                            </div>
                            <span className="text-xs font-medium w-16 text-right">{w.weight} kg</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">Target: {animal.targetWeight} kg</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profitability Tab */}
          <TabsContent value="profitability" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Total Revenue</p><p className="text-3xl font-bold text-green-700">${mockAnimalPerformance.reduce((s, a) => s + a.totalRevenue, 0).toLocaleString()}</p></CardContent></Card>
              <Card className="bg-red-50"><CardContent className="p-4 text-center"><p className="text-sm text-red-600">Total Costs</p><p className="text-3xl font-bold text-red-700">${mockAnimalPerformance.reduce((s, a) => s + a.totalCosts, 0).toLocaleString()}</p></CardContent></Card>
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Net Profit</p><p className="text-3xl font-bold text-blue-700">${totalProfitability.toLocaleString()}</p></CardContent></Card>
              <Card className="bg-purple-50"><CardContent className="p-4 text-center"><p className="text-sm text-purple-600">Avg Profit/Animal</p><p className="text-3xl font-bold text-purple-700">${Math.round(totalProfitability / mockAnimalPerformance.length).toLocaleString()}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Individual Animal Profitability</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Animal</th>
                      <th className="text-left p-4 text-sm font-medium">Mob</th>
                      <th className="text-right p-4 text-sm font-medium">Revenue</th>
                      <th className="text-right p-4 text-sm font-medium">Costs</th>
                      <th className="text-right p-4 text-sm font-medium">Profit/Loss</th>
                      <th className="text-right p-4 text-sm font-medium">ROI</th>
                      <th className="text-center p-4 text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockAnimalPerformance.sort((a, b) => b.profitability - a.profitability).map(animal => {
                      const roi = animal.totalCosts > 0 ? ((animal.profitability / animal.totalCosts) * 100) : 0;
                      return (
                        <tr key={animal.id} className="hover:bg-accent">
                          <td className="p-4"><p className="font-medium">{animal.tagNumber}</p>{animal.name && <p className="text-xs text-gray-500">{animal.name}</p>}</td>
                          <td className="p-4 text-sm">{animal.mob}</td>
                          <td className="p-4 text-right text-green-600">${animal.totalRevenue.toLocaleString()}</td>
                          <td className="p-4 text-right text-red-600">${animal.totalCosts.toLocaleString()}</td>
                          <td className={`p-4 text-right font-bold ${animal.profitability >= 0 ? 'text-green-600' : 'text-red-600'}`}>${animal.profitability.toLocaleString()}</td>
                          <td className="p-4 text-right">{roi.toFixed(0)}%</td>
                          <td className="p-4 text-center"><Badge className={animal.profitability >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{animal.profitability >= 0 ? 'Profitable' : 'Loss'}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mortality Tab */}
          <TabsContent value="mortality" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-red-50"><CardContent className="p-4 text-center"><p className="text-sm text-red-600">Total Deaths</p><p className="text-3xl font-bold text-red-700">{mockMortalityRecords.length}</p></CardContent></Card>
              <Card className="bg-orange-50"><CardContent className="p-4 text-center"><p className="text-sm text-orange-600">Mortality Rate</p><p className="text-3xl font-bold text-orange-700">{mortalityRate.toFixed(1)}%</p></CardContent></Card>
              <Card className="bg-yellow-50"><CardContent className="p-4 text-center"><p className="text-sm text-yellow-600">Preventable</p><p className="text-3xl font-bold text-yellow-700">{mockMortalityRecords.filter(m => m.preventable).length}</p></CardContent></Card>
              <Card className="bg-purple-50"><CardContent className="p-4 text-center"><p className="text-sm text-purple-600">Total Loss Value</p><p className="text-3xl font-bold text-purple-700">${mockMortalityRecords.reduce((s, m) => s + m.cost, 0).toLocaleString()}</p></CardContent></Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Deaths by Cause</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(mortalityByCause).sort((a, b) => b[1] - a[1]).map(([cause, count]) => (
                      <div key={cause} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Badge className={getCauseColor(cause)}>{cause}</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold">{count}</span>
                          <span className="text-sm text-gray-500">({((count / mockMortalityRecords.length) * 100).toFixed(0)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Recent Deaths</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockMortalityRecords.slice(0, 5).map(record => (
                      <div key={record.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{record.tagNumber}</span>
                          <Badge className={getCauseColor(record.category)}>{record.cause}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>{format(new Date(record.date), 'MMM d, yyyy')}</span>
                          <span>Age: {record.age} months</span>
                          <span className="text-red-600">Loss: ${record.cost}</span>
                        </div>
                        {record.preventable && <Badge className="mt-2 bg-yellow-100 text-yellow-800">Preventable</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Culling Analysis Tab */}
          <TabsContent value="culling" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-orange-50"><CardContent className="p-4 text-center"><p className="text-sm text-orange-600">Total Culled</p><p className="text-3xl font-bold text-orange-700">{mockCullingRecords.length}</p></CardContent></Card>
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Culling Rate</p><p className="text-3xl font-bold text-blue-700">{cullingRate.toFixed(1)}%</p></CardContent></Card>
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Sale Value</p><p className="text-3xl font-bold text-green-700">${mockCullingRecords.reduce((s, c) => s + c.saleValue, 0).toLocaleString()}</p></CardContent></Card>
              <Card className="bg-purple-50"><CardContent className="p-4 text-center"><p className="text-sm text-purple-600">Lifetime Value</p><p className="text-3xl font-bold text-purple-700">${mockCullingRecords.reduce((s, c) => s + c.lifetimeValue, 0).toLocaleString()}</p></CardContent></Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Culling by Reason</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(cullingByReason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                      <div key={reason} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <Badge className={getCauseColor(reason)}>{reason}</Badge>
                        <div className="flex items-center gap-4">
                          <span className="font-bold">{count}</span>
                          <span className="text-sm text-gray-500">({((count / mockCullingRecords.length) * 100).toFixed(0)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Recent Culls</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockCullingRecords.slice(0, 5).map(record => (
                      <div key={record.id} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{record.tagNumber}</span>
                          <Badge className={getCauseColor(record.category)}>{record.reason}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <span>{format(new Date(record.date), 'MMM d, yyyy')}</span>
                          <span>Age: {record.age} months</span>
                          <span className="text-green-600">Sale: ${record.saleValue}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Lifetime value: ${record.lifetimeValue.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Lifetime Performance Tab */}
          <TabsContent value="lifetime" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Lifetime Performance Reports</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockAnimalPerformance.slice(0, 6).map(animal => {
                    const ageMonths = differenceInMonths(new Date(), new Date(animal.birthDate));
                    const totalWeightGain = animal.currentWeight - animal.birthWeight;
                    return (
                      <div key={animal.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="font-bold">{animal.tagNumber}</p>
                            {animal.name && <p className="text-sm text-gray-500">{animal.name}</p>}
                          </div>
                          <Badge>{animal.status}</Badge>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500">Age</span><span className="font-medium">{ageMonths} months</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Birth Weight</span><span className="font-medium">{animal.birthWeight} kg</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Current Weight</span><span className="font-medium">{animal.currentWeight} kg</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Total Gain</span><span className="font-medium text-green-600">+{totalWeightGain} kg</span></div>
                          <div className="flex justify-between"><span className="text-gray-500">Lifetime ADG</span><span className="font-medium">{animal.lifetimeAdg} kg/d</span></div>
                          <div className="border-t pt-3 mt-3">
                            <div className="flex justify-between"><span className="text-gray-500">Total Revenue</span><span className="font-medium text-green-600">${animal.totalRevenue.toLocaleString()}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Total Costs</span><span className="font-medium text-red-600">${animal.totalCosts.toLocaleString()}</span></div>
                            <div className="flex justify-between font-bold"><span>Net Value</span><span className={animal.profitability >= 0 ? 'text-green-600' : 'text-red-600'}>${animal.profitability.toLocaleString()}</span></div>
                          </div>
                        </div>
                        <Button variant="outline" className="w-full mt-4" size="sm"><FileText className="h-4 w-4 mr-2" />Full Report</Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
