import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { DollarSign, Plus, TrendingUp, TrendingDown, Receipt, FileText, PieChart, BarChart3, Calendar, Briefcase, Car, Wrench, Fuel, Users, Package, AlertTriangle, CheckCircle2, Download, Filter, ArrowUpRight, ArrowDownRight } from 'lucide-react';

// Interfaces
interface Budget {
  id: string; category: string; name: string; allocated: number; spent: number; period: 'monthly' | 'quarterly' | 'annual';
}

interface Expense {
  id: string; date: string; category: string; subcategory?: string; description: string; amount: number;
  vendor?: string; invoiceNumber?: string; jobId?: string; jobTitle?: string; assetId?: string; assetName?: string;
  paymentMethod?: string; status: 'pending' | 'paid' | 'overdue'; notes?: string;
}

interface JobCost {
  id: string; jobId: string; jobTitle: string; date: string; laborHours: number; laborRate: number; laborCost: number;
  materialsCost: number; equipmentCost: number; otherCost: number; totalCost: number; status: 'estimated' | 'actual';
}

interface VehicleCost {
  id: string; assetId: string; assetName: string; period: string; fuelCost: number; maintenanceCost: number;
  registrationCost: number; insuranceCost: number; repairsCost: number; totalCost: number; distanceKm?: number; hoursUsed?: number;
}

// Mock Data
const mockBudgets: Budget[] = [
  { id: 'b1', category: 'operations', name: 'Feed & Nutrition', allocated: 45000, spent: 38500, period: 'annual' },
  { id: 'b2', category: 'operations', name: 'Veterinary & Health', allocated: 15000, spent: 12200, period: 'annual' },
  { id: 'b3', category: 'operations', name: 'Fuel & Energy', allocated: 18000, spent: 14800, period: 'annual' },
  { id: 'b4', category: 'maintenance', name: 'Equipment Maintenance', allocated: 12000, spent: 9500, period: 'annual' },
  { id: 'b5', category: 'maintenance', name: 'Vehicle Running Costs', allocated: 8000, spent: 6200, period: 'annual' },
  { id: 'b6', category: 'labor', name: 'Wages & Contractors', allocated: 85000, spent: 72000, period: 'annual' },
  { id: 'b7', category: 'admin', name: 'Insurance & Compliance', allocated: 12000, spent: 11500, period: 'annual' },
  { id: 'b8', category: 'capital', name: 'Capital Improvements', allocated: 25000, spent: 18000, period: 'annual' },
];

const mockExpenses: Expense[] = [
  { id: 'e1', date: '2024-01-18', category: 'fuel', description: 'Diesel - Farm Tank Refill', amount: 1850, vendor: 'Z Energy', invoiceNumber: 'INV-2024-0118', status: 'paid' },
  { id: 'e2', date: '2024-01-17', category: 'veterinary', description: 'Cattle vaccination - 120 head', amount: 2400, vendor: 'Rural Vets Ltd', jobId: 'job-1', jobTitle: 'Annual Vaccination Program', status: 'paid' },
  { id: 'e3', date: '2024-01-16', category: 'maintenance', description: 'Tractor service - John Deere 6130R', amount: 770, vendor: 'Farm Machinery Services', assetId: 'asset-1', assetName: 'John Deere 6130R', status: 'paid' },
  { id: 'e4', date: '2024-01-15', category: 'feed', description: 'Hay bales - 50 units', amount: 1250, vendor: 'Local Hay Supplies', status: 'paid' },
  { id: 'e5', date: '2024-01-14', category: 'labor', description: 'Contractor - Fencing repair', amount: 1800, vendor: 'Rural Fencing Co', jobId: 'job-2', jobTitle: 'Back Paddock Fence Repair', status: 'pending' },
  { id: 'e6', date: '2024-01-12', category: 'supplies', description: 'Fencing materials', amount: 650, vendor: 'Farm Supplies NZ', jobId: 'job-2', jobTitle: 'Back Paddock Fence Repair', status: 'paid' },
  { id: 'e7', date: '2024-01-10', category: 'maintenance', description: 'Hilux service - 45,000km', amount: 630, vendor: 'Toyota Dealer', assetId: 'asset-3', assetName: 'Toyota Hilux SR5', status: 'paid' },
  { id: 'e8', date: '2024-01-08', category: 'utilities', description: 'Electricity - December', amount: 420, vendor: 'Mercury Energy', invoiceNumber: 'DEC-2023-001', status: 'paid' },
];

const mockJobCosts: JobCost[] = [
  { id: 'jc1', jobId: 'job-1', jobTitle: 'Annual Vaccination Program', date: '2024-01-17', laborHours: 8, laborRate: 35, laborCost: 280, materialsCost: 2400, equipmentCost: 50, otherCost: 0, totalCost: 2730, status: 'actual' },
  { id: 'jc2', jobId: 'job-2', jobTitle: 'Back Paddock Fence Repair', date: '2024-01-14', laborHours: 16, laborRate: 45, laborCost: 720, materialsCost: 650, equipmentCost: 120, otherCost: 1800, totalCost: 3290, status: 'actual' },
  { id: 'jc3', jobId: 'job-3', jobTitle: 'Hay Baling - North Paddock', date: '2024-01-12', laborHours: 12, laborRate: 35, laborCost: 420, materialsCost: 0, equipmentCost: 380, otherCost: 0, totalCost: 800, status: 'actual' },
  { id: 'jc4', jobId: 'job-4', jobTitle: 'Water System Maintenance', date: '2024-01-20', laborHours: 4, laborRate: 35, laborCost: 140, materialsCost: 200, equipmentCost: 0, otherCost: 0, totalCost: 340, status: 'estimated' },
  { id: 'jc5', jobId: 'job-5', jobTitle: 'Pasture Renovation - East Block', date: '2024-02-01', laborHours: 24, laborRate: 35, laborCost: 840, materialsCost: 1500, equipmentCost: 600, otherCost: 0, totalCost: 2940, status: 'estimated' },
];

const mockVehicleCosts: VehicleCost[] = [
  { id: 'vc1', assetId: 'asset-1', assetName: 'John Deere 6130R', period: '2024-01', fuelCost: 633, maintenanceCost: 770, registrationCost: 0, insuranceCost: 180, repairsCost: 0, totalCost: 1583, hoursUsed: 85 },
  { id: 'vc2', assetId: 'asset-2', assetName: 'Massey Ferguson 5711', period: '2024-01', fuelCost: 555, maintenanceCost: 0, registrationCost: 0, insuranceCost: 165, repairsCost: 0, totalCost: 720, hoursUsed: 62 },
  { id: 'vc3', assetId: 'asset-3', assetName: 'Toyota Hilux SR5', period: '2024-01', fuelCost: 310, maintenanceCost: 630, registrationCost: 0, insuranceCost: 145, repairsCost: 0, totalCost: 1085, distanceKm: 1850 },
  { id: 'vc4', assetId: 'asset-5', assetName: 'Honda TRX420 Quad', period: '2024-01', fuelCost: 88, maintenanceCost: 180, registrationCost: 0, insuranceCost: 45, repairsCost: 0, totalCost: 313, hoursUsed: 45 },
];

export default function FarmFinancePage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [budgets, setBudgets] = useState<Budget[]>(mockBudgets);
  const [expenses, setExpenses] = useState<Expense[]>(mockExpenses);
  const [jobCosts, setJobCosts] = useState<JobCost[]>(mockJobCosts);
  const [vehicleCosts] = useState<VehicleCost[]>(mockVehicleCosts);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isAddBudgetOpen, setIsAddBudgetOpen] = useState(false);
  const [dateRange, setDateRange] = useState('month');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [newExpense, setNewExpense] = useState({ date: format(new Date(), 'yyyy-MM-dd'), category: 'other', description: '', amount: 0, vendor: '', invoiceNumber: '', jobId: '', assetId: '', notes: '' });
  const [newBudget, setNewBudget] = useState({ category: 'operations', name: '', allocated: 0, period: 'annual' as Budget['period'] });

  // Stats
  const totalBudget = budgets.reduce((s, b) => s + b.allocated, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const budgetRemaining = totalBudget - totalSpent;
  const budgetUsedPercent = (totalSpent / totalBudget) * 100;

  const monthExpenses = expenses.filter(e => new Date(e.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).reduce((s, e) => s + e.amount, 0);
  const pendingExpenses = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
  const jobCostsTotal = jobCosts.filter(j => j.status === 'actual').reduce((s, j) => s + j.totalCost, 0);
  const vehicleCostsTotal = vehicleCosts.reduce((s, v) => s + v.totalCost, 0);

  const handleAddExpense = () => {
    const expense: Expense = { id: `e-${Date.now()}`, ...newExpense, status: 'pending' };
    setExpenses([expense, ...expenses]);
    setIsAddExpenseOpen(false);
    setNewExpense({ date: format(new Date(), 'yyyy-MM-dd'), category: 'other', description: '', amount: 0, vendor: '', invoiceNumber: '', jobId: '', assetId: '', notes: '' });
    toast.success('Expense added');
  };

  const handleAddBudget = () => {
    const budget: Budget = { id: `b-${Date.now()}`, ...newBudget, spent: 0 };
    setBudgets([...budgets, budget]);
    setIsAddBudgetOpen(false);
    setNewBudget({ category: 'operations', name: '', allocated: 0, period: 'annual' });
    toast.success('Budget created');
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = { fuel: 'bg-yellow-100 text-yellow-800', veterinary: 'bg-red-100 text-red-800', maintenance: 'bg-blue-100 text-blue-800', feed: 'bg-green-100 text-green-800', labor: 'bg-purple-100 text-purple-800', supplies: 'bg-orange-100 text-orange-800', utilities: 'bg-cyan-100 text-cyan-800', insurance: 'bg-indigo-100 text-indigo-800' };
    return colors[cat] || 'bg-gray-100 text-gray-800';
  };

  const getBudgetStatus = (b: Budget) => {
    const pct = (b.spent / b.allocated) * 100;
    if (pct >= 100) return { color: 'text-red-600', bg: 'bg-red-500', status: 'Over Budget' };
    if (pct >= 90) return { color: 'text-orange-600', bg: 'bg-orange-500', status: 'Near Limit' };
    if (pct >= 75) return { color: 'text-yellow-600', bg: 'bg-yellow-500', status: 'On Track' };
    return { color: 'text-green-600', bg: 'bg-green-500', status: 'Under Budget' };
  };

  const filteredExpenses = expenses.filter(e => categoryFilter === 'all' || e.category === categoryFilter);

  const expensesByCategory = expenses.reduce((acc, e) => { acc[e.category] = (acc[e.category] || 0) + e.amount; return acc; }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><DollarSign className="h-6 w-6 text-green-600" /></div>
              <div><h1 className="text-2xl font-bold text-gray-900">Farm Finance</h1><p className="text-sm text-gray-500">Budgets, expenses, and cost tracking</p></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
              <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                <DialogTrigger asChild><Button className="bg-green-600 hover:bg-green-700"><Plus className="h-4 w-4 mr-2" />Add Expense</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Date</Label><Input type="date" value={newExpense.date} onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} /></div>
                      <div><Label>Category</Label><Select value={newExpense.category} onValueChange={(v) => setNewExpense({ ...newExpense, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fuel">Fuel</SelectItem><SelectItem value="veterinary">Veterinary</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="feed">Feed</SelectItem><SelectItem value="labor">Labor</SelectItem><SelectItem value="supplies">Supplies</SelectItem><SelectItem value="utilities">Utilities</SelectItem><SelectItem value="insurance">Insurance</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select></div>
                    </div>
                    <div><Label>Description</Label><Input value={newExpense.description} onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Amount ($)</Label><Input type="number" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label>Vendor</Label><Input value={newExpense.vendor} onChange={(e) => setNewExpense({ ...newExpense, vendor: e.target.value })} /></div>
                    </div>
                    <div><Label>Invoice #</Label><Input value={newExpense.invoiceNumber} onChange={(e) => setNewExpense({ ...newExpense, invoiceNumber: e.target.value })} /></div>
                    <div><Label>Notes</Label><Textarea value={newExpense.notes} onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })} rows={2} /></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsAddExpenseOpen(false)}>Cancel</Button><Button onClick={handleAddExpense} disabled={!newExpense.description || newExpense.amount <= 0}>Add</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="budgets">Budgets</TabsTrigger><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="job-costs">Job Costs</TabsTrigger><TabsTrigger value="vehicle-costs">Vehicle Costs</TabsTrigger><TabsTrigger value="reports">Reports</TabsTrigger></TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Annual Budget</p><p className="text-2xl font-bold">${totalBudget.toLocaleString()}</p></div><PieChart className="h-8 w-8 text-gray-200" /></div><div className="mt-2"><Progress value={budgetUsedPercent} className="h-2" /><p className="text-xs text-gray-500 mt-1">{budgetUsedPercent.toFixed(0)}% used</p></div></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Month Expenses</p><p className="text-2xl font-bold text-red-600">${monthExpenses.toLocaleString()}</p></div><TrendingDown className="h-8 w-8 text-red-200" /></div><p className="text-xs text-gray-400 mt-1">${pendingExpenses.toLocaleString()} pending</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Job Costs (MTD)</p><p className="text-2xl font-bold text-blue-600">${jobCostsTotal.toLocaleString()}</p></div><Briefcase className="h-8 w-8 text-blue-200" /></div><p className="text-xs text-gray-400 mt-1">{jobCosts.filter(j => j.status === 'actual').length} jobs tracked</p></CardContent></Card>
              <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">Vehicle Costs (MTD)</p><p className="text-2xl font-bold text-orange-600">${vehicleCostsTotal.toLocaleString()}</p></div><Car className="h-8 w-8 text-orange-200" /></div><p className="text-xs text-gray-400 mt-1">{vehicleCosts.length} vehicles</p></CardContent></Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-600" />Budget Alerts</CardTitle></CardHeader><CardContent><div className="space-y-3">{budgets.filter(b => (b.spent / b.allocated) >= 0.85).map(b => { const status = getBudgetStatus(b); return (<div key={b.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p className="font-medium text-sm">{b.name}</p><p className="text-xs text-gray-500">${b.spent.toLocaleString()} of ${b.allocated.toLocaleString()}</p></div><Badge className={status.color === 'text-red-600' ? 'bg-red-100 text-red-800' : 'bg-orange-100 text-orange-800'}>{status.status}</Badge></div>); })}{budgets.filter(b => (b.spent / b.allocated) >= 0.85).length === 0 && <p className="text-sm text-gray-500 text-center py-4">All budgets on track</p>}</div></CardContent></Card>

              <Card><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Receipt className="h-5 w-5 text-green-600" />Recent Expenses</CardTitle></CardHeader><CardContent><div className="space-y-3">{expenses.slice(0, 5).map(e => (<div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div className="flex items-center gap-3"><Badge className={getCategoryColor(e.category)}>{e.category}</Badge><div><p className="font-medium text-sm">{e.description}</p><p className="text-xs text-gray-500">{e.vendor} • {format(new Date(e.date), 'MMM d')}</p></div></div><p className="font-bold">${e.amount.toLocaleString()}</p></div>))}</div></CardContent></Card>
            </div>

            <Card><CardHeader><CardTitle className="text-lg">Expenses by Category</CardTitle></CardHeader><CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (<div key={cat} className="p-4 border rounded-lg"><div className="flex items-center justify-between mb-2"><Badge className={getCategoryColor(cat)}>{cat}</Badge></div><p className="text-2xl font-bold">${amt.toLocaleString()}</p><p className="text-xs text-gray-500">{((amt / expenses.reduce((s, e) => s + e.amount, 0)) * 100).toFixed(0)}% of total</p></div>))}</div></CardContent></Card>
          </TabsContent>

          {/* Budgets */}
          <TabsContent value="budgets" className="space-y-4">
            <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Budget Management</h2>
              <Dialog open={isAddBudgetOpen} onOpenChange={setIsAddBudgetOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Budget</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create Budget</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-4">
                    <div><Label>Category</Label><Select value={newBudget.category} onValueChange={(v) => setNewBudget({ ...newBudget, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="operations">Operations</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="labor">Labor</SelectItem><SelectItem value="admin">Admin</SelectItem><SelectItem value="capital">Capital</SelectItem></SelectContent></Select></div>
                    <div><Label>Name</Label><Input value={newBudget.name} onChange={(e) => setNewBudget({ ...newBudget, name: e.target.value })} placeholder="e.g., Feed & Nutrition" /></div>
                    <div className="grid grid-cols-2 gap-4"><div><Label>Amount ($)</Label><Input type="number" value={newBudget.allocated} onChange={(e) => setNewBudget({ ...newBudget, allocated: parseFloat(e.target.value) || 0 })} /></div><div><Label>Period</Label><Select value={newBudget.period} onValueChange={(v: any) => setNewBudget({ ...newBudget, period: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="annual">Annual</SelectItem></SelectContent></Select></div></div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setIsAddBudgetOpen(false)}>Cancel</Button><Button onClick={handleAddBudget} disabled={!newBudget.name || newBudget.allocated <= 0}>Create</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="bg-blue-50"><CardContent className="p-4 text-center"><p className="text-sm text-blue-600">Total Budget</p><p className="text-3xl font-bold text-blue-700">${totalBudget.toLocaleString()}</p></CardContent></Card>
              <Card className="bg-red-50"><CardContent className="p-4 text-center"><p className="text-sm text-red-600">Total Spent</p><p className="text-3xl font-bold text-red-700">${totalSpent.toLocaleString()}</p></CardContent></Card>
              <Card className="bg-green-50"><CardContent className="p-4 text-center"><p className="text-sm text-green-600">Remaining</p><p className="text-3xl font-bold text-green-700">${budgetRemaining.toLocaleString()}</p></CardContent></Card>
            </div>

            <div className="space-y-4">{budgets.map(b => { const status = getBudgetStatus(b); const pct = (b.spent / b.allocated) * 100; return (<Card key={b.id}><CardContent className="p-4"><div className="flex items-center justify-between mb-3"><div><h3 className="font-semibold">{b.name}</h3><p className="text-sm text-gray-500 capitalize">{b.category} • {b.period}</p></div><Badge className={status.color === 'text-red-600' ? 'bg-red-100 text-red-800' : status.color === 'text-orange-600' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'}>{status.status}</Badge></div><div className="flex items-center gap-4"><div className="flex-1"><Progress value={Math.min(pct, 100)} className={`h-3 ${pct >= 100 ? '[&>div]:bg-red-500' : pct >= 90 ? '[&>div]:bg-orange-500' : '[&>div]:bg-green-500'}`} /></div><div className="text-right min-w-[120px]"><p className="font-bold">${b.spent.toLocaleString()} <span className="text-gray-400 font-normal">/ ${b.allocated.toLocaleString()}</span></p><p className="text-xs text-gray-500">{pct.toFixed(0)}% used</p></div></div></CardContent></Card>); })}</div>
          </TabsContent>

          {/* Expenses */}
          <TabsContent value="expenses" className="space-y-4">
            <div className="flex flex-wrap gap-3"><Input placeholder="Search expenses..." className="flex-1 min-w-[200px]" /><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger><SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="fuel">Fuel</SelectItem><SelectItem value="veterinary">Veterinary</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem><SelectItem value="feed">Feed</SelectItem><SelectItem value="labor">Labor</SelectItem><SelectItem value="supplies">Supplies</SelectItem></SelectContent></Select><Select value={dateRange} onValueChange={setDateRange}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">This Week</SelectItem><SelectItem value="month">This Month</SelectItem><SelectItem value="quarter">This Quarter</SelectItem><SelectItem value="year">This Year</SelectItem></SelectContent></Select></div>

            <Card><CardContent className="p-0"><table className="w-full"><thead className="bg-gray-50"><tr><th className="text-left p-4 text-sm font-medium">Date</th><th className="text-left p-4 text-sm font-medium">Category</th><th className="text-left p-4 text-sm font-medium">Description</th><th className="text-left p-4 text-sm font-medium">Vendor</th><th className="text-left p-4 text-sm font-medium">Linked To</th><th className="text-right p-4 text-sm font-medium">Amount</th><th className="text-left p-4 text-sm font-medium">Status</th></tr></thead><tbody className="divide-y">{filteredExpenses.map(e => (<tr key={e.id}><td className="p-4 text-sm">{format(new Date(e.date), 'MMM d, yyyy')}</td><td className="p-4"><Badge className={getCategoryColor(e.category)}>{e.category}</Badge></td><td className="p-4 text-sm font-medium">{e.description}</td><td className="p-4 text-sm text-gray-500">{e.vendor || '-'}</td><td className="p-4 text-sm">{e.jobTitle ? <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{e.jobTitle}</span> : e.assetName ? <span className="flex items-center gap-1"><Car className="h-3 w-3" />{e.assetName}</span> : '-'}</td><td className="p-4 text-sm text-right font-bold">${e.amount.toLocaleString()}</td><td className="p-4"><Badge variant={e.status === 'paid' ? 'default' : 'secondary'}>{e.status}</Badge></td></tr>))}</tbody></table></CardContent></Card>
          </TabsContent>

          {/* Job Costs */}
          <TabsContent value="job-costs" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Job Costs</p><p className="text-3xl font-bold">${jobCosts.reduce((s, j) => s + j.totalCost, 0).toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Labor Costs</p><p className="text-3xl font-bold text-purple-600">${jobCosts.reduce((s, j) => s + j.laborCost, 0).toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Materials</p><p className="text-3xl font-bold text-blue-600">${jobCosts.reduce((s, j) => s + j.materialsCost, 0).toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Equipment</p><p className="text-3xl font-bold text-orange-600">${jobCosts.reduce((s, j) => s + j.equipmentCost, 0).toLocaleString()}</p></CardContent></Card>
            </div>

            <Card><CardContent className="p-0"><table className="w-full"><thead className="bg-gray-50"><tr><th className="text-left p-4 text-sm font-medium">Job</th><th className="text-left p-4 text-sm font-medium">Date</th><th className="text-right p-4 text-sm font-medium">Labor</th><th className="text-right p-4 text-sm font-medium">Materials</th><th className="text-right p-4 text-sm font-medium">Equipment</th><th className="text-right p-4 text-sm font-medium">Other</th><th className="text-right p-4 text-sm font-medium">Total</th><th className="text-left p-4 text-sm font-medium">Status</th></tr></thead><tbody className="divide-y">{jobCosts.map(j => (<tr key={j.id}><td className="p-4"><p className="font-medium text-sm">{j.jobTitle}</p><p className="text-xs text-gray-500">{j.laborHours}h @ ${j.laborRate}/h</p></td><td className="p-4 text-sm">{format(new Date(j.date), 'MMM d')}</td><td className="p-4 text-sm text-right">${j.laborCost}</td><td className="p-4 text-sm text-right">${j.materialsCost}</td><td className="p-4 text-sm text-right">${j.equipmentCost}</td><td className="p-4 text-sm text-right">${j.otherCost}</td><td className="p-4 text-sm text-right font-bold">${j.totalCost.toLocaleString()}</td><td className="p-4"><Badge variant={j.status === 'actual' ? 'default' : 'secondary'}>{j.status}</Badge></td></tr>))}</tbody></table></CardContent></Card>
          </TabsContent>

          {/* Vehicle Costs */}
          <TabsContent value="vehicle-costs" className="space-y-4">
            <div className="grid md:grid-cols-4 gap-4 mb-6">
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Total Vehicle Costs</p><p className="text-3xl font-bold">${vehicleCostsTotal.toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Fuel</p><p className="text-3xl font-bold text-yellow-600">${vehicleCosts.reduce((s, v) => s + v.fuelCost, 0).toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Maintenance</p><p className="text-3xl font-bold text-blue-600">${vehicleCosts.reduce((s, v) => s + v.maintenanceCost, 0).toLocaleString()}</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-sm text-gray-500">Insurance</p><p className="text-3xl font-bold text-purple-600">${vehicleCosts.reduce((s, v) => s + v.insuranceCost, 0).toLocaleString()}</p></CardContent></Card>
            </div>

            <Card><CardContent className="p-0"><table className="w-full"><thead className="bg-gray-50"><tr><th className="text-left p-4 text-sm font-medium">Vehicle/Equipment</th><th className="text-left p-4 text-sm font-medium">Period</th><th className="text-right p-4 text-sm font-medium">Fuel</th><th className="text-right p-4 text-sm font-medium">Maintenance</th><th className="text-right p-4 text-sm font-medium">Insurance</th><th className="text-right p-4 text-sm font-medium">Repairs</th><th className="text-right p-4 text-sm font-medium">Total</th><th className="text-right p-4 text-sm font-medium">Usage</th></tr></thead><tbody className="divide-y">{vehicleCosts.map(v => (<tr key={v.id}><td className="p-4 font-medium text-sm">{v.assetName}</td><td className="p-4 text-sm">{v.period}</td><td className="p-4 text-sm text-right">${v.fuelCost}</td><td className="p-4 text-sm text-right">${v.maintenanceCost}</td><td className="p-4 text-sm text-right">${v.insuranceCost}</td><td className="p-4 text-sm text-right">${v.repairsCost}</td><td className="p-4 text-sm text-right font-bold">${v.totalCost.toLocaleString()}</td><td className="p-4 text-sm text-right text-gray-500">{v.distanceKm ? `${v.distanceKm} km` : v.hoursUsed ? `${v.hoursUsed} hrs` : '-'}</td></tr>))}</tbody></table></CardContent></Card>

            <Card><CardHeader><CardTitle className="text-lg">Cost per Unit</CardTitle></CardHeader><CardContent><div className="grid md:grid-cols-4 gap-4">{vehicleCosts.map(v => { const costPerUnit = v.distanceKm ? (v.totalCost / v.distanceKm) : v.hoursUsed ? (v.totalCost / v.hoursUsed) : 0; const unit = v.distanceKm ? '/km' : '/hr'; return (<div key={v.id} className="p-4 border rounded-lg"><p className="font-medium text-sm">{v.assetName}</p><p className="text-2xl font-bold mt-2">${costPerUnit.toFixed(2)}<span className="text-sm text-gray-500">{unit}</span></p><p className="text-xs text-gray-500 mt-1">{v.distanceKm ? `${v.distanceKm} km` : `${v.hoursUsed} hours`} this period</p></div>); })}</div></CardContent></Card>
          </TabsContent>

          {/* Reports */}
          <TabsContent value="reports" className="space-y-4">
            <div className="grid md:grid-cols-3 gap-6">
              <Card className="cursor-pointer hover:shadow-md transition-shadow"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-600" />Expense Summary</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500 mb-4">Monthly breakdown of all expenses by category</p><Button variant="outline" className="w-full">Generate Report</Button></CardContent></Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Briefcase className="h-5 w-5 text-green-600" />Job Cost Analysis</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500 mb-4">Labor, materials, and equipment costs per job</p><Button variant="outline" className="w-full">Generate Report</Button></CardContent></Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Car className="h-5 w-5 text-orange-600" />Vehicle Running Costs</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500 mb-4">Fuel, maintenance, and total cost per vehicle</p><Button variant="outline" className="w-full">Generate Report</Button></CardContent></Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><PieChart className="h-5 w-5 text-purple-600" />Budget vs Actual</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500 mb-4">Compare budgeted amounts to actual spending</p><Button variant="outline" className="w-full">Generate Report</Button></CardContent></Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Wrench className="h-5 w-5 text-red-600" />Maintenance Expenses</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500 mb-4">All maintenance costs by asset and type</p><Button variant="outline" className="w-full">Generate Report</Button></CardContent></Card>
              <Card className="cursor-pointer hover:shadow-md transition-shadow"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><TrendingUp className="h-5 w-5 text-cyan-600" />Year-over-Year</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500 mb-4">Compare expenses across financial years</p><Button variant="outline" className="w-full">Generate Report</Button></CardContent></Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
