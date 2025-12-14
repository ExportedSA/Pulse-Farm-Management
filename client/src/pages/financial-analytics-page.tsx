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
import { Skeleton } from '@/components/ui/skeleton';
import { format, subMonths } from 'date-fns';
import { toast } from 'sonner';
import {
  DollarSign, TrendingUp, TrendingDown, BarChart3, PieChart, Calculator,
  Target, ArrowUpRight, ArrowDownRight, Minus, Calendar, Download,
  Filter, RefreshCw, AlertTriangle, CheckCircle2, Info, Layers,
  Beef, Milk, Users, Leaf, Pill, Fuel, Wrench, Package, ChevronRight
} from 'lucide-react';

// Interfaces
interface CostCategory {
  id: string;
  name: string;
  icon: string;
  currentPeriod: number;
  previousPeriod: number;
  budget: number;
  subcategories: { name: string; amount: number }[];
}

interface ProfitabilityData {
  id: string;
  name: string;
  type: 'animal' | 'mob' | 'paddock';
  revenue: number;
  costs: number;
  grossMargin: number;
  marginPercent: number;
  units?: number;
  costPerUnit?: number;
}

interface SeasonComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

interface ProductionCost {
  product: string;
  unit: string;
  totalCost: number;
  totalProduction: number;
  costPerUnit: number;
  industryAvg: number;
  variance: number;
}

// Mock Data
const mockCostCategories: CostCategory[] = [
  { id: 'feed', name: 'Feed & Nutrition', icon: 'leaf', currentPeriod: 45200, previousPeriod: 42800, budget: 48000, subcategories: [{ name: 'Hay & Silage', amount: 22500 }, { name: 'Grain & Concentrates', amount: 15200 }, { name: 'Supplements', amount: 4800 }, { name: 'Minerals', amount: 2700 }] },
  { id: 'animal-health', name: 'Animal Health', icon: 'pill', currentPeriod: 18500, previousPeriod: 16200, budget: 20000, subcategories: [{ name: 'Veterinary Services', amount: 8200 }, { name: 'Medicines', amount: 5800 }, { name: 'Vaccinations', amount: 3200 }, { name: 'Testing', amount: 1300 }] },
  { id: 'labor', name: 'Labor', icon: 'users', currentPeriod: 72000, previousPeriod: 68500, budget: 75000, subcategories: [{ name: 'Permanent Staff', amount: 52000 }, { name: 'Casual Labor', amount: 12000 }, { name: 'Contractors', amount: 8000 }] },
  { id: 'fuel', name: 'Fuel & Energy', icon: 'fuel', currentPeriod: 14800, previousPeriod: 13200, budget: 16000, subcategories: [{ name: 'Diesel', amount: 9500 }, { name: 'Electricity', amount: 4200 }, { name: 'LPG', amount: 1100 }] },
  { id: 'repairs', name: 'Repairs & Maintenance', icon: 'wrench', currentPeriod: 12500, previousPeriod: 15800, budget: 14000, subcategories: [{ name: 'Vehicle Repairs', amount: 4200 }, { name: 'Equipment', amount: 5100 }, { name: 'Buildings', amount: 3200 }] },
  { id: 'other', name: 'Other Operating', icon: 'package', currentPeriod: 8200, previousPeriod: 7500, budget: 9000, subcategories: [{ name: 'Insurance', amount: 4500 }, { name: 'Rates', amount: 2200 }, { name: 'Administration', amount: 1500 }] },
];

const mockProfitabilityByAnimal: ProfitabilityData[] = [
  { id: 'dairy-cows', name: 'Dairy Cows', type: 'mob', revenue: 285000, costs: 142000, grossMargin: 143000, marginPercent: 50.2, units: 180, costPerUnit: 789 },
  { id: 'beef-cattle', name: 'Beef Cattle', type: 'mob', revenue: 125000, costs: 68000, grossMargin: 57000, marginPercent: 45.6, units: 85, costPerUnit: 800 },
  { id: 'young-stock', name: 'Young Stock', type: 'mob', revenue: 42000, costs: 28000, grossMargin: 14000, marginPercent: 33.3, units: 45, costPerUnit: 622 },
  { id: 'bulls', name: 'Bulls', type: 'mob', revenue: 18000, costs: 12000, grossMargin: 6000, marginPercent: 33.3, units: 5, costPerUnit: 2400 },
];

const mockProfitabilityByPaddock: ProfitabilityData[] = [
  { id: 'paddock-north', name: 'North Block', type: 'paddock', revenue: 95000, costs: 42000, grossMargin: 53000, marginPercent: 55.8 },
  { id: 'paddock-south', name: 'South Block', type: 'paddock', revenue: 88000, costs: 45000, grossMargin: 43000, marginPercent: 48.9 },
  { id: 'paddock-east', name: 'East Flats', type: 'paddock', revenue: 72000, costs: 38000, grossMargin: 34000, marginPercent: 47.2 },
  { id: 'paddock-west', name: 'West Hills', type: 'paddock', revenue: 65000, costs: 42000, grossMargin: 23000, marginPercent: 35.4 },
  { id: 'paddock-home', name: 'Home Paddock', type: 'paddock', revenue: 150000, costs: 83000, grossMargin: 67000, marginPercent: 44.7 },
];

const mockSeasonComparison: SeasonComparison[] = [
  { metric: 'Total Revenue', current: 470000, previous: 425000, change: 45000, changePercent: 10.6 },
  { metric: 'Total Costs', current: 171200, previous: 164000, change: 7200, changePercent: 4.4 },
  { metric: 'Gross Margin', current: 298800, previous: 261000, change: 37800, changePercent: 14.5 },
  { metric: 'Cost per Animal', current: 543, previous: 528, change: 15, changePercent: 2.8 },
  { metric: 'Revenue per Hectare', current: 2350, previous: 2125, change: 225, changePercent: 10.6 },
  { metric: 'Labor Cost %', current: 15.3, previous: 16.1, change: -0.8, changePercent: -5.0 },
];

const mockProductionCosts: ProductionCost[] = [
  { product: 'Milk', unit: 'per kg MS', totalCost: 142000, totalProduction: 38500, costPerUnit: 3.69, industryAvg: 4.20, variance: -12.1 },
  { product: 'Beef', unit: 'per kg CW', totalCost: 68000, totalProduction: 12800, costPerUnit: 5.31, industryAvg: 5.85, variance: -9.2 },
  { product: 'Store Cattle', unit: 'per head', totalCost: 28000, totalProduction: 45, costPerUnit: 622, industryAvg: 680, variance: -8.5 },
];

export default function FinancialAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPeriod, setSelectedPeriod] = useState('ytd');
  const [selectedSeason, setSelectedSeason] = useState('2023-24');
  const [comparisonSeason, setComparisonSeason] = useState('2022-23');

  // Fetch financial analytics data from API
  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery({
    queryKey: ['/api/financial-analytics/dashboard', selectedPeriod],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = subMonths(endDate, selectedPeriod === 'ytd' ? 12 : selectedPeriod === 'quarter' ? 3 : 1);
      const res = await fetch(`/api/financial-analytics/dashboard?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`);
      if (!res.ok) throw new Error('Failed to fetch financial data');
      return res.json();
    },
  });

  const { data: cashFlowForecast } = useQuery({
    queryKey: ['/api/financial-analytics/cashflow-forecast'],
    queryFn: async () => {
      const res = await fetch('/api/financial-analytics/cashflow-forecast?months=12');
      if (!res.ok) throw new Error('Failed to fetch cash flow forecast');
      return res.json();
    },
  });

  const { data: enterpriseProfitability } = useQuery({
    queryKey: ['/api/financial-analytics/enterprise-profitability'],
    queryFn: async () => {
      const res = await fetch('/api/financial-analytics/enterprise-profitability');
      if (!res.ok) throw new Error('Failed to fetch enterprise profitability');
      return res.json();
    },
  });

  // Use API data or fallback to mock data
  const totalCosts = dashboardData?.summary?.totalCosts || mockCostCategories.reduce((s, c) => s + c.currentPeriod, 0);
  const totalBudget = mockCostCategories.reduce((s, c) => s + c.budget, 0);
  const totalPrevious = mockCostCategories.reduce((s, c) => s + c.previousPeriod, 0);
  const budgetVariance = totalBudget - totalCosts;
  const budgetVariancePercent = (budgetVariance / totalBudget) * 100;

  const totalRevenue = dashboardData?.summary?.totalRevenue || 470000;
  const grossMargin = dashboardData?.summary?.netProfit || (totalRevenue - totalCosts);
  const grossMarginPercent = dashboardData?.summary?.profitMargin || (grossMargin / totalRevenue) * 100;

  // Break-even calculation
  const fixedCosts = 95000; // Estimated fixed costs
  const variableCostPercent = 0.35;
  const breakEvenRevenue = fixedCosts / (1 - variableCostPercent);

  const getCostIcon = (icon: string) => {
    switch (icon) {
      case 'leaf': return <Leaf className="h-5 w-5" />;
      case 'pill': return <Pill className="h-5 w-5" />;
      case 'users': return <Users className="h-5 w-5" />;
      case 'fuel': return <Fuel className="h-5 w-5" />;
      case 'wrench': return <Wrench className="h-5 w-5" />;
      default: return <Package className="h-5 w-5" />;
    }
  };

  const getChangeIndicator = (change: number) => {
    if (change > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
    if (change < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getVarianceColor = (variance: number, isExpense: boolean = true) => {
    if (isExpense) {
      return variance >= 0 ? 'text-green-600' : 'text-red-600';
    }
    return variance >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Financial Analytics</h1>
                <p className="text-sm text-gray-500">Cost tracking, margins & profitability analysis</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mtd">Month to Date</SelectItem>
                  <SelectItem value="qtd">Quarter to Date</SelectItem>
                  <SelectItem value="ytd">Year to Date</SelectItem>
                  <SelectItem value="12m">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
              <Button variant="outline"><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="costs">Cost Tracking</TabsTrigger>
            <TabsTrigger value="margins">Gross Margins</TabsTrigger>
            <TabsTrigger value="profitability">Profitability</TabsTrigger>
            <TabsTrigger value="comparison">Season Comparison</TabsTrigger>
            <TabsTrigger value="breakeven">Break-Even</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Revenue</p>
                      <p className="text-2xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-200" />
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+10.6% vs last season</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Costs</p>
                      <p className="text-2xl font-bold text-red-600">${totalCosts.toLocaleString()}</p>
                    </div>
                    <TrendingDown className="h-8 w-8 text-red-200" />
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-orange-600">
                    <ArrowUpRight className="h-3 w-3" />
                    <span>+4.4% vs last season</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Gross Margin</p>
                      <p className="text-2xl font-bold text-emerald-600">${grossMargin.toLocaleString()}</p>
                    </div>
                    <PieChart className="h-8 w-8 text-emerald-200" />
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-emerald-600">
                    <span>{grossMarginPercent.toFixed(1)}% margin</span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Budget Variance</p>
                      <p className={`text-2xl font-bold ${budgetVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {budgetVariance >= 0 ? '+' : ''}${budgetVariance.toLocaleString()}
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-blue-200" />
                  </div>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                    <span>{budgetVariancePercent.toFixed(1)}% under budget</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Cost Breakdown & Production Costs */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockCostCategories.map(cat => {
                      const pct = (cat.currentPeriod / totalCosts) * 100;
                      const budgetPct = (cat.currentPeriod / cat.budget) * 100;
                      return (
                        <div key={cat.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-gray-100 rounded">{getCostIcon(cat.icon)}</div>
                              <span className="font-medium text-sm">{cat.name}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold">${cat.currentPeriod.toLocaleString()}</span>
                              <span className="text-xs text-gray-500 ml-2">({pct.toFixed(1)}%)</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={budgetPct} className={`h-2 flex-1 ${budgetPct > 100 ? '[&>div]:bg-red-500' : '[&>div]:bg-green-500'}`} />
                            <span className="text-xs text-gray-500 w-20 text-right">{budgetPct.toFixed(0)}% of budget</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cost of Production</CardTitle>
                  <CardDescription>Cost per unit vs industry average</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {mockProductionCosts.map(prod => (
                      <div key={prod.product} className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {prod.product === 'Milk' ? <Milk className="h-5 w-5 text-blue-600" /> : <Beef className="h-5 w-5 text-red-600" />}
                            <span className="font-medium">{prod.product}</span>
                          </div>
                          <Badge className={prod.variance < 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                            {prod.variance > 0 ? '+' : ''}{prod.variance.toFixed(1)}% vs avg
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Your Cost</p>
                            <p className="font-bold text-lg">${prod.costPerUnit.toFixed(2)}</p>
                            <p className="text-xs text-gray-400">{prod.unit}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Industry Avg</p>
                            <p className="font-bold text-lg">${prod.industryAvg.toFixed(2)}</p>
                            <p className="text-xs text-gray-400">{prod.unit}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Production</p>
                            <p className="font-bold text-lg">{prod.totalProduction.toLocaleString()}</p>
                            <p className="text-xs text-gray-400">{prod.unit.replace('per ', '')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Insights */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  Key Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-800">Strong Performance</span>
                    </div>
                    <p className="text-sm text-green-700">Milk production costs 12% below industry average. Gross margin improved 14.5% year-over-year.</p>
                  </div>
                  <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      <span className="font-medium text-yellow-800">Watch Area</span>
                    </div>
                    <p className="text-sm text-yellow-700">Animal health costs up 14% vs last season. Consider reviewing treatment protocols and supplier contracts.</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-800">Opportunity</span>
                    </div>
                    <p className="text-sm text-blue-700">West Hills paddock showing lowest margin at 35.4%. Consider soil testing and pasture renovation.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cost Tracking Tab */}
          <TabsContent value="costs" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Total Costs (YTD)</p><p className="text-3xl font-bold text-blue-700">${totalCosts.toLocaleString()}</p></CardContent></Card>
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Budget Remaining</p><p className="text-3xl font-bold text-green-700">${budgetVariance.toLocaleString()}</p></CardContent></Card>
              <Card className="bg-purple-50"><CardContent className="p-4 text-center"><p className="text-sm text-purple-600">vs Last Season</p><p className="text-3xl font-bold text-purple-700">+${(totalCosts - totalPrevious).toLocaleString()}</p></CardContent></Card>
            </div>

            <div className="space-y-4">
              {mockCostCategories.map(cat => {
                const budgetPct = (cat.currentPeriod / cat.budget) * 100;
                const vsLastSeason = cat.currentPeriod - cat.previousPeriod;
                const vsLastSeasonPct = (vsLastSeason / cat.previousPeriod) * 100;
                return (
                  <Card key={cat.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-lg ${budgetPct > 100 ? 'bg-red-100' : budgetPct > 90 ? 'bg-yellow-100' : 'bg-green-100'}`}>
                            {getCostIcon(cat.icon)}
                          </div>
                          <div>
                            <h3 className="font-semibold text-lg">{cat.name}</h3>
                            <p className="text-sm text-gray-500">{cat.subcategories.length} subcategories</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">${cat.currentPeriod.toLocaleString()}</p>
                          <p className={`text-sm ${vsLastSeason > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {vsLastSeason > 0 ? '+' : ''}{vsLastSeasonPct.toFixed(1)}% vs last season
                          </p>
                        </div>
                      </div>
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Budget: ${cat.budget.toLocaleString()}</span>
                          <span className={budgetPct > 100 ? 'text-red-600' : 'text-green-600'}>{budgetPct.toFixed(0)}% used</span>
                        </div>
                        <Progress value={Math.min(budgetPct, 100)} className={`h-3 ${budgetPct > 100 ? '[&>div]:bg-red-500' : budgetPct > 90 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'}`} />
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {cat.subcategories.map(sub => (
                          <div key={sub.name} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-500">{sub.name}</p>
                            <p className="font-semibold">${sub.amount.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* Gross Margins Tab */}
          <TabsContent value="margins" className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Gross Revenue</p><p className="text-3xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Costs</p><p className="text-3xl font-bold text-red-600">${totalCosts.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Gross Margin</p><p className="text-3xl font-bold text-emerald-600">${grossMargin.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Margin %</p><p className="text-3xl font-bold text-blue-600">{grossMarginPercent.toFixed(1)}%</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Gross Margin Calculator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium">Revenue Sources</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-green-50 rounded-lg"><span>Milk Sales</span><span className="font-bold">$285,000</span></div>
                      <div className="flex justify-between p-3 bg-green-50 rounded-lg"><span>Livestock Sales</span><span className="font-bold">$145,000</span></div>
                      <div className="flex justify-between p-3 bg-green-50 rounded-lg"><span>Other Income</span><span className="font-bold">$40,000</span></div>
                      <div className="flex justify-between p-3 bg-green-100 rounded-lg border-2 border-green-300"><span className="font-medium">Total Revenue</span><span className="font-bold text-green-700">${totalRevenue.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Cost Deductions</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between p-3 bg-red-50 rounded-lg"><span>Variable Costs</span><span className="font-bold">$108,500</span></div>
                      <div className="flex justify-between p-3 bg-red-50 rounded-lg"><span>Fixed Costs</span><span className="font-bold">$62,700</span></div>
                      <div className="flex justify-between p-3 bg-red-100 rounded-lg border-2 border-red-300"><span className="font-medium">Total Costs</span><span className="font-bold text-red-700">${totalCosts.toLocaleString()}</span></div>
                      <div className="flex justify-between p-3 bg-emerald-100 rounded-lg border-2 border-emerald-400"><span className="font-bold">Gross Margin</span><span className="font-bold text-emerald-700 text-xl">${grossMargin.toLocaleString()}</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Margin by Enterprise</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[{ name: 'Dairy', revenue: 285000, costs: 142000 }, { name: 'Beef', revenue: 145000, costs: 68000 }, { name: 'Other', revenue: 40000, costs: 18000 }].map(ent => {
                    const margin = ent.revenue - ent.costs;
                    const marginPct = (margin / ent.revenue) * 100;
                    return (
                      <div key={ent.name} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-lg">{ent.name}</h4>
                          <Badge className="bg-emerald-100 text-emerald-800">{marginPct.toFixed(1)}% margin</Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div><p className="text-sm text-gray-500">Revenue</p><p className="font-bold text-green-600">${ent.revenue.toLocaleString()}</p></div>
                          <div><p className="text-sm text-gray-500">Costs</p><p className="font-bold text-red-600">${ent.costs.toLocaleString()}</p></div>
                          <div><p className="text-sm text-gray-500">Margin</p><p className="font-bold text-emerald-600">${margin.toLocaleString()}</p></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profitability Tab */}
          <TabsContent value="profitability" className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Profitability by Mob/Class</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium">Mob/Class</th>
                        <th className="text-right p-4 text-sm font-medium">Head</th>
                        <th className="text-right p-4 text-sm font-medium">Revenue</th>
                        <th className="text-right p-4 text-sm font-medium">Costs</th>
                        <th className="text-right p-4 text-sm font-medium">Cost/Head</th>
                        <th className="text-right p-4 text-sm font-medium">Gross Margin</th>
                        <th className="text-right p-4 text-sm font-medium">Margin %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {mockProfitabilityByAnimal.map(item => (
                        <tr key={item.id} className="hover:bg-accent">
                          <td className="p-4 font-medium">{item.name}</td>
                          <td className="p-4 text-right">{item.units}</td>
                          <td className="p-4 text-right text-green-600">${item.revenue.toLocaleString()}</td>
                          <td className="p-4 text-right text-red-600">${item.costs.toLocaleString()}</td>
                          <td className="p-4 text-right">${item.costPerUnit?.toLocaleString()}</td>
                          <td className="p-4 text-right font-bold text-emerald-600">${item.grossMargin.toLocaleString()}</td>
                          <td className="p-4 text-right"><Badge className={item.marginPercent >= 45 ? 'bg-green-100 text-green-800' : item.marginPercent >= 35 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>{item.marginPercent.toFixed(1)}%</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Profitability by Paddock</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {mockProfitabilityByPaddock.map(item => (
                    <div key={item.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold">{item.name}</h4>
                        <Badge className={item.marginPercent >= 50 ? 'bg-green-100 text-green-800' : item.marginPercent >= 40 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>{item.marginPercent.toFixed(1)}%</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">Revenue</span><span className="text-green-600 font-medium">${item.revenue.toLocaleString()}</span></div>
                        <div className="flex justify-between"><span className="text-gray-500">Costs</span><span className="text-red-600 font-medium">${item.costs.toLocaleString()}</span></div>
                        <div className="flex justify-between border-t pt-2"><span className="font-medium">Gross Margin</span><span className="text-emerald-600 font-bold">${item.grossMargin.toLocaleString()}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Season Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <div className="flex gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Label>Current Season:</Label>
                <Select value={selectedSeason} onValueChange={setSelectedSeason}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2023-24">2023-24</SelectItem><SelectItem value="2022-23">2022-23</SelectItem><SelectItem value="2021-22">2021-22</SelectItem></SelectContent></Select>
              </div>
              <div className="flex items-center gap-2">
                <Label>Compare to:</Label>
                <Select value={comparisonSeason} onValueChange={setComparisonSeason}><SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="2022-23">2022-23</SelectItem><SelectItem value="2021-22">2021-22</SelectItem><SelectItem value="2020-21">2020-21</SelectItem></SelectContent></Select>
              </div>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Season-over-Season Comparison</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-4 text-sm font-medium">Metric</th>
                        <th className="text-right p-4 text-sm font-medium">{selectedSeason}</th>
                        <th className="text-right p-4 text-sm font-medium">{comparisonSeason}</th>
                        <th className="text-right p-4 text-sm font-medium">Change</th>
                        <th className="text-right p-4 text-sm font-medium">% Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {mockSeasonComparison.map(item => {
                        const isPositiveGood = !item.metric.includes('Cost');
                        const changeColor = (item.change > 0 && isPositiveGood) || (item.change < 0 && !isPositiveGood) ? 'text-green-600' : 'text-red-600';
                        return (
                          <tr key={item.metric} className="hover:bg-accent">
                            <td className="p-4 font-medium">{item.metric}</td>
                            <td className="p-4 text-right font-bold">{item.metric.includes('%') ? `${item.current}%` : `$${item.current.toLocaleString()}`}</td>
                            <td className="p-4 text-right text-gray-500">{item.metric.includes('%') ? `${item.previous}%` : `$${item.previous.toLocaleString()}`}</td>
                            <td className={`p-4 text-right font-medium ${changeColor}`}>
                              {item.change > 0 ? '+' : ''}{item.metric.includes('%') ? `${item.change}%` : `$${item.change.toLocaleString()}`}
                            </td>
                            <td className="p-4 text-right">
                              <Badge className={changeColor.includes('green') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                                {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(1)}%
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader><CardTitle className="text-lg text-green-600">Improvements</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /><div><p className="font-medium">Gross Margin +14.5%</p><p className="text-sm text-gray-600">Strong revenue growth outpaced cost increases</p></div></div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /><div><p className="font-medium">Revenue per Hectare +10.6%</p><p className="text-sm text-gray-600">Improved productivity across all paddocks</p></div></div>
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg"><CheckCircle2 className="h-5 w-5 text-green-600" /><div><p className="font-medium">Labor Cost % -5.0%</p><p className="text-sm text-gray-600">Better labor efficiency achieved</p></div></div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-lg text-red-600">Areas to Address</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /><div><p className="font-medium">Animal Health +14.2%</p><p className="text-sm text-gray-600">Review treatment protocols and supplier pricing</p></div></div>
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg"><AlertTriangle className="h-5 w-5 text-red-600" /><div><p className="font-medium">Fuel & Energy +12.1%</p><p className="text-sm text-gray-600">Consider energy efficiency improvements</p></div></div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Break-Even Tab */}
          <TabsContent value="breakeven" className="space-y-6">
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Break-Even Revenue</p><p className="text-3xl font-bold text-blue-700">${breakEvenRevenue.toLocaleString()}</p></CardContent></Card>
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Current Revenue</p><p className="text-3xl font-bold text-green-700">${totalRevenue.toLocaleString()}</p></CardContent></Card>
              <Card className="bg-emerald-50"><CardContent className="p-4 text-center"><p className="text-sm text-emerald-600">Safety Margin</p><p className="text-3xl font-bold text-emerald-700">${(totalRevenue - breakEvenRevenue).toLocaleString()}</p></CardContent></Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5" />Break-Even Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h4 className="font-medium">Cost Structure</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between mb-2"><span>Fixed Costs</span><span className="font-bold">${fixedCosts.toLocaleString()}</span></div>
                        <p className="text-xs text-gray-500">Labor, insurance, rates, depreciation</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between mb-2"><span>Variable Cost Ratio</span><span className="font-bold">{(variableCostPercent * 100).toFixed(0)}%</span></div>
                        <p className="text-xs text-gray-500">Feed, animal health, fuel per $ revenue</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <div className="flex justify-between mb-2"><span>Contribution Margin</span><span className="font-bold">{((1 - variableCostPercent) * 100).toFixed(0)}%</span></div>
                        <p className="text-xs text-gray-500">Revenue remaining after variable costs</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="font-medium">Break-Even Metrics</h4>
                    <div className="space-y-3">
                      <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                        <div className="flex justify-between mb-2"><span>Break-Even Revenue</span><span className="font-bold text-blue-700">${breakEvenRevenue.toLocaleString()}</span></div>
                        <p className="text-xs text-blue-600">Minimum revenue to cover all costs</p>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg border-2 border-green-200">
                        <div className="flex justify-between mb-2"><span>Current Position</span><span className="font-bold text-green-700">${(totalRevenue - breakEvenRevenue).toLocaleString()} above</span></div>
                        <p className="text-xs text-green-600">Safety margin: {((totalRevenue - breakEvenRevenue) / totalRevenue * 100).toFixed(1)}%</p>
                      </div>
                      <div className="p-4 bg-purple-50 rounded-lg">
                        <div className="flex justify-between mb-2"><span>Break-Even per Cow</span><span className="font-bold">${(breakEvenRevenue / 315).toFixed(0)}</span></div>
                        <p className="text-xs text-purple-600">Based on 315 total livestock units</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Scenario Analysis</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3 text-red-600">If Milk Price -10%</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>New Revenue</span><span>${(totalRevenue * 0.9).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>New Margin</span><span>${((totalRevenue * 0.9) - totalCosts).toLocaleString()}</span></div>
                      <div className="flex justify-between font-medium"><span>Still Profitable?</span><span className="text-green-600">Yes ✓</span></div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3 text-orange-600">If Feed Costs +20%</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>New Costs</span><span>${(totalCosts + 45200 * 0.2).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>New Margin</span><span>${(grossMargin - 45200 * 0.2).toLocaleString()}</span></div>
                      <div className="flex justify-between font-medium"><span>Still Profitable?</span><span className="text-green-600">Yes ✓</span></div>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3 text-purple-600">If Both Scenarios</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span>New Revenue</span><span>${(totalRevenue * 0.9).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>New Costs</span><span>${(totalCosts + 45200 * 0.2).toLocaleString()}</span></div>
                      <div className="flex justify-between font-medium"><span>Still Profitable?</span><span className="text-yellow-600">Marginal ⚠</span></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
