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
import { format, subDays, subMonths, addMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  Milk, TrendingUp, TrendingDown, BarChart3, Calculator, Target,
  AlertTriangle, CheckCircle2, Calendar, Download, RefreshCw,
  ArrowUpRight, ArrowDownRight, Minus, DollarSign, Droplets,
  Activity, PieChart, Eye, Filter, Info, Zap, Award, Clock
} from 'lucide-react';

// Interfaces
interface HerdTestResult {
  id: string;
  date: string;
  cowsTested: number;
  avgMilkYield: number;
  avgFat: number;
  avgProtein: number;
  avgSCC: number;
  avgLactoseDays: number;
  totalMS: number;
}

interface CowTestResult {
  id: string;
  tagNumber: string;
  name?: string;
  testDate: string;
  milkYield: number;
  fatPercent: number;
  proteinPercent: number;
  scc: number;
  lactationDays: number;
  lactationNumber: number;
  status: 'normal' | 'watch' | 'high-scc' | 'low-production';
}

interface SCCTrend {
  date: string;
  bulkSCC: number;
  herdAvgSCC: number;
  highSCCCows: number;
  target: number;
}

interface ProductionData {
  date: string;
  totalLitres: number;
  totalMS: number;
  cowsMilked: number;
  avgPerCow: number;
}

interface PayoutData {
  season: string;
  basePrice: number;
  fatPrice: number;
  proteinPrice: number;
  volumePrice: number;
  currentPayout: number;
  forecastPayout: number;
}

interface ForecastData {
  month: string;
  predictedMS: number;
  actualMS?: number;
  confidence: number;
}

// Mock Data
const mockHerdTests: HerdTestResult[] = [
  { id: 'ht1', date: '2024-01-15', cowsTested: 175, avgMilkYield: 22.5, avgFat: 4.82, avgProtein: 3.95, avgSCC: 165, avgLactoseDays: 145, totalMS: 1.92 },
  { id: 'ht2', date: '2023-12-18', cowsTested: 178, avgMilkYield: 24.2, avgFat: 4.65, avgProtein: 3.88, avgSCC: 158, avgLactoseDays: 118, totalMS: 2.01 },
  { id: 'ht3', date: '2023-11-20', cowsTested: 180, avgMilkYield: 26.8, avgFat: 4.45, avgProtein: 3.72, avgSCC: 145, avgLactoseDays: 89, totalMS: 2.15 },
  { id: 'ht4', date: '2023-10-16', cowsTested: 182, avgMilkYield: 28.5, avgFat: 4.28, avgProtein: 3.58, avgSCC: 138, avgLactoseDays: 58, totalMS: 2.22 },
  { id: 'ht5', date: '2023-09-18', cowsTested: 180, avgMilkYield: 25.2, avgFat: 4.52, avgProtein: 3.68, avgSCC: 142, avgLactoseDays: 32, totalMS: 2.05 },
];

const mockCowResults: CowTestResult[] = [
  { id: 'c1', tagNumber: 'NZ-2019-0045', name: 'Bella', testDate: '2024-01-15', milkYield: 28.5, fatPercent: 5.12, proteinPercent: 4.05, scc: 85, lactationDays: 148, lactationNumber: 4, status: 'normal' },
  { id: 'c2', tagNumber: 'NZ-2020-0078', name: 'Daisy', testDate: '2024-01-15', milkYield: 32.2, fatPercent: 4.65, proteinPercent: 3.82, scc: 62, lactationDays: 142, lactationNumber: 3, status: 'normal' },
  { id: 'c3', tagNumber: 'NZ-2018-0112', name: 'Ruby', testDate: '2024-01-15', milkYield: 18.5, fatPercent: 5.45, proteinPercent: 4.28, scc: 385, lactationDays: 165, lactationNumber: 5, status: 'high-scc' },
  { id: 'c4', tagNumber: 'NZ-2021-0156', testDate: '2024-01-15', milkYield: 24.8, fatPercent: 4.92, proteinPercent: 3.95, scc: 125, lactationDays: 138, lactationNumber: 2, status: 'normal' },
  { id: 'c5', tagNumber: 'NZ-2019-0089', name: 'Star', testDate: '2024-01-15', milkYield: 15.2, fatPercent: 4.85, proteinPercent: 3.78, scc: 95, lactationDays: 185, lactationNumber: 4, status: 'low-production' },
  { id: 'c6', tagNumber: 'NZ-2020-0234', testDate: '2024-01-15', milkYield: 26.5, fatPercent: 4.72, proteinPercent: 3.88, scc: 245, lactationDays: 152, lactationNumber: 3, status: 'watch' },
  { id: 'c7', tagNumber: 'NZ-2017-0067', name: 'Honey', testDate: '2024-01-15', milkYield: 22.8, fatPercent: 5.25, proteinPercent: 4.15, scc: 520, lactationDays: 168, lactationNumber: 6, status: 'high-scc' },
  { id: 'c8', tagNumber: 'NZ-2021-0312', testDate: '2024-01-15', milkYield: 29.5, fatPercent: 4.58, proteinPercent: 3.72, scc: 78, lactationDays: 125, lactationNumber: 2, status: 'normal' },
];

const mockSCCTrends: SCCTrend[] = Array.from({ length: 12 }, (_, i) => {
  const date = subMonths(new Date(), 11 - i);
  return {
    date: format(date, 'yyyy-MM-dd'),
    bulkSCC: Math.round(140 + Math.random() * 40 + (i > 8 ? 20 : 0)),
    herdAvgSCC: Math.round(155 + Math.random() * 50 + (i > 8 ? 25 : 0)),
    highSCCCows: Math.round(8 + Math.random() * 6),
    target: 150
  };
});

const mockDailyProduction: ProductionData[] = Array.from({ length: 30 }, (_, i) => {
  const date = subDays(new Date(), 29 - i);
  const baseProduction = 3800 - (i * 15); // Declining curve
  return {
    date: format(date, 'yyyy-MM-dd'),
    totalLitres: Math.round(baseProduction + Math.random() * 200 - 100),
    totalMS: Math.round((baseProduction * 0.085 + Math.random() * 20 - 10) * 10) / 10,
    cowsMilked: 175 - Math.floor(i / 10),
    avgPerCow: Math.round((baseProduction / (175 - Math.floor(i / 10))) * 10) / 10
  };
});

const mockPayoutData: PayoutData = {
  season: '2023-24',
  basePrice: 7.80,
  fatPrice: 3.25,
  proteinPrice: 8.45,
  volumePrice: 0.12,
  currentPayout: 7.65,
  forecastPayout: 7.80
};

const mockForecast: ForecastData[] = [
  { month: 'Jan 2024', predictedMS: 32500, actualMS: 31800, confidence: 95 },
  { month: 'Feb 2024', predictedMS: 28500, actualMS: 29200, confidence: 92 },
  { month: 'Mar 2024', predictedMS: 24000, confidence: 88 },
  { month: 'Apr 2024', predictedMS: 18500, confidence: 82 },
  { month: 'May 2024', predictedMS: 12000, confidence: 75 },
  { month: 'Jun 2024', predictedMS: 0, confidence: 95 },
];

const seasonTotals = {
  totalMS: 76500,
  targetMS: 82000,
  lastYearMS: 74200,
  peakDay: { date: '2023-10-15', ms: 385 },
  avgFat: 4.62,
  avgProtein: 3.78,
  avgSCC: 158
};

export default function MilkAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('season');
  const [sccFilter, setSccFilter] = useState('all');
  const [payoutPrice, setPayoutPrice] = useState(mockPayoutData.currentPayout.toString());
  const [estimatedMS, setEstimatedMS] = useState('82000');

  // Calculate stats
  const latestTest = mockHerdTests[0];
  const previousTest = mockHerdTests[1];
  const sccChange = latestTest.avgSCC - previousTest.avgSCC;
  const productionChange = ((latestTest.avgMilkYield - previousTest.avgMilkYield) / previousTest.avgMilkYield) * 100;
  const highSCCCows = mockCowResults.filter(c => c.scc > 250).length;
  const seasonProgress = (seasonTotals.totalMS / seasonTotals.targetMS) * 100;

  // Payout calculation
  const calculatePayout = () => {
    const ms = parseFloat(estimatedMS) || 0;
    const price = parseFloat(payoutPrice) || 0;
    return (ms * price).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800';
      case 'watch': return 'bg-yellow-100 text-yellow-800';
      case 'high-scc': return 'bg-red-100 text-red-800';
      case 'low-production': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSCCColor = (scc: number) => {
    if (scc > 400) return 'text-red-600';
    if (scc > 250) return 'text-orange-600';
    if (scc > 150) return 'text-yellow-600';
    return 'text-green-600';
  };

  const filteredCows = mockCowResults.filter(cow => {
    if (sccFilter === 'all') return true;
    if (sccFilter === 'high') return cow.scc > 250;
    if (sccFilter === 'watch') return cow.scc > 150 && cow.scc <= 250;
    if (sccFilter === 'normal') return cow.scc <= 150;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-lg"><Milk className="h-6 w-6" /></div>
              <div>
                <h1 className="text-2xl font-bold">Milk Production Analytics</h1>
                <p className="text-sm text-blue-100">Season {mockPayoutData.season} • Last herd test: {format(new Date(latestTest.date), 'MMM d, yyyy')}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[140px] bg-white/20 border-0 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="season">This Season</SelectItem>
                  <SelectItem value="12m">Last 12 Months</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="secondary" className="bg-white/20 hover:bg-white/30 text-white border-0"><Download className="h-4 w-4 mr-2" />Export</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="herd-tests">Herd Tests</TabsTrigger>
            <TabsTrigger value="scc">SCC Analysis</TabsTrigger>
            <TabsTrigger value="components">Fat & Protein</TabsTrigger>
            <TabsTrigger value="payout">Payout Calculator</TabsTrigger>
            <TabsTrigger value="forecast">Forecasting</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Season Total MS</p><p className="text-2xl font-bold">{(seasonTotals.totalMS / 1000).toFixed(1)}k kg</p></div><Milk className="h-8 w-8 text-blue-200" /></div><Progress value={seasonProgress} className="h-2 mt-2" /><p className="text-xs text-gray-500 mt-1">{seasonProgress.toFixed(0)}% of target</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Bulk SCC</p><p className={`text-2xl font-bold ${getSCCColor(mockSCCTrends[mockSCCTrends.length - 1].bulkSCC)}`}>{mockSCCTrends[mockSCCTrends.length - 1].bulkSCC}k</p></div><Activity className="h-8 w-8 text-gray-200" /></div><p className={`text-xs mt-1 ${sccChange > 0 ? 'text-red-600' : 'text-green-600'}`}>{sccChange > 0 ? '+' : ''}{sccChange} vs last test</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Avg Fat %</p><p className="text-2xl font-bold text-yellow-600">{seasonTotals.avgFat}%</p></div><Droplets className="h-8 w-8 text-yellow-200" /></div><p className="text-xs text-gray-500 mt-1">Season average</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Avg Protein %</p><p className="text-2xl font-bold text-purple-600">{seasonTotals.avgProtein}%</p></div><Droplets className="h-8 w-8 text-purple-200" /></div><p className="text-xs text-gray-500 mt-1">Season average</p></CardContent></Card>
            </div>

            {/* Season Progress & Payout */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg">Season Progress</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Total MS</span>
                      <span className="font-bold">{seasonTotals.totalMS.toLocaleString()} kg</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Target</span>
                      <span className="font-bold">{seasonTotals.targetMS.toLocaleString()} kg</span>
                    </div>
                    <Progress value={seasonProgress} className="h-4" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Remaining</span>
                      <span className="font-medium">{(seasonTotals.targetMS - seasonTotals.totalMS).toLocaleString()} kg</span>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">vs Last Season</span>
                        <Badge className="bg-green-100 text-green-800">
                          <ArrowUpRight className="h-3 w-3 mr-1" />
                          +{((seasonTotals.totalMS - seasonTotals.lastYearMS) / seasonTotals.lastYearMS * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Estimated Payout</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                      <p className="text-sm text-green-600">Current Milk Price</p>
                      <p className="text-4xl font-bold text-green-700">${mockPayoutData.currentPayout}</p>
                      <p className="text-sm text-green-600">per kg MS</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-gray-500">Forecast:</span><span className="font-bold ml-2">${mockPayoutData.forecastPayout}</span></div>
                      <div><span className="text-gray-500">Season:</span><span className="font-bold ml-2">{mockPayoutData.season}</span></div>
                    </div>
                    <div className="pt-3 border-t">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Est. Season Revenue</span>
                        <span className="font-bold text-green-600">${(seasonTotals.targetMS * mockPayoutData.currentPayout).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Daily Production Chart */}
            <Card>
              <CardHeader><CardTitle className="text-lg">Daily Production (Last 30 Days)</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-end h-48 gap-1">
                  {mockDailyProduction.map((day, idx) => (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                      <div className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors" style={{ height: `${(day.totalMS / 350) * 100}%` }} />
                      <div className="hidden group-hover:block absolute bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                        {format(new Date(day.date), 'MMM d')}: {day.totalMS} kg MS
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{format(new Date(mockDailyProduction[0].date), 'MMM d')}</span>
                  <span>{format(new Date(mockDailyProduction[mockDailyProduction.length - 1].date), 'MMM d')}</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Herd Tests Tab */}
          <TabsContent value="herd-tests" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Herd Test Results</CardTitle>
                  <Button><Calendar className="h-4 w-4 mr-2" />Schedule Test</Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Test Date</th>
                      <th className="text-center p-4 text-sm font-medium">Cows Tested</th>
                      <th className="text-center p-4 text-sm font-medium">Avg Yield (L)</th>
                      <th className="text-center p-4 text-sm font-medium">Fat %</th>
                      <th className="text-center p-4 text-sm font-medium">Protein %</th>
                      <th className="text-center p-4 text-sm font-medium">Avg SCC</th>
                      <th className="text-center p-4 text-sm font-medium">Total MS (kg)</th>
                      <th className="text-center p-4 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockHerdTests.map((test, idx) => (
                      <tr key={test.id} className={idx === 0 ? 'bg-blue-50' : 'hover:bg-accent'}>
                        <td className="p-4 font-medium">{format(new Date(test.date), 'MMM d, yyyy')}{idx === 0 && <Badge className="ml-2 bg-blue-100 text-blue-800">Latest</Badge>}</td>
                        <td className="p-4 text-center">{test.cowsTested}</td>
                        <td className="p-4 text-center font-medium">{test.avgMilkYield}</td>
                        <td className="p-4 text-center text-yellow-600 font-medium">{test.avgFat}%</td>
                        <td className="p-4 text-center text-purple-600 font-medium">{test.avgProtein}%</td>
                        <td className={`p-4 text-center font-medium ${getSCCColor(test.avgSCC)}`}>{test.avgSCC}k</td>
                        <td className="p-4 text-center font-bold">{test.totalMS}</td>
                        <td className="p-4 text-center"><Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Individual Cow Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Individual Cow Results - {format(new Date(latestTest.date), 'MMM d, yyyy')}</CardTitle>
                  <Select value={sccFilter} onValueChange={setSccFilter}>
                    <SelectTrigger className="w-[150px]"><SelectValue placeholder="Filter" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cows</SelectItem>
                      <SelectItem value="high">High SCC (&gt;250)</SelectItem>
                      <SelectItem value="watch">Watch (150-250)</SelectItem>
                      <SelectItem value="normal">Normal (&lt;150)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Animal</th>
                      <th className="text-center p-4 text-sm font-medium">Yield (L)</th>
                      <th className="text-center p-4 text-sm font-medium">Fat %</th>
                      <th className="text-center p-4 text-sm font-medium">Protein %</th>
                      <th className="text-center p-4 text-sm font-medium">SCC</th>
                      <th className="text-center p-4 text-sm font-medium">DIM</th>
                      <th className="text-center p-4 text-sm font-medium">Lact #</th>
                      <th className="text-center p-4 text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredCows.map(cow => (
                      <tr key={cow.id} className="hover:bg-accent">
                        <td className="p-4"><p className="font-medium">{cow.tagNumber}</p>{cow.name && <p className="text-xs text-gray-500">{cow.name}</p>}</td>
                        <td className="p-4 text-center font-medium">{cow.milkYield}</td>
                        <td className="p-4 text-center text-yellow-600">{cow.fatPercent}%</td>
                        <td className="p-4 text-center text-purple-600">{cow.proteinPercent}%</td>
                        <td className={`p-4 text-center font-bold ${getSCCColor(cow.scc)}`}>{cow.scc}k</td>
                        <td className="p-4 text-center">{cow.lactationDays}</td>
                        <td className="p-4 text-center">{cow.lactationNumber}</td>
                        <td className="p-4 text-center"><Badge className={getStatusColor(cow.status)}>{cow.status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* SCC Analysis Tab */}
          <TabsContent value="scc" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Current Bulk SCC</p><p className={`text-3xl font-bold ${getSCCColor(mockSCCTrends[mockSCCTrends.length - 1].bulkSCC)}`}>{mockSCCTrends[mockSCCTrends.length - 1].bulkSCC}k</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Season Average</p><p className="text-3xl font-bold">{seasonTotals.avgSCC}k</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">High SCC Cows</p><p className="text-3xl font-bold text-red-600">{highSCCCows}</p><p className="text-xs text-gray-500">&gt;250k cells/ml</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Target</p><p className="text-3xl font-bold text-green-600">&lt;150k</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">SCC Trend (12 Months)</CardTitle></CardHeader>
              <CardContent>
                <div className="relative h-64">
                  {/* Target line */}
                  <div className="absolute left-0 right-0 border-t-2 border-dashed border-green-400" style={{ top: `${100 - (150 / 250) * 100}%` }}>
                    <span className="absolute -top-3 right-0 text-xs text-green-600 bg-white px-1">Target: 150k</span>
                  </div>
                  <div className="flex items-end h-full gap-2">
                    {mockSCCTrends.map((trend, idx) => (
                      <div key={idx} className="flex-1 flex flex-col items-center group relative">
                        <div className={`w-full rounded-t transition-colors ${trend.bulkSCC > 200 ? 'bg-red-500 hover:bg-red-600' : trend.bulkSCC > 150 ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`} style={{ height: `${(trend.bulkSCC / 250) * 100}%` }} />
                        <p className="text-xs mt-1 text-gray-500">{format(new Date(trend.date), 'MMM')}</p>
                        <div className="hidden group-hover:block absolute bottom-full mb-2 bg-gray-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {format(new Date(trend.date), 'MMM yyyy')}: {trend.bulkSCC}k
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">High SCC Cows Requiring Attention</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockCowResults.filter(c => c.scc > 250).map(cow => (
                    <div key={cow.id} className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                      <div>
                        <p className="font-medium">{cow.tagNumber} {cow.name && `(${cow.name})`}</p>
                        <p className="text-sm text-gray-500">Lactation {cow.lactationNumber} • DIM: {cow.lactationDays}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">{cow.scc}k</p>
                        <p className="text-xs text-gray-500">cells/ml</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fat & Protein Tab */}
          <TabsContent value="components" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-yellow-200">
                <CardHeader className="bg-yellow-50"><CardTitle className="text-lg flex items-center gap-2"><Droplets className="h-5 w-5 text-yellow-600" />Fat Analysis</CardTitle></CardHeader>
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <p className="text-5xl font-bold text-yellow-600">{seasonTotals.avgFat}%</p>
                    <p className="text-gray-500">Season Average</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-gray-500">Latest Test</span><span className="font-bold">{latestTest.avgFat}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Previous Test</span><span>{previousTest.avgFat}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Change</span><Badge className={latestTest.avgFat > previousTest.avgFat ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{latestTest.avgFat > previousTest.avgFat ? '+' : ''}{(latestTest.avgFat - previousTest.avgFat).toFixed(2)}%</Badge></div>
                    <div className="flex justify-between"><span className="text-gray-500">Industry Avg</span><span>4.50%</span></div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-200">
                <CardHeader className="bg-purple-50"><CardTitle className="text-lg flex items-center gap-2"><Droplets className="h-5 w-5 text-purple-600" />Protein Analysis</CardTitle></CardHeader>
                <CardContent className="p-6">
                  <div className="text-center mb-6">
                    <p className="text-5xl font-bold text-purple-600">{seasonTotals.avgProtein}%</p>
                    <p className="text-gray-500">Season Average</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between"><span className="text-gray-500">Latest Test</span><span className="font-bold">{latestTest.avgProtein}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Previous Test</span><span>{previousTest.avgProtein}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Change</span><Badge className={latestTest.avgProtein > previousTest.avgProtein ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{latestTest.avgProtein > previousTest.avgProtein ? '+' : ''}{(latestTest.avgProtein - previousTest.avgProtein).toFixed(2)}%</Badge></div>
                    <div className="flex justify-between"><span className="text-gray-500">Industry Avg</span><span>3.70%</span></div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Component Trends</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockHerdTests.map((test, idx) => (
                    <div key={test.id} className="flex items-center gap-4">
                      <span className="w-24 text-sm text-gray-500">{format(new Date(test.date), 'MMM yyyy')}</span>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden flex">
                          <div className="bg-yellow-500 h-full flex items-center justify-center text-xs text-white font-medium" style={{ width: `${(test.avgFat / 6) * 100}%` }}>{test.avgFat}%</div>
                        </div>
                        <span className="text-xs text-yellow-600 w-8">Fat</span>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden flex">
                          <div className="bg-purple-500 h-full flex items-center justify-center text-xs text-white font-medium" style={{ width: `${(test.avgProtein / 5) * 100}%` }}>{test.avgProtein}%</div>
                        </div>
                        <span className="text-xs text-purple-600 w-12">Protein</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payout Calculator Tab */}
          <TabsContent value="payout" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" />Payout Calculator</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label>Milk Price ($/kg MS)</Label>
                      <Input type="number" step="0.01" value={payoutPrice} onChange={e => setPayoutPrice(e.target.value)} />
                    </div>
                    <div>
                      <Label>Estimated Season MS (kg)</Label>
                      <Input type="number" value={estimatedMS} onChange={e => setEstimatedMS(e.target.value)} />
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Estimated Payout</p>
                      <p className="text-4xl font-bold text-green-700">${calculatePayout()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg">Current Pricing</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-600">Base Price</span>
                        <span className="text-2xl font-bold text-blue-700">${mockPayoutData.basePrice}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Fat</p>
                        <p className="font-bold">${mockPayoutData.fatPrice}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Protein</p>
                        <p className="font-bold">${mockPayoutData.proteinPrice}</p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-500">Volume</p>
                        <p className="font-bold">${mockPayoutData.volumePrice}</p>
                      </div>
                    </div>
                    <div className="pt-4 border-t">
                      <div className="flex justify-between"><span className="text-gray-500">Current Payout</span><span className="font-bold">${mockPayoutData.currentPayout}/kg MS</span></div>
                      <div className="flex justify-between mt-2"><span className="text-gray-500">Forecast Payout</span><span className="font-bold text-green-600">${mockPayoutData.forecastPayout}/kg MS</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Payout Scenarios</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { scenario: 'Conservative', price: 7.20, ms: 78000 },
                    { scenario: 'Expected', price: 7.80, ms: 82000 },
                    { scenario: 'Optimistic', price: 8.20, ms: 85000 },
                  ].map(s => (
                    <div key={s.scenario} className="p-4 border rounded-lg">
                      <h4 className="font-medium mb-3">{s.scenario}</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Price</span><span>${s.price}/kg</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">MS</span><span>{s.ms.toLocaleString()} kg</span></div>
                        <div className="flex justify-between font-bold border-t pt-2"><span>Payout</span><span className="text-green-600">${(s.price * s.ms).toLocaleString()}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Forecasting Tab */}
          <TabsContent value="forecast" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Predicted Season Total</p><p className="text-3xl font-bold">{(seasonTotals.targetMS / 1000).toFixed(1)}k kg</p><p className="text-xs text-gray-500">MS</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Remaining to Produce</p><p className="text-3xl font-bold text-blue-600">{((seasonTotals.targetMS - seasonTotals.totalMS) / 1000).toFixed(1)}k kg</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Forecast Accuracy</p><p className="text-3xl font-bold text-green-600">94%</p><p className="text-xs text-gray-500">based on historical data</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Monthly Production Forecast</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockForecast.map((month, idx) => (
                    <div key={idx} className="flex items-center gap-4">
                      <span className="w-24 font-medium">{month.month}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Progress value={month.actualMS ? (month.actualMS / month.predictedMS) * 100 : 0} className="h-4 flex-1" />
                          <span className="text-sm font-medium w-20">{(month.predictedMS / 1000).toFixed(1)}k kg</span>
                        </div>
                        {month.actualMS && (
                          <p className="text-xs text-gray-500">Actual: {(month.actualMS / 1000).toFixed(1)}k kg ({month.actualMS > month.predictedMS ? '+' : ''}{((month.actualMS - month.predictedMS) / month.predictedMS * 100).toFixed(1)}%)</p>
                        )}
                      </div>
                      <Badge className={month.confidence >= 90 ? 'bg-green-100 text-green-800' : month.confidence >= 80 ? 'bg-yellow-100 text-yellow-800' : 'bg-orange-100 text-orange-800'}>{month.confidence}% conf</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Factors Affecting Forecast</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { factor: 'Pasture Growth', impact: 'positive', description: 'Above average GDD accumulation' },
                    { factor: 'Herd Health', impact: 'neutral', description: 'SCC slightly elevated but stable' },
                    { factor: 'Weather Outlook', impact: 'negative', description: 'Dry conditions forecast' },
                    { factor: 'Cow Numbers', impact: 'positive', description: '5 more cows than last season' },
                  ].map((f, idx) => (
                    <div key={idx} className={`p-4 rounded-lg border-2 ${f.impact === 'positive' ? 'border-green-200 bg-green-50' : f.impact === 'negative' ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{f.factor}</span>
                        {f.impact === 'positive' && <ArrowUpRight className="h-5 w-5 text-green-600" />}
                        {f.impact === 'negative' && <ArrowDownRight className="h-5 w-5 text-red-600" />}
                        {f.impact === 'neutral' && <Minus className="h-5 w-5 text-gray-400" />}
                      </div>
                      <p className="text-sm text-gray-600">{f.description}</p>
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
