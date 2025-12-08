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
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, ComposedChart
} from 'recharts';
import {
  Leaf, TrendingUp, TrendingDown, Calculator, Calendar, AlertTriangle,
  Download, RefreshCw, Settings, ChevronRight, Wheat, Droplets,
  Sun, Cloud, ThermometerSun, Scale, Target, Plus, Edit, Trash2,
  ArrowUpRight, ArrowDownRight, Minus, Package, Truck
} from 'lucide-react';

// Types
interface FeedBudget {
  month: string;
  pastureDemand: number; // kg DM
  pastureSupply: number;
  supplementRequired: number;
  silageUsed: number;
  concentrateUsed: number;
  deficit: number;
}

interface PastureWedge {
  paddock: string;
  area: number;
  currentCover: number;
  targetCover: number;
  daysToGraze: number;
  rotation: number;
}

interface SupplementInventory {
  id: string;
  type: 'silage' | 'hay' | 'baleage' | 'concentrate' | 'palm_kernel' | 'maize';
  name: string;
  quantity: number; // tonnes or bales
  unit: string;
  dryMatter: number; // %
  metabolisableEnergy: number; // MJ/kg DM
  crudeProtein: number; // %
  costPerUnit: number;
  supplier?: string;
  deliveryDate?: string;
  expiryDate?: string;
}

interface GrazingPlan {
  date: string;
  paddock: string;
  mob: string;
  entryTime: string;
  exitTime?: string;
  preCover: number;
  postCover: number;
  area: number;
  stockCount: number;
}

// Mock data
const mockFeedBudget: FeedBudget[] = [
  { month: 'Jul', pastureDemand: 45000, pastureSupply: 15000, supplementRequired: 30000, silageUsed: 25000, concentrateUsed: 5000, deficit: 0 },
  { month: 'Aug', pastureDemand: 55000, pastureSupply: 35000, supplementRequired: 20000, silageUsed: 15000, concentrateUsed: 5000, deficit: 0 },
  { month: 'Sep', pastureDemand: 75000, pastureSupply: 70000, supplementRequired: 5000, silageUsed: 3000, concentrateUsed: 2000, deficit: 0 },
  { month: 'Oct', pastureDemand: 85000, pastureSupply: 95000, supplementRequired: 0, silageUsed: 0, concentrateUsed: 0, deficit: -10000 },
  { month: 'Nov', pastureDemand: 90000, pastureSupply: 110000, supplementRequired: 0, silageUsed: 0, concentrateUsed: 0, deficit: -20000 },
  { month: 'Dec', pastureDemand: 85000, pastureSupply: 90000, supplementRequired: 0, silageUsed: 0, concentrateUsed: 0, deficit: -5000 },
  { month: 'Jan', pastureDemand: 80000, pastureSupply: 65000, supplementRequired: 15000, silageUsed: 10000, concentrateUsed: 5000, deficit: 0 },
  { month: 'Feb', pastureDemand: 75000, pastureSupply: 55000, supplementRequired: 20000, silageUsed: 15000, concentrateUsed: 5000, deficit: 0 },
  { month: 'Mar', pastureDemand: 70000, pastureSupply: 50000, supplementRequired: 20000, silageUsed: 15000, concentrateUsed: 5000, deficit: 0 },
  { month: 'Apr', pastureDemand: 60000, pastureSupply: 40000, supplementRequired: 20000, silageUsed: 15000, concentrateUsed: 5000, deficit: 0 },
  { month: 'May', pastureDemand: 50000, pastureSupply: 25000, supplementRequired: 25000, silageUsed: 20000, concentrateUsed: 5000, deficit: 0 },
  { month: 'Jun', pastureDemand: 45000, pastureSupply: 18000, supplementRequired: 27000, silageUsed: 22000, concentrateUsed: 5000, deficit: 0 },
];

const mockPastureWedge: PastureWedge[] = [
  { paddock: 'North Block 1', area: 4.2, currentCover: 3200, targetCover: 2800, daysToGraze: 0, rotation: 1 },
  { paddock: 'North Block 2', area: 3.8, currentCover: 2900, targetCover: 2800, daysToGraze: 2, rotation: 2 },
  { paddock: 'South Block 1', area: 5.1, currentCover: 2700, targetCover: 2800, daysToGraze: 5, rotation: 3 },
  { paddock: 'River Flat', area: 6.2, currentCover: 2500, targetCover: 2800, daysToGraze: 8, rotation: 4 },
  { paddock: 'Hill Block', area: 8.5, currentCover: 2300, targetCover: 2500, daysToGraze: 12, rotation: 5 },
  { paddock: 'Effluent Block', area: 3.5, currentCover: 3500, targetCover: 3200, daysToGraze: -2, rotation: 0 },
];

const mockSupplements: SupplementInventory[] = [
  { id: '1', type: 'silage', name: 'Grass Silage', quantity: 450, unit: 'tonnes', dryMatter: 35, metabolisableEnergy: 10.5, crudeProtein: 14, costPerUnit: 180 },
  { id: '2', type: 'baleage', name: 'Baleage', quantity: 120, unit: 'bales', dryMatter: 45, metabolisableEnergy: 10.2, crudeProtein: 12, costPerUnit: 85 },
  { id: '3', type: 'hay', name: 'Meadow Hay', quantity: 80, unit: 'bales', dryMatter: 85, metabolisableEnergy: 8.5, crudeProtein: 8, costPerUnit: 65 },
  { id: '4', type: 'palm_kernel', name: 'PKE', quantity: 45, unit: 'tonnes', dryMatter: 90, metabolisableEnergy: 11.0, crudeProtein: 16, costPerUnit: 320 },
  { id: '5', type: 'concentrate', name: 'Dairy Pellets', quantity: 25, unit: 'tonnes', dryMatter: 88, metabolisableEnergy: 12.5, crudeProtein: 18, costPerUnit: 580 },
  { id: '6', type: 'maize', name: 'Maize Silage', quantity: 200, unit: 'tonnes', dryMatter: 33, metabolisableEnergy: 10.8, crudeProtein: 8, costPerUnit: 200 },
];

const mockGrazingPlan: GrazingPlan[] = [
  { date: '2024-12-08', paddock: 'North Block 1', mob: 'Milking Herd', entryTime: '06:00', preCover: 3200, postCover: 1500, area: 4.2, stockCount: 300 },
  { date: '2024-12-09', paddock: 'North Block 2', mob: 'Milking Herd', entryTime: '06:00', preCover: 2900, postCover: 1500, area: 3.8, stockCount: 300 },
  { date: '2024-12-10', paddock: 'South Block 1', mob: 'Milking Herd', entryTime: '06:00', preCover: 2700, postCover: 1500, area: 5.1, stockCount: 300 },
  { date: '2024-12-11', paddock: 'River Flat', mob: 'Milking Herd', entryTime: '06:00', preCover: 2500, postCover: 1500, area: 6.2, stockCount: 300 },
];

export default function FeedPlanningPage() {
  const [activeTab, setActiveTab] = useState('budget');
  const [selectedMonth, setSelectedMonth] = useState('Dec');
  const [showAddSupplement, setShowAddSupplement] = useState(false);

  // Calculations
  const totalPastureDemand = mockFeedBudget.reduce((sum, m) => sum + m.pastureDemand, 0);
  const totalPastureSupply = mockFeedBudget.reduce((sum, m) => sum + m.pastureSupply, 0);
  const totalSupplementRequired = mockFeedBudget.reduce((sum, m) => sum + m.supplementRequired, 0);
  const averageCover = Math.round(mockPastureWedge.reduce((sum, p) => sum + p.currentCover, 0) / mockPastureWedge.length);
  const totalFarmArea = mockPastureWedge.reduce((sum, p) => sum + p.area, 0);

  // Supplement inventory totals
  const totalSilageDM = mockSupplements
    .filter(s => ['silage', 'maize'].includes(s.type))
    .reduce((sum, s) => sum + (s.quantity * s.dryMatter / 100), 0);
  const totalSupplementValue = mockSupplements.reduce((sum, s) => sum + (s.quantity * s.costPerUnit), 0);

  const getSupplementIcon = (type: string) => {
    switch (type) {
      case 'silage': return <Package className="h-4 w-4 text-green-600" />;
      case 'hay': return <Wheat className="h-4 w-4 text-yellow-600" />;
      case 'baleage': return <Package className="h-4 w-4 text-emerald-600" />;
      case 'concentrate': return <Package className="h-4 w-4 text-orange-600" />;
      case 'palm_kernel': return <Package className="h-4 w-4 text-amber-700" />;
      case 'maize': return <Wheat className="h-4 w-4 text-yellow-500" />;
      default: return <Package className="h-4 w-4" />;
    }
  };

  const getCoverStatus = (current: number, target: number) => {
    const ratio = current / target;
    if (ratio >= 1.1) return { color: 'bg-green-500', label: 'Above Target' };
    if (ratio >= 0.95) return { color: 'bg-blue-500', label: 'On Target' };
    if (ratio >= 0.8) return { color: 'bg-yellow-500', label: 'Below Target' };
    return { color: 'bg-red-500', label: 'Critical' };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Leaf className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Feed Planning & Budget</h1>
                <p className="text-sm text-gray-500">Pasture management, feed budgets & supplement planning</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalculate
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export Plan
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
                  <p className="text-sm text-gray-500">Average Cover</p>
                  <p className="text-2xl font-bold text-green-600">{averageCover.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">kg DM/ha</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <Leaf className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Rotation Length</p>
                  <p className="text-2xl font-bold text-blue-600">24</p>
                  <p className="text-xs text-gray-400">days</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Silage On Hand</p>
                  <p className="text-2xl font-bold text-emerald-600">{Math.round(totalSilageDM)}</p>
                  <p className="text-xs text-gray-400">tonnes DM</p>
                </div>
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <Package className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Supplement Value</p>
                  <p className="text-2xl font-bold text-amber-600">${(totalSupplementValue / 1000).toFixed(0)}k</p>
                  <p className="text-xs text-gray-400">inventory</p>
                </div>
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Scale className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="budget">Feed Budget</TabsTrigger>
            <TabsTrigger value="wedge">Pasture Wedge</TabsTrigger>
            <TabsTrigger value="supplements">Supplements</TabsTrigger>
            <TabsTrigger value="grazing">Grazing Plan</TabsTrigger>
          </TabsList>

          <TabsContent value="budget">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Feed Budget Chart */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Annual Feed Budget</CardTitle>
                    <CardDescription>Pasture supply vs demand with supplement requirements</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <ComposedChart data={mockFeedBudget}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis tickFormatter={(v) => `${v / 1000}k`} />
                        <Tooltip formatter={(value: number) => `${(value / 1000).toFixed(1)}k kg DM`} />
                        <Legend />
                        <Area type="monotone" dataKey="pastureSupply" name="Pasture Supply" fill="#86efac" stroke="#22c55e" fillOpacity={0.6} />
                        <Line type="monotone" dataKey="pastureDemand" name="Demand" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
                        <Bar dataKey="silageUsed" name="Silage" stackId="supplement" fill="#10b981" />
                        <Bar dataKey="concentrateUsed" name="Concentrate" stackId="supplement" fill="#f59e0b" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Budget Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Season Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-500">Total Pasture Demand</span>
                      <span className="font-bold">{(totalPastureDemand / 1000).toFixed(0)}t DM</span>
                    </div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-500">Total Pasture Supply</span>
                      <span className="font-bold text-green-600">{(totalPastureSupply / 1000).toFixed(0)}t DM</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Supplement Required</span>
                      <span className="font-bold text-amber-600">{(totalSupplementRequired / 1000).toFixed(0)}t DM</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Feed Efficiency</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Pasture Utilization</span>
                          <span className="font-medium">85%</span>
                        </div>
                        <Progress value={85} className="h-2" />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Supplement Efficiency</span>
                          <span className="font-medium">92%</span>
                        </div>
                        <Progress value={92} className="h-2" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Key Metrics</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="p-2 bg-green-50 rounded">
                        <p className="text-gray-500">Pasture Eaten</p>
                        <p className="font-bold text-green-700">12.5 t/ha</p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded">
                        <p className="text-gray-500">Stocking Rate</p>
                        <p className="font-bold text-blue-700">2.8 cows/ha</p>
                      </div>
                      <div className="p-2 bg-amber-50 rounded">
                        <p className="text-gray-500">Supplement/Cow</p>
                        <p className="font-bold text-amber-700">650 kg DM</p>
                      </div>
                      <div className="p-2 bg-purple-50 rounded">
                        <p className="text-gray-500">Feed Cost</p>
                        <p className="font-bold text-purple-700">$1.85/kg MS</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="wedge">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pasture Wedge Chart */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Pasture Wedge</CardTitle>
                    <CardDescription>Current pasture cover by paddock</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <BarChart data={mockPastureWedge.sort((a, b) => b.currentCover - a.currentCover)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 4000]} />
                        <YAxis dataKey="paddock" type="category" width={100} />
                        <Tooltip formatter={(value: number) => `${value} kg DM/ha`} />
                        <Legend />
                        <Bar dataKey="currentCover" name="Current Cover" fill="#22c55e" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="targetCover" name="Target Cover" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Paddock Details */}
              <Card>
                <CardHeader>
                  <CardTitle>Paddock Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {mockPastureWedge.map(paddock => {
                      const status = getCoverStatus(paddock.currentCover, paddock.targetCover);
                      return (
                        <div key={paddock.paddock} className="p-3 border rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{paddock.paddock}</span>
                            <Badge className={status.color}>{status.label}</Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-gray-500">Cover:</span>
                              <span className="ml-1 font-medium">{paddock.currentCover} kg/ha</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Area:</span>
                              <span className="ml-1 font-medium">{paddock.area} ha</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Days to graze:</span>
                              <span className={`ml-1 font-medium ${paddock.daysToGraze <= 0 ? 'text-green-600' : ''}`}>
                                {paddock.daysToGraze <= 0 ? 'Ready' : paddock.daysToGraze}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Rotation:</span>
                              <span className="ml-1 font-medium">#{paddock.rotation || '-'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="supplements">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Supplement Inventory */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Supplement Inventory</CardTitle>
                        <CardDescription>Current feed stocks and nutritional values</CardDescription>
                      </div>
                      <Button size="sm" onClick={() => setShowAddSupplement(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Supplement
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">DM %</TableHead>
                          <TableHead className="text-right">ME</TableHead>
                          <TableHead className="text-right">CP %</TableHead>
                          <TableHead className="text-right">Value</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockSupplements.map(supplement => (
                          <TableRow key={supplement.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getSupplementIcon(supplement.type)}
                                <span className="capitalize">{supplement.type.replace('_', ' ')}</span>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{supplement.name}</TableCell>
                            <TableCell className="text-right">
                              {supplement.quantity} {supplement.unit}
                            </TableCell>
                            <TableCell className="text-right">{supplement.dryMatter}%</TableCell>
                            <TableCell className="text-right">{supplement.metabolisableEnergy}</TableCell>
                            <TableCell className="text-right">{supplement.crudeProtein}%</TableCell>
                            <TableCell className="text-right font-medium">
                              ${(supplement.quantity * supplement.costPerUnit).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm">
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm">
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Supplement Summary */}
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Inventory Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Silage</span>
                        <span className="font-bold">{mockSupplements.filter(s => s.type === 'silage').reduce((sum, s) => sum + s.quantity, 0)} tonnes</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Baleage</span>
                        <span className="font-bold">{mockSupplements.filter(s => s.type === 'baleage').reduce((sum, s) => sum + s.quantity, 0)} bales</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">Total Hay</span>
                        <span className="font-bold">{mockSupplements.filter(s => s.type === 'hay').reduce((sum, s) => sum + s.quantity, 0)} bales</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">PKE</span>
                        <span className="font-bold">{mockSupplements.filter(s => s.type === 'palm_kernel').reduce((sum, s) => sum + s.quantity, 0)} tonnes</span>
                      </div>
                    </div>
                    <div className="border-t pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Total Inventory Value</span>
                        <span className="text-xl font-bold text-green-600">${totalSupplementValue.toLocaleString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Feed Quality Guide</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="p-2 bg-green-50 rounded">
                        <p className="font-medium text-green-700">High Quality (ME &gt; 11)</p>
                        <p className="text-green-600">Dairy pellets, good silage</p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded">
                        <p className="font-medium text-blue-700">Medium Quality (ME 10-11)</p>
                        <p className="text-blue-600">PKE, average silage, maize</p>
                      </div>
                      <div className="p-2 bg-yellow-50 rounded">
                        <p className="font-medium text-yellow-700">Lower Quality (ME &lt; 10)</p>
                        <p className="text-yellow-600">Hay, straw, poor silage</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="grazing">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Grazing Schedule */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Grazing Schedule</CardTitle>
                        <CardDescription>Planned paddock rotations</CardDescription>
                      </div>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Grazing
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Paddock</TableHead>
                          <TableHead>Mob</TableHead>
                          <TableHead className="text-right">Pre Cover</TableHead>
                          <TableHead className="text-right">Post Cover</TableHead>
                          <TableHead className="text-right">Area</TableHead>
                          <TableHead className="text-right">Stock</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mockGrazingPlan.map((plan, index) => (
                          <TableRow key={index} className={index === 0 ? 'bg-green-50' : ''}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{new Date(plan.date).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                                <p className="text-xs text-gray-500">{plan.entryTime}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{plan.paddock}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{plan.mob}</Badge>
                            </TableCell>
                            <TableCell className="text-right">{plan.preCover} kg/ha</TableCell>
                            <TableCell className="text-right">{plan.postCover} kg/ha</TableCell>
                            <TableCell className="text-right">{plan.area} ha</TableCell>
                            <TableCell className="text-right">{plan.stockCount}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Grazing Calculator */}
              <Card>
                <CardHeader>
                  <CardTitle>Grazing Calculator</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Number of Cows</Label>
                    <Input type="number" defaultValue={300} />
                  </div>
                  <div>
                    <Label>Daily Intake (kg DM/cow)</Label>
                    <Input type="number" defaultValue={18} />
                  </div>
                  <div>
                    <Label>Pre-grazing Cover (kg DM/ha)</Label>
                    <Input type="number" defaultValue={2800} />
                  </div>
                  <div>
                    <Label>Post-grazing Cover (kg DM/ha)</Label>
                    <Input type="number" defaultValue={1500} />
                  </div>
                  <div className="border-t pt-4">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-500">Area Required Per Day</p>
                      <p className="text-2xl font-bold text-green-700">4.15 ha</p>
                    </div>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-500">Rotation Length</p>
                    <p className="text-2xl font-bold text-blue-700">24 days</p>
                  </div>
                  <Button className="w-full">
                    <Calculator className="h-4 w-4 mr-2" />
                    Recalculate
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Supplement Dialog */}
      <Dialog open={showAddSupplement} onOpenChange={setShowAddSupplement}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Supplement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="silage">Grass Silage</SelectItem>
                  <SelectItem value="maize">Maize Silage</SelectItem>
                  <SelectItem value="baleage">Baleage</SelectItem>
                  <SelectItem value="hay">Hay</SelectItem>
                  <SelectItem value="palm_kernel">PKE</SelectItem>
                  <SelectItem value="concentrate">Concentrate</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Quantity</Label>
                <Input type="number" placeholder="0" />
              </div>
              <div>
                <Label>Unit</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tonnes">Tonnes</SelectItem>
                    <SelectItem value="bales">Bales</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>DM %</Label>
                <Input type="number" placeholder="35" />
              </div>
              <div>
                <Label>ME (MJ/kg)</Label>
                <Input type="number" placeholder="10.5" />
              </div>
              <div>
                <Label>CP %</Label>
                <Input type="number" placeholder="14" />
              </div>
            </div>
            <div>
              <Label>Cost per Unit ($)</Label>
              <Input type="number" placeholder="180" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSupplement(false)}>Cancel</Button>
            <Button onClick={() => { setShowAddSupplement(false); toast.success('Supplement added'); }}>Add Supplement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
