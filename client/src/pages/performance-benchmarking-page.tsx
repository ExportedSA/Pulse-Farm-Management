import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Target, TrendingUp, TrendingDown, BarChart3, Award, Medal, Trophy,
  ArrowUpRight, ArrowDownRight, Minus, Calendar, Download, Settings,
  CheckCircle2, AlertTriangle, Info, ChevronRight, Star, Zap,
  Milk, Beef, Heart, Baby, Scale, DollarSign, Leaf, Activity,
  Users, ThermometerSun, Droplets, Clock, MapPin
} from 'lucide-react';

// Interfaces
interface KPI {
  id: string;
  name: string;
  category: string;
  unit: string;
  current: number;
  target: number;
  lastYear: number;
  regionalAvg: number;
  nationalAvg: number;
  topPerformer: number;
  percentile: number;
  trend: 'up' | 'down' | 'stable';
  icon: string;
}

interface SeasonData {
  season: string;
  milkProduction: number;
  reproRate: number;
  calvingRate: number;
  deathRate: number;
  costPerKg: number;
  revenuePerHa: number;
}

interface PerformanceScore {
  category: string;
  score: number;
  maxScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  metrics: { name: string; score: number; max: number }[];
}

// Mock Data
const mockKPIs: KPI[] = [
  { id: 'milk-production', name: 'Milk Solids Production', category: 'Production', unit: 'kg MS/cow', current: 420, target: 450, lastYear: 395, regionalAvg: 410, nationalAvg: 405, topPerformer: 520, percentile: 62, trend: 'up', icon: 'milk' },
  { id: 'milk-per-ha', name: 'Milk Solids per Hectare', category: 'Production', unit: 'kg MS/ha', current: 1180, target: 1250, lastYear: 1120, regionalAvg: 1150, nationalAvg: 1100, topPerformer: 1450, percentile: 58, trend: 'up', icon: 'milk' },
  { id: 'repro-rate', name: '6-Week In-Calf Rate', category: 'Reproduction', unit: '%', current: 68, target: 78, lastYear: 64, regionalAvg: 70, nationalAvg: 68, topPerformer: 85, percentile: 48, trend: 'up', icon: 'heart' },
  { id: 'submission-rate', name: '21-Day Submission Rate', category: 'Reproduction', unit: '%', current: 82, target: 90, lastYear: 78, regionalAvg: 85, nationalAvg: 83, topPerformer: 95, percentile: 42, trend: 'up', icon: 'heart' },
  { id: 'calving-rate', name: 'Calving Rate', category: 'Reproduction', unit: '%', current: 88, target: 92, lastYear: 86, regionalAvg: 89, nationalAvg: 88, topPerformer: 95, percentile: 50, trend: 'up', icon: 'baby' },
  { id: 'empty-rate', name: 'Empty Rate', category: 'Reproduction', unit: '%', current: 12, target: 8, lastYear: 14, regionalAvg: 11, nationalAvg: 12, topPerformer: 5, percentile: 55, trend: 'up', icon: 'heart' },
  { id: 'death-rate', name: 'Death Rate', category: 'Animal Health', unit: '%', current: 2.8, target: 2.0, lastYear: 3.2, regionalAvg: 2.5, nationalAvg: 2.8, topPerformer: 1.5, percentile: 45, trend: 'up', icon: 'activity' },
  { id: 'somatic-cell', name: 'Bulk Milk SCC', category: 'Animal Health', unit: '000/ml', current: 165, target: 150, lastYear: 180, regionalAvg: 170, nationalAvg: 175, topPerformer: 120, percentile: 58, trend: 'up', icon: 'activity' },
  { id: 'lame-rate', name: 'Lameness Rate', category: 'Animal Health', unit: '%', current: 8, target: 5, lastYear: 10, regionalAvg: 7, nationalAvg: 8, topPerformer: 3, percentile: 48, trend: 'up', icon: 'activity' },
  { id: 'cost-per-kg', name: 'Cost of Production', category: 'Financial', unit: '$/kg MS', current: 4.85, target: 4.50, lastYear: 5.10, regionalAvg: 4.90, nationalAvg: 5.00, topPerformer: 3.80, percentile: 55, trend: 'up', icon: 'dollar' },
  { id: 'revenue-per-ha', name: 'Revenue per Hectare', category: 'Financial', unit: '$/ha', current: 4250, target: 4500, lastYear: 3980, regionalAvg: 4100, nationalAvg: 4000, topPerformer: 5500, percentile: 60, trend: 'up', icon: 'dollar' },
  { id: 'gross-margin', name: 'Gross Margin', category: 'Financial', unit: '$/cow', current: 1850, target: 2000, lastYear: 1720, regionalAvg: 1800, nationalAvg: 1750, topPerformer: 2400, percentile: 58, trend: 'up', icon: 'dollar' },
  { id: 'pasture-eaten', name: 'Pasture Eaten', category: 'Feed & Pasture', unit: 't DM/ha', current: 12.5, target: 14.0, lastYear: 11.8, regionalAvg: 12.0, nationalAvg: 11.5, topPerformer: 16.0, percentile: 62, trend: 'up', icon: 'leaf' },
  { id: 'supplement-rate', name: 'Supplement Fed', category: 'Feed & Pasture', unit: 'kg DM/cow', current: 850, target: 800, lastYear: 920, regionalAvg: 900, nationalAvg: 950, topPerformer: 600, percentile: 65, trend: 'up', icon: 'leaf' },
  { id: 'stocking-rate', name: 'Stocking Rate', category: 'Feed & Pasture', unit: 'cows/ha', current: 2.8, target: 2.9, lastYear: 2.7, regionalAvg: 2.8, nationalAvg: 2.7, topPerformer: 3.2, percentile: 55, trend: 'stable', icon: 'users' },
];

const mockSeasonData: SeasonData[] = [
  { season: '2023-24', milkProduction: 420, reproRate: 68, calvingRate: 88, deathRate: 2.8, costPerKg: 4.85, revenuePerHa: 4250 },
  { season: '2022-23', milkProduction: 395, reproRate: 64, calvingRate: 86, deathRate: 3.2, costPerKg: 5.10, revenuePerHa: 3980 },
  { season: '2021-22', milkProduction: 385, reproRate: 62, calvingRate: 85, deathRate: 3.5, costPerKg: 4.95, revenuePerHa: 3850 },
  { season: '2020-21', milkProduction: 378, reproRate: 60, calvingRate: 84, deathRate: 3.8, costPerKg: 4.80, revenuePerHa: 3720 },
  { season: '2019-20', milkProduction: 365, reproRate: 58, calvingRate: 82, deathRate: 4.0, costPerKg: 4.70, revenuePerHa: 3580 },
];

const mockPerformanceScores: PerformanceScore[] = [
  { category: 'Production', score: 78, maxScore: 100, grade: 'B', metrics: [{ name: 'Milk Solids/Cow', score: 82, max: 100 }, { name: 'Milk Solids/Ha', score: 75, max: 100 }, { name: 'Production Efficiency', score: 77, max: 100 }] },
  { category: 'Reproduction', score: 65, maxScore: 100, grade: 'C', metrics: [{ name: 'In-Calf Rate', score: 62, max: 100 }, { name: 'Submission Rate', score: 68, max: 100 }, { name: 'Empty Rate', score: 65, max: 100 }] },
  { category: 'Animal Health', score: 72, maxScore: 100, grade: 'B', metrics: [{ name: 'Death Rate', score: 70, max: 100 }, { name: 'SCC', score: 75, max: 100 }, { name: 'Lameness', score: 71, max: 100 }] },
  { category: 'Financial', score: 70, maxScore: 100, grade: 'B', metrics: [{ name: 'Cost of Production', score: 68, max: 100 }, { name: 'Revenue/Ha', score: 72, max: 100 }, { name: 'Gross Margin', score: 70, max: 100 }] },
  { category: 'Feed & Pasture', score: 74, maxScore: 100, grade: 'B', metrics: [{ name: 'Pasture Eaten', score: 78, max: 100 }, { name: 'Supplement Efficiency', score: 72, max: 100 }, { name: 'Stocking Rate', score: 72, max: 100 }] },
];

export default function PerformanceBenchmarkingPage() {
  const [activeTab, setActiveTab] = useState('scorecard');
  const [selectedRegion, setSelectedRegion] = useState('waikato');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSetTargetOpen, setIsSetTargetOpen] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState<KPI | null>(null);

  // Fetch benchmarking data from API
  const { data: benchmarkingData, isLoading } = useQuery({
    queryKey: ['/api/benchmarking/dashboard', selectedRegion],
    queryFn: async () => {
      const res = await fetch(`/api/benchmarking/dashboard?region=${selectedRegion}`);
      if (!res.ok) throw new Error('Failed to fetch benchmarking data');
      return res.json();
    },
  });

  const { data: yoyData } = useQuery({
    queryKey: ['/api/benchmarking/yoy-comparison'],
    queryFn: async () => {
      const res = await fetch('/api/benchmarking/yoy-comparison?years=3');
      if (!res.ok) throw new Error('Failed to fetch YoY data');
      return res.json();
    },
  });

  // Calculate overall score - use API data if available
  const overallScore = benchmarkingData?.rankings?.overall?.percentile || 
    Math.round(mockPerformanceScores.reduce((s, p) => s + p.score, 0) / mockPerformanceScores.length);
  const overallGrade = overallScore >= 85 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 55 ? 'C' : overallScore >= 40 ? 'D' : 'F';

  // Filter KPIs
  const filteredKPIs = selectedCategory === 'all' ? mockKPIs : mockKPIs.filter(k => k.category === selectedCategory);
  const categories = Array.from(new Set(mockKPIs.map(k => k.category)));

  const getKPIIcon = (icon: string) => {
    switch (icon) {
      case 'milk': return <Milk className="h-5 w-5" />;
      case 'heart': return <Heart className="h-5 w-5" />;
      case 'baby': return <Baby className="h-5 w-5" />;
      case 'activity': return <Activity className="h-5 w-5" />;
      case 'dollar': return <DollarSign className="h-5 w-5" />;
      case 'leaf': return <Leaf className="h-5 w-5" />;
      case 'users': return <Users className="h-5 w-5" />;
      default: return <Target className="h-5 w-5" />;
    }
  };

  const getPercentileColor = (percentile: number) => {
    if (percentile >= 75) return 'text-green-600 bg-green-100';
    if (percentile >= 50) return 'text-blue-600 bg-blue-100';
    if (percentile >= 25) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getPercentileLabel = (percentile: number) => {
    if (percentile >= 90) return 'Top 10%';
    if (percentile >= 75) return 'Top 25%';
    if (percentile >= 50) return 'Above Average';
    if (percentile >= 25) return 'Below Average';
    return 'Bottom 25%';
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return 'bg-green-500';
      case 'B': return 'bg-blue-500';
      case 'C': return 'bg-yellow-500';
      case 'D': return 'bg-orange-500';
      default: return 'bg-red-500';
    }
  };

  const getTrendIcon = (trend: string, isLowerBetter: boolean = false) => {
    if (trend === 'up') return isLowerBetter ? <ArrowDownRight className="h-4 w-4 text-green-600" /> : <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (trend === 'down') return isLowerBetter ? <ArrowUpRight className="h-4 w-4 text-red-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const calculateTargetProgress = (current: number, target: number, isLowerBetter: boolean = false) => {
    if (isLowerBetter) {
      if (current <= target) return 100;
      return Math.max(0, 100 - ((current - target) / target) * 100);
    }
    return Math.min(100, (current / target) * 100);
  };

  const isLowerBetter = (kpiId: string) => ['empty-rate', 'death-rate', 'somatic-cell', 'lame-rate', 'cost-per-kg', 'supplement-rate'].includes(kpiId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Trophy className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Performance Benchmarking</h1>
                <p className="text-sm text-gray-500">Track KPIs, compare to industry, and set targets</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="waikato">Waikato</SelectItem>
                  <SelectItem value="taranaki">Taranaki</SelectItem>
                  <SelectItem value="canterbury">Canterbury</SelectItem>
                  <SelectItem value="southland">Southland</SelectItem>
                  <SelectItem value="national">National</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
              <Button variant="outline"><Settings className="h-4 w-4 mr-2" />Settings</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="scorecard">Performance Scorecard</TabsTrigger>
            <TabsTrigger value="kpis">KPI Dashboard</TabsTrigger>
            <TabsTrigger value="targets">Targets vs Actual</TabsTrigger>
            <TabsTrigger value="benchmarks">Industry Benchmarks</TabsTrigger>
            <TabsTrigger value="trends">Year-over-Year</TabsTrigger>
          </TabsList>

          {/* Performance Scorecard Tab */}
          <TabsContent value="scorecard" className="space-y-6">
            {/* Overall Score */}
            <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className={`w-24 h-24 rounded-full ${getGradeColor(overallGrade)} flex items-center justify-center`}>
                      <span className="text-4xl font-bold text-white">{overallGrade}</span>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold">Overall Performance Score</h2>
                      <p className="text-4xl font-bold text-amber-600">{overallScore}/100</p>
                      <p className="text-sm text-gray-600 mt-1">Based on 5 categories and 15 KPIs</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-blue-100 text-blue-800 text-lg px-4 py-2">
                      <Medal className="h-5 w-5 mr-2 inline" />
                      {overallScore >= 75 ? 'Top Performer' : overallScore >= 50 ? 'Above Average' : 'Developing'}
                    </Badge>
                    <p className="text-sm text-gray-500 mt-2">Industry Percentile: {Math.round((overallScore / 100) * 75 + 25)}th</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category Scores */}
            <div className="grid md:grid-cols-5 gap-4">
              {mockPerformanceScores.map(cat => (
                <Card key={cat.category} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">{cat.category}</span>
                      <div className={`w-8 h-8 rounded-full ${getGradeColor(cat.grade)} flex items-center justify-center`}>
                        <span className="text-sm font-bold text-white">{cat.grade}</span>
                      </div>
                    </div>
                    <div className="text-3xl font-bold mb-2">{cat.score}</div>
                    <Progress value={cat.score} className="h-2 mb-3" />
                    <div className="space-y-1">
                      {cat.metrics.map(m => (
                        <div key={m.name} className="flex justify-between text-xs">
                          <span className="text-gray-500 truncate">{m.name}</span>
                          <span className="font-medium">{m.score}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-green-600">
                    <Star className="h-5 w-5" />
                    Top Strengths
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockKPIs.filter(k => k.percentile >= 60).slice(0, 5).map(kpi => (
                      <div key={kpi.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded">{getKPIIcon(kpi.icon)}</div>
                          <div>
                            <p className="font-medium text-sm">{kpi.name}</p>
                            <p className="text-xs text-gray-500">{kpi.current} {kpi.unit}</p>
                          </div>
                        </div>
                        <Badge className={getPercentileColor(kpi.percentile)}>{kpi.percentile}th %ile</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2 text-orange-600">
                    <Zap className="h-5 w-5" />
                    Priority Improvements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockKPIs.filter(k => k.percentile < 55).slice(0, 5).map(kpi => (
                      <div key={kpi.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded">{getKPIIcon(kpi.icon)}</div>
                          <div>
                            <p className="font-medium text-sm">{kpi.name}</p>
                            <p className="text-xs text-gray-500">Current: {kpi.current} → Target: {kpi.target} {kpi.unit}</p>
                          </div>
                        </div>
                        <Badge className="bg-orange-100 text-orange-800">{kpi.percentile}th %ile</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* KPI Dashboard Tab */}
          <TabsContent value="kpis" className="space-y-6">
            <div className="flex gap-4 mb-4">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filter by category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (<SelectItem key={cat} value={cat}>{cat}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredKPIs.map(kpi => {
                const lowerBetter = isLowerBetter(kpi.id);
                const progress = calculateTargetProgress(kpi.current, kpi.target, lowerBetter);
                const vsLastYear = lowerBetter ? kpi.lastYear - kpi.current : kpi.current - kpi.lastYear;
                const vsLastYearPct = (vsLastYear / kpi.lastYear) * 100;
                return (
                  <Card key={kpi.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded ${getPercentileColor(kpi.percentile)}`}>{getKPIIcon(kpi.icon)}</div>
                          <div>
                            <p className="font-medium text-sm">{kpi.name}</p>
                            <p className="text-xs text-gray-500">{kpi.category}</p>
                          </div>
                        </div>
                        <Badge className={getPercentileColor(kpi.percentile)}>{getPercentileLabel(kpi.percentile)}</Badge>
                      </div>
                      <div className="flex items-end justify-between mb-2">
                        <div>
                          <p className="text-3xl font-bold">{kpi.current}</p>
                          <p className="text-xs text-gray-500">{kpi.unit}</p>
                        </div>
                        <div className="text-right">
                          <div className={`flex items-center gap-1 ${vsLastYear >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {getTrendIcon(kpi.trend, lowerBetter)}
                            <span className="text-sm font-medium">{vsLastYear >= 0 ? '+' : ''}{vsLastYearPct.toFixed(1)}%</span>
                          </div>
                          <p className="text-xs text-gray-500">vs last year</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>Target: {kpi.target}</span>
                          <span>{progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={progress} className={`h-2 ${progress >= 100 ? '[&>div]:bg-green-500' : progress >= 80 ? '[&>div]:bg-blue-500' : '[&>div]:bg-orange-500'}`} />
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t text-xs">
                        <div className="text-center"><p className="text-gray-500">Regional</p><p className="font-medium">{kpi.regionalAvg}</p></div>
                        <div className="text-center"><p className="text-gray-500">National</p><p className="font-medium">{kpi.nationalAvg}</p></div>
                        <div className="text-center"><p className="text-gray-500">Top 10%</p><p className="font-medium text-green-600">{kpi.topPerformer}</p></div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Targets vs Actual Tab */}
          <TabsContent value="targets" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Target vs Actual Performance</h2>
              <Dialog open={isSetTargetOpen} onOpenChange={setIsSetTargetOpen}>
                <DialogTrigger asChild><Button><Target className="h-4 w-4 mr-2" />Set Targets</Button></DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>Set Farm Targets</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    {categories.map(cat => (
                      <div key={cat}>
                        <h4 className="font-medium mb-2">{cat}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {mockKPIs.filter(k => k.category === cat).map(kpi => (
                            <div key={kpi.id} className="flex items-center gap-2">
                              <Label className="flex-1 text-sm">{kpi.name}</Label>
                              <Input type="number" defaultValue={kpi.target} className="w-24" />
                              <span className="text-xs text-gray-500 w-16">{kpi.unit}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsSetTargetOpen(false)}>Cancel</Button><Button onClick={() => { setIsSetTargetOpen(false); toast.success('Targets updated'); }}>Save Targets</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">KPI</th>
                      <th className="text-right p-4 text-sm font-medium">Target</th>
                      <th className="text-right p-4 text-sm font-medium">Actual</th>
                      <th className="text-right p-4 text-sm font-medium">Variance</th>
                      <th className="text-center p-4 text-sm font-medium">Progress</th>
                      <th className="text-center p-4 text-sm font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockKPIs.map(kpi => {
                      const lowerBetter = isLowerBetter(kpi.id);
                      const variance = lowerBetter ? kpi.target - kpi.current : kpi.current - kpi.target;
                      const variancePct = (variance / kpi.target) * 100;
                      const progress = calculateTargetProgress(kpi.current, kpi.target, lowerBetter);
                      const onTrack = progress >= 90;
                      return (
                        <tr key={kpi.id} className="hover:bg-accent">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-gray-100 rounded">{getKPIIcon(kpi.icon)}</div>
                              <div><p className="font-medium text-sm">{kpi.name}</p><p className="text-xs text-gray-500">{kpi.category}</p></div>
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium">{kpi.target} <span className="text-xs text-gray-500">{kpi.unit}</span></td>
                          <td className="p-4 text-right font-bold">{kpi.current} <span className="text-xs text-gray-500">{kpi.unit}</span></td>
                          <td className={`p-4 text-right font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)} ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(1)}%)</td>
                          <td className="p-4"><div className="w-full max-w-[100px] mx-auto"><Progress value={progress} className={`h-2 ${progress >= 100 ? '[&>div]:bg-green-500' : progress >= 80 ? '[&>div]:bg-blue-500' : '[&>div]:bg-orange-500'}`} /></div></td>
                          <td className="p-4 text-center">{onTrack ? <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />On Track</Badge> : <Badge className="bg-orange-100 text-orange-800"><AlertTriangle className="h-3 w-3 mr-1" />Behind</Badge>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Industry Benchmarks Tab */}
          <TabsContent value="benchmarks" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Your Avg Percentile</p><p className="text-3xl font-bold text-blue-700">{Math.round(mockKPIs.reduce((s, k) => s + k.percentile, 0) / mockKPIs.length)}th</p></CardContent></Card>
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Above Regional Avg</p><p className="text-3xl font-bold text-green-700">{mockKPIs.filter(k => isLowerBetter(k.id) ? k.current < k.regionalAvg : k.current > k.regionalAvg).length}/{mockKPIs.length}</p></CardContent></Card>
              <Card className="bg-purple-50"><CardContent className="p-4 text-center"><p className="text-sm text-purple-600">Above National Avg</p><p className="text-3xl font-bold text-purple-700">{mockKPIs.filter(k => isLowerBetter(k.id) ? k.current < k.nationalAvg : k.current > k.nationalAvg).length}/{mockKPIs.length}</p></CardContent></Card>
              <Card className="bg-amber-50"><CardContent className="p-4 text-center"><p className="text-sm text-amber-600">Top 25% KPIs</p><p className="text-3xl font-bold text-amber-700">{mockKPIs.filter(k => k.percentile >= 75).length}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Industry Comparison - {selectedRegion.charAt(0).toUpperCase() + selectedRegion.slice(1)} Region</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">KPI</th>
                      <th className="text-right p-4 text-sm font-medium">Your Farm</th>
                      <th className="text-right p-4 text-sm font-medium">Regional Avg</th>
                      <th className="text-right p-4 text-sm font-medium">National Avg</th>
                      <th className="text-right p-4 text-sm font-medium">Top 10%</th>
                      <th className="text-center p-4 text-sm font-medium">Percentile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockKPIs.map(kpi => {
                      const lowerBetter = isLowerBetter(kpi.id);
                      const vsRegional = lowerBetter ? kpi.regionalAvg - kpi.current : kpi.current - kpi.regionalAvg;
                      return (
                        <tr key={kpi.id} className="hover:bg-accent">
                          <td className="p-4"><div className="flex items-center gap-2">{getKPIIcon(kpi.icon)}<span className="font-medium text-sm">{kpi.name}</span></div></td>
                          <td className={`p-4 text-right font-bold ${vsRegional >= 0 ? 'text-green-600' : 'text-red-600'}`}>{kpi.current}</td>
                          <td className="p-4 text-right text-gray-600">{kpi.regionalAvg}</td>
                          <td className="p-4 text-right text-gray-600">{kpi.nationalAvg}</td>
                          <td className="p-4 text-right text-green-600 font-medium">{kpi.topPerformer}</td>
                          <td className="p-4 text-center"><Badge className={getPercentileColor(kpi.percentile)}>{kpi.percentile}th</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Percentile Distribution</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 bg-red-50 rounded-lg text-center border-2 border-red-200">
                    <p className="text-sm text-red-600 mb-2">Bottom 25%</p>
                    <p className="text-3xl font-bold text-red-700">{mockKPIs.filter(k => k.percentile < 25).length}</p>
                    <p className="text-xs text-red-500">KPIs</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg text-center border-2 border-yellow-200">
                    <p className="text-sm text-yellow-600 mb-2">25th-50th</p>
                    <p className="text-3xl font-bold text-yellow-700">{mockKPIs.filter(k => k.percentile >= 25 && k.percentile < 50).length}</p>
                    <p className="text-xs text-yellow-500">KPIs</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg text-center border-2 border-blue-200">
                    <p className="text-sm text-blue-600 mb-2">50th-75th</p>
                    <p className="text-3xl font-bold text-blue-700">{mockKPIs.filter(k => k.percentile >= 50 && k.percentile < 75).length}</p>
                    <p className="text-xs text-blue-500">KPIs</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg text-center border-2 border-green-200">
                    <p className="text-sm text-green-600 mb-2">Top 25%</p>
                    <p className="text-3xl font-bold text-green-700">{mockKPIs.filter(k => k.percentile >= 75).length}</p>
                    <p className="text-xs text-green-500">KPIs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Year-over-Year Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">5-Year Performance Trends</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-4 text-sm font-medium">Season</th>
                      <th className="text-right p-4 text-sm font-medium">Milk Production<br/><span className="text-xs text-gray-400">kg MS/cow</span></th>
                      <th className="text-right p-4 text-sm font-medium">6-Wk In-Calf<br/><span className="text-xs text-gray-400">%</span></th>
                      <th className="text-right p-4 text-sm font-medium">Calving Rate<br/><span className="text-xs text-gray-400">%</span></th>
                      <th className="text-right p-4 text-sm font-medium">Death Rate<br/><span className="text-xs text-gray-400">%</span></th>
                      <th className="text-right p-4 text-sm font-medium">Cost/kg MS<br/><span className="text-xs text-gray-400">$</span></th>
                      <th className="text-right p-4 text-sm font-medium">Revenue/Ha<br/><span className="text-xs text-gray-400">$</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mockSeasonData.map((season, idx) => {
                      const prev = mockSeasonData[idx + 1];
                      return (
                        <tr key={season.season} className={idx === 0 ? 'bg-blue-50' : 'hover:bg-accent'}>
                          <td className="p-4 font-medium">{season.season} {idx === 0 && <Badge className="ml-2 bg-blue-100 text-blue-800">Current</Badge>}</td>
                          <td className="p-4 text-right">{season.milkProduction} {prev && <span className={season.milkProduction > prev.milkProduction ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>({season.milkProduction > prev.milkProduction ? '+' : ''}{((season.milkProduction - prev.milkProduction) / prev.milkProduction * 100).toFixed(1)}%)</span>}</td>
                          <td className="p-4 text-right">{season.reproRate}% {prev && <span className={season.reproRate > prev.reproRate ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>({season.reproRate > prev.reproRate ? '+' : ''}{(season.reproRate - prev.reproRate).toFixed(0)}pp)</span>}</td>
                          <td className="p-4 text-right">{season.calvingRate}%</td>
                          <td className="p-4 text-right">{season.deathRate}% {prev && <span className={season.deathRate < prev.deathRate ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>({season.deathRate < prev.deathRate ? '' : '+'}{(season.deathRate - prev.deathRate).toFixed(1)}pp)</span>}</td>
                          <td className="p-4 text-right">${season.costPerKg.toFixed(2)} {prev && <span className={season.costPerKg < prev.costPerKg ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>({season.costPerKg < prev.costPerKg ? '' : '+'}${(season.costPerKg - prev.costPerKg).toFixed(2)})</span>}</td>
                          <td className="p-4 text-right">${season.revenuePerHa.toLocaleString()} {prev && <span className={season.revenuePerHa > prev.revenuePerHa ? 'text-green-600 text-xs' : 'text-red-600 text-xs'}>({season.revenuePerHa > prev.revenuePerHa ? '+' : ''}{((season.revenuePerHa - prev.revenuePerHa) / prev.revenuePerHa * 100).toFixed(1)}%)</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg text-green-600">5-Year Improvements</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { metric: 'Milk Production', start: 365, end: 420, unit: 'kg MS/cow' },
                      { metric: '6-Week In-Calf Rate', start: 58, end: 68, unit: '%' },
                      { metric: 'Revenue per Hectare', start: 3580, end: 4250, unit: '$' },
                    ].map(item => {
                      const change = ((item.end - item.start) / item.start) * 100;
                      return (
                        <div key={item.metric} className="p-4 bg-green-50 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{item.metric}</span>
                            <Badge className="bg-green-100 text-green-800">+{change.toFixed(1)}%</Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-gray-500">{item.start} {item.unit}</span>
                            <ChevronRight className="h-4 w-4 text-green-600" />
                            <span className="font-bold text-green-600">{item.end} {item.unit}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-lg text-orange-600">Areas Still Developing</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { metric: 'Death Rate', start: 4.0, end: 2.8, target: 2.0, unit: '%', improved: true },
                      { metric: 'Cost of Production', start: 4.70, end: 4.85, target: 4.50, unit: '$/kg', improved: false },
                    ].map(item => (
                      <div key={item.metric} className="p-4 bg-orange-50 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-medium">{item.metric}</span>
                          <Badge className="bg-orange-100 text-orange-800">Target: {item.target}{item.unit}</Badge>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-gray-500">{item.start}{item.unit} (2019)</span>
                          <ChevronRight className="h-4 w-4" />
                          <span className={item.improved ? 'text-green-600' : 'text-orange-600'}>{item.end}{item.unit} (now)</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">{item.improved ? 'Improving but not yet at target' : 'Needs focus to reach target'}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
