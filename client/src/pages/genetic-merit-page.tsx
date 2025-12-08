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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line,
  ScatterChart, Scatter, ZAxis
} from 'recharts';
import {
  Dna, TrendingUp, TrendingDown, Award, Target, Calculator, Search,
  Filter, Download, RefreshCw, Info, ChevronRight, Star, Zap,
  ArrowUpRight, ArrowDownRight, Minus, Users, Heart, Milk, Scale
} from 'lucide-react';

// Types
interface AnimalGenetics {
  id: string;
  tagId: string;
  name: string;
  breed: string;
  birthDate: string;
  sireCode?: string;
  sireName?: string;
  damId?: string;
  damName?: string;
  breedingWorth: number;
  productionWorth: number;
  lactationWorth: number;
  reliability: number;
  milkBV: number;
  fatBV: number;
  proteinBV: number;
  somaticCellBV: number;
  fertilityBV: number;
  liveweightBV: number;
  bcsEBV?: number;
  adaptabilityEBV?: number;
  shedTemperamentEBV?: number;
  milkingSpeedEBV?: number;
  lastUpdated: string;
}

interface HerdGeneticSummary {
  averageBW: number;
  averagePW: number;
  averageLW: number;
  topQuartileBW: number;
  bottomQuartileBW: number;
  geneticTrend: { year: string; bw: number; pw: number }[];
  breedComposition: { breed: string; percentage: number }[];
}

interface SireRecommendation {
  sireCode: string;
  sireName: string;
  breed: string;
  breedingWorth: number;
  productionWorth: number;
  reliability: number;
  matchScore: number;
  strengths: string[];
  considerations: string[];
}

// Mock data
const mockAnimals: AnimalGenetics[] = [
  { id: '1', tagId: 'A001', name: 'Bella', breed: 'Friesian', birthDate: '2020-08-15', sireCode: 'LIC001', sireName: 'Donaghys Dozer', breedingWorth: 245, productionWorth: 285, lactationWorth: 320, reliability: 85, milkBV: 720, fatBV: 38, proteinBV: 32, somaticCellBV: -0.18, fertilityBV: 4.5, liveweightBV: 28, lastUpdated: '2024-12-01' },
  { id: '2', tagId: 'A002', name: 'Daisy', breed: 'Jersey', birthDate: '2021-07-20', sireCode: 'LIC002', sireName: 'Greenwell Donalds', breedingWorth: 198, productionWorth: 220, lactationWorth: 265, reliability: 78, milkBV: 480, fatBV: 52, proteinBV: 45, somaticCellBV: -0.22, fertilityBV: 5.2, liveweightBV: 15, lastUpdated: '2024-12-01' },
  { id: '3', tagId: 'A003', name: 'Rosie', breed: 'Crossbred', birthDate: '2019-09-10', sireCode: 'LIC003', sireName: 'Meander Donut', breedingWorth: 275, productionWorth: 310, lactationWorth: 345, reliability: 92, milkBV: 650, fatBV: 45, proteinBV: 38, somaticCellBV: -0.15, fertilityBV: 5.8, liveweightBV: 22, lastUpdated: '2024-12-01' },
  { id: '4', tagId: 'A004', name: 'Molly', breed: 'Friesian', birthDate: '2020-08-25', sireCode: 'LIC001', sireName: 'Donaghys Dozer', breedingWorth: 232, productionWorth: 268, lactationWorth: 298, reliability: 82, milkBV: 695, fatBV: 35, proteinBV: 30, somaticCellBV: -0.12, fertilityBV: 4.2, liveweightBV: 32, lastUpdated: '2024-12-01' },
  { id: '5', tagId: 'A005', name: 'Lucy', breed: 'Jersey', birthDate: '2021-08-05', sireCode: 'LIC002', sireName: 'Greenwell Donalds', breedingWorth: 210, productionWorth: 235, lactationWorth: 278, reliability: 75, milkBV: 510, fatBV: 55, proteinBV: 48, somaticCellBV: -0.25, fertilityBV: 5.5, liveweightBV: 12, lastUpdated: '2024-12-01' },
  { id: '6', tagId: 'A006', name: 'Poppy', breed: 'Crossbred', birthDate: '2022-07-15', sireCode: 'LIC004', sireName: 'Donaghys Dozer II', breedingWorth: 295, productionWorth: 335, lactationWorth: 375, reliability: 68, milkBV: 780, fatBV: 42, proteinBV: 36, somaticCellBV: -0.20, fertilityBV: 4.8, liveweightBV: 25, lastUpdated: '2024-12-01' },
  { id: '7', tagId: 'A007', name: 'Clover', breed: 'Friesian', birthDate: '2019-08-30', sireCode: 'LIC001', sireName: 'Donaghys Dozer', breedingWorth: 258, productionWorth: 295, lactationWorth: 328, reliability: 95, milkBV: 740, fatBV: 40, proteinBV: 34, somaticCellBV: -0.16, fertilityBV: 4.0, liveweightBV: 30, lastUpdated: '2024-12-01' },
  { id: '8', tagId: 'A008', name: 'Buttercup', breed: 'Jersey', birthDate: '2020-09-12', sireCode: 'LIC005', sireName: 'Donaghys Dozer III', breedingWorth: 225, productionWorth: 255, lactationWorth: 295, reliability: 80, milkBV: 540, fatBV: 58, proteinBV: 50, somaticCellBV: -0.28, fertilityBV: 5.0, liveweightBV: 10, lastUpdated: '2024-12-01' },
];

const mockHerdSummary: HerdGeneticSummary = {
  averageBW: 242,
  averagePW: 275,
  averageLW: 313,
  topQuartileBW: 285,
  bottomQuartileBW: 205,
  geneticTrend: [
    { year: '2020', bw: 195, pw: 220 },
    { year: '2021', bw: 210, pw: 240 },
    { year: '2022', bw: 225, pw: 258 },
    { year: '2023', bw: 238, pw: 270 },
    { year: '2024', bw: 242, pw: 275 },
  ],
  breedComposition: [
    { breed: 'Friesian', percentage: 45 },
    { breed: 'Jersey', percentage: 30 },
    { breed: 'Crossbred', percentage: 25 },
  ],
};

const mockSireRecommendations: SireRecommendation[] = [
  { sireCode: 'LIC010', sireName: 'Premier Dozer', breed: 'Friesian', breedingWorth: 320, productionWorth: 365, reliability: 95, matchScore: 95, strengths: ['High milk volume', 'Excellent fertility', 'Low SCC'], considerations: ['Higher liveweight'] },
  { sireCode: 'LIC011', sireName: 'Elite Jersey', breed: 'Jersey', breedingWorth: 285, productionWorth: 310, reliability: 92, matchScore: 88, strengths: ['High fat %', 'High protein %', 'Good temperament'], considerations: ['Lower milk volume'] },
  { sireCode: 'LIC012', sireName: 'Crossbred Champion', breed: 'Crossbred', breedingWorth: 305, productionWorth: 345, reliability: 90, matchScore: 92, strengths: ['Balanced traits', 'Good fertility', 'Adaptability'], considerations: ['Moderate reliability'] },
];

export default function GeneticMeritPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAnimal, setSelectedAnimal] = useState<AnimalGenetics | null>(null);
  const [sortBy, setSortBy] = useState('breedingWorth');
  const [filterBreed, setFilterBreed] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data from LIC API
  const { data: breedingValues, isLoading } = useQuery({
    queryKey: ['/api/integrations/lic/breeding-values'],
    queryFn: async () => {
      const res = await fetch('/api/integrations/lic/breeding-values');
      if (!res.ok) throw new Error('Failed to fetch breeding values');
      return res.json();
    },
  });

  // Use API data or mock data
  const animals = breedingValues?.data || mockAnimals;

  // Filter and sort animals
  const filteredAnimals = animals
    .filter((a: AnimalGenetics) => filterBreed === 'all' || a.breed === filterBreed)
    .filter((a: AnimalGenetics) => 
      a.tagId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a: AnimalGenetics, b: AnimalGenetics) => {
      const aVal = a[sortBy as keyof AnimalGenetics] as number;
      const bVal = b[sortBy as keyof AnimalGenetics] as number;
      return bVal - aVal;
    });

  const getBWRating = (bw: number) => {
    if (bw >= 280) return { label: 'Elite', color: 'bg-purple-500' };
    if (bw >= 240) return { label: 'Excellent', color: 'bg-green-500' };
    if (bw >= 200) return { label: 'Good', color: 'bg-blue-500' };
    if (bw >= 160) return { label: 'Average', color: 'bg-yellow-500' };
    return { label: 'Below Avg', color: 'bg-red-500' };
  };

  const getPercentile = (value: number, metric: string) => {
    // Simplified percentile calculation
    const benchmarks: Record<string, { p25: number; p50: number; p75: number; p90: number }> = {
      breedingWorth: { p25: 180, p50: 220, p75: 260, p90: 300 },
      productionWorth: { p25: 200, p50: 250, p75: 300, p90: 350 },
      milkBV: { p25: 400, p50: 550, p75: 700, p90: 850 },
    };
    const bench = benchmarks[metric] || benchmarks.breedingWorth;
    if (value >= bench.p90) return 90;
    if (value >= bench.p75) return 75;
    if (value >= bench.p50) return 50;
    if (value >= bench.p25) return 25;
    return 10;
  };

  // Radar chart data for selected animal
  const getRadarData = (animal: AnimalGenetics) => [
    { trait: 'Milk', value: Math.min(100, (animal.milkBV / 10)), fullMark: 100 },
    { trait: 'Fat', value: Math.min(100, animal.fatBV * 1.5), fullMark: 100 },
    { trait: 'Protein', value: Math.min(100, animal.proteinBV * 2), fullMark: 100 },
    { trait: 'Fertility', value: Math.min(100, animal.fertilityBV * 15), fullMark: 100 },
    { trait: 'SCC', value: Math.min(100, 50 - animal.somaticCellBV * 100), fullMark: 100 },
    { trait: 'Liveweight', value: Math.min(100, animal.liveweightBV * 2.5), fullMark: 100 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Dna className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Genetic Merit & Breeding Values</h1>
                <p className="text-sm text-gray-500">BW, PW, LW analysis and sire selection tools</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync LIC Data
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Herd Avg BW</p>
                  <p className="text-2xl font-bold text-purple-600">${mockHerdSummary.averageBW}</p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+$12 vs last year</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Herd Avg PW</p>
                  <p className="text-2xl font-bold text-blue-600">${mockHerdSummary.averagePW}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Milk className="h-5 w-5 text-blue-600" />
                </div>
              </div>
              <div className="mt-2 flex items-center text-sm">
                <ArrowUpRight className="h-4 w-4 text-green-500 mr-1" />
                <span className="text-green-600">+$15 vs last year</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Top Quartile BW</p>
                  <p className="text-2xl font-bold text-green-600">${mockHerdSummary.topQuartileBW}</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Star className="h-5 w-5 text-green-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">Top 25% of herd</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Genetic Progress</p>
                  <p className="text-2xl font-bold text-emerald-600">+$47</p>
                </div>
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">5-year BW gain</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Herd Overview</TabsTrigger>
            <TabsTrigger value="animals">Individual Animals</TabsTrigger>
            <TabsTrigger value="sires">Sire Selection</TabsTrigger>
            <TabsTrigger value="mating">Mating Planner</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Genetic Trend Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Genetic Progress Over Time</CardTitle>
                  <CardDescription>Herd average BW and PW trend</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={mockHerdSummary.geneticTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" />
                      <YAxis />
                      <Tooltip formatter={(value) => `$${value}`} />
                      <Legend />
                      <Line type="monotone" dataKey="bw" name="Breeding Worth" stroke="#9333ea" strokeWidth={2} />
                      <Line type="monotone" dataKey="pw" name="Production Worth" stroke="#3b82f6" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Breed Composition */}
              <Card>
                <CardHeader>
                  <CardTitle>Breed Composition</CardTitle>
                  <CardDescription>Herd breed breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={mockHerdSummary.breedComposition} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis dataKey="breed" type="category" width={80} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="percentage" fill="#10b981" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* BW Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>Breeding Worth Distribution</CardTitle>
                  <CardDescription>Distribution of BW across herd</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={[
                      { range: '<$180', count: 15, color: '#ef4444' },
                      { range: '$180-220', count: 45, color: '#f59e0b' },
                      { range: '$220-260', count: 85, color: '#3b82f6' },
                      { range: '$260-300', count: 42, color: '#22c55e' },
                      { range: '>$300', count: 13, color: '#9333ea' },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="range" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" name="Animals" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Top Performers */}
              <Card>
                <CardHeader>
                  <CardTitle>Top Genetic Merit Animals</CardTitle>
                  <CardDescription>Highest BW animals in herd</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredAnimals.slice(0, 5).map((animal: AnimalGenetics, index: number) => (
                      <div key={animal.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{animal.tagId} - {animal.name}</p>
                            <p className="text-sm text-gray-500">{animal.breed}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-purple-600">${animal.breedingWorth}</p>
                          <Badge className={getBWRating(animal.breedingWorth).color}>
                            {getBWRating(animal.breedingWorth).label}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="animals">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Individual Animal Genetics</CardTitle>
                    <CardDescription>Detailed breeding values for each animal</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search animals..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-48"
                      />
                    </div>
                    <Select value={filterBreed} onValueChange={setFilterBreed}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Breed" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Breeds</SelectItem>
                        <SelectItem value="Friesian">Friesian</SelectItem>
                        <SelectItem value="Jersey">Jersey</SelectItem>
                        <SelectItem value="Crossbred">Crossbred</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="breedingWorth">Breeding Worth</SelectItem>
                        <SelectItem value="productionWorth">Production Worth</SelectItem>
                        <SelectItem value="lactationWorth">Lactation Worth</SelectItem>
                        <SelectItem value="milkBV">Milk BV</SelectItem>
                        <SelectItem value="fertilityBV">Fertility BV</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Animal</TableHead>
                        <TableHead>Breed</TableHead>
                        <TableHead className="text-right">BW</TableHead>
                        <TableHead className="text-right">PW</TableHead>
                        <TableHead className="text-right">LW</TableHead>
                        <TableHead className="text-right">Milk BV</TableHead>
                        <TableHead className="text-right">Fat BV</TableHead>
                        <TableHead className="text-right">Protein BV</TableHead>
                        <TableHead className="text-right">Fertility</TableHead>
                        <TableHead className="text-right">Reliability</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAnimals.map((animal: AnimalGenetics) => (
                        <TableRow key={animal.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedAnimal(animal)}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{animal.tagId}</p>
                              <p className="text-sm text-gray-500">{animal.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>{animal.breed}</TableCell>
                          <TableCell className="text-right">
                            <span className="font-bold text-purple-600">${animal.breedingWorth}</span>
                          </TableCell>
                          <TableCell className="text-right">${animal.productionWorth}</TableCell>
                          <TableCell className="text-right">${animal.lactationWorth}</TableCell>
                          <TableCell className="text-right">{animal.milkBV}</TableCell>
                          <TableCell className="text-right">{animal.fatBV}</TableCell>
                          <TableCell className="text-right">{animal.proteinBV}</TableCell>
                          <TableCell className="text-right">{animal.fertilityBV.toFixed(1)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline">{animal.reliability}%</Badge>
                          </TableCell>
                          <TableCell>
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Animal Detail Dialog */}
            {selectedAnimal && (
              <Dialog open={!!selectedAnimal} onOpenChange={() => setSelectedAnimal(null)}>
                <DialogContent className="max-w-3xl">
                  <DialogHeader>
                    <DialogTitle>{selectedAnimal.tagId} - {selectedAnimal.name}</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Breeding Values</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Breeding Worth (BW)</span>
                          <span className="font-bold text-purple-600">${selectedAnimal.breedingWorth}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Production Worth (PW)</span>
                          <span className="font-bold">${selectedAnimal.productionWorth}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Lactation Worth (LW)</span>
                          <span className="font-bold">${selectedAnimal.lactationWorth}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Reliability</span>
                          <span className="font-bold">{selectedAnimal.reliability}%</span>
                        </div>
                      </div>
                      <h4 className="font-medium mt-4 mb-3">Trait BVs</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Milk Volume</span>
                          <span>{selectedAnimal.milkBV} L</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fat</span>
                          <span>{selectedAnimal.fatBV} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Protein</span>
                          <span>{selectedAnimal.proteinBV} kg</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Somatic Cell</span>
                          <span>{selectedAnimal.somaticCellBV.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fertility</span>
                          <span>{selectedAnimal.fertilityBV.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Liveweight</span>
                          <span>{selectedAnimal.liveweightBV} kg</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Trait Profile</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <RadarChart data={getRadarData(selectedAnimal)}>
                          <PolarGrid />
                          <PolarAngleAxis dataKey="trait" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} />
                          <Radar name="BV" dataKey="value" stroke="#9333ea" fill="#9333ea" fillOpacity={0.5} />
                        </RadarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-500">Sire: {selectedAnimal.sireName || 'Unknown'}</p>
                        <p className="text-sm text-gray-500">Last Updated: {selectedAnimal.lastUpdated}</p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          <TabsContent value="sires">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Sire Recommendations */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Recommended Sires</CardTitle>
                    <CardDescription>AI-matched sires based on your herd genetics</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {mockSireRecommendations.map((sire, index) => (
                        <div key={sire.sireCode} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-amber-600'}`}>
                                #{index + 1}
                              </div>
                              <div>
                                <p className="font-medium">{sire.sireName}</p>
                                <p className="text-sm text-gray-500">{sire.sireCode} • {sire.breed}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge className="bg-purple-500">{sire.matchScore}% Match</Badge>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-sm text-gray-500">BW</p>
                              <p className="font-bold text-purple-600">${sire.breedingWorth}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">PW</p>
                              <p className="font-bold">${sire.productionWorth}</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Reliability</p>
                              <p className="font-bold">{sire.reliability}%</p>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-4">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-green-600 mb-1">Strengths</p>
                              <div className="flex flex-wrap gap-1">
                                {sire.strengths.map(s => (
                                  <Badge key={s} variant="outline" className="text-green-600 border-green-300">{s}</Badge>
                                ))}
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-amber-600 mb-1">Consider</p>
                              <div className="flex flex-wrap gap-1">
                                {sire.considerations.map(c => (
                                  <Badge key={c} variant="outline" className="text-amber-600 border-amber-300">{c}</Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-4 flex gap-2">
                            <Button size="sm" className="flex-1">View Full Profile</Button>
                            <Button size="sm" variant="outline">Add to Mating Plan</Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sire Search */}
              <Card>
                <CardHeader>
                  <CardTitle>Search Sires</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input placeholder="Search by name or code..." className="pl-9" />
                    </div>
                    <div>
                      <Label>Minimum BW</Label>
                      <Input type="number" placeholder="e.g., 250" />
                    </div>
                    <div>
                      <Label>Breed</Label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Any breed" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="friesian">Friesian</SelectItem>
                          <SelectItem value="jersey">Jersey</SelectItem>
                          <SelectItem value="crossbred">Crossbred</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Priority Traits</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="cursor-pointer hover:bg-purple-100">Milk Volume</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-purple-100">Fat %</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-purple-100">Protein %</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-purple-100">Fertility</Badge>
                        <Badge variant="outline" className="cursor-pointer hover:bg-purple-100">Low SCC</Badge>
                      </div>
                    </div>
                    <Button className="w-full">
                      <Search className="h-4 w-4 mr-2" />
                      Search Sires
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="mating">
            <Card>
              <CardHeader>
                <CardTitle>Mating Planner</CardTitle>
                <CardDescription>Plan matings to maximize genetic progress</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Mating Planner Coming Soon</h3>
                  <p className="text-gray-500 max-w-md mx-auto">
                    Plan optimal matings based on individual cow genetics and sire selection to maximize genetic progress while managing inbreeding.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
