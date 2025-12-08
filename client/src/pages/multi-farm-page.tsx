import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line
} from 'recharts';
import {
  Building2, MapPin, Users, TrendingUp, TrendingDown, Plus, Settings,
  ChevronRight, BarChart3, FileText, UserPlus, Shield, Globe, Layers,
  ArrowUpRight, ArrowDownRight, Minus, Calendar, DollarSign, Milk
} from 'lucide-react';

// Types
interface Farm {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  region: string;
  totalArea: number;
  effectiveArea: number;
  peakCows?: number;
  currentStock?: number;
  stockingRate?: number;
  ownerName: string;
  managerName?: string;
}

interface FarmMetrics {
  farmId: string;
  farmName: string;
  totalMilkSolids: number;
  milkSolidsPerCow: number;
  milkSolidsPerHa: number;
  totalRevenue: number;
  totalCosts: number;
  netProfit: number;
  profitPerHa: number;
  costPerKgMs: number;
  sccAverage: number;
  reproRate: number;
}

// Mock data
const mockFarms: Farm[] = [
  { id: 'farm-001', name: 'Greenfields Dairy', code: 'GFD', type: 'dairy', status: 'active', region: 'Waikato', totalArea: 180, effectiveArea: 165, peakCows: 450, currentStock: 420, stockingRate: 2.55, ownerName: 'John Smith', managerName: 'Sarah Johnson' },
  { id: 'farm-002', name: 'Riverside Farm', code: 'RSF', type: 'dairy', status: 'active', region: 'Waikato', totalArea: 220, effectiveArea: 200, peakCows: 520, currentStock: 495, stockingRate: 2.48, ownerName: 'John Smith' },
  { id: 'farm-003', name: 'Hilltop Station', code: 'HTS', type: 'mixed', status: 'active', region: 'Waikato', totalArea: 350, effectiveArea: 280, peakCows: 380, currentStock: 350, stockingRate: 1.25, ownerName: 'John Smith', managerName: 'Mike Williams' },
  { id: 'farm-004', name: 'Southland Dairy', code: 'SLD', type: 'dairy', status: 'active', region: 'Southland', totalArea: 280, effectiveArea: 260, peakCows: 680, currentStock: 650, stockingRate: 2.50, ownerName: 'David Brown' },
];

const mockMetrics: FarmMetrics[] = [
  { farmId: 'farm-001', farmName: 'Greenfields Dairy', totalMilkSolids: 175500, milkSolidsPerCow: 390, milkSolidsPerHa: 1064, totalRevenue: 1491750, totalCosts: 1044225, netProfit: 447525, profitPerHa: 2712, costPerKgMs: 5.95, sccAverage: 142, reproRate: 72 },
  { farmId: 'farm-002', farmName: 'Riverside Farm', totalMilkSolids: 213200, milkSolidsPerCow: 410, milkSolidsPerHa: 1066, totalRevenue: 1812200, totalCosts: 1268540, netProfit: 543660, profitPerHa: 2718, costPerKgMs: 5.95, sccAverage: 128, reproRate: 75 },
  { farmId: 'farm-003', farmName: 'Hilltop Station', totalMilkSolids: 140600, milkSolidsPerCow: 370, milkSolidsPerHa: 502, totalRevenue: 1195100, totalCosts: 895825, netProfit: 299275, profitPerHa: 1069, costPerKgMs: 6.37, sccAverage: 165, reproRate: 68 },
  { farmId: 'farm-004', farmName: 'Southland Dairy', totalMilkSolids: 278800, milkSolidsPerCow: 410, milkSolidsPerHa: 1072, totalRevenue: 2369800, totalCosts: 1658860, netProfit: 710940, profitPerHa: 2734, costPerKgMs: 5.95, sccAverage: 135, reproRate: 74 },
];

const mockComparisonData = [
  { metric: 'MS/Cow', GFD: 390, RSF: 410, HTS: 370, SLD: 410, average: 395 },
  { metric: 'MS/Ha', GFD: 1064, RSF: 1066, HTS: 502, SLD: 1072, average: 926 },
  { metric: 'Profit/Ha', GFD: 2712, RSF: 2718, HTS: 1069, SLD: 2734, average: 2308 },
  { metric: 'Cost/kg MS', GFD: 5.95, RSF: 5.95, HTS: 6.37, SLD: 5.95, average: 6.06 },
  { metric: 'SCC', GFD: 142, RSF: 128, HTS: 165, SLD: 135, average: 143 },
  { metric: 'Repro %', GFD: 72, RSF: 75, HTS: 68, SLD: 74, average: 72 },
];

export default function MultiFarmPage() {
  const [activeTab, setActiveTab] = useState('portfolio');
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [showInviteUser, setShowInviteUser] = useState(false);

  // Fetch farms
  const { data: farmsData, isLoading } = useQuery({
    queryKey: ['/api/farms'],
    queryFn: async () => {
      const res = await fetch('/api/farms');
      if (!res.ok) throw new Error('Failed to fetch farms');
      return res.json();
    },
  });

  const farms = farmsData?.data || mockFarms;
  const metrics = mockMetrics;

  // Calculate totals
  const totalArea = farms.reduce((sum: number, f: Farm) => sum + f.totalArea, 0);
  const totalStock = farms.reduce((sum: number, f: Farm) => sum + (f.currentStock || 0), 0);
  const totalMs = metrics.reduce((sum, m) => sum + m.totalMilkSolids, 0);
  const totalRevenue = metrics.reduce((sum, m) => sum + m.totalRevenue, 0);
  const totalProfit = metrics.reduce((sum, m) => sum + m.netProfit, 0);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'dairy': return 'bg-blue-500';
      case 'beef': return 'bg-red-500';
      case 'sheep': return 'bg-green-500';
      case 'mixed': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Multi-Farm Management</h1>
                <p className="text-sm text-gray-500">Portfolio overview, cross-farm analytics & consolidated reporting</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowInviteUser(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite User
              </Button>
              <Button size="sm" onClick={() => setShowAddFarm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Farm
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Farms</p>
                  <p className="text-2xl font-bold">{farms.length}</p>
                </div>
                <Building2 className="h-8 w-8 text-indigo-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Area</p>
                  <p className="text-2xl font-bold">{totalArea.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">hectares</p>
                </div>
                <Globe className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Stock</p>
                  <p className="text-2xl font-bold">{totalStock.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">animals</p>
                </div>
                <Users className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total MS</p>
                  <p className="text-2xl font-bold">{(totalMs / 1000).toFixed(0)}k</p>
                  <p className="text-xs text-gray-400">kg MS</p>
                </div>
                <Milk className="h-8 w-8 text-cyan-200" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Profit</p>
                  <p className="text-2xl font-bold text-green-600">${(totalProfit / 1000000).toFixed(1)}M</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="portfolio">Farm Portfolio</TabsTrigger>
            <TabsTrigger value="comparison">Cross-Farm Comparison</TabsTrigger>
            <TabsTrigger value="consolidated">Consolidated Report</TabsTrigger>
            <TabsTrigger value="users">User Access</TabsTrigger>
          </TabsList>

          <TabsContent value="portfolio">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {farms.map((farm: Farm) => {
                const farmMetrics = metrics.find(m => m.farmId === farm.id);
                return (
                  <Card key={farm.id} className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setSelectedFarm(farm)}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{farm.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {farm.region}
                          </CardDescription>
                        </div>
                        <Badge className={getTypeColor(farm.type)}>{farm.type}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-500">Area</p>
                          <p className="font-medium">{farm.effectiveArea} ha</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Stock</p>
                          <p className="font-medium">{farm.currentStock || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Stocking Rate</p>
                          <p className="font-medium">{farm.stockingRate?.toFixed(2) || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Manager</p>
                          <p className="font-medium">{farm.managerName || '-'}</p>
                        </div>
                      </div>

                      {farmMetrics && (
                        <div className="border-t pt-4">
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-xs text-gray-500">MS/Cow</p>
                              <p className="font-bold text-blue-600">{farmMetrics.milkSolidsPerCow}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Profit/Ha</p>
                              <p className="font-bold text-green-600">${farmMetrics.profitPerHa}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">SCC</p>
                              <p className="font-bold">{farmMetrics.sccAverage}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <Button variant="ghost" className="w-full mt-4" size="sm">
                        View Details <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Add Farm Card */}
              <Card className="border-dashed border-2 hover:border-indigo-300 cursor-pointer" onClick={() => setShowAddFarm(true)}>
                <CardContent className="flex flex-col items-center justify-center h-full min-h-[300px] text-gray-400">
                  <Plus className="h-12 w-12 mb-2" />
                  <p className="font-medium">Add New Farm</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="comparison">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Comparison Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Farm Performance Comparison</CardTitle>
                  <CardDescription>Key metrics across all farms</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={mockComparisonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="metric" type="category" width={100} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="GFD" name="Greenfields" fill="#6366f1" />
                      <Bar dataKey="RSF" name="Riverside" fill="#22c55e" />
                      <Bar dataKey="HTS" name="Hilltop" fill="#f59e0b" />
                      <Bar dataKey="SLD" name="Southland" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Ranking Tables */}
              <Card>
                <CardHeader>
                  <CardTitle>MS/Cow Ranking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.sort((a, b) => b.milkSolidsPerCow - a.milkSolidsPerCow).map((m, i) => (
                      <div key={m.farmId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                            {i + 1}
                          </div>
                          <span className="font-medium">{m.farmName}</span>
                        </div>
                        <span className="font-bold text-blue-600">{m.milkSolidsPerCow} kg</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Profit/Ha Ranking</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {metrics.sort((a, b) => b.profitPerHa - a.profitPerHa).map((m, i) => (
                      <div key={m.farmId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${i === 0 ? 'bg-yellow-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-amber-600' : 'bg-gray-300'}`}>
                            {i + 1}
                          </div>
                          <span className="font-medium">{m.farmName}</span>
                        </div>
                        <span className="font-bold text-green-600">${m.profitPerHa}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="consolidated">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Consolidated Financial Report</CardTitle>
                    <CardDescription>2024-25 Season to Date</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Farm</TableHead>
                      <TableHead className="text-right">Total MS (kg)</TableHead>
                      <TableHead className="text-right">MS/Cow</TableHead>
                      <TableHead className="text-right">MS/Ha</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">Profit/Ha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.map(m => (
                      <TableRow key={m.farmId}>
                        <TableCell className="font-medium">{m.farmName}</TableCell>
                        <TableCell className="text-right">{m.totalMilkSolids.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{m.milkSolidsPerCow}</TableCell>
                        <TableCell className="text-right">{m.milkSolidsPerHa}</TableCell>
                        <TableCell className="text-right">${m.totalRevenue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${m.totalCosts.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">${m.netProfit.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${m.profitPerHa}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-bold">
                      <TableCell>TOTAL</TableCell>
                      <TableCell className="text-right">{totalMs.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{Math.round(totalMs / totalStock)}</TableCell>
                      <TableCell className="text-right">{Math.round(totalMs / farms.reduce((s: number, f: Farm) => s + f.effectiveArea, 0))}</TableCell>
                      <TableCell className="text-right">${totalRevenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${metrics.reduce((s, m) => s + m.totalCosts, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right text-green-600">${totalProfit.toLocaleString()}</TableCell>
                      <TableCell className="text-right">${Math.round(totalProfit / farms.reduce((s: number, f: Farm) => s + f.effectiveArea, 0))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Access Management</CardTitle>
                    <CardDescription>Manage user permissions across farms</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowInviteUser(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Farm Access</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>JS</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">John Smith</span>
                        </div>
                      </TableCell>
                      <TableCell>john@example.com</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant="outline">All Farms</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-purple-500">Owner</Badge>
                      </TableCell>
                      <TableCell>Just now</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>SJ</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">Sarah Johnson</span>
                        </div>
                      </TableCell>
                      <TableCell>sarah@example.com</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant="outline">Greenfields</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500">Manager</Badge>
                      </TableCell>
                      <TableCell>2 hours ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>MW</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">Mike Williams</span>
                        </div>
                      </TableCell>
                      <TableCell>mike@example.com</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant="outline">Hilltop</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-blue-500">Manager</Badge>
                      </TableCell>
                      <TableCell>Yesterday</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>AC</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">Amy Chen</span>
                        </div>
                      </TableCell>
                      <TableCell>amy@accounting.com</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Badge variant="outline">All Farms</Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-amber-500">Accountant</Badge>
                      </TableCell>
                      <TableCell>3 days ago</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Farm Dialog */}
      <Dialog open={showAddFarm} onOpenChange={setShowAddFarm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Farm</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Farm Name</Label>
              <Input placeholder="e.g., Greenfields Dairy" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Farm Code</Label>
                <Input placeholder="e.g., GFD" maxLength={4} />
              </div>
              <div>
                <Label>Farm Type</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dairy">Dairy</SelectItem>
                    <SelectItem value="beef">Beef</SelectItem>
                    <SelectItem value="sheep">Sheep</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input placeholder="Farm address" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Region</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="waikato">Waikato</SelectItem>
                    <SelectItem value="canterbury">Canterbury</SelectItem>
                    <SelectItem value="southland">Southland</SelectItem>
                    <SelectItem value="taranaki">Taranaki</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total Area (ha)</Label>
                <Input type="number" placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>NAIT Location #</Label>
                <Input placeholder="12345678" />
              </div>
              <div>
                <Label>Fonterra Supplier #</Label>
                <Input placeholder="F001234" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFarm(false)}>Cancel</Button>
            <Button onClick={() => { setShowAddFarm(false); toast.success('Farm added successfully'); }}>Add Farm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite User Dialog */}
      <Dialog open={showInviteUser} onOpenChange={setShowInviteUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input type="email" placeholder="user@example.com" />
            </div>
            <div>
              <Label>Role</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="accountant">Accountant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Farm Access</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select farms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Farms</SelectItem>
                  <SelectItem value="farm-001">Greenfields Dairy</SelectItem>
                  <SelectItem value="farm-002">Riverside Farm</SelectItem>
                  <SelectItem value="farm-003">Hilltop Station</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteUser(false)}>Cancel</Button>
            <Button onClick={() => { setShowInviteUser(false); toast.success('Invitation sent'); }}>Send Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
